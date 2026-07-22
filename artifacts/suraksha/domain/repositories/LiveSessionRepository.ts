import type { Result } from "@/domain/result/Result";
import type { AppError } from "@/domain/errors";
import type { LiveSession } from "@/domain/entities/LiveSession";

export interface LiveSessionRepository {
  startLiveSession(lat: number, lng: number, accuracy: number | null): Promise<Result<LiveSession, AppError>>;
  updateLiveSession(shareId: string, lat: number, lng: number, accuracy: number | null): Promise<Result<void, AppError>>;
  endLiveSession(shareId: string): Promise<Result<void, AppError>>;
}
