import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  inMemoryPersistence,
  type Persistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FIREBASE_CONFIG = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY            ?? "",
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? "",
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         ?? "",
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             ?? "",
  measurementId:     process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

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

const firebaseApp = getApps().length === 0
  ? initializeApp(FIREBASE_CONFIG)
  : getApp();

let _fbAuth: ReturnType<typeof getAuth>;
try {
  _fbAuth = initializeAuth(firebaseApp, {
    persistence: asyncStoragePersistence,
  });
} catch {
  _fbAuth = getAuth(firebaseApp);
}

export const firebaseAuth = _fbAuth;
export { inMemoryPersistence };
export default firebaseApp;
