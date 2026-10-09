import {
  collection,
  doc,
  deleteDoc,
  deleteField,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from 'firebase/auth';
import { requireAuth, requireDb } from '../lib/firebase';
import { normalizePhone, pseudoEmail, InvalidPhoneError } from '../domain/phone';
import type {
  AdminApprovalMessage,
  AppUser,
  Channel,
  ChannelRead,
  Committee,
  CommitteeMembership,
  GlobalRole,
  RequestDoc,
  RequestType,
  RoutingRule,
  Student,
  StudentTemplate,
  TaskPriority,
  TaskStatus,
} from '../domain/models';

export class AppError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

export function mapAuthError(e: unknown): AppError {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return new AppError('PHONE_TAKEN', 'هذا الرقم مسجَّل مسبقًا');
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new AppError('BAD_LOGIN', 'رقم الهاتف أو كلمة المرور غير صحيحة');
    case 'auth/weak-password':
      return new AppError('WEAK_PASSWORD', 'كلمة المرور قصيرة (8 أحرف على الأقل)');
    case 'auth/too-many-requests':
      return new AppError('THROTTLED', 'محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة');
    case 'auth/network-request-failed':
      return new AppError('OFFLINE', 'لا يوجد اتصال بالإنترنت');
    case 'auth/requires-recent-login':
      return new AppError('REAUTH', 'أعد إدخال كلمة المرور الحالية لتأكيد العملية');
    default:
      return new AppError('UNKNOWN', 'حدث خطأ غير متوقع، أعد المحاولة');
  }
}

/* ---------------- المصادقة والتسجيل ---------------- */

export async function registerAccount(input: { name: string; phoneRaw: string; password: string }): Promise<void> {
  let phone: string;
  try {
    phone = normalizePhone(input.phoneRaw);
  } catch {
    throw new AppError('BAD_PHONE', 'رقم الهاتف غير صالح. أدخله بصيغة 09XXXXXXXX أو +9639XXXXXXXX');
  }
  if (input.password.length < 8) throw new AppError('WEAK_PASSWORD', 'كلمة المرور قصيرة (8 أحرف على الأقل)');
  const auth = requireAuth();
  const db = requireDb();
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, pseudoEmail(phone), input.password);
  } catch (e) {
    throw mapAuthError(e);
  }
  try {
    const batch = writeBatch(db);
    const userDoc: Record<string, unknown> = {
      uid: cred.user.uid,
      name: input.name.trim(),
      phone,
      status: 'pending',
      role: 'member',
      globalPermissions: [],
      committeeIds: [],
      createdAt: serverTimestamp(),
    };
    const inboxDoc: Record<string, unknown> = {
      uid: cred.user.uid,
      name: input.name.trim(),
      phone,
      status: 'open',
      createdAt: serverTimestamp(),
    };
    batch.set(doc(db, 'users', cred.user.uid), userDoc);
    batch.set(doc(db, 'adminApprovalInbox', cred.user.uid), inboxDoc);
    await batch.commit();
  } catch (e) {
    try {
      await deleteUser(cred.user);
    } catch {
      /* لا يمكن حذف الحساب؛ ستظهر شاشة خطأ مع إعادة المحاولة */
    }
    throw mapAuthError(e);
  }
}

export async function loginWithPhone(phoneRaw: string, password: string): Promise<void> {
  let phone: string;
  try {
    phone = normalizePhone(phoneRaw);
  } catch (e) {
    if (e instanceof InvalidPhoneError) throw new AppError('BAD_PHONE', 'رقم الهاتف غير صالح');
    throw e;
  }
  try {
    await signInWithEmailAndPassword(requireAuth(), pseudoEmail(phone), password);
  } catch (e) {
    throw mapAuthError(e);
  }
}

export async function loginWithEmail(email: string, password: string): Promise<void> {
  try {
    await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
  } catch (e) {
    throw mapAuthError(e);
  }
}

export async function logout(): Promise<void> {
  await signOut(requireAuth());
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const auth = requireAuth();
  const user = auth.currentUser;
  if (!user?.email) throw new AppError('UNKNOWN');
  if (newPassword.length < 8) throw new AppError('WEAK_PASSWORD', 'كلمة المرور قصيرة (8 أحرف على الأقل)');
  try {
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
  } catch (e) {
    throw mapAuthError(e);
  }
}

/* ---------------- مراجعة الحسابات (الإدارة) ---------------- */

export type ApprovalDecision = 'under_review' | 'approve' | 'reject';

