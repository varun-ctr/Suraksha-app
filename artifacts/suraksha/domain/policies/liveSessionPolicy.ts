/**
 * Pure heartbeat/expiry policy for live-tracking sessions, extracted so it's
 * unit-testable in plain Node — see __tests__/liveSessionPolicy.test.ts.
 *
 * live_sessions.expires_at is already enforced server-side (see
 * get_live_session() in DATABASE_SETUP.sql: a session past its expires_at is
 * excluded from the public read regardless of is_active). Nothing sets it
 * today, so a session that never gets a clean endLiveSession() call — an app
 * kill, a crash, GPS silently dying mid-emergency — stays "active" forever
 * to anyone holding the share link. Treating expires_at as a heartbeat
 * (pushed forward on every successful location update, set on creation)
 * turns that into automatic, no-migration-required zombie-session cleanup:
 * the moment updates stop, the session goes stale and expires on its own
 * within one timeout window, without needing a server-side sweep job.
 */

/**
 * How long a live session is considered current after its last heartbeat.
 * Must comfortably exceed the gap between two real location updates
 * (background delivery is requested every 10s but iOS may throttle this
 * further under low power / poor signal) while still being short enough
 * that a genuinely dead/zombie session doesn't stay "live" for long.
 */
export const LIVE_SESSION_HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000;

/** ISO timestamp for the next expiry, given the current time. */
export function computeExpiresAt(nowMs: number): string {
  return new Date(nowMs + LIVE_SESSION_HEARTBEAT_TIMEOUT_MS).toISOString();
}
