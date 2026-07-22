import { db } from "./supabaseClient";
import { getCurrentFirebaseUser } from "@/repositories/firebase/firebaseAuth";
import { optionalPublicEnv } from "@/core/config/env";
import { AuthError, RepositoryError, type AppError } from "@/domain/errors";
import { ok, err, type Result } from "@/domain/result/Result";
import type { LiveSession } from "@/domain/entities/LiveSession";
import type { LiveSessionRepository } from "@/domain/repositories/LiveSessionRepository";
import { toLiveSession } from "./mappers/liveSessionMapper";

const LIVE_TRACKER_URL = optionalPublicEnv("EXPO_PUBLIC_LIVE_TRACKER_URL") ?? "";

async function startLiveSession(
  lat: number,
  lng: number,
  accuracy: number | null,
): Promise<Result<LiveSession, AppError>> {
  try {
    const user = getCurrentFirebaseUser();
    if (!user) return err(new AuthError("Not signed in", { reason: "no-current-user" }));

    const { data, error } = await db.liveSessions.insert(user.uid, { lat, lng, accuracy });
    if (error || !data) {
      return err(new RepositoryError("Failed to start live session", { operation: "startLiveSession", cause: error }));
    }

    // Only produce a shareable URL when a tracker base URL is configured.
    // Otherwise return null so the emergency message falls back to a valid
    // maps link instead of embedding a broken relative URL like "/<id>".
    const shareUrl = LIVE_TRACKER_URL ? `${LIVE_TRACKER_URL}/${data.share_id}` : null;
    return ok(toLiveSession(data, shareUrl));
  } catch (cause) {
    return err(new RepositoryError("Failed to start live session", { operation: "startLiveSession", cause }));
  }
}

async function updateLiveSession(
  shareId: string,
  lat: number,
  lng: number,
  accuracy: number | null,
): Promise<Result<void, AppError>> {
  try {
    await db.liveSessions.update(shareId, { lat, lng, accuracy });
    return ok(undefined);
  } catch (cause) {
    // network hiccups shouldn't crash SOS — caller logs but never blocks on this
    return err(new RepositoryError("Failed to update live session", { operation: "updateLiveSession", cause }));
  }
}

async function endLiveSession(shareId: string): Promise<Result<void, AppError>> {
  try {
    await db.liveSessions.end(shareId);
    return ok(undefined);
  } catch (cause) {
    return err(new RepositoryError("Failed to end live session", { operation: "endLiveSession", cause }));
  }
}

export const liveSessionRepository: LiveSessionRepository = {
  startLiveSession,
  updateLiveSession,
  endLiveSession,
};