export async function resolveApproval(input: {
  message: AdminApprovalMessage;
  decision: ApprovalDecision;
  actor: AppUser;
  role?: GlobalRole;
  globalPermissions?: string[];
  committeeIds?: string[];
  reason?: string;
}): Promise<void> {
  const db = requireDb();
  const { message, decision, actor } = input;
  const batch = writeBatch(db);
  const targetRef = doc(db, 'users', message.uid);
  const inboxRef = doc(db, 'adminApprovalInbox', message.uid);

  if (decision === 'under_review') {
    batch.update(targetRef, { status: 'under_review', reviewedBy: actor.uid, reviewedAt: serverTimestamp() });
    batch.update(inboxRef, { status: 'under_review' });
    await batch.commit();
    return;
  }

  if (decision === 'reject') {
    const reason = (input.reason ?? '').trim();
    if (reason.length < 3) throw new AppError('REASON_REQUIRED', 'سبب الرفض مطلوب');
    batch.update(targetRef, {
      status: 'rejected',
      decisionReason: reason,
      reviewedBy: actor.uid,
      reviewedAt: serverTimestamp(),
    });
    batch.update(inboxRef, { status: 'resolved', resolvedAt: serverTimestamp() });
    await batch.commit();
    return;
  }

  const role = input.role ?? 'member';
  const globalPermissions = (input.globalPermissions ?? []).filter((p) => role === 'admin' || p === '');
  const committeeIds = [...new Set(input.committeeIds ?? [])];
  if (role === 'admin' && globalPermissions.length === 0) {
    throw new AppError('ADMIN_NEEDS_PERMS', 'المدير يحتاج صلاحية عالمية واحدة على الأقل');
  }
  batch.update(targetRef, {
    status: 'approved',
    role,
    globalPermissions,
    committeeIds,
    decisionReason: deleteField(),
    reviewedBy: actor.uid,
    reviewedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'profiles', message.uid), {
    uid: message.uid,
    name: message.name,
    phone: message.phone,
    committeeIds,
    createdAt: serverTimestamp(),
  } satisfies Record<string, unknown>);
  for (const c of committeeIds) {
    batch.set(doc(db, 'committees', c, 'members', message.uid), {
      uid: message.uid,
      role: 'member',
      grants: [],
      denies: [],
      status: 'active',
    } satisfies CommitteeMembership);
  }
  batch.update(inboxRef, { status: 'resolved', resolvedAt: serverTimestamp() });
  await batch.commit();
}

export async function suspendUser(targetUid: string, reason: string, actor: AppUser): Promise<void> {
  const db = requireDb();
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', targetUid), {
    status: 'suspended',
    decisionReason: reason.trim(),
    reviewedBy: actor.uid,
    reviewedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'securityEvents', doc(collection(db, 'securityEvents')).id), {
    kind: 'user.suspended',
    actorUid: actor.uid,
    targetId: targetUid,
    detail: reason.slice(0, 300),
    at: serverTimestamp(),
  });
  await batch.commit();
}

/** إعادة حساب معلّق إلى الحالة المقبولة وحذف سبب التعليق. */
export async function reinstateUser(targetUid: string, actor: AppUser): Promise<void> {
  const db = requireDb();
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', targetUid), {
    status: 'approved',
    decisionReason: deleteField(),
    reviewedBy: actor.uid,
    reviewedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'securityEvents', doc(collection(db, 'securityEvents')).id), {
    kind: 'user.reinstated',
    actorUid: actor.uid,
    targetId: targetUid,
    detail: 'إلغاء تعليق الحساب',
    at: serverTimestamp(),
  });
  await batch.commit();
}

