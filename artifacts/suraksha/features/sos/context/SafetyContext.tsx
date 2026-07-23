import * as Haptics from "expo-haptics";
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
import { useI18n } from "@/features/settings/context/LanguageContext";
import { useShakeDetector } from "@/features/sos/hooks/useShakeDetector";
import { getCurrentLocation, reverseGeocode } from "@/core/permissions/location";
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  setLocationUpdateListener,
} from "@/core/permissions/backgroundLocation";
import { useLiveSessionRepository, useSosEventsRepository } from "@/core/di/hooks";
import {
  cancelAllScheduledNotifications,
  scheduleLocalNotification,
} from "@/core/permissions/notifications";
import { firebaseAuth } from "@/repositories/firebase/firebaseClient";
import { logger } from "@/core/logger/logger";
import { trackSosEvent } from "@/core/analytics/sosTelemetry";
import { sendSosAlerts, type AlertStatus } from "@/features/sos/services/sosAlertService";
import {
  savePendingActivation,
  updatePendingActivation,
  getPendingActivation,
  clearPendingActivation,
  type PendingSosActivation,
} from "@/features/sos/services/sosOfflineQueue";
import { isPendingActivationStale } from "@/features/sos/services/sosRecoveryPolicy";
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
  /** Per-contact alert delivery status for the active SOS — owned here (not by the presentational SosBottomSheet) so it survives that component remounting and is available to crash-recovery. */
  alertStatuses: AlertStatus[];
  alertSending: boolean;
  journey: JourneyState;
  setJourneyDuration: (d: number) => void;
  startJourney: () => void;
  endJourney: () => void;
  /** User confirms they're safe — clears overdue state and ends journey */
  checkInJourney: () => void;
}

const COUNTDOWN_START   = 3;
const OVERDUE_GRACE_SEC = 60; // seconds before auto-SOS fires after journey expires
const DB_RETRY_INTERVAL_MS = 15_000;
const DEDUP_LOOKBACK_MS = 5 * 60 * 1000;

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

function newIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const SafetyContext = createContext<SafetyContextValue | null>(null);

