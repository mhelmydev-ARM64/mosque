import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, firebaseReady } from "../../lib/firebase";
import type { AppUser, Committee, CommitteeMembership } from "../../domain/models";
import { effectiveCommitteePermission, hasGlobalPermission } from "../../domain/permissions";

interface AuthContextValue {
  authUser: User | null;
  user: AppUser | null;
  authLoading: boolean;
  userLoading: boolean;
  logout: () => Promise<void>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  hasGlobal: (permission: string) => boolean;
  committeePerm: (committeeId: string, permission: string) => boolean;
  managedCommittees: string[];
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(firebaseReady);
  const [userLoading, setUserLoading] = useState(false);
  const [committees, setCommittees] = useState<Map<string, Committee | null>>(new Map());
  const [memberships, setMemberships] = useState<Map<string, CommitteeMembership | null>>(new Map());

  useEffect(() => {
    if (!firebaseReady || !auth) {
      setAuthLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!firebaseReady || !db || !authUser) {
      setUser(null);
      setUserLoading(false);
      return;
    }
    setUserLoading(true);
    const unsub = onSnapshot(
      doc(db, "users", authUser.uid),
      (snap) => {
        setUser(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<AppUser, "id">) } as AppUser) : null);
        setUserLoading(false);
      },
      () => {
        setUser(null);
        setUserLoading(false);
      }
    );
    return unsub;
  }, [authUser]);

  const cidKey = useMemo(() => [...(user?.committeeIds ?? [])].sort().join(","), [user?.committeeIds]);

  // وثائق اللجان والعضويات اللازمة لحسم الصلاحيات المحلية في الواجهة
  const uid = user?.uid ?? null;
  useEffect(() => {
    if (!firebaseReady || !db || !uid || !cidKey) {
      setCommittees(new Map());
      setMemberships(new Map());
      return;
    }
    const cids = cidKey.split(",");
    setCommittees(new Map(cids.map((c) => [c, null])));
    setMemberships(new Map(cids.map((c) => [c, null])));
    const unsubs = cids.flatMap((cid) => [
      onSnapshot(doc(db, "committees", cid), (snap) => {
        setCommittees((prev) => {
          const next = new Map(prev);
          next.set(cid, snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Committee, "id">) } as Committee) : null);
          return next;
        });
      }),
      onSnapshot(doc(db, "committees", cid, "members", uid), (snap) => {
        setMemberships((prev) => {
          const next = new Map(prev);
          next.set(cid, snap.exists() ? (snap.data() as CommitteeMembership) : null);
          return next;
        });
      }),
    ]);
    return () => unsubs.forEach((u) => u());
  }, [uid, cidKey]);

  const value = useMemo<AuthContextValue>(() => {
    return {
      authUser,
      user,
      authLoading,
      userLoading,
      logout: async () => {
        if (auth) await signOut(auth);
      },
      isSuperAdmin: user?.role === "superAdmin",
      isAdmin: user?.role === "admin" || user?.role === "superAdmin",
      isApproved: user?.status === "approved",
      hasGlobal: (permission) => !!user && hasGlobalPermission(user, permission),
      committeePerm: (committeeId, permission) =>
        !!user &&
        effectiveCommitteePermission(
          user,
          committeeId,
          committees.get(committeeId) ?? null,
          memberships.get(committeeId) ?? null,
          permission as Parameters<typeof effectiveCommitteePermission>[4]
        ),
      managedCommittees: user?.committeeIds ?? [],
    };
  }, [authUser, user, authLoading, userLoading, committees, memberships]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