/** تعديل دور/صلاحيات/لجان مستخدم مقبول مع مزامنة الملف والعضويات في دفعة واحدة. */
export async function updateUserAssignment(input: {
  targetUid: string;
  role: GlobalRole;
  globalPermissions: string[];
  nextCommitteeIds: string[];
  memberships: Record<string, CommitteeMembership>;
  actor: AppUser;
  reason?: string;
}): Promise<void> {
  const db = requireDb();
  const { targetUid, role, globalPermissions, nextCommitteeIds, memberships, actor } = input;
  const before = await getDoc(doc(db, 'users', targetUid));
  const prev = (before.data()?.committeeIds ?? []) as string[];
  const added = nextCommitteeIds.filter((c) => !prev.includes(c));
  const removed = prev.filter((c) => !nextCommitteeIds.includes(c));
  if (targetUid === actor.uid) throw new AppError('SELF_EDIT', 'لا يمكنك تعديل حسابك بنفسك');

  const trimmedReason = (input.reason ?? '').trim();
  if (added.length > 0 && trimmedReason.length < 3) {
    throw new AppError('REASON_REQUIRED', 'سبب إدخال العضو إلى لجنة جديدة مطلوب (3 أحرف على الأقل)');
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'users', targetUid), { role, globalPermissions, committeeIds: nextCommitteeIds });
  batch.update(doc(db, 'profiles', targetUid), { committeeIds: nextCommitteeIds });
  for (const c of added) {
    batch.set(doc(db, 'committees', c, 'members', targetUid), memberships[c] ?? {
      uid: targetUid,
      role: 'member',
      grants: [],
      denies: [],
      status: 'active',
    });
  }
  for (const c of removed) {
    batch.delete(doc(db, 'committees', c, 'members', targetUid));
  }
  if (added.length > 0) {
    batch.set(doc(db, 'securityEvents', doc(collection(db, 'securityEvents')).id), {
      kind: 'user.membership_updated',
      actorUid: actor.uid,
      targetId: targetUid,
      detail: `${trimmedReason} (اللجان المضافة: ${added.join('، ')})`.slice(0, 300),
      at: serverTimestamp(),
    });
  }
  await batch.commit();
}

/* ---------------- اللجان ---------------- */

export async function saveCommittee(committee: Partial<Committee> & { name: string; colorKey: string }, actor: AppUser): Promise<string> {
  const db = requireDb();
  const ref = committee.id ? doc(db, 'committees', committee.id) : doc(collection(db, 'committees'));
  const data = {
    name: committee.name.trim(),
    colorKey: committee.colorKey,
    status: committee.status ?? 'active',
    teamWidePermissions: committee.teamWidePermissions ?? [],
    ...(committee.id ? {} : { createdBy: actor.uid, createdAt: serverTimestamp() }),
  };
  await setDoc(ref, data, { merge: !!committee.id });
  return ref.id;
}

export async function saveMembership(input: {
  committeeId: string;
  member: CommitteeMembership;
  removeFromUserDoc: boolean;
}): Promise<void> {
  const db = requireDb();
  const { committeeId, member, removeFromUserDoc } = input;
  const userSnap = await getDoc(doc(db, 'users', member.uid));
  const current = (userSnap.data()?.committeeIds ?? []) as string[];
  const next = removeFromUserDoc
    ? current.filter((c) => c !== committeeId)
    : current.includes(committeeId)
      ? current
      : [...current, committeeId];
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', member.uid), { committeeIds: next });
  const profileSnap = await getDoc(doc(db, 'profiles', member.uid));
  if (profileSnap.exists()) batch.update(doc(db, 'profiles', member.uid), { committeeIds: next });
  if (removeFromUserDoc) batch.delete(doc(db, 'committees', committeeId, 'members', member.uid));
  else batch.set(doc(db, 'committees', committeeId, 'members', member.uid), member);
  await batch.commit();
}

/* ---------------- الطلاب والقالب ---------------- */

export async function saveTemplate(template: StudentTemplate): Promise<void> {
  const db = requireDb();
  const current = await getDoc(doc(db, 'studentTemplates', 'current'));
  const prevVersion = current.exists() ? (current.data()?.version as number) : 0;
  await setDoc(doc(db, 'studentTemplates', 'current'), {
    fields: template.fields,
    fieldKeys: template.fields.map((f) => f.key),
    requiredKeys: template.fields.filter((f) => f.required).map((f) => f.key),
    version: prevVersion + 1,
    updatedAt: serverTimestamp(),
  });
}

