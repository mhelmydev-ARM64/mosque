import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseReady = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let authRef: Auth | null = null;
let dbRef: Firestore | null = null;

if (firebaseReady) {
  app = initializeApp(firebaseConfig);
  authRef = getAuth(app);
  dbRef = getFirestore(app);
  if (import.meta.env.VITE_USE_EMULATORS === 'true') {
    connectAuthEmulator(authRef, 'http://127.0.0.1:9099');
    connectFirestoreEmulator(dbRef, '127.0.0.1', 8080);
  }
}

export const auth = authRef as Auth;
export const db = dbRef as Firestore;

/** يجب استدعاء هذه الدوال فقط بعد التحقق من firebaseReady. */
export function requireAuth(): Auth {
  if (!authRef) throw new Error('FIREBASE_NOT_CONFIGURED');
  return authRef;
}

export function requireDb(): Firestore {
  if (!dbRef) throw new Error('FIREBASE_NOT_CONFIGURED');
  return dbRef;
}
