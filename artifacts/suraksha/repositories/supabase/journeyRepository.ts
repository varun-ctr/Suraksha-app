import { db } from "./supabaseClient";
import { getCurrentFirebaseUser } from "@/repositories/firebase/firebaseAuth";
import { AuthError, RepositoryError, type AppError } from "@/domain/errors";
import { ok, err, type Result } from "@/domain/result/Result";
import type { Journey } from "@/domain/entities/Journey";
import type { JourneyRepository } from "@/domain/repositories/JourneyRepository";
import { validateJourneyDuration } from "@/domain/policies/journeyValidation";
import { computeBackoffDelayMs } from "@/domain/policies/retryBackoff";
import { trackJourneyEvent } from "@/core/analytics/journeyTelemetry";
import { logger } from "@/core/logger/logger";
import { toJourney } from "./mappers/journeyMapper";

const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 4000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Starts a journey with a client-generated, stable `journeyId` as the row's
 * primary key, retrying up to MAX_ATTEMPTS times with exponential backoff
 * on transient failure. Because the id is stable across attempts (not
 * server-generated per insert), a retry first checks whether a prior
 * attempt's insert actually succeeded server-side even though its response
 * never reached the client — an exact-id lookup, not the time-window
 * best-effort heuristic sos_events needs (that table has no
 * client-controlled id). This makes duplicate-journey creation
 * structurally impossible from this code path, not just unlikely.
 */
async function startJourney(journeyId: string, durationMinutes: number): Promise<Result<Journey, AppError>> {
  const durationCheck = validateJourneyDuration(durationMinutes);
  if (!durationCheck.ok) return err(durationCheck.error);

  const user = getCurrentFirebaseUser();
  if (!user) return err(new AuthError("Not signed in", { reason: "no-current-user" }));

  let lastError: AppError = new RepositoryError("Failed to start journey", { operation: "startJourney" });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const existing = await db.journeys.getById(journeyId);
      if (!existing.error && existing.data) {
        trackJourneyEvent("journey_retry_count", { attempts: attempt + 1 });
        return ok(toJourney(existing.data));
      }
      await sleep(computeBackoffDelayMs(attempt - 1, BASE_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS));
    }

    try {
      const { data, error } = await db.journeys.insert(user.uid, {
        id: journeyId,
        started_at: new Date().toISOString(),
        duration_minutes: durationCheck.value,
      });
      if (error || !data) {
        lastError = new RepositoryError("Failed to start journey", { operation: "startJourney", cause: error });
        continue;
      }
      if (attempt > 0) trackJourneyEvent("journey_retry_count", { attempts: attempt + 1 });
      return ok(toJourney(data));
    } catch (cause) {
      lastError = new RepositoryError("Failed to start journey", { operation: "startJourney", cause });
    }
  }

  logger.warn("[journeyRepository] startJourney exhausted all retry attempts", lastError);
  trackJourneyEvent("journey_retry_count", { attempts: MAX_ATTEMPTS });
  return err(lastError);
}

async function endJourney(id: string): Promise<Result<void, AppError>> {
  try {
    await db.journeys.end(id, { ended_at: new Date().toISOString() });
    return ok(undefined);
  } catch (cause) {
    // best-effort — offline-safe; caller logs but never blocks the local
    // journey-ending UX on this (mirrors sosEventsRepository.resolveSosEvent).
    // Naturally idempotent (an update by id) so, unlike startJourney, isn't
    // retried here — a caller can safely call this again without risk.
    return err(new RepositoryError("Failed to end journey", { operation: "endJourney", cause }));
  }
}

export const journeyRepository: JourneyRepository = {
  startJourney,
  endJourney,
};
