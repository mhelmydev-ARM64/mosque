import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type CollectionReference,
  type DocumentReference,
  type Query,
} from "firebase/firestore";
import { db, firebaseReady } from "../lib/firebase";
import type {
  AdminApprovalMessage,
  AppUser,
  Channel,
  ChannelRead,
  Committee,
  CommitteeMembership,
  CommitteeTask,
  LedgerEntry,
  Profile,
  RequestDoc,
  RoutingRule,
  Student,
  StudentTemplate,
  WeeklyReport,
} from "../domain/models";

export interface SnapshotState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

/**
 * يؤخر فتح المستمعين خطوة واحدة كي تُلغى الاستعارات اللحظية
 * (StrictMode في التطوير، أو التنقل السريع بين الصفحات) قبل أن تُفتح أصلًا.
 * بلا ذلك يفتح SDK قاعدة البيانات أهدافًا ثم يزيلها فورًا، وهو نمط
 * يوقظ خطأً داخليًا معروفًا في SDK عند العمل مع المحاكي (ca9).
 */
function deferredListen(open: () => () => void): () => void {
  let cleanup: (() => void) | null = null;
  const timer = window.setTimeout(() => {
    cleanup = open();
  }, 0);
  return () => {
    window.clearTimeout(timer);
    if (cleanup) cleanup();
  };
}

export function errText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code === "permission-denied") return "لا تملك صلاحية الوصول لهذه البيانات";
  if (code === "failed-precondition") return "فهرس قاعدة البيانات غير جاهز بعد، حاول بعد دقائق";
  if (code === "unavailable") return "تعذر الاتصال بقاعدة البيانات";
  return "خطأ في تحميل البيانات";
}

export function useCollection<T>(q: Query<T> | null): SnapshotState<T[]> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(!!q);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q || !firebaseReady || !db) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    return deferredListen(() => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<T, "id">) })) as T[]);
          setLoading(false);
        },
        (e) => {
          setError(errText(e));
          setLoading(false);
        }
      );
      return unsub;
    });
  }, [q]);

  return { data, loading, error };
}

interface ScopeSlot<T> {
  bucket: Map<string, T>;
  ready: boolean;
  error: string | null;
  timer: number | null;
  unsub: (() => void) | null;
}

/**
 * مستمع موزَّع يدمج عدة استعلامات على المجموعة نفسها.
 *
 * القاعدة الأمنية في Firestore لا تُثبت `list` إلا إذا كان قيد الاستعلام نفسه
 * كافيًا، لذا كل استعلام هنا يحمل قيد مساواة واحدًا على حقل واحد فقط.
 *
 * لكل مقطع من المفتاح (`all` أو `field=value` مفصولة بـ `|`) «خانة» مستمع
 * تُفتح مرة وتبقى عبر تغيّرات المفتاح، ولا يُغلق إلا المقاطع المُزالة فعلًا.
 * وفتح الخانات الجديدة موزَّع بفاصل قصير بدل دفعة واحدة. السبب: إضافة أهداف
 * وإزالتها دفعة واحدة أثناء وصول اللقطات يوقظ خطأً داخليًا معروفًا في SDK
 * (ca9) كان يسقط الصفحات الثقيلة عند وصول أول بيانات اللجان.
 */
function useScopedCollection<T>(path: string, key: string): SnapshotState<T[]> {
  const [state, setState] = useState<SnapshotState<T[]>>({ data: [], loading: !!key, error: null });
  const slots = useRef(new Map<string, ScopeSlot<T>>());
  const slotsPath = useRef(path);

  const closeAll = useCallback(() => {
    for (const slot of slots.current.values()) {
      if (slot.timer !== null) window.clearTimeout(slot.timer);
      if (slot.unsub) slot.unsub();
    }
    slots.current.clear();
  }, []);

  const flush = useCallback(() => {
    const merged = new Map<string, T>();
    let ready = true;
    let error: string | null = null;
    for (const slot of slots.current.values()) {
      for (const [id, value] of slot.bucket) merged.set(id, value);
      if (!slot.ready) ready = false;
      if (slot.error) error = slot.error;
    }
    setState({ data: [...merged.values()], loading: !ready, error });
  }, []);

  useEffect(() => {
    if (!firebaseReady || !db) {
      closeAll();
      setState({ data: [], loading: false, error: null });
      return;
    }
    if (slotsPath.current !== path) {
      closeAll();
      slotsPath.current = path;
    }
    const want = new Set(key ? key.split("|").filter(Boolean) : []);
    if (want.size === 0) {
      closeAll();
      setState({ data: [], loading: false, error: null });
      return;
    }

    for (const [spec, slot] of slots.current) {
      if (want.has(spec)) continue;
      if (slot.timer !== null) window.clearTimeout(slot.timer);
      if (slot.unsub) slot.unsub();
      slots.current.delete(spec);
    }

    let i = 0;
    for (const spec of want) {
      if (slots.current.has(spec)) continue;
      const slot: ScopeSlot<T> = { bucket: new Map(), ready: false, error: null, timer: null, unsub: null };
      slots.current.set(spec, slot);
      slot.timer = window.setTimeout(() => {
        slot.timer = null;
        if (slots.current.get(spec) !== slot) return;
        const sep = spec.indexOf("=");
        const q =
          sep === -1
            ? (typedRef<T>(path) as Query<T>)
            : query(typedRef<T>(path), where(spec.slice(0, sep), "==", spec.slice(sep + 1)));
        slot.unsub = onSnapshot(
          q,
          (snap) => {
            slot.bucket = new Map(
              snap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Omit<T, "id">) } as T])
            );
            slot.ready = true;
            slot.error = null;
            flush();
          },
          (e) => {
            slot.ready = true;
            slot.error = errText(e);
            flush();
          }
        );
      }, i * 25);
      i += 1;
    }
    flush();
  }, [path, key, closeAll, flush]);

  useEffect(() => () => closeAll(), [closeAll]);

  return state;
}

