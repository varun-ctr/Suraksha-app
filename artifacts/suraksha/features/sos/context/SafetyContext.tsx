import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { SosBottomSheet } from "@/features/sos/components/SosBottomSheet";
import { useApp } from "@/features/profile/context/AppContext";
import { useShakeDetector } from "@/features/sos/hooks/useShakeDetector";
import { getCurrentLocation, reverseGeocode } from "@/core/permissions/location";
import { useLiveSessionRepository, useSosEventsRepository } from "@/core/di/hooks";
import {
  cancelAllScheduledNotifications,
  scheduleLocalNotification,
} from "@/core/permissions/notifications";
import { firebaseAuth } from "@/repositories/firebase/firebaseClient";
import { logger } from "@/core/logger/logger";
import type { Coords } from "@/domain/entities/Coords";
import type { SosPhase, SafetyStatus, SosState, JourneyState } from "@/features/sos/types";

// Re-exported for backward compatibility — these types' canonical home is
// now domain/entities/Coords.ts and features/sos/types.ts (breaks an import
// cycle: this module is transitively imported by
// emergencyMessage.ts/sosAlertService.ts/SosBottomSheet.tsx, all of which
// need one or more of these types).
export type { Coords, SosPhase, SafetyStatus, SosState, JourneyState };

interface SafetyContextValue {
  sos: SosState;
  safetyStatus: SafetyStatus;
  triggerSOS: () => void;
  cancelSOS: () => void;
  journey: JourneyState;
  setJourneyDuration: (d: number) => void;
  startJourney: () => void;
  endJourney: () => void;
  /** User confirms they're safe — clears overdue state and ends journey */
  checkInJourney: () => void;
}

const COUNTDOWN_START   = 3;
const OVERDUE_GRACE_SEC = 60; // seconds before auto-SOS fires after journey expires

const SOS_DEFAULTS: SosState = {
  phase: "idle",
  countdown: COUNTDOWN_START,
  seconds: 0,
  coords: null,
  address: null,
  loading: false,
  shareUrl: null,
  eventId: null,
};

const JOURNEY_DEFAULTS: JourneyState = {
  active: false,
  seconds: 0,
  duration: 15,
  overdue: false,
  overdueSeconds: OVERDUE_GRACE_SEC,
};

const SafetyContext = createContext<SafetyContextValue | null>(null);

