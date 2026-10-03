import * as fs from 'node:fs';
import * as url from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

const RULES = fs.readFileSync(url.fileURLToPath(new URL('../../firestore.rules', import.meta.url)), 'utf8');

const ALICE = 'alice';
const BOB = 'bob';
const SAMIR = 'samir';
const MGR = 'mgr';
const ROOT = 'root';
const GUEST = 'guest';
const NEW_U = 'user-new';

const NAME: Record<string, string> = {
  [ALICE]: 'علي',
  [BOB]: 'بلال',
  [SAMIR]: 'سامر',
  [MGR]: 'ناصر',
  [ROOT]: 'المدير',
  [GUEST]: 'زائر',
};

const PHONE_OK = '963900000009';
const T0 = Timestamp.fromMillis(Date.parse('2026-01-01T00:00:00Z'));

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-student-app-rules',
    firestore: { rules: RULES },
  });
});

afterAll(async () => {
  await env.cleanup();
});

// كل استدعاء لauthenticatedContext ينشئ Firestore instance جديدًا؛
// خلط refs من instances مختلفة داخل دفعة واحدة يفشل، لذا نخزّن السياق لكل مستخدم.
type TestDb = ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']>;
const ctxCache = new Map<string, TestDb>();
const udb = (uid: string): TestDb => {
  let db = ctxCache.get(uid);
  if (!db) {
    db = env.authenticatedContext(uid).firestore();
    ctxCache.set(uid, db);
  }
  return db;
};
const adb = () => env.unauthenticatedContext().firestore();

async function seed(): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    const set = (path: string, data: Record<string, unknown>) => d.doc(path).set(data);

    const users: Array<[string, Record<string, unknown>]> = [
      [ALICE, { committeeIds: ['c1'], globalPermissions: [], role: 'member', status: 'approved' }],
      [BOB, { committeeIds: ['c1'], globalPermissions: [], role: 'member', status: 'approved' }],
      [SAMIR, { committeeIds: ['c2'], globalPermissions: [], role: 'member', status: 'approved' }],
      [MGR, {
        committeeIds: [],
        globalPermissions: ['users.review', 'users.managePermissions', 'committees.manage', 'templates.manage'],
        role: 'admin',
        status: 'approved',
      }],
      [ROOT, { committeeIds: [], globalPermissions: [], role: 'superAdmin', status: 'approved' }],
      [GUEST, { committeeIds: [], globalPermissions: [], role: 'member', status: 'pending' }],
    ];
    for (const [uid, over] of users) {
      await set(`users/${uid}`, { name: NAME[uid], phone: '96390000000' + uid.length, createdAt: T0, ...over });
    }

    await set('committees/c1', {
      name: 'لجنة التنفيذ',
      colorKey: 'blue',
      status: 'active',
      teamWidePermissions: ['students.read', 'students.create', 'students.update', 'requests.send'],
      createdBy: ROOT,
      createdAt: T0,
    });
    await set('committees/c2', {
      name: 'لجنة المالية',
      colorKey: 'rose',
      status: 'active',
      teamWidePermissions: ['requests.receive', 'requests.decide', 'requests.execute', 'finance.read', 'finance.post'],
      createdBy: ROOT,
      createdAt: T0,
    });
    await set('committees/c1/members/alice', { uid: ALICE, role: 'member', grants: [], denies: [], status: 'active' });
    await set('committees/c1/members/bob', { uid: BOB, role: 'member', grants: [], denies: [], status: 'active' });
    await set('committees/c2/members/samir', { uid: SAMIR, role: 'manager', grants: [], denies: [], status: 'active' });

    await set('studentTemplates/current', {
      fields: [
        { key: 'phone', label: 'الهاتف', type: 'text', required: false, searchable: true },
        { key: 'level', label: 'الصف', type: 'text', required: true, searchable: false },
      ],
      fieldKeys: ['phone', 'level'],
      requiredKeys: ['level'],
      version: 3,
      updatedAt: T0,
    });

    await set('routingRules/formatting', { type: 'formatting', mode: 'fixed', committeeId: 'c2', updatedAt: T0 });
    await set('routingRules/support', { type: 'support', mode: 'sender_choice', committeeId: null, updatedAt: T0 });
    await set('routingRules/expense', { type: 'expense', mode: 'fixed', committeeId: 'c2', updatedAt: T0 });

    await set('requests/reqApproved', {
      type: 'expense',
      createdBy: ALICE,
      createdByName: NAME[ALICE],
      senderCommitteeId: 'c1',
      destinationCommitteeId: 'c2',
      title: 'شراء قرطاسية',
      body: '',
      amount: 5000,
      currency: 'SYP',
      direction: 'expense',
      status: 'approved',
      decisionReason: 'تم القبول',
      decidedBy: SAMIR,
      decidedByName: NAME[SAMIR],
      createdAt: T0,
      updatedAt: T0,
    });
    await set('requests/reqOpen', {
      type: 'formatting',
      createdBy: ALICE,
      createdByName: NAME[ALICE],
      senderCommitteeId: 'c1',
      destinationCommitteeId: 'c2',
      title: 'تنسيق كتيب',
      body: '',
      status: 'submitted',
      createdAt: T0,
      updatedAt: T0,
    });
    await set('requests/reqToReject', {
      type: 'support',
      createdBy: ALICE,
      createdByName: NAME[ALICE],
      senderCommitteeId: 'c1',
      destinationCommitteeId: 'c2',
      title: 'طلب دعم',
      body: '',
      status: 'submitted',
      createdAt: T0,
      updatedAt: T0,
    });
    await set('requests/reqToCancel', {
      type: 'inquiry',
      createdBy: ALICE,
      createdByName: NAME[ALICE],
      senderCommitteeId: 'c1',
      destinationCommitteeId: 'c2',
      title: 'استفسار عن الموعد',
      body: '',
      status: 'submitted',
      createdAt: T0,
      updatedAt: T0,
    });

    await set('students/st1', {
      committeeId: 'c1',
      name: 'طالب تجريبي',
      values: { phone: '0991111111', level: 'الثالث' },
      searchTokens: [],
      normalizedName: 'طالب تجريبي',
      points: 10,
      memorizationLevel: 'beginner',
      archived: false,
      templateVersion: 3,
      createdAt: T0,
      updatedAt: T0,
    });

    await set('channels/ann', {
      name: 'الإعلانات',
      type: 'announcements',
      audience: 'allApproved',
      committeeIds: [],
      status: 'active',
      createdBy: ROOT,
      createdAt: T0,
      lastActivityAt: T0,
    });
    await set('channels/disc', {
      name: 'دردشة التنفيذ',
      type: 'discussion',
      audience: 'committees',
      committeeIds: ['c1'],
      status: 'active',
      createdBy: ROOT,
      createdAt: T0,
      lastActivityAt: T0,
    });
    await set('channels/disc/messages/msg1', {
      senderId: ALICE,
      senderName: NAME[ALICE],
      text: 'مرحبًا بالجميع',
      hidden: false,
      createdAt: T0,
    });
  });
}

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

