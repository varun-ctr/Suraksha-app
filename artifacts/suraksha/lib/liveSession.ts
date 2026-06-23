import { db } from "./supabaseClient";
import { getCurrentUser } from "./auth";

export interface LiveSessionResult {
  shareId: string;
  shareUrl: string;
}

const LIVE_TRACKER_URL = process.env.EXPO_PUBLIC_LIVE_TRACKER_URL ?? "";

export async function startLiveSession(
  lat: number,
  lng: number,
  accuracy: number | null,
): Promise<LiveSessionResult | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await db.liveSessions.insert({ lat, lng, accuracy });

    if (error || !data) return null;

    const shareId = data.share_id;
    return { shareId, shareUrl: `${LIVE_TRACKER_URL}/${shareId}` };
  } catch {
    return null;
  }
}

export async function updateLiveSession(
  shareId: string,
  lat: number,
  lng: number,
  accuracy: number | null,
): Promise<void> {
  try {
    await db.liveSessions.update(shareId, { lat, lng, accuracy });
  } catch {
    // silently ignore — network hiccups shouldn't crash SOS
  }
}

export async function endLiveSession(shareId: string): Promise<void> {
  try {
    await db.liveSessions.end(shareId);
  } catch {
    // silently ignore on cleanup
  }
}