export function SafetyProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useApp();
  const liveSessionRepository = useLiveSessionRepository();
  const sosEventsRepository = useSosEventsRepository();
  const [sos, setSos]         = useState<SosState>(SOS_DEFAULTS);
  const [journey, setJourney] = useState<JourneyState>(JOURNEY_DEFAULTS);

  const countdownTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const sosTimer        = useRef<ReturnType<typeof setInterval> | null>(null);
  const journeyTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const overdueTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const shareIdRef      = useRef<string | null>(null);
  const watchRef        = useRef<Location.LocationSubscription | null>(null);
  const sosRunIdRef     = useRef(0);
  const insertingRef    = useRef(false);

  // ── Live-tracking helpers ─────────────────────────────────────────

  const stopLiveTracking = useCallback(async () => {
    if (watchRef.current) { watchRef.current.remove(); watchRef.current = null; }
    if (shareIdRef.current) {
      const result = await liveSessionRepository.endLiveSession(shareIdRef.current);
      if (!result.ok) logger.warn("[SafetyContext] failed to end live session", result.error);
      shareIdRef.current = null;
    }
  }, [liveSessionRepository]);

  const fetchLocationAndStartTracking = useCallback(async (runId: number) => {
    const point = await getCurrentLocation();
    if (sosRunIdRef.current !== runId) return;

    if (!point) {
      setSos((s) => s.phase !== "idle" ? { ...s, loading: false } : s);
      return;
    }
    setSos((s) => s.phase !== "idle" ? { ...s, loading: false, coords: point } : s);

    const addr = await reverseGeocode(point.lat, point.lng);
    if (sosRunIdRef.current !== runId) return;
    setSos((s) => s.phase !== "idle" ? { ...s, address: addr } : s);

    const sessionResult = await liveSessionRepository.startLiveSession(point.lat, point.lng, point.accuracy);
    if (sosRunIdRef.current !== runId) {
      if (sessionResult.ok) await liveSessionRepository.endLiveSession(sessionResult.value.shareId);
      return;
    }

    if (sessionResult.ok) {
      const session = sessionResult.value;
      shareIdRef.current = session.shareId;
      setSos((s) => s.phase !== "idle" ? { ...s, shareUrl: session.shareUrl } : s);

      try {
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 10 },
          (loc) => {
            if (sosRunIdRef.current !== runId) return;
            if (shareIdRef.current) {
              liveSessionRepository.updateLiveSession(
                shareIdRef.current,
                loc.coords.latitude,
                loc.coords.longitude,
                loc.coords.accuracy ?? null,
              ).then((r) => {
                if (!r.ok) logger.warn("[SafetyContext] failed to update live session", r.error);
              });
              setSos((s) =>
                s.phase !== "idle"
                  ? { ...s, coords: { lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy: loc.coords.accuracy ?? null } }
                  : s,
              );
            }
          },
        );
        if (sosRunIdRef.current !== runId) { sub.remove(); return; }
        watchRef.current = sub;
      } catch {
        // Location watch unavailable — SOS still works without continuous updates
      }
    }
  }, [liveSessionRepository]);

  // ── Supabase sos_events record ────────────────────────────────────

  const activateSosDb = useCallback(
    (runId: number, coords: Coords | null, address: string | null) => {
      void (async () => {
        if (sosRunIdRef.current !== runId || !coords) return;

        const user = firebaseAuth.currentUser;
        if (sosRunIdRef.current !== runId || !user) return;

        const result = await sosEventsRepository.insertSosEvent(user.uid, coords.lat, coords.lng, address);
        if (!result.ok) {
          logger.warn("[SafetyContext] failed to record SOS event", result.error);
          return;
        }
        const id = result.value.id;

        setSos((s) => {
          // Re-check runId here too: this run may have been cancelled and a
          // new one started while insertSosEvent's network call was in
          // flight — s.phase would then be "active" again for the *new*
          // run, so checking phase alone isn't enough to detect staleness.
          if (sosRunIdRef.current !== runId || s.phase === "idle") {
            void sosEventsRepository.resolveSosEvent(id);
            return s;
          }
          return { ...s, eventId: id };
        });
      })();
    },
    [sosEventsRepository],
  );

  // ── Countdown timer ───────────────────────────────────────────────

  useEffect(() => {
    if (sos.phase !== "countdown") {
      if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; }
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    countdownTimer.current = setInterval(() => {
      setSos((s) => {
        if (s.phase !== "countdown") return s;
        const next = s.countdown - 1;
        if (next > 0) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          return { ...s, countdown: next };
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return { ...s, phase: "active", countdown: 0 };
      });
    }, 1000);

    return () => {
      if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; }
    };
  }, [sos.phase]);

  // ── Write sos_events once coords are available in active phase ────

  useEffect(() => {
    if (sos.phase === "idle") {
      insertingRef.current = false;
      return;
    }
    if (sos.phase === "active" && sos.coords !== null && sos.eventId === null && !insertingRef.current) {
      insertingRef.current = true;
      activateSosDb(sosRunIdRef.current, sos.coords, sos.address);
    }
  }, [sos.phase, sos.coords, sos.eventId, sos.address, activateSosDb]);

  // ── Elapsed SOS timer ─────────────────────────────────────────────

  useEffect(() => {
    if (sos.phase === "active") {
      sosTimer.current = setInterval(
        () => setSos((s) => ({ ...s, seconds: s.seconds + 1 })),
        1000,
      );
    } else {
      if (sosTimer.current) { clearInterval(sosTimer.current); sosTimer.current = null; }
    }
    return () => {
      if (sosTimer.current) { clearInterval(sosTimer.current); sosTimer.current = null; }
    };
  }, [sos.phase]);

  // ── Cleanup on unmount ────────────────────────────────────────────

  useEffect(() => () => { void stopLiveTracking(); }, [stopLiveTracking]);

  // ── Public SOS API ────────────────────────────────────────────────

  const triggerSOS = useCallback(() => {
    // Guard at the source rather than in each caller: tap, shake, and the
    // journey-overdue auto-trigger all call this, and a second SOS while one
    // is already active/counting down would clobber the first run's GPS
    // watch, live-tracking session, and DB event.
    if (sos.phase !== "idle") return;
    const runId = ++sosRunIdRef.current;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSos({ ...SOS_DEFAULTS, phase: "countdown", countdown: COUNTDOWN_START, loading: true });
    void fetchLocationAndStartTracking(runId);
  }, [sos.phase, fetchLocationAndStartTracking]);

  // ── Shake-to-SOS (opt-in, off by default) ──────────────────────────
  useShakeDetector(triggerSOS, settings.shakeToSos);

  const cancelSOS = useCallback(() => {
    sosRunIdRef.current++;
    setSos((s) => {
      if (s.eventId) {
        sosEventsRepository.resolveSosEvent(s.eventId).then((r) => {
          if (!r.ok) logger.warn("[SafetyContext] failed to resolve SOS event", r.error);
        });
      }
      return { ...SOS_DEFAULTS };
    });
    void stopLiveTracking();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [stopLiveTracking, sosEventsRepository]);

  // ── Journey timer ─────────────────────────────────────────────────

  const setJourneyDuration = useCallback(
    (d: number) => setJourney((j) => ({ ...j, duration: d })),
    [],
  );

  const startJourney = useCallback(
    () => setJourney((j) => ({ ...JOURNEY_DEFAULTS, active: true, duration: j.duration })),
    [],
  );

  const endJourney = useCallback(
    () => {
      if (overdueTimer.current) { clearInterval(overdueTimer.current); overdueTimer.current = null; }
      setJourney((j) => ({ ...JOURNEY_DEFAULTS, duration: j.duration }));
    },
    [],
  );

  /** User taps "I'm Safe" during an overdue journey. Clears overdue + ends journey. */
  const checkInJourney = useCallback(
    () => {
      if (overdueTimer.current) { clearInterval(overdueTimer.current); overdueTimer.current = null; }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJourney((j) => ({ ...JOURNEY_DEFAULTS, duration: j.duration }));
    },
    [],
  );

  // Journey elapsed-seconds tick
  useEffect(() => {
    if (journey.active && !journey.overdue) {
      journeyTimer.current = setInterval(
        () => setJourney((j) => {
          if (!j.active) return j;
          const next = j.seconds + 1;
          // Transition to overdue when timer elapses
          if (!j.overdue && next >= j.duration * 60) {
            return { ...j, seconds: next, overdue: true, overdueSeconds: OVERDUE_GRACE_SEC };
          }
          return { ...j, seconds: next };
        }),
        1000,
      );
    } else {
      if (journeyTimer.current) { clearInterval(journeyTimer.current); journeyTimer.current = null; }
    }
    return () => {
      if (journeyTimer.current) { clearInterval(journeyTimer.current); journeyTimer.current = null; }
    };
  }, [journey.active, journey.overdue]);

  // Overdue countdown → auto-SOS
  useEffect(() => {
    if (!journey.overdue) {
      if (overdueTimer.current) { clearInterval(overdueTimer.current); overdueTimer.current = null; }
      return;
    }

    // Haptic alert to let user know they're overdue
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    overdueTimer.current = setInterval(() => {
      setJourney((j) => {
        if (!j.overdue) return j;
        const next = j.overdueSeconds - 1;
        if (next <= 0) {
          // Auto-trigger SOS — clear interval and fire
          if (overdueTimer.current) { clearInterval(overdueTimer.current); overdueTimer.current = null; }
          // Trigger SOS on next tick to avoid setState-during-render
          setTimeout(() => triggerSOS(), 0);
          return { ...j, overdueSeconds: 0 };
        }
        return { ...j, overdueSeconds: next };
      });
    }, 1000);

    return () => {
      if (overdueTimer.current) { clearInterval(overdueTimer.current); overdueTimer.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey.overdue]);

  // Schedule / cancel the local "are you safe?" notification
  useEffect(() => {
    if (journey.active && !journey.overdue) {
      void scheduleLocalNotification(
        "Journey Timer Ended",
        "Your journey timer has ended — are you safe?",
        journey.duration * 60,
      );
    } else {
      void cancelAllScheduledNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey.active]);

  // ── Derived safety status ─────────────────────────────────────────

  const safetyStatus = useMemo<SafetyStatus>(() => {
    if (sos.phase === "idle") return "safe";
    if (sos.phase === "active" && sos.seconds > 120) return "caution";
    return "emergency";
  }, [sos.phase, sos.seconds]);

  const value = useMemo<SafetyContextValue>(
    () => ({
      sos,
      safetyStatus,
      triggerSOS,
      cancelSOS,
      journey,
      setJourneyDuration,
      startJourney,
      endJourney,
      checkInJourney,
    }),
    [sos, safetyStatus, triggerSOS, cancelSOS, journey, setJourneyDuration, startJourney, endJourney, checkInJourney],
  );

  return (
    <SafetyContext.Provider value={value}>
      {children}
      {sos.phase !== "idle" && <SosBottomSheet sos={sos} cancelSOS={cancelSOS} />}
    </SafetyContext.Provider>
  );
}

export function useSafety(): SafetyContextValue {
  const ctx = useContext(SafetyContext);
  if (!ctx) throw new Error("useSafety must be used within SafetyProvider");
  return ctx;
}