const regDocs = (uid: string) => ({
  user: {
    uid,
    name: 'مستخدم جديد',
    phone: PHONE_OK,
    status: 'pending',
    role: 'member',
    globalPermissions: [],
    committeeIds: [],
    createdAt: serverTimestamp(),
  },
  inbox: { uid, name: 'مستخدم جديد', phone: PHONE_OK, status: 'open', createdAt: serverTimestamp() },
});

describe('الوصول العام والمستخدم غير المقبول', () => {
  it('غير المسجل لا يقرأ شيئًا', async () => {
    await assertFails(getDoc(doc(adb(), 'users/alice')));
    await assertFails(getDoc(doc(adb(), 'committees/c1')));
  });

  it('المعلق يقرأ وثيقته فقط', async () => {
    await assertSucceeds(getDoc(doc(udb(GUEST), `users/${GUEST}`)));
    await assertFails(getDoc(doc(udb(GUEST), `users/${ALICE}`)));
    await assertFails(getDocs(collection(udb(GUEST), 'users')));
  });

  it('المعلق لا يقرأ اللجان ولا الطلاب ولا القنوات', async () => {
    await assertFails(getDoc(doc(udb(GUEST), 'committees/c1')));
    await assertFails(getDocs(query(collection(udb(GUEST), 'students'), where('committeeId', '==', 'c1'))));
    await assertFails(getDoc(doc(udb(GUEST), 'channels/ann')));
  });

  it('المقبول يقرأ اللجان', async () => {
    await assertSucceeds(getDoc(doc(udb(ALICE), 'committees/c1')));
  });
});