const sortedKey = (parts: string[]) => [...new Set(parts.filter(Boolean))].sort().join("|");

export function useDocument<T>(ref: DocumentReference<T> | null): SnapshotState<T | null> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!ref);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref || !firebaseReady || !db) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    return deferredListen(() => {
      const unsub = onSnapshot(
        ref,
        (snap) => {
          setData(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<T, "id">) } as T) : null);
          setLoading(false);
        },
        (e) => {
          setError(errText(e));
          setLoading(false);
        }
      );
      return unsub;
    });
  }, [ref]);

  return { data, loading, error };
}

function typedRef<T>(path: string): CollectionReference<T> {
  return collection(db!, path) as CollectionReference<T>;
}

export function useCommittees() {
  const q = useMemo(() => (firebaseReady && db ? typedRef<Committee>("committees") : null), []);
  const { data, loading, error } = useCollection<Committee>(q);
  const committees = useMemo(() => [...data].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "ar")), [data]);
  const byId = useMemo(() => {
    const map = new Map<string, Committee>();
    for (const c of data) map.set(c.id, c);
    return map;
  }, [data]);
  return { committees, byId, loading, error };
}

export function useTemplate() {
  const ref = useMemo(() => (firebaseReady && db ? doc(db!, "studentTemplates", "current") as DocumentReference<StudentTemplate> : null), []);
  return useDocument<StudentTemplate>(ref);
}

export function useRoutingRules() {
  const q = useMemo(() => (firebaseReady && db ? typedRef<RoutingRule>("routingRules") : null), []);
  const { data, loading, error } = useCollection<RoutingRule>(q);
  const byType = useMemo(() => {
    const map = new Map<string, RoutingRule>();
    for (const r of data) map.set(r.type, r);
    return map;
  }, [data]);
  return { rules: data, byType, loading, error };
}

/**
 * القنوات المرئية للمستخدم. القواعد ليست مرشحات، لذا يجب تقييد كل استعلام
 * ليطابق channelVisible() وإلا فشل الاستعلام بالكامل.
 */
