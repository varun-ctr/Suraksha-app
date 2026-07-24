import type { Result } from "@/domain/result/Result";
import type { AppError } from "@/domain/errors";
import type { Journey } from "@/domain/entities/Journey";

export interface JourneyRepository {
  /** Persists the start of a new journey for the signed-in user. Best-effort from the caller's perspective — see features/journey/services/journeyPersistence.ts for the local, durable record this backs up. */
  startJourney(durationMinutes: number): Promise<Result<Journey, AppError>>;
  /** Marks a journey ended (checked in, cancelled, or auto-escalated to SOS). */
  endJourney(id: string): Promise<Result<void, AppError>>;
}
