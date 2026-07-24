import type { JourneyDto } from "../dto/JourneyDto";
import type { Journey } from "@/domain/entities/Journey";

export function toJourney(row: JourneyDto): Journey {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMinutes: row.duration_minutes,
  };
}