export function useVisibleChannels(user: AppUser | null) {
  const isAdmin = user?.role === 'admin' || user?.role === 'superAdmin';
  const cidKey = useMemo(() => [...(user?.committeeIds ?? [])].slice(0, 10).sort().join(','), [user?.committeeIds]);
  const [state, setState] = useState<SnapshotState<Channel[]>>({ data: [], loading: true, error: null });

  const uid = user?.uid ?? null;
  const status = user?.status ?? null;
  useEffect(() => {
    if (!firebaseReady || !db || !uid || status !== 'approved') {
      setState({ data: [], loading: false, error: null });
      return;
    }
    const queries: Query<Channel>[] = [];
    if (isAdmin) {
      queries.push(typedRef<Channel>('channels'));
    } else {
      queries.push(
        query(typedRef<Channel>('channels'), where('audience', '==', 'allApproved'), where('status', '==', 'active'))
      );
      const cids = cidKey ? cidKey.split(',') : [];
      if (cids.length > 0) {
        queries.push(
          query(
            typedRef<Channel>('channels'),
            where('audience', '==', 'committees'),
            where('committeeIds', 'array-contains-any', cids),
            where('status', '==', 'active')
          )
        );
      }
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    return deferredListen(() => {
      const merged = new Map<string, Channel>();
      const unsubs = queries.map((q) =>
        onSnapshot(
          q,
          (snap) => {
            for (const d of snap.docs) merged.set(d.id, { id: d.id, ...(d.data() as Omit<Channel, 'id'>) });
            setState({ data: [...merged.values()], loading: false, error: null });
          },
          (e) => setState((s2) => ({ ...s2, loading: false, error: errText(e) }))
        )
      );
      return () => unsubs.forEach((u) => u());
    });
  }, [uid, status, cidKey, isAdmin]);

  return state;
}

/** إيصالات قراءة المستخدم لعرض علامة «جديد» في قائمة الشات. */
export function useMyChannelReads(uid: string | null) {
  const q = useMemo(
    () => (firebaseReady && db && uid ? query(typedRef<ChannelRead>('channelReads'), where('uid', '==', uid)) : null),
    [uid]
  );
  return useCollection<ChannelRead>(q);
}

export function useProfiles(committeeId?: string) {
  const q = useMemo(
    () =>
      firebaseReady && db
        ? committeeId
          ? query(typedRef<Profile>("profiles"), where("committeeIds", "array-contains", committeeId))
          : typedRef<Profile>("profiles")
        : null,
    [committeeId]
  );
  return useCollection<Profile>(q);
}

/** ملفات أعضاء لجان محددة (حتى 10) لعرض لجنة مرسل الرسالة. */
export function useProfilesIn(committeeIds: string[]) {
  const key = useMemo(() => [...committeeIds].sort().join(","), [committeeIds]);
  const [state, setState] = useState<SnapshotState<Profile[]>>({ data: [], loading: false, error: null });

  useEffect(() => {
    if (!firebaseReady || !db || !key) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    const ids = key.split(",");
    return deferredListen(() => {
      const unsub = onSnapshot(
        query(typedRef<Profile>("profiles"), where("committeeIds", "array-contains-any", ids)),
        (snap) => setState({ data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Profile, "id">) })), loading: false, error: null }),
        (e) => setState({ data: [], loading: false, error: errText(e) })
      );
      return unsub;
    });
  }, [key]);

  return state;
}

export function useApprovalInbox() {
  const q = useMemo(
    () =>
      firebaseReady && db
        ? query(typedRef<AdminApprovalMessage>("adminApprovalInbox"), where("status", "in", ["open", "under_review"]))
        : null,
    []
  );
  return useCollection<AdminApprovalMessage>(q);
}

export function useStudentsFor(
  committeeId: string | null,
  archived: boolean,
  namePrefix: string | null,
  orderByField: "name" | "points" = "name"
) {
  const q = useMemo(() => {
    if (!firebaseReady || !db || !committeeId) return null;
    const parts = [
      where("committeeId", "==", committeeId),
      where("archived", "==", archived),
      ...(namePrefix ? [where("normalizedName", ">=", namePrefix), where("normalizedName", "<", namePrefix + "\uf8ff")] : []),
    ];
    // نطاق على normalizedName يمنع الترتيب بحقل آخر، وإلا رفض Firestore الاستعلام
    const byPoints = orderByField === "points" && !namePrefix;
    return query(
      typedRef<Student>("students"),
      ...parts,
      ...(byPoints ? [orderBy("points", "desc")] : [orderBy("normalizedName", "asc")])
    );
  }, [committeeId, archived, namePrefix, orderByField]);
  return useCollection<Student>(q);
}

/**
 * دليل الطلاب العام — لكل من يملك students.oversight.
 * الاستعلام بلا قيد لجنة لأن القاعدة تثبته من المنحة العالمية وحدها.
 */
export function useAllStudents(archived: boolean, namePrefix: string | null, orderByField: "name" | "points" = "name") {
  const q = useMemo(() => {
    if (!firebaseReady || !db) return null;
    const byPoints = orderByField === "points" && !namePrefix;
    return query(
      typedRef<Student>("students"),
      where("archived", "==", archived),
      ...(namePrefix ? [where("normalizedName", ">=", namePrefix), where("normalizedName", "<", namePrefix + "\uf8ff")] : []),
      ...(byPoints ? [orderBy("points", "desc")] : [orderBy("normalizedName", "asc")])
    );
  }, [archived, namePrefix, orderByField]);
  return useCollection<Student>(q);
}