export function SafetyProvider({ children }: { children: React.ReactNode }) {
  const { settings, contacts, profile } = useApp();
  const { t } = useI18n();
  const liveSessionRepository = useLiveSessionRepository();
  const sosEventsRepository = useSosEventsRepository();
  const [sos, setSos]         = useState<SosState>(SOS_DEFAULTS);
  const [journey, setJourney] = useState<JourneyState>(JOURNEY_DEFAULTS);
  const [alertStatuses, setAlertStatuses] = useState<AlertStatus[]>([]);
  const [alertSending, setAlertSending]   = useState(false);

  const countdownTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const sosTimer        = useRef<ReturnType<typeof setInterval> | null>(null);
  const journeyTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const overdueTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const dbRetryTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const shareIdRef      = useRef<string | null>(null);
  const sosRunIdRef     = useRef(0);
  const insertingRef    = useRef(false);
  const alertDispatchedRef = useRef(false);
  const idempotencyKeyRef  = useRef<string | null>(null);
  // Always-current refs for use inside the module-level location listener
  // and the mount-time recovery effect, both of which run outside the
  // normal render/callback closures below.
  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;
  const profileNameRef = useRef(profile.name);
  profileNameRef.current = profile.name;

  // ── Live-tracking helpers ─────────────────────────────────────────

  const stopLiveTracking = useCallback(async () => {
    await stopBackgroundLocationTracking();
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

      // Drives sos.coords for the UI regardless of foreground/background —
      // see core/permissions/backgroundLocation.ts for why this replaced a
      // plain watchPositionAsync subscription (foreground-only; stops
      // within seconds of the app being backgrounded, which is exactly
      // when it matters most during a real emergency).
      setLocationUpdateListener((loc) => {
        if (sosRunIdRef.current !== runId) return;
        setSos((s) => s.phase !== "idle" ? { ...s, coords: loc } : s);
      });
      const started = await startBackgroundLocationTracking(session.shareId);
      if (!started) {
        logger.warn("[SafetyContext] background location unavailable — live tracking limited to foreground");
      }
    }
  }, [liveSessionRepository]);

  // ── Supabase sos_events record (with offline-queue-backed retry) ──

  const insertOrAdopt = useCallback(
    async (userId: string, lat: number, lng: number, address: string | null, isRetry: boolean) => {
      if (isRetry) {
        // A previous attempt's outcome is unknown — it may have already
        // succeeded server-side with the response never reaching the
        // client. Check before inserting again rather than risk a
        // duplicate sos_events row (sos_events has no idempotency-key
        // column to enforce this server-side — see
        // docs/sos-audit/technical-debt-report.md).
        const since = new Date(Date.now() - DEDUP_LOOKBACK_MS).toISOString();
        const existing = await sosEventsRepository.findRecentUnresolvedEvent(userId, since);
        if (existing.ok && existing.value) return existing.value;
      }
      const result = await sosEventsRepository.insertSosEvent(userId, lat, lng, address);
      return result.ok ? result.value : null;
    },
    [sosEventsRepository],
  );

  const activateSosDb = useCallback(
    (runId: number, coords: Coords | null, address: string | null) => {
      void (async () => {
        if (sosRunIdRef.current !== runId || !coords) return;

        const user = firebaseAuth.currentUser;
        if (sosRunIdRef.current !== runId || !user) return;

        const idempotencyKey = idempotencyKeyRef.current ?? newIdempotencyKey();
        idempotencyKeyRef.current = idempotencyKey;
        await savePendingActivation({
          idempotencyKey,
          userId: user.uid,
          lat: coords.lat,
          lng: coords.lng,
          address,
          triggeredAtMs: Date.now(),
          dbEventId: null,
          alertsDispatched: false,
        });

        const event = await insertOrAdopt(user.uid, coords.lat, coords.lng, address, false);
        if (!event) {
          trackSosEvent("sos_db_write_failed");
          logger.warn("[SafetyContext] failed to record SOS event — will retry automatically");
          return; // dbRetryTimer effect below picks this up
        }

        await updatePendingActivation({ dbEventId: event.id });
        trackSosEvent("sos_db_write_success");

        setSos((s) => {
          // Re-check runId here too: this run may have been cancelled and a
          // new one started while insertSosEvent's network call was in
          // flight — s.phase would then be "active" again for the *new*
          // run, so checking phase alone isn't enough to detect staleness.
          if (sosRunIdRef.current !== runId || s.phase === "idle") {
            void sosEventsRepository.resolveSosEvent(event.id);
            return s;
          }
          return { ...s, eventId: event.id };
        });
      })();
    },
    [sosEventsRepository, insertOrAdopt],
  );

  // Automatic retry for a still-unconfirmed SOS event write — network
  // blips, backend timeouts, and Supabase hiccups must never permanently
  // drop the record of a real emergency.
  useEffect(() => {
    if (sos.phase !== "active" || sos.eventId !== null) {
      if (dbRetryTimer.current) { clearInterval(dbRetryTimer.current); dbRetryTimer.current = null; }
      return;
    }
    dbRetryTimer.current = setInterval(() => {
      const runId = sosRunIdRef.current;
      const user = firebaseAuth.currentUser;
      if (!user || !sos.coords) return;
      trackSosEvent("sos_db_retry");
      void insertOrAdopt(user.uid, sos.coords.lat, sos.coords.lng, sos.address, true).then((event) => {
        if (!event || sosRunIdRef.current !== runId) return;
        void updatePendingActivation({ dbEventId: event.id });
        setSos((s) => (sosRunIdRef.current === runId && s.phase !== "idle") ? { ...s, eventId: event.id } : s);
      });
    }, DB_RETRY_INTERVAL_MS);
    return () => {
      if (dbRetryTimer.current) { clearInterval(dbRetryTimer.current); dbRetryTimer.current = null; }
    };
  }, [sos.phase, sos.eventId, sos.coords, sos.address, insertOrAdopt]);

  // ── Alert dispatch (moved from SosBottomSheet — a presentational
  // component must not own the actual emergency-delivery side effect;
  // owning it here also means it survives SosBottomSheet remounting and
  // can be re-run by crash recovery below) ──────────────────────────

  const dispatchAlerts = useCallback(
    (coords: Coords | null, shareUrl: string | null) => {
      if (alertDispatchedRef.current || contactsRef.current.length === 0) return;
      alertDispatchedRef.current = true;
      setAlertSending(true);
      trackSosEvent("sos_alert_dispatch_start");
      sendSosAlerts(t, contactsRef.current, coords, shareUrl, profileNameRef.current)
        .then((statuses) => {
          setAlertStatuses(statuses);
          setAlertSending(false);
          void updatePendingActivation({ alertsDispatched: true });
          const anySent = statuses.some((s) => s.sms === "sent" || s.sms === "opening");
          trackSosEvent(anySent ? "sos_alert_dispatch_success" : "sos_alert_dispatch_failed");
        })
        .catch(() => {
          setAlertSending(false);
          trackSosEvent("sos_alert_dispatch_failed");
        });
    },
    [t],
  );

  useEffect(() => {
    if (sos.phase === "active") {
      dispatchAlerts(sos.coords, sos.shareUrl);
    }
    if (sos.phase === "idle") {
      alertDispatchedRef.current = false;
      setAlertStatuses([]);
      setAlertSending(false);
    }
  }, [sos.phase, sos.coords, sos.shareUrl, dispatchAlerts]);

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

  // ── Crash recovery: resume (or reconcile) a pending activation left
  // over from a previous process — app killed or crashed mid-emergency.
  // Runs once, on mount. ──────────────────────────────────────────────

  useEffect(() => {
    // TEMP-DEBUG(startup-audit): 6/10 — SafetyProvider mounted and started
    // its crash-recovery check. On a normal fresh launch with no in-flight
    // SOS, "no pending activation" should log immediately after.
    console.log("[TEMP-DEBUG][STARTUP] 6/10 SafetyProvider: mounted, checking for a pending SOS activation");
    void (async () => {
      const pending = await getPendingActivation();
      console.log("[TEMP-DEBUG][STARTUP] SafetyProvider: pending activation check done", { found: !!pending });
      if (!pending) return;

      const stale = isPendingActivationStale(pending.triggeredAtMs, Date.now());
      trackSosEvent(stale ? "sos_recovery_stale" : "sos_recovery_resumed");

      if (stale) {
        // Too old to safely auto-resume the full-screen active-SOS UI —
        // the emergency context has almost certainly already resolved one
        // way or another. Still reconcile the record in the background so
        // it isn't permanently lost, without surprising the user with a
        // stale SOS screen.
        if (!pending.dbEventId) {
          const since = new Date(pending.triggeredAtMs - DEDUP_LOOKBACK_MS).toISOString();
          const existing = await sosEventsRepository.findRecentUnresolvedEvent(pending.userId, since);
          let event = existing.ok ? existing.value : null;
          if (!event) {
            const inserted = await sosEventsRepository.insertSosEvent(pending.userId, pending.lat, pending.lng, pending.address);
            event = inserted.ok ? inserted.value : null;
          }
          if (event) await updatePendingActivation({ dbEventId: event.id });
        }
        return;
      }

      // Resume: a real emergency may still be in progress. Idempotency key
      // is reused so any further retry still dedupes against this same
      // activation rather than starting a fresh one.
      idempotencyKeyRef.current = pending.idempotencyKey;
      alertDispatchedRef.current = pending.alertsDispatched;
      const runId = ++sosRunIdRef.current;
      setSos({
        ...SOS_DEFAULTS,
        phase: "active",
        loading: false,
        coords: { lat: pending.lat, lng: pending.lng, accuracy: null },
        address: pending.address,
        eventId: pending.dbEventId,
      });
      // Re-establish live tracking (a fresh session — the prior process's
      // in-memory share id isn't recoverable) and location watch.
      void fetchLocationAndStartTracking(runId);
    })();
    // Mount-only — deliberately not re-run on dependency changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Public SOS API ────────────────────────────────────────────────

  const triggerSOS = useCallback(() => {
    // Guard at the source rather than in each caller: tap, shake, and the
    // journey-overdue auto-trigger all call this, and a second SOS while one
    // is already active/counting down would clobber the first run's GPS
    // watch, live-tracking session, and DB event.
    if (sos.phase !== "idle") return;
    const runId = ++sosRunIdRef.current;
    idempotencyKeyRef.current = null;
    trackSosEvent("sos_triggered");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSos({ ...SOS_DEFAULTS, phase: "countdown", countdown: COUNTDOWN_START, loading: true });
    void fetchLocationAndStartTracking(runId);
  }, [sos.phase, fetchLocationAndStartTracking]);

  // ── Shake-to-SOS (opt-in, off by default) ──────────────────────────
  useShakeDetector(triggerSOS, settings.shakeToSos);

  const cancelSOS = useCallback(() => {
    const wasCountdown = sos.phase === "countdown";
    sosRunIdRef.current++;
    trackSosEvent(wasCountdown ? "sos_cancelled_countdown" : "sos_cancelled_active");
    setSos((s) => {
      if (s.eventId) {
        sosEventsRepository.resolveSosEvent(s.eventId).then((r) => {
          if (!r.ok) logger.warn("[SafetyContext] failed to resolve SOS event", r.error);
        });
      }
      return { ...SOS_DEFAULTS };
    });
    void clearPendingActivation();
    void stopLiveTracking();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [sos.phase, stopLiveTracking, sosEventsRepository]);

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
      alertStatuses,
      alertSending,
      journey,
      setJourneyDuration,
      startJourney,
      endJourney,
      checkInJourney,
    }),
    [sos, safetyStatus, triggerSOS, cancelSOS, alertStatuses, alertSending, journey, setJourneyDuration, startJourney, endJourney, checkInJourney],
  );

  return (
    <SafetyContext.Provider value={value}>
      {children}
      {sos.phase !== "idle" && (
        <SosBottomSheet
          sos={sos}
          cancelSOS={cancelSOS}
          alertStatuses={alertStatuses}
          alertSending={alertSending}
        />
      )}
    </SafetyContext.Provider>
  );
}

export function useSafety(): SafetyContextValue {
  const ctx = useContext(SafetyContext);
  if (!ctx) throw new Error("useSafety must be used within SafetyProvider");
  return ctx;
}
