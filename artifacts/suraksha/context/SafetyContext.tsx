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

import { SosBottomSheet } from "@/components/SosBottomSheet";
import { getCurrentLocation, reverseGeocode } from "@/lib/location";
import { endLiveSession, startLiveSession, updateLiveSession } from "@/lib/liveSession";
import {
  cancelAllScheduledNotifications,
  scheduleLocalNotification,
} from "@/lib/notifications";
import { insertSosEvent, resolveSosEvent } from "@/lib/sosEvents";
import { firebaseAuth } from "@/lib/firebase";

export interface Coords {
  lat: number;
  lng: number;
  accuracy: number | null;
}

export type SosPhase = "idle" | "countdown" | "active";
export type SafetyStatus = "safe" | "caution" | "emergency";

export interface SosState {
  phase: SosPhase;
  countdown: number;
  seconds: number;
  coords: Coords | null;
  address: string | null;
  loading: boolean;
  shareUrl: string | null;
  eventId: string | null;
}

export interface JourneyState {
  active: boolean;
  seconds: number;
  duration: number;
  /** True once seconds >= duration*60 and user hasn't checked in */
  overdue: boolean;
  /** Countdown seconds before auto-SOS fires (60 → 0) */
  overdueSeconds: number;
}

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
      await endLiveSession(shareIdRef.current);
      shareIdRef.current = null;
    }
  }, []);

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

    const session = await startLiveSession(point.lat, point.lng, point.accuracy);
    if (sosRunIdRef.current !== runId) {
      if (session) await endLiveSession(session.shareId);
      return;
    }

    if (session) {
      shareIdRef.current = session.shareId;
      setSos((s) => s.phase !== "idle" ? { ...s, shareUrl: session.shareUrl } : s);

      try {
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 10 },
          (loc) => {
            if (sosRunIdRef.current !== runId) return;
            if (shareIdRef.current) {
              void updateLiveSession(
                shareIdRef.current,
                loc.coords.latitude,
                loc.coords.longitude,
                loc.coords.accuracy ?? null,
              );
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
  }, []);

  // ── Supabase sos_events record ────────────────────────────────────

  const activateSosDb = useCallback(
    (runId: number, coords: Coords | null, address: string | null) => {
      void (async () => {
        if (sosRunIdRef.current !== runId || !coords) return;

        const user = firebaseAuth.currentUser;
        if (sosRunIdRef.current !== runId || !user) return;

        const id = await insertSosEvent(user.uid, coords.lat, coords.lng, address);
        if (!id) return;

        setSos((s) => {
          if (s.phase === "idle") {
            void resolveSosEvent(id);
            return s;
          }
          return { ...s, eventId: id };
        });
      })();
    },
    [],
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
    const runId = ++sosRunIdRef.current;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSos({ ...SOS_DEFAULTS, phase: "countdown", countdown: COUNTDOWN_START, loading: true });
    void fetchLocationAndStartTracking(runId);
  }, [fetchLocationAndStartTracking]);

  const cancelSOS = useCallback(() => {
    sosRunIdRef.current++;
    setSos((s) => {
      if (s.eventId) void resolveSosEvent(s.eventId);
      return { ...SOS_DEFAULTS };
    });
    void stopLiveTracking();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [stopLiveTracking]);

  // ── Journey timer ─────────────────────────────────────────────────

  const setJourneyDuration = useCallback(
    (d: number) => setJourney((j) => ({ ...j, duration: d })),
    [],
  );

  const startJourney = useCallback(
    () => setJourney({ ...JOURNEY_DEFAULTS, active: true, duration: JOURNEY_DEFAULTS.duration }),
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