describe('التسجيل الذاتي ورسالة الإدارة', () => {
  it('يفشل إنشاء الحساب دون رسالة الإدارة', async () => {
    const { user } = regDocs(NEW_U);
    await assertFails(setDoc(doc(udb(NEW_U), `users/${NEW_U}`), user));
  });

  it('يفشل إنشاء رسالة الإدارة دون الحساب', async () => {
    const { inbox } = regDocs(NEW_U);
    await assertFails(setDoc(doc(udb(NEW_U), `adminApprovalInbox/${NEW_U}`), inbox));
  });

  it('ينجح الدفعة الثنائية: الحساب + رسالة الإدارة', async () => {
    const { user, inbox } = regDocs(NEW_U);
    const b = writeBatch(udb(NEW_U));
    b.set(doc(udb(NEW_U), `users/${NEW_U}`), user);
    b.set(doc(udb(NEW_U), `adminApprovalInbox/${NEW_U}`), inbox);
    await assertSucceeds(b.commit());
  });

  it('يفشل تكرار إنشاء نفس الحساب', async () => {
    const { user, inbox } = regDocs(NEW_U);
    const b = writeBatch(udb(NEW_U));
    b.set(doc(udb(NEW_U), `users/${NEW_U}`), user);
    b.set(doc(udb(NEW_U), `adminApprovalInbox/${NEW_U}`), inbox);
    await assertSucceeds(b.commit());

    const b2 = writeBatch(udb(NEW_U));
    b2.set(doc(udb(NEW_U), `users/${NEW_U}`), user);
    b2.set(doc(udb(NEW_U), `adminApprovalInbox/${NEW_U}`), inbox);
    await assertFails(b2.commit());
  });

  it('صاحب الحساب لا يقرأ رسالة الإدارة ولا يعدلها', async () => {
    const { user, inbox } = regDocs(NEW_U);
    const b = writeBatch(udb(NEW_U));
    b.set(doc(udb(NEW_U), `users/${NEW_U}`), user);
    b.set(doc(udb(NEW_U), `adminApprovalInbox/${NEW_U}`), inbox);
    await assertSucceeds(b.commit());

    await assertFails(getDoc(doc(udb(NEW_U), `adminApprovalInbox/${NEW_U}`)));
    await assertFails(updateDoc(doc(udb(NEW_U), `adminApprovalInbox/${NEW_U}`), { status: 'resolved' }));
  });

  it('المستخدم المقبول يغيّر اسمه فقط', async () => {
    await assertSucceeds(updateDoc(doc(udb(ALICE), `users/${ALICE}`), { name: 'علي المحدث' }));
    await assertFails(updateDoc(doc(udb(ALICE), `users/${ALICE}`), { name: 'علي المحدث', phone: '963911111111' }));
  });
});

