/**
 * Pure check, kept separate from firebaseAuth.ts (which pulls in native
 * modules at import time) so it's unit-testable in plain Node — see
 * __tests__/reauthCheck.test.ts.
 */

/**
 * True for any Firebase error code indicating a sensitive operation
 * (account deletion, email change, etc.) was rejected because the session
 * is too old — Firebase requires a *recent* sign-in for these, distinct
 * from an otherwise-valid, still-refreshing session. Centralized so every
 * call site that needs to detect "please sign in again before doing this"
 * checks the same set of codes rather than each guessing at just one.
 */
export function isReauthRequired(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return code === "auth/requires-recent-login" || code === "auth/user-token-expired";
}