export async function saveStudent(input: { student: Student; id?: string }, _actor: AppUser): Promise<string> {
  const db = requireDb();
  const { student, id } = input;
  if (id) {
    await updateDoc(doc(db, 'students', id), {
      name: student.name,
      values: student.values,
      searchTokens: student.searchTokens,
      normalizedName: student.normalizedName,
      points: student.points,
      memorizationLevel: student.memorizationLevel,
      archived: student.archived,
      committeeId: student.committeeId,
      templateVersion: student.templateVersion,
      updatedAt: serverTimestamp(),
    });
    return id;
  }
  const ref = doc(collection(db, 'students'));
  await setDoc(ref, {
    committeeId: student.committeeId,
    name: student.name,
    values: student.values,
    searchTokens: student.searchTokens,
    normalizedName: student.normalizedName,
    points: student.points,
    memorizationLevel: student.memorizationLevel,
    archived: false,
    templateVersion: student.templateVersion,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function setStudentArchived(studentId: string, archived: boolean): Promise<void> {
  await updateDoc(doc(requireDb(), 'students', studentId), { archived, updatedAt: serverTimestamp() });
}

export async function hardDeleteStudent(studentId: string, actor: AppUser): Promise<void> {
  const db = requireDb();
  const batch = writeBatch(db);
  batch.delete(doc(db, 'students', studentId));
  batch.set(doc(db, 'securityEvents', doc(collection(db, 'securityEvents')).id), {
    kind: 'student.hard_deleted',
    actorUid: actor.uid,
    targetId: studentId,
    at: serverTimestamp(),
  });
  await batch.commit();
}

/* ---------------- الطلبات ---------------- */

export async function createRequest(payload: {
  type: RequestType;
  senderCommitteeId: string;
  destinationCommitteeId: string;
  title: string;
  body: string;
  amount?: number;
  currency?: string;
  direction?: 'income' | 'expense';
}, actor: AppUser): Promise<string> {
  const db = requireDb();
  const ref = doc(collection(db, 'requests'));
  await setDoc(ref, {
    type: payload.type,
    createdBy: actor.uid,
    createdByName: actor.name,
    senderCommitteeId: payload.senderCommitteeId,
    destinationCommitteeId: payload.destinationCommitteeId,
    title: payload.title.trim(),
    body: payload.body.trim(),
    ...(payload.amount !== undefined
      ? { amount: payload.amount, currency: payload.currency, direction: payload.direction }
      : {}),
    status: 'submitted',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function decideRequest(input: {
  request: RequestDoc;
  decision: 'approved' | 'rejected' | 'under_review';
  reason: string;
  deliveryDate?: Date | null;
  actor: AppUser;
}): Promise<void> {
  const db = requireDb();
  const { request, decision, reason, deliveryDate, actor } = input;
  if (decision === 'under_review') {
    await updateDoc(doc(db, 'requests', request.id), { status: 'under_review', updatedAt: serverTimestamp() });
    return;
  }
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new AppError('REASON_REQUIRED', 'سبب القرار مطلوب');
  await updateDoc(doc(db, 'requests', request.id), {
    status: decision,
    decisionReason: trimmed,
    deliveryDate: decision === 'approved' && deliveryDate ? Timestamp.fromDate(deliveryDate) : null,
    decidedBy: actor.uid,
    decidedByName: actor.name,
    decidedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function cancelRequest(request: RequestDoc, actor: AppUser): Promise<void> {
  const db = requireDb();
  const batch = writeBatch(db);
  batch.update(doc(db, 'requests', request.id), { status: 'cancelled', updatedAt: serverTimestamp() });
  batch.set(doc(db, 'securityEvents', doc(collection(db, 'securityEvents')).id), {
    kind: 'request.cancelled',
    actorUid: actor.uid,
    targetId: request.id,
    at: serverTimestamp(),
  });
  await batch.commit();
}

/** تنفيذ طلب مالي معتمد: الطلب + الحركة + أثر أمني في معاملة واحدة. */
export async function executeFinancialRequest(request: RequestDoc, actor: AppUser): Promise<void> {
  const db = requireDb();
  await runTransaction(db, async (tx) => {
    tx.update(doc(db, 'requests', request.id), {
      status: 'executed',
      executedBy: actor.uid,
      executedByName: actor.name,
      executedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.set(doc(db, 'ledgerEntries', request.id), {
      requestId: request.id,
      committeeId: request.destinationCommitteeId,
      type: request.type,
      direction: request.direction,
      amount: request.amount,
      currency: request.currency,
      note: request.decisionReason ?? '',
      executedBy: actor.uid,
      executedByName: actor.name,
      executedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    } satisfies Record<string, unknown>);
    tx.set(doc(db, 'securityEvents', doc(collection(db, 'securityEvents')).id), {
      kind: 'finance.executed',
      actorUid: actor.uid,
      targetId: request.id,
      detail: `${request.direction} ${request.amount} ${request.currency}`,
      at: serverTimestamp(),
    });
  });
}

/** تنفيذ طلب غير مالي معتمد مع أثر أمني. */
export async function executePlainRequest(request: RequestDoc, actor: AppUser): Promise<void> {
  const db = requireDb();
  const batch = writeBatch(db);
  batch.update(doc(db, 'requests', request.id), {
    status: 'executed',
    executedBy: actor.uid,
    executedByName: actor.name,
    executedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'securityEvents', doc(collection(db, 'securityEvents')).id), {
    kind: 'request.executed',
    actorUid: actor.uid,
    targetId: request.id,
    detail: request.type,
    at: serverTimestamp(),
  });
  await batch.commit();
}

/**
 * إدخال مالي يدوي: إنشاء الطلب ← اعتماده ← تنفيذه مع الحركة والأثر.
 * ثلاث خطوات منفصلة عمدًا: قواعد Firestore تقيّم كل كتابات المعاملة الواحدة
 * على الحالة النهائية، فلا يمكن تمرير انتقالات الحالة داخل معاملة واحدة.
 */
export async function manualFinanceEntry(input: {
  committeeId: string;
  type: 'manual_income' | 'manual_expense';
  amount: number;
  currency: string;
  note: string;
  actor: AppUser;
}): Promise<void> {
  const db = requireDb();
  const { committeeId, type, amount, currency, note, actor } = input;
  const trimmedNote = note.trim();
  if (trimmedNote.length < 3) throw new AppError('NOTE_REQUIRED', 'الوصف/السبب مطلوب (3 أحرف على الأقل)');
  if (!(Number.isInteger(amount) && amount > 0)) throw new AppError('BAD_AMOUNT', 'المبلغ عدد صحيح موجب');

  const reqRef = doc(collection(db, 'requests'));
  const direction = type === 'manual_income' ? 'income' : 'expense';

  await setDoc(reqRef, {
    type,
    createdBy: actor.uid,
    createdByName: actor.name,
    senderCommitteeId: committeeId,
    destinationCommitteeId: committeeId,
    title: trimmedNote.slice(0, 120),
    body: trimmedNote,
    amount,
    currency,
    direction,
    status: 'submitted',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(reqRef, {
    status: 'approved',
    decisionReason: trimmedNote,
    decidedBy: actor.uid,
    decidedByName: actor.name,
    decidedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const batch = writeBatch(db);
  batch.update(reqRef, {
    status: 'executed',
    executedBy: actor.uid,
    executedByName: actor.name,
    executedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'ledgerEntries', reqRef.id), {
    requestId: reqRef.id,
    committeeId,
    type,
    direction,
    amount,
    currency,
    note: trimmedNote,
    executedBy: actor.uid,
    executedByName: actor.name,
    executedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'securityEvents', doc(collection(db, 'securityEvents')).id), {
    kind: 'finance.executed',
    actorUid: actor.uid,
    targetId: reqRef.id,
    detail: `${type} ${amount} ${currency}`,
    at: serverTimestamp(),
  });
  await batch.commit();
}

/* ---------------- قواعد التوجيه ---------------- */

export async function saveRoutingRule(rule: RoutingRule): Promise<void> {
  await setDoc(
    doc(requireDb(), 'routingRules', rule.type),
    {
      type: rule.type,
      mode: rule.mode,
      committeeId: rule.mode === 'fixed' ? rule.committeeId ?? null : null,
      updatedAt: serverTimestamp(),
    },
    { merge: false }
  );
}

/* ---------------- الشات ---------------- */

export async function sendMessage(channel: Channel, text: string, actor: AppUser): Promise<string> {
  const db = requireDb();
  const trimmed = text.trim();
  if (!trimmed) throw new AppError('EMPTY_MSG', 'الرسالة فارغة');
  if (trimmed.length > 2000) throw new AppError('LONG_MSG', 'الرسالة طويلة (2000 حرف كحد أقصى)');
  const msgRef = doc(collection(db, 'channels', channel.id, 'messages'));
  const batch = writeBatch(db);
  batch.set(msgRef, {
    senderId: actor.uid,
    senderName: actor.name,
    text: trimmed,
    hidden: false,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, 'channels', channel.id), { lastActivityAt: serverTimestamp() });
  await batch.commit();
  return msgRef.id;
}

export async function hideMessage(channelId: string, messageId: string, hidden: boolean): Promise<void> {
  await updateDoc(doc(requireDb(), 'channels', channelId, 'messages', messageId), { hidden });
}

export async function saveChannel(input: {
  id?: string;
  name: string;
  type: Channel['type'];
  audience: Channel['audience'];
  committeeIds: string[];
  actor: AppUser;
}): Promise<string> {
  const db = requireDb();
  const { id, name, type, audience, committeeIds, actor } = input;
  if (id) {
    await updateDoc(doc(db, 'channels', id), { name: name.trim(), type, audience, committeeIds });
    return id;
  }
  const ref = doc(collection(db, 'channels'));
  await setDoc(ref, {
    name: name.trim(),
    type,
    audience,
    committeeIds,
    status: 'active',
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  });
  return ref.id;
}

export async function archiveChannel(channelId: string, archived: boolean): Promise<void> {
  await updateDoc(doc(requireDb(), 'channels', channelId), { status: archived ? 'archived' : 'active' });
}

const readId = (uid: string, channelId: string) => `${uid}_${channelId}`;

export async function markChannelRead(uid: string, channel: Channel, lastMessageId: string): Promise<void> {
  const ref = doc(requireDb(), 'channelReads', readId(uid, channel.id));
  await setDoc(ref, {
    uid,
    channelId: channel.id,
    lastReadMessageId: lastMessageId,
    lastReadAt: serverTimestamp(),
  });
}

export function watchChannelRead(uid: string, channelId: string, cb: (read: ChannelRead | null) => void): Unsubscribe {
  return onSnapshot(
    doc(requireDb(), 'channelReads', readId(uid, channelId)),
    (snap) => cb(snap.exists() ? (snap.data() as ChannelRead) : null),
    () => cb(null)
  );
}

/* ---------------- مهام اللجان ---------------- */

export async function saveTask(input: {
  id?: string;
  committeeId: string;
  title: string;
  details: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeUid: string;
  assigneeName: string;
  dueDate: Date | null;
  requestId?: string;
  actor: AppUser;
}): Promise<string> {
  const db = requireDb();
  const title = input.title.trim();
  if (title.length < 2) throw new AppError('TITLE_REQUIRED', 'عنوان المهمة مطلوب');
  if (title.length > 120) throw new AppError('TITLE_TOO_LONG', 'العنوان طويل (120 حرفًا كحد أقصى)');

  const fields = {
    committeeId: input.committeeId,
    title,
    details: input.details.trim().slice(0, 2000),
    status: input.status,
    priority: input.priority,
    assigneeUid: input.assigneeUid,
    assigneeName: input.assigneeUid ? input.assigneeName : '',
    dueDate: input.dueDate ? Timestamp.fromDate(input.dueDate) : null,
    requestId: input.requestId ?? '',
    updatedAt: serverTimestamp(),
    doneAt: input.status === 'done' ? serverTimestamp() : null,
  };

  if (input.id) {
    await updateDoc(doc(db, 'tasks', input.id), fields);
    return input.id;
  }

  const ref = doc(collection(db, 'tasks'));
  await setDoc(ref, {
    ...fields,
    createdBy: input.actor.uid,
    createdByName: input.actor.name,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** المكلَّف بالمهمة يحرّك حالتها ويضيف ملاحظاته دون صلاحية tasks.manage. */
export async function updateTaskProgress(input: {
  taskId: string;
  status: TaskStatus;
  details: string;
}): Promise<void> {
  await updateDoc(doc(requireDb(), 'tasks', input.taskId), {
    status: input.status,
    details: input.details.trim().slice(0, 2000),
    doneAt: input.status === 'done' ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'tasks', taskId));
}

/* ---------------- التقارير الأسبوعية ---------------- */

export async function createWeeklyReport(input: {
  committeeId: string;
  title: string;
  body: string;
  periodFrom: Date;
  periodTo: Date;
  actor: AppUser;
}): Promise<string> {
  const db = requireDb();
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 2) throw new AppError('TITLE_REQUIRED', 'عنوان التقرير مطلوب');
  if (title.length > 120) throw new AppError('TITLE_TOO_LONG', 'العنوان طويل (120 حرفًا كحد أقصى)');
  if (!body) throw new AppError('BODY_REQUIRED', 'محتوى التقرير مطلوب');
  if (body.length > 6000) throw new AppError('BODY_TOO_LONG', 'التقرير طويل (6000 حرف كحد أقصى)');
  if (input.periodTo.getTime() < input.periodFrom.getTime()) {
    throw new AppError('BAD_PERIOD', 'نهاية الفترة قبل بدايتها');
  }

  const ref = doc(collection(db, 'weeklyReports'));
  await setDoc(ref, {
    committeeId: input.committeeId,
    title,
    body,
    periodFrom: Timestamp.fromDate(input.periodFrom),
    periodTo: Timestamp.fromDate(input.periodTo),
    createdBy: input.actor.uid,
    createdByName: input.actor.name,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
