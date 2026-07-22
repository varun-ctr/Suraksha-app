export type CommunityReportType =
  | "unsafe_area"
  | "harassment"
  | "stalking"
  | "suspicious_activity"
  | "accident"
  | "medical"
  | "road_block"
  | "fire"
  | "flood"
  | "animal_attack"
  | "other";

export type ModerationStatus = "pending" | "reviewed" | "removed";

/** A community-submitted incident report, shown in the local safety feed. */
export interface CommunityReport {
  id: string;
  type: CommunityReportType;
  lat: number;
  lng: number;
  address: string | null;
  description: string | null;
  photoUrl: string | null;
  moderationStatus: ModerationStatus;
  createdAt: string;
}
