/** A live-location-sharing session started during an active SOS or journey. */
export interface LiveSession {
  id: string;
  shareId: string;
  /** Null when EXPO_PUBLIC_LIVE_TRACKER_URL is not configured. */
  shareUrl: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  isActive: boolean;
}
