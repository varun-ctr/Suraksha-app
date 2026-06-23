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
import { insertSosEvent, resolveSosEvent } from "@/lib/sosEvents";
import { supabase } from "@/lib/supabaseClient";

export interface Coords {
  lat: number;
  lng: number;
  accuracy: number | null;
}

export type SosPhase = "idle" | "countdown" | "active";
export type SafetyStatus = "safe" | "caution" | "emergency";

export interface SosState {
  phase: SosPhase;
  /** Counts 3 → 2 → 1 → 0 before SOS activates */
  countdown: number;
  /** Elapsed seconds since SOS became active */
  seconds: number;
  coords: Coords | null;
  address: string | null;
  loading: boolean;
  shareUrl: string | null;
  eventId: string | null;
}

interface JourneyState {
  active: boolean;
  seconds: number;
  duration: number;
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
}

const COUNTDOWN_START = 3;

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

const SafetyContext = createContext<SafetyContextValue | null>(null);

export function SafetyProvider({ children }: { children: React.ReactNode }) {
  const [sos, setSos] = useState<SosState>(SOS_DEFAULTS);
  const [journey, setJourney] = useState<JourneyState>({
    active: false,
    seconds: 0,
    duration: 15,
  });

  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sosTimer       = useRef<ReturnType<typeof setInterval> | null>(null);
  const journeyTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const shareIdRef     = useRef<string | null>(null);
  const watchRef       = useRef<Location.LocationSubscription | null>(null);

  /**
   * Run-ID cancellation guard.
   * Incremented on every triggerSOS() and cancelSOS() call.
   * Async callbacks close over the runId at launch time and check
   * `sosRunIdRef.current === runId` before touching state or starting
   * side-effects — stale closures from a prior (cancelled) trigger are
   * simply discarded.
   */
  const sosRunIdRef = useRef(0);
  /**
   * Prevents duplicate sos_events inserts within one SOS activation.
   * Reset to false whenever phase returns to "idle".
   */
  const insertingRef = useRef(false);

  // ── Live-tracking helpers ─────────────────────────────────────────

  const stopLiveTracking = useCallback(async () => {
    if (watchRef.current) { watchRef.current.remove(); watchRef.current = null; }
    if (shareIdRef.current) {
      await endLiveSession(shareIdRef.current);
      shareIdRef.current = null;
    }
  }, []);

  /**
   * Fetches GPS + reverse-geocodes + starts a live session.
   * Every async step checks `runId` against `sosRunIdRef.current`
   * so a cancel mid-flight doesn't leak tracking or DB records.
   */
  const fetchLocationAndStartTracking = useCallback(async (runId: number) => {
    const point = await getCurrentLocation();
    if (sosRunIdRef.current !== runId) return; // cancelled

    if (!point) {
      setSos((s) => s.phase !== "idle" ? { ...s, loading: false } : s);
      return;
    }
    setSos((s) => s.phase !== "idle" ? { ...s, loading: false, coords: point } : s);

    const addr = await reverseGeocode(point.lat, point.lng);
    if (sosRunIdRef.current !== runId) return; // cancelled after geocode
    setSos((s) => s.phase !== "idle" ? { ...s, address: addr } : s);

    const session = await startLiveSession(point.lat, point.lng, point.accuracy);
    if (sosRunIdRef.current !== runId) {
      // Cancelled while starting session — clean it up immediately
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
            if (sosRunIdRef.current !== runId) return; // guard each update too
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
        // Final guard after watchPositionAsync resolves (it itself is async)
        if (sosRunIdRef.current !== runId) { sub.remove(); return; }
        watchRef.current = sub;
      } catch {
        // Location watch unavailable — SOS still works without continuous updates
      }
    }
  }, []);

  // ── Supabase sos_events record when phase goes active ─────────────
  //
  // Resilient: waits until coords are available before inserting, then
  // re-checks phase. If cancelled between insert-start and insert-complete,
  // the late-arriving eventId is immediately resolved.

  const activateSosDb = useCallback(
    (runId: number, coords: Coords | null, address: string | null) => {
      void (async () => {
        if (sosRunIdRef.current !== runId || !coords) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (sosRunIdRef.current !== runId || !user) return; // cancelled while awaiting auth

        const id = await insertSosEvent(user.id, coords.lat, coords.lng, address);
        if (!id) return;

        // Write eventId — but if phase is now idle (cancelled), resolve immediately
        setSos((s) => {
          if (s.phase === "idle") {
            void resolveSosEvent(id); // late write: auto-resolve the orphaned record
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
    // Haptic for the first displayed number
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

  // ── Write sos_events once coords are available in active phase ───
  //
  // Keyed on (phase, coords, eventId) so the insert is retried whenever
  // coords arrive after the countdown finishes (slow GPS / permission
  // prompt). insertingRef guards against duplicate concurrent inserts;
  // it resets to false when phase returns to idle.

  useEffect(() => {
    if (sos.phase === "idle") {
      insertingRef.current = false; // reset for next activation
      return;
    }
    if (sos.phase === "active" && sos.coords !== null && sos.eventId === null && !insertingRef.current) {
      insertingRef.current = true;
      activateSosDb(sosRunIdRef.current, sos.coords, sos.address);
    }
  }, [sos.phase, sos.coords, sos.eventId, sos.address, activateSosDb]);

  // ── Elapsed timer (active only) ───────────────────────────────────

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

  // ── Public API ────────────────────────────────────────────────────

  const triggerSOS = useCallback(() => {
    const runId = ++sosRunIdRef.current; // invalidates any prior in-flight ops
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSos({ ...SOS_DEFAULTS, phase: "countdown", countdown: COUNTDOWN_START, loading: true });
    void fetchLocationAndStartTracking(runId);
  }, [fetchLocationAndStartTracking]);

  const cancelSOS = useCallback(() => {
    sosRunIdRef.current++; // invalidate all in-flight async ops
    setSos((s) => {
      if (s.eventId) void resolveSosEvent(s.eventId);
      return { ...SOS_DEFAULTS };
    });
    void stopLiveTracking();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [stopLiveTracking]);

  // ── Journey ───────────────────────────────────────────────────────

  const setJourneyDuration = useCallback((d: number) => setJourney((j) => ({ ...j, duration: d })), []);
  const startJourney  = useCallback(() => setJourney((j) => ({ ...j, active: true, seconds: 0 })), []);
  const endJourney    = useCallback(() => setJourney((j) => ({ ...j, active: false, seconds: 0 })), []);

  useEffect(() => {
    if (journey.active) {
      journeyTimer.current = setInterval(
        () => setJourney((j) => ({ ...j, seconds: j.seconds + 1 })),
        1000,
      );
    } else {
      if (journeyTimer.current) { clearInterval(journeyTimer.current); journeyTimer.current = null; }
    }
    return () => {
      if (journeyTimer.current) { clearInterval(journeyTimer.current); journeyTimer.current = null; }
    };
  }, [journey.active]);

  // ── Derived safety status ─────────────────────────────────────────

  const safetyStatus = useMemo<SafetyStatus>(() => {
    if (sos.phase === "idle") return "safe";
    if (sos.phase === "active" && sos.seconds > 120) return "caution";
    return "emergency";
  }, [sos.phase, sos.seconds]);

  const value = useMemo<SafetyContextValue>(
    () => ({ sos, safetyStatus, triggerSOS, cancelSOS, journey, setJourneyDuration, startJourney, endJourney }),
    [sos, safetyStatus, triggerSOS, cancelSOS, journey, setJourneyDuration, startJourney, endJourney],
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
