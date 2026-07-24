import type { Result } from "@/domain/result/Result";
import type { AppError } from "@/domain/errors";
import type { SosEvent } from "@/domain/entities/SosEvent";

export interface SosEventsRepository {
  /**
   * `idempotencyKey` is a client-generated key, stable for the lifetime of one
   * SOS activation (see SafetyContext.tsx's idempotencyKeyRef). The database
   * enforces a partial unique index on (user_id, idempotency_key) — see
   * api-server/migrations/005_emergency_data_idempotency.sql — and the write
   * is an UPSERT, so retrying with the same key is a true idempotent no-op
   * rather than a possible duplicate emergency record.
   */
  insertSosEvent(
    userId: string,
    lat: number,
    lng: number,
    address: string | null,
    idempotencyKey: string,
  ): Promise<Result<SosEvent, AppError>>;
  resolveSosEvent(eventId: string): Promise<Result<void, AppError>>;
  /**
   * Defense-in-depth duplicate check used when *retrying* a previously failed
   * insertSosEvent (the offline queue, features/sos/services/sosOfflineQueue.ts,
   * and the crash-recovery path in SafetyContext.tsx). The DB-level upsert on
   * (user_id, idempotency_key) is now the authoritative dedup mechanism; this
   * check is a harmless secondary layer for callers/rows that predate the
   * idempotency_key column. Returns the most recent unresolved event for the
   * user triggered at or after `sinceIso`, or null if none.
   */
  findRecentUnresolvedEvent(userId: string, sinceIso: string): Promise<Result<SosEvent | null, AppError>>;
}
