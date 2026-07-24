/**
 * Pure, wall-clock-based journey status computation — the core fix for the
 * biggest reliability gap found in the journey-tracking audit.
 *
 * Before this: journey elapsed/overdue state was tracked by incrementing a
 * counter once per second via `setInterval` (see the original
 * SafetyContext.tsx journey timer). That only advances while the JS engine
 * is actually running — it does NOT run once the app is backgrounded long
 * enough for iOS to suspend JS, and never runs at all if the app is killed.
 * A user starting a 15-minute check-in timer and locking their phone (the
 * overwhelmingly common real case) would silently get zero protection: the
 * countdown simply stops ticking, "overdue" is never detected, and the
 * auto-SOS escalation — the entire point of the feature — never fires.
 *
 * The fix: persist `startedAtMs` once, and always derive the *current*
 * status from `Date.now() - startedAtMs`, not from an incrementally-updated
 * counter. This makes every check — on each live tick, on app foreground,
 * and on a fresh launch after the app was killed — self-correcting: it's
 * always computed fresh from wall-clock time, so it doesn't matter whether
 * or how long the JS engine was suspended in between.
 *
 * This does not make background execution itself more reliable (iOS still
 * won't run arbitrary JS on a timer while suspended) — see
 * docs/journey-audit/reliability-audit.md for why a server-side monitor is
 * the only way to close that residual gap completely. What this guarantees
 * is that the moment the app *is* running (foreground, relaunch, or a
 * background wake for any other reason), the journey's status is always
 * computed correctly, never drifted or stale.
 */

export interface JourneyTiming {
  startedAtMs: number;
  durationSec: number;
  overdueGraceSec: number;
}

export type JourneyWallClockStatus =
  | { phase: "active"; elapsedSec: number; secondsRemaining: number }
  | { phase: "overdue"; overdueElapsedSec: number; graceSecondsRemaining: number }
  /** The grace period has fully elapsed — auto-SOS should fire (or already should have). */
  | { phase: "expired"; overdueElapsedSec: number };

/** Computes the journey's current status purely from timing + the current wall-clock time. Never mutates, never reads any ambient/global state. */
export function computeJourneyStatus(timing: JourneyTiming, nowMs: number): JourneyWallClockStatus {
  const elapsedSec = Math.max(0, Math.floor((nowMs - timing.startedAtMs) / 1000));

  if (elapsedSec < timing.durationSec) {
    return { phase: "active", elapsedSec, secondsRemaining: timing.durationSec - elapsedSec };
  }

  const overdueElapsedSec = elapsedSec - timing.durationSec;
  if (overdueElapsedSec < timing.overdueGraceSec) {
    return { phase: "overdue", overdueElapsedSec, graceSecondsRemaining: timing.overdueGraceSec - overdueElapsedSec };
  }

  return { phase: "expired", overdueElapsedSec };
}
