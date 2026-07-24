/**
 * Pure exponential-backoff delay calculation — used by
 * repositories/supabase/journeyRepository.ts's startJourney() retry loop.
 * Kept generic/dependency-free (no journey-specific concepts) so it's
 * reusable for any future bounded-retry need, and directly unit-testable.
 */

/** Delay before retry attempt `attempt` (0-indexed: 0 = the delay before the *first* retry, not the initial attempt). Doubles each attempt, capped at `maxDelayMs`. */
export function computeBackoffDelayMs(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const delay = baseDelayMs * 2 ** attempt;
  return Math.min(delay, maxDelayMs);
}
