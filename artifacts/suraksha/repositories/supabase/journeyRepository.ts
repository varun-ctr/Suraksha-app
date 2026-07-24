import { db } from "./supabaseClient";
import { getCurrentFirebaseUser } from "@/repositories/firebase/firebaseAuth";
import { AuthError, RepositoryError, type AppError } from "@/domain/errors";
import { ok, err, type Result } from "@/domain/result/Result";
import type { Journey } from "@/domain/entities/Journey";
import type { JourneyRepository } from "@/domain/repositories/JourneyRepository";
import { toJourney } from "./mappers/journeyMapper";

async function startJourney(durationMinutes: number): Promise<Result<Journey, AppError>> {
  try {
    const user = getCurrentFirebaseUser();
    if (!user) return err(new AuthError("Not signed in", { reason: "no-current-user" }));

    const { data, error } = await db.journeys.insert(user.uid, {
      started_at: new Date().toISOString(),
      duration_minutes: durationMinutes,
    });
    if (error || !data) {
      return err(new RepositoryError("Failed to start journey", { operation: "startJourney", cause: error }));
    }
    return ok(toJourney(data));
  } catch (cause) {
    return err(new RepositoryError("Failed to start journey", { operation: "startJourney", cause }));
  }
}

async function endJourney(id: string): Promise<Result<void, AppError>> {
  try {
    await db.journeys.end(id, { ended_at: new Date().toISOString() });
    return ok(undefined);
  } catch (cause) {
    // best-effort — offline-safe; caller logs but never blocks the local
    // journey-ending UX on this (mirrors sosEventsRepository.resolveSosEvent)
    return err(new RepositoryError("Failed to end journey", { operation: "endJourney", cause }));
  }
}

export const journeyRepository: JourneyRepository = {
  startJourney,
  endJourney,
};
