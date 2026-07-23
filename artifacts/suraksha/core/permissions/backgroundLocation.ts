/**
 * Background-capable location tracking for an active SOS.
 *
 * `Location.watchPositionAsync` (the previous mechanism) is foreground-only
 * — on iOS, delivery stops within seconds to minutes of the app being
 * backgrounded. During a real emergency the phone is very plausibly in a
 * pocket, or the user's attention is on the situation rather than the
 * screen, so background delivery is the difference between live tracking
 * that actually works during an emergency and one that silently stops the
 * moment the screen locks. This is why background location tracking is the
 * one capability in this hardening pass that required a new native
 * dependency (expo-task-manager), a new iOS background mode, and an
 * "Always" location permission prompt — the alternative (foreground-only)
 * fails the core reliability requirement for this feature.
 *
 * The TaskManager task below is defined at module load time — this module
 * is imported once, unconditionally, from app/_layout.tsx specifically so
 * that happens on every app launch, including a background relaunch. iOS
 * can relaunch the app in the background purely to deliver a location task
 * event; if the task isn't already registered by the time that happens,
 * the update is silently lost. Because that relaunch may not have the
 * React tree mounted at all, the task talks directly to the concrete
 * liveSessionRepository singleton (the same direct-import pattern
 * authService.ts uses for non-component code) rather than through the DI
 * hook, and reads which share ID is currently active from AsyncStorage —
 * SafetyContext's in-memory `shareIdRef` isn't reachable from here.
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Needs direct repository access: the background task can run in a headless
// JS context with no React tree mounted (see file header), so there's no
// component to resolve this via the DI hook from. Not a composition-root
// concern, but there's no domain-level indirection for a non-component
// background task yet.
// eslint-disable-next-line import/no-restricted-paths
import { liveSessionRepository } from "@/repositories/supabase/liveSessionRepository";
import { logger } from "@/core/logger/logger";
import type { GeoPoint } from "@/core/permissions/location";

export const BACKGROUND_LOCATION_TASK = "suraksha-sos-background-location";
const ACTIVE_SHARE_ID_KEY = "suraksha.sos.activeShareId";

type LocationUpdateListener = (point: GeoPoint) => void;
let listener: LocationUpdateListener | null = null;

/**
 * Registers a callback invoked with each location point the background
 * task receives, whether the app is foregrounded or not — SafetyContext
 * uses this to keep `sos.coords` in sync while mounted, without running a
 * second, separate location subscription. Pass `null` to unregister.
 */
export function setLocationUpdateListener(cb: LocationUpdateListener | null): void {
  listener = cb;
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error }) => {
    if (error) {
      logger.warn("[backgroundLocation] task error", error);
      return;
    }
    const latest = data?.locations?.at(-1);
    if (!latest) return;

    const point: GeoPoint = {
      lat: latest.coords.latitude,
      lng: latest.coords.longitude,
      accuracy: latest.coords.accuracy ?? null,
    };

    listener?.(point);

    let shareId: string | null = null;
    try {
      shareId = await AsyncStorage.getItem(ACTIVE_SHARE_ID_KEY);
    } catch (e) {
      logger.warn("[backgroundLocation] failed to read active share id", e);
      return;
    }
    // No active SOS right now — the task keeps running (cheap to leave
    // registered) but has nothing to push until startBackgroundLocationTracking
    // records a share id again.
    if (!shareId) return;

    const result = await liveSessionRepository.updateLiveSession(shareId, point.lat, point.lng, point.accuracy);
    if (!result.ok) logger.warn("[backgroundLocation] failed to push location update", result.error);
  },
);

/** True if the OS currently grants continuous background delivery (iOS: "Always"). Does not prompt — see requestBackgroundLocationPermission. */
export async function hasBackgroundLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getBackgroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Prompts for background ("Always") location permission. iOS requires
 * foreground permission to already be granted before this can succeed —
 * getCurrentLocation() (called earlier in the SOS trigger flow) already
 * requests that, so by the time this runs the prerequisite is normally
 * already satisfied.
 */
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Starts (or restarts, if already running) background-capable location
 * delivery for the given share id. Returns `false` — never throws — if
 * background permission isn't granted or the OS rejects the request, so
 * the caller can fall back to foreground-only tracking; an active SOS
 * must never fail outright over a missing "Always" grant.
 */
export async function startBackgroundLocationTracking(shareId: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(ACTIVE_SHARE_ID_KEY, shareId);
  } catch (e) {
    logger.warn("[backgroundLocation] failed to persist active share id", e);
  }

  const granted = (await hasBackgroundLocationPermission()) || (await requestBackgroundLocationPermission());
  if (!granted) return false;

  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000,
      distanceInterval: 10,
      showsBackgroundLocationIndicator: true,
      activityType: Location.LocationActivityType.Other,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: "Suraksha SOS is active",
        notificationBody: "Sharing your live location with your trusted contacts.",
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch (e) {
    logger.warn("[backgroundLocation] failed to start location updates", e);
    return false;
  }
}

/** Stops background location delivery and clears the persisted share id. Safe to call even if nothing was started. */
export async function stopBackgroundLocationTracking(): Promise<void> {
  setLocationUpdateListener(null);
  try {
    await AsyncStorage.removeItem(ACTIVE_SHARE_ID_KEY);
  } catch (e) {
    logger.warn("[backgroundLocation] failed to clear active share id", e);
  }
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (started) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch (e) {
    logger.warn("[backgroundLocation] failed to stop location updates", e);
  }
}
