import { db } from "./supabaseClient";
import { getCurrentUser } from "./auth";

export interface LiveSessionResult {
  shareId: string;
  /** Null when EXPO_PUBLIC_LIVE_TRACKER_URL is not configured. */
  shareUrl: string | null;
}

import { optionalPublicEnv } from "./env";

const LIVE_TRACKER_URL = optionalPublicEnv("EXPO_PUBLIC_LIVE_TRACKER_URL") ?? "";

export async function startLiveSession(
  lat: number,
  lng: number,
  accuracy: number | null,
): Promise<LiveSessionResult | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await db.liveSessions.insert(user.uid, { lat, lng, accuracy });

    if (error || !data) return null;

    const shareId = data.share_id;
    // Only produce a shareable URL when a tracker base URL is configured.
    // Otherwise return null so the emergency message falls back to a valid
    // maps link instead of embedding a broken relative URL like "/<id>".
    const shareUrl = LIVE_TRACKER_URL ? `${LIVE_TRACKER_URL}/${shareId}` : null;
    return { shareId, shareUrl };
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
