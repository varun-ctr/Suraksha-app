/**
 * Pure wall-clock logic for the app-lock ("unlock on resume") feature —
 * mirrors journeyRecoveryPolicy.ts's pattern of deriving a decision from a
 * timestamp + the current time rather than an incrementally-updated flag,
 * so it's correct regardless of how long the JS engine was suspended while
 * backgrounded.
 *
 * `graceMs` intentionally allows a short window after backgrounding during
 * which returning to the app does NOT require re-unlocking — a quick app
 * switch (answering a call, copying an SMS OTP code, glancing at another
 * app) shouldn't force a fresh Face ID prompt every time, which would make
 * the feature annoying enough that users disable it — undermining the
 * security goal entirely. Longer than the grace window, or a fresh cold
 * start, always requires unlocking again.
 */

/** Default: quick app-switches under 30s don't force a re-unlock; anything longer does. */
export const DEFAULT_APP_LOCK_GRACE_MS = 30_000;

/**
 * `backgroundedAtMs` is null when the app hasn't been backgrounded yet this
 * process lifetime (e.g. still on its very first foreground render) — in
 * that case there's nothing to compare against, so no unlock is newly
 * required by *this* check (the cold-start lock state is decided
 * separately, at mount, by the caller — see useAppLock.ts).
 */
export function shouldRequireUnlock(
  backgroundedAtMs: number | null,
  nowMs: number,
  graceMs: number = DEFAULT_APP_LOCK_GRACE_MS,
): boolean {
  if (backgroundedAtMs === null) return false;
  return nowMs - backgroundedAtMs >= graceMs;
}
