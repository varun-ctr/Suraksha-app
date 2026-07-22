import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { initializeAuth, getAuth, type Auth } from "firebase/auth";
// `getReactNativePersistence` ships in the React-Native build of firebase/auth
// (@firebase/auth's "react-native" entry) but is intentionally absent from the
// package's web type definitions, so it must be imported with a type override.
// It persists the auth session via the storage adapter passed to it. The
// previous hand-rolled persistence object crashed with "INTERNAL ASSERTION
// FAILED: Expected a class definition".
// @ts-expect-error — RN-only export missing from firebase/auth web typings
import { getReactNativePersistence } from "firebase/auth";
import { encryptedAuthStorage } from "./encryptedAuthStorage";

// ── Lazy singletons — populated by initFirebase() ─────────────────────────────
let _firebaseApp: FirebaseApp | null = null;
let _firebaseAuth: Auth | null = null;

/**
 * Initialize Firebase exactly once.
 * Called from app/_layout.tsx at module level ONLY when config validation passes.
 */
export function initFirebase(config: {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}): void {
  _firebaseApp = getApps().length === 0 ? initializeApp(config) : getApp();
  try {
    _firebaseAuth = initializeAuth(_firebaseApp, {
      persistence: getReactNativePersistence(encryptedAuthStorage),
    });
  } catch {
    // Already initialized (fast refresh) or persistence unavailable — fall back
    // to the default auth instance rather than crashing.
    _firebaseAuth = getAuth(_firebaseApp);
  }
}

/**
 * Proxy that forwards all property access to the real Auth instance.
 * Returns null for currentUser before initialization (safe for startup).
 * Throws for any other access before initFirebase() is called.
 */
export const firebaseAuth = new Proxy({} as Auth, {
  get(_, prop) {
    if (!_firebaseAuth) {
      if (prop === "currentUser") return null;
      throw new Error("[Suraksha] Firebase Auth used before initialization — call initFirebase() first");
    }
    const val = Reflect.get(_firebaseAuth, prop as string | symbol, _firebaseAuth);
    return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(_firebaseAuth) : val;
  },
});
