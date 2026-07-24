import type { Result } from "@/domain/result/Result";
import type { AppError } from "@/domain/errors";
import type { LiveSession } from "@/domain/entities/LiveSession";

export interface LiveSessionRepository {
  /**
   * `shareId` is a client-generated, stable UUID used as the row's own
   * `share_id`, mirroring journeyRepository.startJourney's pattern — this lets
   * a retry after a lost response adopt a prior successful insert instead of
   * risking a duplicate live session.
   */
  startLiveSession(
    shareId: string,
    lat: number,
    lng: number,
    accuracy: number | null,
  ): Promise<Result<LiveSession, AppError>>;
  updateLiveSession(shareId: string, lat: number, lng: number, accuracy: number | null): Promise<Result<void, AppError>>;
  endLiveSession(shareId: string): Promise<Result<void, AppError>>;
}
