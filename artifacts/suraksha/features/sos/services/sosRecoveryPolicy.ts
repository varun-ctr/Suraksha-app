/**
 * Pure decision logic for SOS crash-recovery, extracted from
 * sosOfflineQueue.ts so it's unit-testable in plain Node — see
 * __tests__/sosRecoveryPolicy.test.ts.
 */

/**
 * A recovered pending activation older than this is treated as stale: the
 * emergency context has almost certainly already resolved one way or
 * another by the time the app is reopened, so silently popping the
 * full-screen "SOS active" UI hours or days later would be confusing and
 * wrong, not helpful. A stale activation still gets its DB record/alerts
 * reconciled in the background (see sosOfflineQueue.ts) — only the
 * UI-resumption behavior is capped by this.
 */
export const MAX_RECOVERABLE_AGE_MS = 30 * 60 * 1000;

/** True if a pending SOS activation from `triggeredAtMs` is too old to auto-resume the active-SOS UI for. */
export function isPendingActivationStale(triggeredAtMs: number, nowMs: number): boolean {
  return nowMs - triggeredAtMs > MAX_RECOVERABLE_AGE_MS;
}
