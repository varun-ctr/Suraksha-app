/**
 * Drop-in AsyncStorage.getItem/setItem/removeItem replacement that
 * transparently encrypts values at rest using the same AES-256-CBC +
 * HMAC-SHA256 envelope already protecting the Firebase session
 * (core/storage/cryptoBox.ts) — reused here rather than duplicated, per
 * this pass's brief. Intended for safety-sensitive, transient records that
 * don't fit expo-secure-store's per-item size limit and so can't just move
 * to core/storage/secureStore.ts directly (see cryptoBox.ts's own header
 * for why the Firebase session has the same constraint).
 *
 * Migration: exactly mirrors repositories/firebase/encryptedAuthStorage.ts's
 * approach — a value without the `encv1:` prefix is legacy plaintext,
 * returned as-is (never silently discarded) rather than treated as "no
 * value", and gets re-written encrypted the next time that key is saved.
 * See core/storage/secureStorageMigration.ts for a proactive, one-time
 * migration of keys that might not be rewritten again soon after upgrade.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { isEncryptedBlob } from "@/core/storage/aesCbcHmac";
import { encryptForStorage, decryptFromStorage } from "@/core/storage/cryptoBox";
import { logger } from "@/core/logger/logger";

export async function secureAsyncGet(key: string): Promise<string | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch (e) {
    logger.warn(`[secureAsyncStorage] read failed for ${key}`, e);
    return null;
  }
  if (raw === null) return null;
  if (!isEncryptedBlob(raw)) return raw; // legacy plaintext — pass through, see module doc

  const plaintext = await decryptFromStorage(raw);
  if (plaintext === null) {
    // Corrupted/tampered/undecryptable — fail closed, same convention as
    // encryptedAuthStorage.ts: callers treat null as "nothing persisted".
    logger.warn(`[secureAsyncStorage] stored value for ${key} could not be decrypted; treating as absent`);
  }
  return plaintext;
}

export async function secureAsyncSet(key: string, value: string): Promise<void> {
  try {
    const blob = await encryptForStorage(value);
    await AsyncStorage.setItem(key, blob);
  } catch (e) {
    logger.warn(`[secureAsyncStorage] write failed for ${key}`, e);
  }
}

export async function secureAsyncRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    logger.warn(`[secureAsyncStorage] remove failed for ${key}`, e);
  }
}
