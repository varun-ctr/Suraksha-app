/**
 * Centralized journey-duration validation — pure (mirrors
 * journeyRecoveryPolicy.ts's testability convention), returning a typed
 * Result<number, ValidationError> instead of throwing or silently clamping.
 *
 * The UI only ever offers 15/30/60-minute presets, so these bounds are
 * chosen to comfortably contain every legitimate preset while rejecting
 * pathological values (negative, zero, a few seconds, multi-day) that could
 * only reach this code through a malformed/direct call, not the picker.
 *
 * Relative (not "@/…") imports: this module is executed directly by plain
 * Node (`node --test`) for unit tests, which has no path-alias resolution
 * (see repositories/api/emailOtpErrorMapper.ts for the same convention).
 */
import { ValidationError } from "../errors/ValidationError.ts";
import { ok, err, type Result } from "../result/Result.ts";

export const MIN_JOURNEY_DURATION_MINUTES = 5;
export const MAX_JOURNEY_DURATION_MINUTES = 240; // 4 hours

export function validateJourneyDuration(minutes: number): Result<number, ValidationError> {
  if (!Number.isFinite(minutes)) {
    return err(new ValidationError("Journey duration must be a finite number", { field: "durationMinutes" }));
  }
  if (minutes <= 0) {
    return err(new ValidationError("Journey duration must be greater than zero", { field: "durationMinutes" }));
  }
  if (minutes < MIN_JOURNEY_DURATION_MINUTES) {
    return err(new ValidationError(
      `Journey duration must be at least ${MIN_JOURNEY_DURATION_MINUTES} minutes`,
      { field: "durationMinutes" },
    ));
  }
  if (minutes > MAX_JOURNEY_DURATION_MINUTES) {
    return err(new ValidationError(
      `Journey duration must be at most ${MAX_JOURNEY_DURATION_MINUTES} minutes`,
      { field: "durationMinutes" },
    ));
  }
  return ok(minutes);
}
