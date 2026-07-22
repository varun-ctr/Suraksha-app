import type { Coords } from "@/domain/entities/Coords";

export type SosPhase = "idle" | "countdown" | "active";
export type SafetyStatus = "safe" | "caution" | "emergency";

export interface SosState {
  phase: SosPhase;
  countdown: number;
  seconds: number;
  coords: Coords | null;
  address: string | null;
  loading: boolean;
  shareUrl: string | null;
  eventId: string | null;
}

export interface JourneyState {
  active: boolean;
  seconds: number;
  duration: number;
  /** True once seconds >= duration*60 and user hasn't checked in */
  overdue: boolean;
  /** Countdown seconds before auto-SOS fires (60 → 0) */
  overdueSeconds: number;
}
