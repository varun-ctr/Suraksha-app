import { db } from "@/repositories/supabase/supabaseClient";
import { RepositoryError, type AppError } from "@/domain/errors";
import { ok, err, type Result } from "@/domain/result/Result";
import type { SosEvent } from "@/domain/entities/SosEvent";
import type { SosEventsRepository } from "@/domain/repositories/SosEventsRepository";
import { toSosEvent } from "./mappers/sosEventMapper";

async function insertSosEvent(
  userId: string,
  lat: number,
  lng: number,
  address: string | null,
): Promise<Result<SosEvent, AppError>> {
  try {
    const { data, error } = await db.sosEvents.insert(userId, { lat, lng, address });
    if (error || !data) {
      return err(new RepositoryError("Failed to record SOS event", { operation: "insertSosEvent", cause: error }));
    }
    return ok(toSosEvent(data));
  } catch (cause) {
    return err(new RepositoryError("Failed to record SOS event", { operation: "insertSosEvent", cause }));
  }
}

async function resolveSosEvent(eventId: string): Promise<Result<void, AppError>> {
  try {
    await db.sosEvents.resolve(eventId, { resolved_at: new Date().toISOString() });
    return ok(undefined);
  } catch (cause) {
    // best-effort — offline-safe; caller logs but never blocks on this
    return err(new RepositoryError("Failed to resolve SOS event", { operation: "resolveSosEvent", cause }));
  }
}

async function findRecentUnresolvedEvent(
  userId: string,
  sinceIso: string,
): Promise<Result<SosEvent | null, AppError>> {
  try {
    const { data, error } = await db.sosEvents.findRecentUnresolved(userId, sinceIso);
    if (error) {
      return err(new RepositoryError("Failed to check for an existing SOS event", { operation: "findRecentUnresolvedEvent", cause: error }));
    }
    return ok(data ? toSosEvent(data) : null);
  } catch (cause) {
    return err(new RepositoryError("Failed to check for an existing SOS event", { operation: "findRecentUnresolvedEvent", cause }));
  }
}

export const sosEventsRepository: SosEventsRepository = {
  insertSosEvent,
  resolveSosEvent,
  findRecentUnresolvedEvent,
};
