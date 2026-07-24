/**
 * Extension point for community-report spam/abuse detection.
 *
 * Deliberately a no-op today: a heuristic or ML-based classifier needs real
 * traffic data to calibrate thresholds against without incorrectly
 * flagging legitimate safety reports — getting that wrong in a safety app
 * (rejecting or hiding a genuine harassment/stalking report) is worse than
 * not detecting spam at all, and this environment has no real traffic to
 * validate thresholds against. The call site (community-reports.ts) already
 * logs whenever this returns a non-empty result, so wiring in a real
 * implementation later requires no route changes — only this function.
 */
export interface SpamSignal {
  reason: string;
}

export function detectSpamSignals(_report: {
  type: string;
  description: string | null;
}): SpamSignal[] {
  return [];
}
