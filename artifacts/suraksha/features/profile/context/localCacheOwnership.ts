/**
 * Pure decision logic for AppContext.tsx's crash-recovery cache-ownership
 * check, extracted so it's unit-testable in plain Node — see
 * __tests__/localCacheOwnership.test.ts. See AppContext.tsx's `persist()`
 * doc comment for the full rationale (recovering a killed sign-out/account
 * deletion across app restarts via a persisted owner-uid marker).
 */

/**
 * True if locally-cached contacts/profile data — last known to belong to
 * `persistedOwnerUid` — must be cleared before being used/synced under
 * `currentUid`. False when there's no prior owner recorded (nothing to
 * clear) or the owner is unchanged (including the anonymous-upgrade case,
 * where Firebase preserves the same uid across linking, so no clear is
 * ever triggered by that transition).
 */
export function shouldClearLocalCache(
  persistedOwnerUid: string | null,
  currentUid: string | null,
): boolean {
  return persistedOwnerUid !== null && persistedOwnerUid !== currentUid;
}
