import { supabase } from "./supabaseClient";
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

    const { data, error } = await supabase
      .from("live_sessions")
      .insert({ user_id: user.id, lat, lng, accuracy })
      .select("share_id")
      .single();

    if (error || !data) return null;

    const shareId = data.share_id as string;
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
    await supabase
      .from("live_sessions")
      .update({ lat, lng, accuracy, updated_at: new Date().toISOString() })
      .eq("share_id", shareId);
  } catch {
    // silently ignore — network hiccups shouldn't crash SOS
  }
}

export async function endLiveSession(shareId: string): Promise<void> {
  try {
    await supabase
      .from("live_sessions")
      .update({ is_active: false })
      .eq("share_id", shareId);
  } catch {
    // silently ignore on cleanup
  }
}
