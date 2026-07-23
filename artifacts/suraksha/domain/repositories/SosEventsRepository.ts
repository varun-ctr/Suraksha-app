import type { Result } from "@/domain/result/Result";
import type { AppError } from "@/domain/errors";
import type { SosEvent } from "@/domain/entities/SosEvent";

export interface SosEventsRepository {
  insertSosEvent(userId: string, lat: number, lng: number, address: string | null): Promise<Result<SosEvent, AppError>>;
  resolveSosEvent(eventId: string): Promise<Result<void, AppError>>;
  /**
   * Best-effort duplicate check used only when *retrying* a previously
   * failed insertSosEvent (the offline queue, features/sos/services/
   * sosOfflineQueue.ts) — sos_events has no idempotency-key column, so this
   * is not a mathematically airtight guarantee, just a check for "did an
   * earlier attempt actually succeed even though its response never
   * reached the client" before inserting a possible duplicate. Returns the
   * most recent unresolved event for the user triggered at or after
   * `sinceIso`, or null if none.
   */
  findRecentUnresolvedEvent(userId: string, sinceIso: string): Promise<Result<SosEvent | null, AppError>>;
}
