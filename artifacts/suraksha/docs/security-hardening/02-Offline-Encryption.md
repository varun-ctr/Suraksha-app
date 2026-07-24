# 2. Offline Storage Encryption

## The gap this closes

The prior security audit (`docs/security-audit/05-Secure-Storage.md`) identified the single largest MASVS-STORAGE finding in the codebase: `features/sos/services/sosOfflineQueue.ts` persisted **plaintext GPS coordinates and street address of a user in active distress** to bare `AsyncStorage`, and `features/journey/services/journeyPersistence.ts` persisted journey state the same way — no encryption, unlike the Firebase session (which already had a proven AES-256-CBC+HMAC-SHA256 envelope).

## What was reused, not duplicated

Per this pass's explicit instruction, no new crypto was written. Every encrypted value in this pass goes through the exact same primitives already protecting the Firebase session:
- `core/storage/aesCbcHmac.ts` — AES-256-CBC + HMAC-SHA256, encrypt-then-MAC, unchanged.
- `core/storage/cryptoBox.ts` — key generation/storage (Keychain/Keystore via `expo-secure-store`), unchanged.

## New files (thin wrappers only — zero new cryptographic code)

- **`core/storage/secureAsyncStorage.ts`** — `secureAsyncGet`/`secureAsyncSet`/`secureAsyncRemove`, a drop-in replacement for `AsyncStorage.getItem`/`setItem`/`removeItem` that transparently encrypts/decrypts through `cryptoBox.ts`. Structurally identical to `repositories/firebase/encryptedAuthStorage.ts`'s existing adapter (same `isEncryptedBlob` check, same lazy-migration-on-next-write behavior, same fail-closed-to-null-on-decrypt-failure contract) — generalized into a reusable helper instead of being copy-pasted a third time.
- **`core/storage/secureStorageMigration.ts`** — `migrateLegacyPlaintextKeys(keys)`, a proactive, one-time migration for records that might not be rewritten again soon after upgrading (see "Migration" below).

## Wired into (mechanical changes only — `AsyncStorage.*` calls replaced with `secureAsync*` calls, no logic changes)

| File | What's now encrypted |
|---|---|
| `features/sos/services/sosOfflineQueue.ts` | `PendingSosActivation` — includes `lat`, `lng`, `address` for an active emergency |
| `features/journey/services/journeyPersistence.ts` | `PersistedJourney` — journey identity, timing, escalation outcome |
| `core/permissions/backgroundLocation.ts` | `ACTIVE_SHARE_ID_KEY` — the live-session share token a background TaskManager task reads to know where to push location updates |

The `backgroundLocation.ts` change runs inside a headless background task (no React tree mounted — see that file's own header comment). This was verified safe: `secureAsyncGet`/`Set` depend only on `expo-secure-store` and `expo-crypto`, both of which are native-module calls with no dependency on a mounted UI, the same way the existing `liveSessionRepository` (a Supabase network client) already runs from this exact headless context.

## Migration for existing plaintext records

Two layers, matching the exact convention `encryptedAuthStorage.ts` already established for the Firebase session:

1. **Lazy** (built into `secureAsyncStorage.ts` itself): a value without the `encv1:` prefix is legacy plaintext — read and used as-is, then re-written encrypted the next time that key is saved. Covers the common case (an in-progress SOS/journey gets updated shortly after the app restarts).
2. **Proactive** (`secureStorageMigration.ts`'s `migrateLegacyPlaintextKeys`): called once at app startup (`app/_layout.tsx`, alongside the other init calls) with all three keys (`PENDING_ACTIVATION_KEY`, `ACTIVE_JOURNEY_KEY`, `ACTIVE_SHARE_ID_KEY`, all now exported from their owning modules). Reads each key directly; if present and not already encrypted, encrypts and re-writes it immediately — covering a record that might sit untouched for a while (e.g. a stale record left over from a crash, or simply no active SOS/journey right now to trigger the lazy path). Fire-and-forget (`void migrateLegacyPlaintextKeys([...])`), never blocks startup, and a failure for one key doesn't affect the others.

## Why this required no mobile UX/behavior change

Every change is internal to the storage layer. `savePendingActivation`/`getPendingActivation`/`updatePendingActivation`/`clearPendingActivation` and their journey equivalents keep their exact same signatures and call sites — `SafetyContext.tsx` was not touched at all. The only visible difference, if any, is a few extra milliseconds of AES overhead on each read/write, which is negligible next to the network round-trips already happening on the same code paths.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run test`: 95/95 passing (including the 5 pre-existing `appLockPolicy` tests and all prior suites — no new tests were needed for the storage wrappers themselves, consistent with this codebase's established convention that native/Supabase/SecureStore-touching code isn't unit-tested, only the pure crypto primitives underneath it, which were already tested before this pass and are unchanged). `npx madge --circular`: clean.
