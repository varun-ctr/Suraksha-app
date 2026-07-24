/** A timed check-in journey — the record of when it started, its planned duration, and whether/when it ended. */
export interface Journey {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
}