describe('المراجعة والأدوار', () => {
  it('يمنع المستخدم ترقية نفسه أو تغيير حالته', async () => {
    await assertFails(updateDoc(doc(udb(ALICE), `users/${ALICE}`), { role: 'superAdmin' }));
    await assertFails(updateDoc(doc(udb(ALICE), `users/${ALICE}`), { role: 'admin' }));
    await assertFails(updateDoc(doc(udb(BOB), `users/${BOB}`), { status: 'approved', role: 'admin' }));
  });

  it('يقبل المراجع الحساب ويحدث الرسالة resolved في دفعة واحدة', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await d.doc(`users/${NEW_U}`).set({
        uid: NEW_U, name: 'مستخدم جديد', phone: PHONE_OK, status: 'pending', role: 'member',
        globalPermissions: [], committeeIds: [], createdAt: T0,
      });
      await d.doc(`adminApprovalInbox/${NEW_U}`).set({
        uid: NEW_U, name: 'مستخدم جديد', phone: PHONE_OK, status: 'open', createdAt: T0,
      });
    });

    const b = writeBatch(udb(MGR));
    b.update(doc(udb(MGR), `users/${NEW_U}`), {
      status: 'approved',
      role: 'member',
      globalPermissions: [],
      committeeIds: ['c1'],
      reviewedBy: MGR,
      reviewedAt: serverTimestamp(),
    });
    b.update(doc(udb(MGR), `adminApprovalInbox/${NEW_U}`), { status: 'resolved', resolvedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it('يرفض الرفض بلا سبب وينجح بسبب واضح', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await d.doc(`users/${NEW_U}`).set({
        uid: NEW_U, name: 'مستخدم جديد', phone: PHONE_OK, status: 'pending', role: 'member',
        globalPermissions: [], committeeIds: [], createdAt: T0,
      });
      await d.doc(`adminApprovalInbox/${NEW_U}`).set({
        uid: NEW_U, name: 'مستخدم جديد', phone: PHONE_OK, status: 'open', createdAt: T0,
      });
    });

    await assertFails(updateDoc(doc(udb(MGR), `users/${NEW_U}`), {
      status: 'rejected', reviewedBy: MGR, reviewedAt: serverTimestamp(),
    }));

    const b = writeBatch(udb(MGR));
    b.update(doc(udb(MGR), `users/${NEW_U}`), {
      status: 'rejected',
      decisionReason: 'البيانات غير مكتملة',
      reviewedBy: MGR,
      reviewedAt: serverTimestamp(),
    });
    b.update(doc(udb(MGR), `adminApprovalInbox/${NEW_U}`), { status: 'resolved', resolvedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it('يمنع المراجع منح superAdmin', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await d.doc(`users/${NEW_U}`).set({
        uid: NEW_U, name: 'مستخدم جديد', phone: PHONE_OK, status: 'pending', role: 'member',
        globalPermissions: [], committeeIds: [], createdAt: T0,
      });
    });
    await assertFails(updateDoc(doc(udb(MGR), `users/${NEW_U}`), {
      status: 'approved',
      role: 'superAdmin',
      globalPermissions: [],
      committeeIds: [],
      reviewedBy: MGR,
      reviewedAt: serverTimestamp(),
    }));
  });

  it('يمنع المراجع تعديل نفسه أو تعديل مدير أعلى', async () => {
    await assertFails(updateDoc(doc(udb(MGR), `users/${MGR}`), {
      status: 'approved', role: 'admin', reviewedBy: MGR, reviewedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(udb(MGR), `users/${ROOT}`), {
      status: 'suspended', decisionReason: 'محاولة غير مشروعة', reviewedBy: MGR, reviewedAt: serverTimestamp(),
    }));
  });

  it('superAdmin يعلق مستخدمًا بسبب', async () => {
    await assertSucceeds(updateDoc(doc(udb(ROOT), `users/${ALICE}`), {
      status: 'suspended',
      decisionReason: 'إيقاف مؤقت للتحقق',
      reviewedBy: ROOT,
      reviewedAt: serverTimestamp(),
    }));
  });
});

describe('اللجان والألوان', () => {
  const committeeDoc = (colorKey: string) => ({
    name: 'لجنة جديدة',
    colorKey,
    status: 'active',
    teamWidePermissions: ['students.read'],
    createdBy: MGR,
    createdAt: serverTimestamp(),
  });

  it('عضو عادي لا ينشئ لجنة', async () => {
    await assertFails(setDoc(doc(udb(ALICE), 'committees/c9'), committeeDoc('violet')));
  });

  it('colorKey خارج اللوحة يرفض وداخلها يقبل', async () => {
    await assertFails(setDoc(doc(udb(MGR), 'committees/c9'), committeeDoc('pink')));
    await assertFails(setDoc(doc(udb(MGR), 'committees/c9'), committeeDoc('#ff0000')));
    await assertSucceeds(setDoc(doc(udb(MGR), 'committees/c9'), committeeDoc('violet')));
  });

  it('تعديل اللون: خارجه يرفض وداخله يقبل وعضو يُمنع', async () => {
    await assertFails(updateDoc(doc(udb(MGR), 'committees/c1'), { colorKey: 'chartreuse' }));
    await assertSucceeds(updateDoc(doc(udb(MGR), 'committees/c1'), { colorKey: 'amber' }));
    await assertFails(updateDoc(doc(udb(ALICE), 'committees/c1'), { colorKey: 'red' }));
  });
});

