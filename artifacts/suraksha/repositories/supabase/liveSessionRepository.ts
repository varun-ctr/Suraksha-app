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
import { computeBackoffDelayMs } from "@/domain/policies/retryBackoff";

const LIVE_TRACKER_URL = optionalPublicEnv("EXPO_PUBLIC_LIVE_TRACKER_URL") ?? "";

const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 4000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Only produce a shareable URL when a tracker base URL is configured.
// Otherwise return null so the emergency message falls back to a valid
// maps link instead of embedding a broken relative URL like "/<id>".
function toShareUrl(shareId: string): string | null {
  return LIVE_TRACKER_URL ? `${LIVE_TRACKER_URL}/${shareId}` : null;
}

/**
 * Starts a live session with a client-generated, stable `shareId` used as
 * the row's own `share_id`, retrying up to MAX_ATTEMPTS times with
 * exponential backoff on transient failure — mirrors
 * journeyRepository.startJourney's pattern. Because the share_id is stable
 * across attempts, a retry first checks whether a prior attempt's insert
 * actually succeeded server-side (an exact share_id lookup) before assuming
 * it failed, making duplicate live-session creation from this code path
 * structurally impossible rather than merely unlikely.
 */
async function startLiveSession(
  shareId: string,
  lat: number,
  lng: number,
  accuracy: number | null,
): Promise<Result<LiveSession, AppError>> {
  const user = getCurrentFirebaseUser();
  if (!user) return err(new AuthError("Not signed in", { reason: "no-current-user" }));

  // Best-effort zombie cleanup: a prior process that never called
  // endLiveSession (crash, kill) can leave an old session "active"
  // forever. Closing it before starting a new one keeps at most one
  // truly-live session per user; failing to do so must never block a new
  // emergency's own tracking from starting.
  const cleanup = await db.liveSessions.endAllActiveForUser(user.uid);
  if (cleanup.error) logger.warn("[liveSessionRepository] failed to close stale prior sessions", cleanup.error);

  let lastError: AppError = new RepositoryError("Failed to start live session", { operation: "startLiveSession" });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const existing = await db.liveSessions.getByShareId(shareId);
      if (!existing.error && existing.data) {
        return ok(toLiveSession(existing.data, toShareUrl(existing.data.share_id)));
      }
      await sleep(computeBackoffDelayMs(attempt - 1, BASE_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS));
    }

    try {
      const { data, error } = await db.liveSessions.insert(user.uid, {
        share_id: shareId,
        lat,
        lng,
        accuracy,
        expires_at: computeExpiresAt(Date.now()),
      });
      if (error || !data) {
        lastError = new RepositoryError("Failed to start live session", { operation: "startLiveSession", cause: error });
        continue;
      }
      return ok(toLiveSession(data, toShareUrl(data.share_id)));
    } catch (cause) {
      lastError = new RepositoryError("Failed to start live session", { operation: "startLiveSession", cause });
    }
  }

  logger.warn("[liveSessionRepository] startLiveSession exhausted all retry attempts", lastError);
  return err(lastError);
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
