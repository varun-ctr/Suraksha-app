/**
 * One-time, best-effort migration of already-persisted plaintext
 * safety-sensitive records (SOS pending-activation queue, active journey
 * state, active live-session share id) to the encrypted envelope
 * (core/storage/secureAsyncStorage.ts), for records that might not be
 * rewritten again soon after upgrading to this pass — e.g. a stale record
 * left over from a crash, or a live session/journey that just isn't active
 * right now. secureAsyncStorage's own lazy migration (encrypt on next
 * write) already covers the common case of an in-progress SOS/journey that
 * gets updated shortly after launch; this covers the rest.
 *
 * Safe to call on every app launch — a no-op for any key that's absent or
 * already encrypted. Never throws; a failure for one key doesn't block the
 * others or app startup.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { isEncryptedBlob } from "@/core/storage/aesCbcHmac";
import { encryptForStorage } from "@/core/storage/cryptoBox";
import { logger } from "@/core/logger/logger";

export async function migrateLegacyPlaintextKeys(keys: readonly string[]): Promise<void> {
  await Promise.all(
    keys.map(async (key) => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw === null || isEncryptedBlob(raw)) return;
        const blob = await encryptForStorage(raw);
        await AsyncStorage.setItem(key, blob);
      } catch (e) {
        logger.warn(`[secureStorageMigration] failed to migrate ${key}`, e);
      }
    }),
  );
}
