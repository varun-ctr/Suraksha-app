import type { Result } from "@/domain/result/Result";
import type { AppError } from "@/domain/errors";
import type { SosEvent } from "@/domain/entities/SosEvent";

export interface SosEventsRepository {
  insertSosEvent(userId: string, lat: number, lng: number, address: string | null): Promise<Result<SosEvent, AppError>>;
  resolveSosEvent(eventId: string): Promise<Result<void, AppError>>;
}
