import type { LiveSessionDto } from "../dto/LiveSessionDto";
import type { LiveSession } from "@/domain/entities/LiveSession";

/**
 * `shareUrl` isn't a DB column — it's synthesized from the configured tracker
 * base URL, a business rule the repository owns — so it's passed in rather
 * than derived here, keeping this mapper a pure DTO → domain transform.
 */
export function toLiveSession(row: LiveSessionDto, shareUrl: string | null): LiveSession {
  return {
    id: row.id,
    shareId: row.share_id,
    shareUrl,
    lat: row.lat,
    lng: row.lng,
    accuracy: row.accuracy,
    isActive: row.is_active,
  };
}
