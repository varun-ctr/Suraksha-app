/**
 * Explicit terminal states for a journey — replaces the previous implicit
 * model where "ended" was represented only by clearing state, with no
 * record of *why*. Each value has a distinct, non-overlapping meaning:
 *
 * - "completed" — user checked in safely before the deadline.
 * - "cancelled" — user manually ended the journey before any overdue state.
 * - "escalated" — the grace period expired AND an SOS was actually
 *                  triggered as a result.
 * - "expired"   — the grace period fully elapsed but SOS could NOT be
 *                  triggered (e.g. blocked because an unrelated SOS was
 *                  already active) — a real, distinct outcome, not merged
 *                  into "escalated", since it means the safety escalation
 *                  did not actually happen.
 *
 * "Recovered" is deliberately NOT a 5th value here: it isn't a mutually
 * exclusive alternative to the four above — a recovered journey still
 * resolves to exactly one of them (most often "escalated" or "expired",
 * since that's the scenario recovery exists for). It's tracked as a
 * separate dimension instead — see `wasRecoveredFromBackground` below and
 * journeyTelemetry.ts's "journey_recovery" event — answering "was this
 * outcome determined by the crash/background recovery path, or live?"
 * rather than being forced into the same field as "why did it end."
 */
export type JourneyOutcome = "completed" | "cancelled" | "escalated" | "expired";

/** Only meaningful when the outcome is "escalated" or "expired" — records *why* the grace period's expiry did or didn't result in an actual SOS trigger. */
export type JourneyEscalationReason =
  | "grace_period_elapsed"
  | "sos_blocked_by_existing_emergency";
