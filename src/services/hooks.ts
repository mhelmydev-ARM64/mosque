import { useEffect, useMemo, useState } from "react";
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
  LedgerEntry,
  Profile,
  RequestDoc,
  RoutingRule,
  Student,
  StudentTemplate,
} from "../domain/models";

export interface SnapshotState<T> {
  data: T;
  loading: boolean;
  error: string | null;
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
  }, [q]);

  return { data, loading, error };
}

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
    const unsub = onSnapshot(
      query(typedRef<Profile>("profiles"), where("committeeIds", "array-contains-any", ids)),
      (snap) => setState({ data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Profile, "id">) })), loading: false, error: null }),
      (e) => setState({ data: [], loading: false, error: errText(e) })
    );
    return unsub;
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
    return query(
      typedRef<Student>("students"),
      ...parts,
      ...(orderByField === "points" ? [orderBy("points", "desc")] : [orderBy("normalizedName", "asc")])
    );
  }, [committeeId, archived, namePrefix, orderByField]);
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
  }, [ids]);

  return state;
}

export function useRequestsFor(committeeIds: string[], createdBy: string | null) {
  const key = useMemo(() => (createdBy ? `u:${createdBy}` : [...committeeIds].sort().join(",")), [committeeIds, createdBy]);
  const ids = useMemo(() => (key.startsWith("u:") ? [] : key.split(",")), [key]);
  const [state, setState] = useState<SnapshotState<RequestDoc[]>>({ data: [], loading: true, error: null });

  useEffect(() => {
    if (!firebaseReady || !db) return;
    if (createdBy) {
      setState((s) => ({ ...s, loading: true, error: null }));
      const unsub = onSnapshot(
        query(typedRef<RequestDoc>("requests"), where("createdBy", "==", createdBy)),
        (snap) => setState({ data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RequestDoc, "id">) })), loading: false, error: null }),
        (e) => setState({ data: [], loading: false, error: errText(e) })
      );
      return unsub;
    }
    if (ids.length === 0) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const merged = new Map<string, RequestDoc>();
    const unsubs = ids.map((cid) =>
      onSnapshot(
        query(typedRef<RequestDoc>("requests"), where("destinationCommitteeId", "==", cid)),
        (snap) => {
          for (const d of snap.docs) merged.set(d.id, { id: d.id, ...(d.data() as Omit<RequestDoc, "id">) });
          setState({ data: [...merged.values()], loading: false, error: null });
        },
        (e) => setState({ data: [...merged.values()], loading: false, error: errText(e) })
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [ids, createdBy, key]);

  return state;
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
