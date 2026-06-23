import { db } from "@/lib/supabaseClient";

export async function insertSosEvent(
  userId: string,
  lat: number,
  lng: number,
  address: string | null,
): Promise<string | null> {
  try {
    const { data, error } = await db.sosEvents.insert(userId, { lat, lng, address });
    if (error || !data) return null;
    return data.id;
  } catch {
    return null;
  }
}

export async function resolveSosEvent(eventId: string): Promise<void> {
  try {
    await db.sosEvents.resolve(eventId, { resolved_at: new Date().toISOString() });
  } catch {
    // best-effort — offline-safe
  }
}
