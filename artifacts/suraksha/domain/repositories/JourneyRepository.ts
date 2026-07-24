import type { Result } from "@/domain/result/Result";
import type { AppError } from "@/domain/errors";
import type { Journey } from "@/domain/entities/Journey";

export interface JourneyRepository {
  /**
   * Persists the start of a new journey for the signed-in user.
   * `journeyId` is a client-generated, stable UUID (see
   * features/sos/context/SafetyContext.tsx's startJourney) used as the
   * row's primary key — this is what makes the retry this method performs
   * internally on transient failure truly idempotent (checking for an
   * existing row by its exact id, not a best-effort time-window heuristic).
   * Validates `durationMinutes` via domain/policies/journeyValidation.ts
   * before attempting any write. Best-effort from the caller's
   * perspective beyond that — see
   * features/journey/services/journeyPersistence.ts for the local,
   * durable record this backs up, which is the actual safety mechanism
   * regardless of whether this backend write ultimately succeeds.
   */
  startJourney(journeyId: string, durationMinutes: number): Promise<Result<Journey, AppError>>;
  /** Marks a journey ended (checked in, cancelled, or auto-escalated to SOS). Naturally idempotent (an update by id), not retried. */
  endJourney(id: string): Promise<Result<void, AppError>>;
}
