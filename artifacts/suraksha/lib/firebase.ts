import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  type Auth,
  type Persistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── AsyncStorage persistence (Firebase v12 — no getReactNativePersistence) ──
const asyncStoragePersistence = {
  type: "LOCAL",
  async _isAvailable() { return true; },
  async _set(key: string, value: unknown) {
    try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  },
  async _get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch { return null; }
  },
  async _remove(key: string) {
    try { await AsyncStorage.removeItem(key); } catch { /* ignore */ }
  },
  _addListener() {},
  _removeListener() {},
} as unknown as Persistence;

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
      persistence: asyncStoragePersistence,
    });
  } catch {
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
