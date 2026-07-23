import { db } from "./supabaseClient";
import { getCurrentFirebaseUser } from "@/repositories/firebase/firebaseAuth";
import { optionalPublicEnv } from "@/core/config/env";
import { logger } from "@/core/logger/logger";
import { AuthError, RepositoryError, type AppError } from "@/domain/errors";
import { ok, err, type Result } from "@/domain/result/Result";
import type { LiveSession } from "@/domain/entities/LiveSession";
import type { LiveSessionRepository } from "@/domain/repositories/LiveSessionRepository";
import { toLiveSession } from "./mappers/liveSessionMapper";
import { computeExpiresAt } from "@/domain/policies/liveSessionPolicy";

const LIVE_TRACKER_URL = optionalPublicEnv("EXPO_PUBLIC_LIVE_TRACKER_URL") ?? "";

async function startLiveSession(
  lat: number,
  lng: number,
  accuracy: number | null,
): Promise<Result<LiveSession, AppError>> {
  try {
    const user = getCurrentFirebaseUser();
    if (!user) return err(new AuthError("Not signed in", { reason: "no-current-user" }));

    // Best-effort zombie cleanup: a prior process that never called
    // endLiveSession (crash, kill) can leave an old session "active"
    // forever. Closing it before starting a new one keeps at most one
    // truly-live session per user; failing to do so must never block a new
    // emergency's own tracking from starting.
    const cleanup = await db.liveSessions.endAllActiveForUser(user.uid);
    if (cleanup.error) logger.warn("[liveSessionRepository] failed to close stale prior sessions", cleanup.error);

    const { data, error } = await db.liveSessions.insert(user.uid, {
      lat,
      lng,
      accuracy,
      expires_at: computeExpiresAt(Date.now()),
    });
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
    // Pushing expires_at forward on every successful update turns it into a
    // heartbeat: as long as real location updates keep arriving, the session
    // stays "live"; the moment they stop (crash, GPS dead, permission
    // revoked), expires_at stops moving and the session goes stale on its
    // own within one timeout window — see domain/policies/liveSessionPolicy.ts.
    await db.liveSessions.update(shareId, { lat, lng, accuracy, expires_at: computeExpiresAt(Date.now()) });
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
