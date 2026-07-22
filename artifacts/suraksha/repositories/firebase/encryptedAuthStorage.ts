/**
 * Storage adapter passed to firebase/auth's `getReactNativePersistence()`
 * in place of raw AsyncStorage — see firebaseClient.ts. Satisfies exactly
 * the 3-method `ReactNativeAsyncStorage` interface Firebase expects
 * (setItem/getItem/removeItem), transparently encrypting values at rest
 * via core/storage/cryptoBox so the persisted session (refresh token, ID
 * token, linked-provider metadata) isn't recoverable in plaintext from an
 * unencrypted device backup or a rooted/jailbroken filesystem dump.
 *
 * Migration: a value already stored in the old plaintext format (from
 * before this adapter existed) is detected via the encv1: prefix's absence
 * and returned as-is rather than treated as "no session" — this is what
 * lets an already-signed-in user keep their session across the upgrade
 * instead of being silently signed out. The very next write for that key
 * (Firebase writes routinely, e.g. on token refresh) re-persists it
 * encrypted, so migration happens lazily with no explicit migration step.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { isEncryptedBlob } from "@/core/storage/aesCbcHmac";
import { encryptForStorage, decryptFromStorage } from "@/core/storage/cryptoBox";
import { logger } from "@/core/logger/logger";

export const encryptedAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(key);
    } catch (e) {
      logger.warn("[encryptedAuthStorage] AsyncStorage read failed", e);
      return null;
    }
    if (raw === null) return null;
    if (!isEncryptedBlob(raw)) return raw; // legacy plaintext — pass through, see module doc

    const plaintext = await decryptFromStorage(raw);
    if (plaintext === null) {
      // Corrupted/tampered/undecryptable — fail closed. Firebase treats a
      // null read as "no persisted session", so this results in a fresh
      // anonymous sign-in, the same safe fallback used everywhere else in
      // the app when persisted state can't be trusted.
      logger.warn("[encryptedAuthStorage] stored session could not be decrypted; treating as signed out");
    }
    return plaintext;
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      const blob = await encryptForStorage(value);
      await AsyncStorage.setItem(key, blob);
    } catch (e) {
      logger.warn("[encryptedAuthStorage] write failed", e);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      logger.warn("[encryptedAuthStorage] remove failed", e);
    }
  },
};