/** حركات مالية للجان المستخدم: مستمع لكل لجنة داخل Effect واحد ثابت. */
export function useLedgerFor(committeeIds: string[]) {
  const key = useMemo(() => [...committeeIds].sort().join(","), [committeeIds]);
  const ids = useMemo(() => (key ? key.split(",") : []), [key]);
  const [state, setState] = useState<SnapshotState<LedgerEntry[]>>({ data: [], loading: true, error: null });

  useEffect(() => {
    if (!firebaseReady || !db || ids.length === 0) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    return deferredListen(() => {
      const merged = new Map<string, LedgerEntry>();
      const unsubs = ids.map((cid) =>
        onSnapshot(
          query(typedRef<LedgerEntry>("ledgerEntries"), where("committeeId", "==", cid)),
          (snap) => {
            for (const d of snap.docs) merged.set(d.id, { id: d.id, ...(d.data() as Omit<LedgerEntry, "id">) });
            setState({ data: [...merged.values()], loading: false, error: null });
          },
          (e) => setState({ data: [...merged.values()], loading: false, error: errText(e) })
        )
      );
      return () => unsubs.forEach((u) => u());
    });
  }, [ids]);

  return state;
}

export interface RequestScope {
  /** لجان يستقبل فيها المستخدم الطلبات (requests.receive أو finance.read). */
  receiveCommittees?: string[];
  /** لجان يرسل منها المستخدم الطلبات (requests.send أو finance.read). */
  sendCommittees?: string[];
  /** طلبات أنشأها المستخدم نفسه. */
  createdBy?: string | null;
  /** صاحب requests.oversight يرى كل الطلبات باستعلام واحد بلا قيود. */
  all?: boolean;
}

/**
 * الطلبات المرئية للمستخدم حسب الجهات الثلاث في القواعد:
 * المستلمة، المرسلة، والإدارة. كل جهة استعلام مستقل بقيد واحد.
 */
export function useRequests(scope: RequestScope) {
  const { receiveCommittees = [], sendCommittees = [], createdBy = null, all = false } = scope;
  const recvKey = useMemo(() => sortedKey(receiveCommittees), [receiveCommittees]);
  const sendKey = useMemo(() => sortedKey(sendCommittees), [sendCommittees]);
  const key = useMemo(() => {
    if (all) return "all";
    const parts = [
      ...recvKey.split("|").filter(Boolean).map((c) => `destinationCommitteeId=${c}`),
      ...sendKey.split("|").filter(Boolean).map((c) => `senderCommitteeId=${c}`),
      ...(createdBy ? [`createdBy=${createdBy}`] : []),
    ];
    return sortedKey(parts);
  }, [all, recvKey, sendKey, createdBy]);

  return useScopedCollection<RequestDoc>("requests", key);
}

/** مهام لجنة (أو كل اللجان لصاحب requests.oversight). */
export function useTasks(committeeIds: string[], all = false) {
  const idsKey = useMemo(() => sortedKey(committeeIds), [committeeIds]);
  const key = useMemo(
    () => (all ? "all" : sortedKey(idsKey.split("|").filter(Boolean).map((c) => `committeeId=${c}`))),
    [all, idsKey]
  );
  return useScopedCollection<CommitteeTask>("tasks", key);
}

/** مهامي أنا كمكلَّف بها، في كل اللجان. */
export function useMyTasks(uid: string | null) {
  return useScopedCollection<CommitteeTask>("tasks", uid ? `assigneeUid=${uid}` : "");
}

/** التقارير الأسبوعية للجنة (أو كلها للإدارة). */
export function useWeeklyReports(committeeIds: string[], all = false) {
  const idsKey = useMemo(() => sortedKey(committeeIds), [committeeIds]);
  const key = useMemo(
    () => (all ? "all" : sortedKey(idsKey.split("|").filter(Boolean).map((c) => `committeeId=${c}`))),
    [all, idsKey]
  );
  return useScopedCollection<WeeklyReport>("weeklyReports", key);
}

export function useUserDoc(uid: string | null) {
  const ref = useMemo(() => (firebaseReady && db && uid ? (doc(db!, "users", uid) as DocumentReference<AppUser>) : null), [uid]);
  return useDocument<AppUser>(ref);
}

/** كل المستخدمين — للإدارة ذات users.review فقط. */
export function useAllUsers() {
  const q = useMemo(() => (firebaseReady && db ? typedRef<AppUser>("users") : null), []);
  return useCollection<AppUser>(q);
}

/** أعضاء لجنة محددة. */
export function useMembers(committeeId: string | null) {
  const q = useMemo(
    () => (firebaseReady && db && committeeId ? typedRef<CommitteeMembership>(`committees/${committeeId}/members`) : null),
    [committeeId]
  );
  return useCollection<CommitteeMembership>(q);
}

export async function fetchOnce<T>(q: Query<T>): Promise<T[]> {
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<T, "id">) })) as T[];
}

export type { RequestDoc };