describe('عضويات اللجان', () => {
  it('عضو عادي لا يدير عضويات', async () => {
    await assertFails(setDoc(doc(udb(BOB), 'committees/c1/members/samir'), {
      uid: SAMIR, role: 'member', grants: [], denies: [], status: 'active',
    }));
  });

  it('لا عضوية ذاتية', async () => {
    await assertFails(setDoc(doc(udb(ALICE), 'committees/c2/members/alice'), {
      uid: ALICE, role: 'member', grants: [], denies: [], status: 'active',
    }));
  });

  it('العضوية تتطلب committeeId متزامنًا في ملف المستخدم بنفس الدفعة', async () => {
    await assertFails(setDoc(doc(udb(MGR), 'committees/c2/members/bob'), {
      uid: BOB, role: 'member', grants: [], denies: [], status: 'active',
    }));

    const b = writeBatch(udb(MGR));
    b.update(doc(udb(MGR), `users/${BOB}`), { committeeIds: ['c1', 'c2'] });
    b.set(doc(udb(MGR), 'committees/c2/members/bob'), {
      uid: BOB, role: 'member', grants: [], denies: [], status: 'active',
    });
    await assertSucceeds(b.commit());
  });
});

describe('الطلاب والقالب', () => {
  const studentDoc = (over: Record<string, unknown> = {}) => ({
    committeeId: 'c1',
    name: 'طالب جديد',
    values: { phone: '0992222222', level: 'الأول' },
    searchTokens: [],
    normalizedName: 'طالب جديد',
    points: 0,
    memorizationLevel: 'none',
    archived: false,
    templateVersion: 3,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...over,
  });

  it('إنشاء طالب صحيح ينجح بصلاحية اللجنة', async () => {
    await assertSucceeds(setDoc(doc(udb(ALICE), 'students/new1'), studentDoc()));
    await assertFails(setDoc(doc(udb(SAMIR), 'students/new2'), studentDoc({ committeeId: 'c1' })));
  });

  it('مفتاح خارج القالب يرفض والحقل المطلوب الناقص يرفض', async () => {
    await assertFails(setDoc(doc(udb(ALICE), 'students/new1'), studentDoc({
      values: { phone: 'x', level: 'الأول', nope: 'y' },
    })));
    await assertFails(setDoc(doc(udb(ALICE), 'students/new1'), studentDoc({ values: { phone: 'x' } })));
  });

  it('templateVersion غير مطابق يرفض', async () => {
    await assertFails(setDoc(doc(udb(ALICE), 'students/new1'), studentDoc({ templateVersion: 2 })));
  });

  it('النقاط يجب أن تكون عددًا صحيحًا', async () => {
    await assertFails(setDoc(doc(udb(ALICE), 'students/new1'), studentDoc({ points: 5.5 })));
    await assertFails(setDoc(doc(udb(ALICE), 'students/new1'), studentDoc({ points: -1 })));
  });

  it('الإنشاء المؤرشف ممنوع', async () => {
    await assertFails(setDoc(doc(udb(ALICE), 'students/new1'), studentDoc({ archived: true })));
  });

  it('نقل الطالب بين اللجان ممنوع لغير superAdmin', async () => {
    const snap = await getDoc(doc(udb(ALICE), 'students/st1'));
    const base = snap.data();
    await assertFails(updateDoc(doc(udb(ALICE), 'students/st1'), { ...base, committeeId: 'c2', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(udb(ALICE), 'students/st1'), { ...base, updatedAt: serverTimestamp() }));
  });

  it('الأرشفة يومية بصلاحية اللجنة والحذف النهائي للإدارة العليا فقط', async () => {
    await assertSucceeds(updateDoc(doc(udb(ALICE), 'students/st1'), { archived: true, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(udb(ALICE), 'students/st1')));
    await assertSucceeds(deleteDoc(doc(udb(ROOT), 'students/st1')));
  });
});

describe('الطلبات والتوجيه', () => {
  const nonFinancial = (type: string, dest: string) => ({
    type,
    createdBy: ALICE,
    createdByName: NAME[ALICE],
    senderCommitteeId: 'c1',
    destinationCommitteeId: dest,
    title: 'عنوان كافٍ للطلب',
    body: '',
    status: 'submitted',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const financial = (over: Record<string, unknown> = {}) => ({
    ...nonFinancial('expense', 'c2'),
    amount: 5000,
    currency: 'SYP',
    direction: 'expense',
    ...over,
  });

  it('الوجهة الثابتة تُفرض', async () => {
    await assertFails(setDoc(doc(udb(ALICE), 'requests/r1'), nonFinancial('formatting', 'c1')));
    await assertSucceeds(setDoc(doc(udb(ALICE), 'requests/r1'), nonFinancial('formatting', 'c2')));
  });

  it('sender_choice يمنع التوجيه للذات ويسمح لغيرها', async () => {
    await assertFails(setDoc(doc(udb(ALICE), 'requests/r1'), nonFinancial('support', 'c1')));
    await assertSucceeds(setDoc(doc(udb(ALICE), 'requests/r1'), nonFinancial('support', 'c2')));
  });

  it('الطلب المالي بلا مبلغ يرفض والاتجاه الخاطئ يرفض والصحيح ينجح', async () => {
    const { amount: _a, currency: _c, direction: _d, ...noMoney } = financial();
    await assertFails(setDoc(doc(udb(ALICE), 'requests/r1'), noMoney));
    await assertFails(setDoc(doc(udb(ALICE), 'requests/r1'), financial({ direction: 'income' })));
    await assertFails(setDoc(doc(udb(ALICE), 'requests/r1'), financial({ amount: 0 })));
    await assertFails(setDoc(doc(udb(ALICE), 'requests/r1'), financial({ currency: 'EUR' })));
    await assertSucceeds(setDoc(doc(udb(ALICE), 'requests/r1'), financial()));
  });

  it('الطلب غير المالي لا يقبل حقول المال', async () => {
    await assertFails(setDoc(doc(udb(ALICE), 'requests/r1'), { ...nonFinancial('formatting', 'c2'), amount: 5 }));
  });

  it('انتحال اسم المرسل أو الحالة يرفض', async () => {
    await assertFails(setDoc(doc(udb(ALICE), 'requests/r1'), {
      ...nonFinancial('formatting', 'c2'), createdByName: 'شخص آخر',
    }));
    await assertFails(setDoc(doc(udb(ALICE), 'requests/r1'), {
      ...nonFinancial('formatting', 'c2'), status: 'approved',
    }));
  });

  it('القرار يتطلب صلاحية اللجنة الوجهة وسببًا', async () => {
    await assertFails(updateDoc(doc(udb(ALICE), 'requests/reqOpen'), {
      status: 'approved',
      decisionReason: 'موافقة',
      decidedBy: ALICE,
      decidedByName: NAME[ALICE],
      decidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(udb(SAMIR), 'requests/reqToReject'), {
      status: 'rejected',
      decidedBy: SAMIR,
      decidedByName: NAME[SAMIR],
      decidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(udb(SAMIR), 'requests/reqOpen'), {
      status: 'approved',
      decisionReason: 'الطلب مكتمل',
      decidedBy: SAMIR,
      decidedByName: NAME[SAMIR],
      decidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  });

  it('المرسل يلغي طلبه وغيره لا يلغي', async () => {
    await assertFails(updateDoc(doc(udb(SAMIR), 'requests/reqToCancel'), {
      status: 'cancelled', updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(udb(ALICE), 'requests/reqToCancel'), {
      status: 'cancelled', updatedAt: serverTimestamp(),
    }));
  });

  it('قواعد التوجيه: المدير يعدلها والعضو لا، والوجهة الثابتة يجب أن تكون لجنة نشطة', async () => {
    await assertFails(updateDoc(doc(udb(ALICE), 'routingRules/support'), {
      type: 'support', mode: 'fixed', committeeId: 'c1', updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(udb(MGR), 'routingRules/support'), {
      type: 'support', mode: 'fixed', committeeId: 'c404', updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(udb(MGR), 'routingRules/support'), {
      type: 'support', mode: 'fixed', committeeId: 'c1', updatedAt: serverTimestamp(),
    }));
  });
});

describe('التنفيذ المالي والحركة غير القابلة للتعديل', () => {
  const execUpdate = {
    status: 'executed',
    executedBy: SAMIR,
    executedByName: NAME[SAMIR],
    executedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ledgerDoc = {
    requestId: 'reqApproved',
    committeeId: 'c2',
    type: 'expense',
    direction: 'expense',
    amount: 5000,
    currency: 'SYP',
    note: 'تم القبول',
    executedBy: SAMIR,
    executedByName: NAME[SAMIR],
    executedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  it('التنفيذ بلا حركة مالية يرفض', async () => {
    await assertFails(updateDoc(doc(udb(SAMIR), 'requests/reqApproved'), execUpdate));
  });

  it('الدفعة الكاملة: تنفيذ + حركة متطابقة تنجح', async () => {
    const b = writeBatch(udb(SAMIR));
    b.update(doc(udb(SAMIR), 'requests/reqApproved'), execUpdate);
    b.set(doc(udb(SAMIR), 'ledgerEntries/reqApproved'), ledgerDoc);
    await assertSucceeds(b.commit());
  });

  it('حركة بمبلغ مغاير للطلب ترفض الدفعة كلها', async () => {
    const b = writeBatch(udb(SAMIR));
    b.update(doc(udb(SAMIR), 'requests/reqApproved'), execUpdate);
    b.set(doc(udb(SAMIR), 'ledgerEntries/reqApproved'), { ...ledgerDoc, amount: 999 });
    await assertFails(b.commit());
  });

  it('التنفيذ المكرر يرفض بعد أول تنفيذ', async () => {
    const b = writeBatch(udb(SAMIR));
    b.update(doc(udb(SAMIR), 'requests/reqApproved'), execUpdate);
    b.set(doc(udb(SAMIR), 'ledgerEntries/reqApproved'), ledgerDoc);
    await assertSucceeds(b.commit());

    const b2 = writeBatch(udb(SAMIR));
    b2.update(doc(udb(SAMIR), 'requests/reqApproved'), execUpdate);
    b2.set(doc(udb(SAMIR), 'ledgerEntries/reqApproved'), ledgerDoc);
    await assertFails(b2.commit());
  });

  it('الحركة المالية append-only: لا تعديل ولا حذف', async () => {
    const b = writeBatch(udb(SAMIR));
    b.update(doc(udb(SAMIR), 'requests/reqApproved'), execUpdate);
    b.set(doc(udb(SAMIR), 'ledgerEntries/reqApproved'), ledgerDoc);
    await assertSucceeds(b.commit());

    await assertFails(updateDoc(doc(udb(SAMIR), 'ledgerEntries/reqApproved'), { amount: 1 }));
    await assertFails(deleteDoc(doc(udb(SAMIR), 'ledgerEntries/reqApproved')));
    await assertFails(deleteDoc(doc(udb(ROOT), 'ledgerEntries/reqApproved')));
  });

  it('قراءة الحركة تتطلب finance.read في لجنة الوجهة', async () => {
    const b = writeBatch(udb(SAMIR));
    b.update(doc(udb(SAMIR), 'requests/reqApproved'), execUpdate);
    b.set(doc(udb(SAMIR), 'ledgerEntries/reqApproved'), ledgerDoc);
    await assertSucceeds(b.commit());

    await assertFails(getDoc(doc(udb(ALICE), 'ledgerEntries/reqApproved')));
    await assertSucceeds(getDoc(doc(udb(SAMIR), 'ledgerEntries/reqApproved')));
    await assertSucceeds(getDocs(query(collection(udb(SAMIR), 'ledgerEntries'), where('committeeId', '==', 'c2'))));
  });
});

describe('القنوات والرسائل', () => {
  const message = (sender: string, text: string) => ({
    senderId: sender,
    senderName: NAME[sender],
    text,
    hidden: false,
    createdAt: serverTimestamp(),
  });

  const postBatch = (uid: string, ch: string, id: string, sender: string, text: string) => {
    const b = writeBatch(udb(uid));
    b.set(doc(udb(uid), `channels/${ch}/messages/${id}`), message(sender, text));
    b.update(doc(udb(uid), `channels/${ch}`), { lastActivityAt: serverTimestamp() });
    return b.commit();
  };

  it('الإعلانات للقراءة على الجميع المقبول والنشر للمدير فقط', async () => {
    await assertSucceeds(getDoc(doc(udb(ALICE), 'channels/ann')));
    await assertFails(postBatch(ALICE, 'ann', 'm1', ALICE, 'محاولة نشر'));
    await assertSucceeds(postBatch(ROOT, 'ann', 'm1', ROOT, 'إعلان أول'));
  });

  it('النشر دون bump للقناة يرفض', async () => {
    await assertFails(setDoc(doc(udb(ROOT), 'channels/ann/messages/m0'), message(ROOT, 'بلا تحديث نشاط')));
  });

  it('انتحال اسم المرسل يرفض', async () => {
    const b = writeBatch(udb(ROOT));
    b.set(doc(udb(ROOT), 'channels/ann/messages/m2'), message(ALICE, 'رسالة منتحلة'));
    b.update(doc(udb(ROOT), 'channels/ann'), { lastActivityAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('أعضاء اللجان المحددة فقط يرون قناة الدردشة وينشرون فيها', async () => {
    await assertFails(getDoc(doc(udb(SAMIR), 'channels/disc')));
    await assertFails(postBatch(SAMIR, 'disc', 'm3', SAMIR, ' outsider '));
    await assertSucceeds(postBatch(ALICE, 'disc', 'm3', ALICE, 'أهلًا بكم'));
  });

  it('النص الإلزامي: فارغ مرفوض وطويل جدًا مرفوض', async () => {
    await assertFails(postBatch(ALICE, 'disc', 'm4', ALICE, ''));
    await assertFails(postBatch(ALICE, 'disc', 'm4', ALICE, 'خ'.repeat(2001)));
    await assertSucceeds(postBatch(ALICE, 'disc', 'm4', ALICE, 'خ'.repeat(2000)));
  });

  it('الرسالة لا تعدل: المحتوى مقفول والإخفاء للمدير فقط', async () => {
    await assertFails(updateDoc(doc(udb(ALICE), 'channels/disc/messages/msg1'), { text: 'نص معدل' }));
    await assertFails(updateDoc(doc(udb(ALICE), 'channels/disc/messages/msg1'), { hidden: true }));
    await assertSucceeds(updateDoc(doc(udb(ROOT), 'channels/disc/messages/msg1'), { hidden: true }));
  });

  it('إيصالات القراءة لصاحبها فقط', async () => {
    await assertSucceeds(setDoc(doc(udb(ALICE), 'channelReads/alice-disc'), {
      uid: ALICE, channelId: 'disc', lastReadMessageId: 'msg1', lastReadAt: serverTimestamp(),
    }));
    await assertFails(setDoc(doc(udb(ALICE), 'channelReads/fake'), {
      uid: SAMIR, channelId: 'disc', lastReadMessageId: 'msg1', lastReadAt: serverTimestamp(),
    }));
    await assertSucceeds(setDoc(doc(udb(ALICE), 'channelReads/alice-disc'), {
      uid: ALICE, channelId: 'disc', lastReadMessageId: 'msg1', lastReadAt: serverTimestamp(),
    }));
    await assertFails(getDoc(doc(udb(SAMIR), 'channelReads/alice-disc')));
    await assertSucceeds(getDoc(doc(udb(ALICE), 'channelReads/alice-disc')));
  });
});

describe('الأثر الأمني وملفات العرض', () => {
  it('إنشاء حدث أمني بصيغة صحيحة ينجح ونوع مجهول يرفض والتعديل ممنوع', async () => {
    await assertSucceeds(setDoc(doc(udb(ALICE), 'securityEvents/e1'), {
      kind: 'request.cancelled', actorUid: ALICE, targetId: 'reqToCancel', at: serverTimestamp(),
    }));
    await assertFails(setDoc(doc(udb(ALICE), 'securityEvents/e2'), {
      kind: 'hax', actorUid: ALICE, targetId: 'x', at: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(udb(ALICE), 'securityEvents/e1'), { detail: 'تلاعب' }));
  });

  it('قراءة الأثر للمديرين فقط', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('securityEvents/e1').set({
        kind: 'finance.executed', actorUid: SAMIR, targetId: 'reqApproved', at: T0,
      });
    });
    await assertFails(getDoc(doc(udb(ALICE), 'securityEvents/e1')));
    await assertSucceeds(getDoc(doc(udb(MGR), 'securityEvents/e1')));
    await assertSucceeds(getDoc(doc(udb(ROOT), 'securityEvents/e1')));
  });

  it('profiles يقرأها المقبولون وينشئها المراجع للمقبولين فقط', async () => {
    await assertFails(getDoc(doc(udb(GUEST), `profiles/${ALICE}`)));
    // القراءة مسموحة للمقبولين حتى لو كانت الوثيقة غير موجودة (لا خطأ صلاحية).
    await assertSucceeds(getDoc(doc(udb(ALICE), `profiles/${ROOT}`)));

    await assertFails(setDoc(doc(udb(MGR), `profiles/${GUEST}`), {
      uid: GUEST, name: NAME[GUEST], phone: '963900000005', committeeIds: [], createdAt: serverTimestamp(),
    }));
    await assertSucceeds(setDoc(doc(udb(MGR), `profiles/${ALICE}`), {
      uid: ALICE, name: NAME[ALICE], phone: '963900000005', committeeIds: ['c1'], createdAt: serverTimestamp(),
    }));
  });
});
