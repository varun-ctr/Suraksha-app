import type { SosEventDto } from "../dto/SosEventDto";
import type { SosEvent } from "@/domain/entities/SosEvent";

export function toSosEvent(row: SosEventDto): SosEvent {
  return {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    triggeredAt: row.triggered_at,
    resolvedAt: row.resolved_at,
  };
}
