import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
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
import { useLiveSessionRepository, useSosEventsRepository, useJourneyRepository } from "@/core/di/hooks";
import {
  cancelAllScheduledNotifications,
  scheduleLocalNotification,
} from "@/core/permissions/notifications";
import { firebaseAuth } from "@/repositories/firebase/firebaseClient";
import { logger } from "@/core/logger/logger";
import { trackSosEvent } from "@/core/analytics/sosTelemetry";
import { trackJourneyEvent } from "@/core/analytics/journeyTelemetry";
import { sendSosAlerts, type AlertStatus } from "@/features/sos/services/sosAlertService";
import {
  savePendingActivation,
  updatePendingActivation,
  getPendingActivation,
  clearPendingActivation,
  type PendingSosActivation,
} from "@/features/sos/services/sosOfflineQueue";
import { isPendingActivationStale } from "@/features/sos/services/sosRecoveryPolicy";
import {
  saveActiveJourney,
  getActiveJourney,
  updateActiveJourney,
  clearActiveJourney,
} from "@/features/journey/services/journeyPersistence";
import { computeJourneyStatus } from "@/domain/policies/journeyRecoveryPolicy";
import type { Coords } from "@/domain/entities/Coords";
import type { JourneyEscalationReason } from "@/domain/entities/JourneyOutcome";
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
  const journeyRepository = useJourneyRepository();
  const [sos, setSos]         = useState<SosState>(SOS_DEFAULTS);
  const [journey, setJourney] = useState<JourneyState>(JOURNEY_DEFAULTS);
  const [alertStatuses, setAlertStatuses] = useState<AlertStatus[]>([]);
  const [alertSending, setAlertSending]   = useState(false);

  const countdownTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const sosTimer        = useRef<ReturnType<typeof setInterval> | null>(null);
  const journeyTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const dbRetryTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const shareIdRef      = useRef<string | null>(null);
  const sosRunIdRef     = useRef(0);
  const insertingRef    = useRef(false);
  const alertDispatchedRef = useRef(false);
  const idempotencyKeyRef  = useRef<string | null>(null);
  // Wall-clock anchor for the active journey's timing — see
  // domain/policies/journeyRecoveryPolicy.ts for why every tick recomputes
  // elapsed/overdue from this rather than trusting an incrementally-updated
  // counter, which silently stops advancing the moment the app is
  // backgrounded or killed (the core reliability gap this audit found).
  const journeyStartedAtMsRef = useRef<number | null>(null);
  // Client-generated UUID (see startJourney), stable for the lifetime of
  // the journey — also the backend journeys-table row's primary key.
  const journeyIdRef           = useRef<string | null>(null);
  const journeyAutoSosFiredRef = useRef(false);
  const journeyWasOverdueRef   = useRef(false);
  // Always-current refs for use inside the module-level location listener
  // and the mount-time recovery effect, both of which run outside the
  // normal render/callback closures below.
  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;
  const profileNameRef = useRef(profile.name);
  profileNameRef.current = profile.name;
  // Lets the journey tick/recovery effects know, at the exact moment the
  // grace period expires, whether triggerSOS() is actually going to fire
  // (sos.phase === "idle") or will no-op because an unrelated SOS is
  // already active — used only to label journey_expired/journey_escalated
  // telemetry and the persisted outcome accurately, not to gate any actual
  // safety behavior (triggerSOS()'s own internal guard is what's
  // authoritative there, regardless of what this ref says).
  const sosPhaseRef = useRef(sos.phase);
  sosPhaseRef.current = sos.phase;
  // Always-current coords/address for the dbRetryTimer effect below — kept
  // as refs (not effect dependencies) specifically so an incoming location
  // ping (as often as every ~10s during an active SOS) does NOT tear down
  // and restart the 15s retry interval. Before this, sos.coords/sos.address
  // sat in that effect's own dependency array, so a fast-moving emergency
  // could perpetually reset the interval before it ever fired — starving
  // the one mechanism that's supposed to guarantee the SOS record is never
  // permanently lost during a network blip.
  const sosCoordsRef = useRef(sos.coords);
  sosCoordsRef.current = sos.coords;
  const sosAddressRef = useRef(sos.address);
  sosAddressRef.current = sos.address;

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

    const shareId = Crypto.randomUUID();
    const sessionResult = await liveSessionRepository.startLiveSession(shareId, point.lat, point.lng, point.accuracy);
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
    async (userId: string, lat: number, lng: number, address: string | null, idempotencyKey: string, isRetry: boolean) => {
      if (isRetry) {
        // A previous attempt's outcome is unknown — it may have already
        // succeeded server-side with the response never reaching the
        // client. Check before inserting again as a defense-in-depth
        // secondary layer — the DB-level upsert on (user_id,
        // idempotency_key) below is now the authoritative dedup mechanism
        // (see api-server/migrations/005_emergency_data_idempotency.sql).
        const since = new Date(Date.now() - DEDUP_LOOKBACK_MS).toISOString();
        const existing = await sosEventsRepository.findRecentUnresolvedEvent(userId, since);
        if (existing.ok && existing.value) return existing.value;
      }
      const result = await sosEventsRepository.insertSosEvent(userId, lat, lng, address, idempotencyKey);
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

        const event = await insertOrAdopt(user.uid, coords.lat, coords.lng, address, idempotencyKey, false);
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
  //
  // Deliberately depends only on [sos.phase, sos.eventId, insertOrAdopt] —
  // NOT on sos.coords/sos.address — so an incoming location ping can never
  // restart this interval mid-flight (see sosCoordsRef/sosAddressRef above
  // for why that would otherwise starve the retry indefinitely during a
  // fast-moving emergency). The interval callback reads the always-current
  // ref values instead of closing over a stale sos.coords/sos.address from
  // whichever render started it.
  useEffect(() => {
    if (sos.phase !== "active" || sos.eventId !== null) {
      if (dbRetryTimer.current) { clearInterval(dbRetryTimer.current); dbRetryTimer.current = null; }
      return;
    }
    dbRetryTimer.current = setInterval(() => {
      const runId = sosRunIdRef.current;
      const user = firebaseAuth.currentUser;
      const coords = sosCoordsRef.current;
      if (!user || !coords || !idempotencyKeyRef.current) return;
      trackSosEvent("sos_db_retry");
      void insertOrAdopt(user.uid, coords.lat, coords.lng, sosAddressRef.current, idempotencyKeyRef.current, true).then((event) => {
        if (!event || sosRunIdRef.current !== runId) return;
        void updatePendingActivation({ dbEventId: event.id });
        setSos((s) => (sosRunIdRef.current === runId && s.phase !== "idle") ? { ...s, eventId: event.id } : s);
      });
    }, DB_RETRY_INTERVAL_MS);
    return () => {
      if (dbRetryTimer.current) { clearInterval(dbRetryTimer.current); dbRetryTimer.current = null; }
    };
  }, [sos.phase, sos.eventId, insertOrAdopt]);

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
    void (async () => {
      const pending = await getPendingActivation();
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
            const inserted = await sosEventsRepository.insertSosEvent(pending.userId, pending.lat, pending.lng, pending.address, pending.idempotencyKey);
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
  // A timed check-in, not continuous route tracking: pick a duration, and
  // if you don't check in before it elapses (plus a grace period), it
  // auto-escalates to a real SOS. See domain/policies/journeyRecoveryPolicy.ts
  // for why every tick — and every app resume/relaunch — recomputes status
  // from wall-clock time (journeyStartedAtMsRef) rather than trusting a
  // counter that silently stops advancing the moment the app is
  // backgrounded or killed, which used to mean the auto-SOS escalation
  // (the entire point of the feature) could quietly never fire.

  const setJourneyDuration = useCallback(
    (d: number) => setJourney((j) => ({ ...j, duration: d })),
    [],
  );

  const startJourney = useCallback(() => {
    const startedAtMs = Date.now();
    const durationSec = journey.duration * 60;
    const journeyId = Crypto.randomUUID();
    journeyStartedAtMsRef.current = startedAtMs;
    journeyIdRef.current = journeyId;
    journeyAutoSosFiredRef.current = false;
    journeyWasOverdueRef.current = false;
    trackJourneyEvent("journey_started");
    setJourney((j) => ({ ...JOURNEY_DEFAULTS, active: true, duration: j.duration }));

    void saveActiveJourney({
      journeyId,
      startedAtMs,
      deadlineAtMs: startedAtMs + durationSec * 1000,
      durationSec,
      overdueGraceSec: OVERDUE_GRACE_SEC,
      completedAtMs: null,
      cancelledAtMs: null,
      escalationReason: null,
      outcome: null,
      autoSosTriggered: false,
      wasRecoveredFromBackground: false,
    });
    // Best-effort backend record — never blocks the local timer, which is
    // the actual safety mechanism regardless of whether this write
    // succeeds. The repository itself retries transient failures with
    // backoff and is idempotent on `journeyId` (see journeyRepository.ts),
    // so this call either succeeds, adopts an existing row from a prior
    // attempt, or gives up after bounded retries — it never blocks here
    // either way (mirrors the "never let a backend hiccup block safety"
    // ethos already established for SOS).
    journeyRepository.startJourney(journeyId, journey.duration).then((r) => {
      if (!r.ok) {
        trackJourneyEvent("journey_db_write_failed");
        logger.warn("[SafetyContext] failed to persist journey start", r.error);
      }
    });
  }, [journey.duration, journeyRepository]);

  /**
   * Shared teardown for every way a journey can end. `outcome` and
   * `escalationReason` are written to the persisted record for
   * observability (see domain/entities/JourneyOutcome.ts) immediately
   * before it's cleared, and telemetry carries the journey's actual
   * elapsed duration — "Journey Duration" telemetry is a field on these
   * terminal events, not a separate occurrence.
   */
  const endJourneyRecord = useCallback((
    outcome: "completed" | "cancelled" | "escalated" | "expired",
    escalationReason: JourneyEscalationReason | null,
    durationSec: number,
  ) => {
    const journeyId = journeyIdRef.current;
    if (journeyId) {
      // endJourney() is a naturally-idempotent update-by-id — safe to call
      // even if the original insert never actually reached the backend
      // (it simply updates zero rows in that case, not an error).
      journeyRepository.endJourney(journeyId).then((r) => {
        if (!r.ok) logger.warn("[SafetyContext] failed to end journey record", r.error);
      });
    }
    const now = Date.now();
    void updateActiveJourney({
      outcome,
      escalationReason,
      completedAtMs: outcome === "completed" ? now : null,
      cancelledAtMs: outcome === "cancelled" ? now : null,
    }).then(() => clearActiveJourney());
    trackJourneyEvent(
      outcome === "completed" ? "journey_completed"
      : outcome === "cancelled" ? "journey_cancelled"
      : outcome === "escalated" ? "journey_escalated"
      : "journey_expired",
      { durationSec },
    );
    journeyStartedAtMsRef.current = null;
    journeyIdRef.current = null;
    journeyAutoSosFiredRef.current = false;
    journeyWasOverdueRef.current = false;
  }, [journeyRepository]);

  const endJourney = useCallback(() => {
    const startedAtMs = journeyStartedAtMsRef.current;
    const elapsedSec = startedAtMs !== null ? Math.floor((Date.now() - startedAtMs) / 1000) : 0;
    endJourneyRecord("cancelled", null, elapsedSec);
    setJourney((j) => ({ ...JOURNEY_DEFAULTS, duration: j.duration }));
  }, [endJourneyRecord]);

  /** User taps "I'm Safe" during an overdue journey. Clears overdue + ends journey. */
  const checkInJourney = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const startedAtMs = journeyStartedAtMsRef.current;
    const elapsedSec = startedAtMs !== null ? Math.floor((Date.now() - startedAtMs) / 1000) : 0;
    endJourneyRecord("completed", null, elapsedSec);
    setJourney((j) => ({ ...JOURNEY_DEFAULTS, duration: j.duration }));
  }, [endJourneyRecord]);

  // Unified wall-clock tick — recomputes elapsed/overdue every second from
  // journeyStartedAtMsRef rather than incrementing a counter, so a stalled
  // JS thread (app backgrounded) never desyncs the displayed countdown: the
  // moment ticking resumes, it's instantly correct again, and if the grace
  // period fully elapsed while the tick wasn't running at all, the very
  // first tick after resume detects "expired" and escalates immediately
  // instead of waiting for however many now-meaningless ticks it "should"
  // have taken.
  useEffect(() => {
    if (!journey.active) {
      if (journeyTimer.current) { clearInterval(journeyTimer.current); journeyTimer.current = null; }
      return;
    }

    const tick = () => {
      const startedAtMs = journeyStartedAtMsRef.current;
      if (startedAtMs === null) return;

      const status = computeJourneyStatus(
        { startedAtMs, durationSec: journey.duration * 60, overdueGraceSec: OVERDUE_GRACE_SEC },
        Date.now(),
      );

      if (status.phase === "active") {
        setJourney((j) => ({ ...j, seconds: status.elapsedSec, overdue: false, overdueSeconds: OVERDUE_GRACE_SEC }));
        return;
      }

      if (!journeyWasOverdueRef.current) {
        journeyWasOverdueRef.current = true;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }

      if (status.phase === "overdue") {
        setJourney((j) => ({ ...j, seconds: journey.duration * 60 + status.overdueElapsedSec, overdue: true, overdueSeconds: status.graceSecondsRemaining }));
        return;
      }

      // expired — the grace period has fully elapsed.
      setJourney((j) => ({ ...j, overdue: true, overdueSeconds: 0 }));
      if (!journeyAutoSosFiredRef.current) {
        journeyAutoSosFiredRef.current = true;
        // Read *before* calling triggerSOS(): its own internal guard
        // (sos.phase !== "idle") is what actually decides whether it
        // fires — this is only to label the outcome/telemetry accurately,
        // never to gate the trigger itself.
        const canEscalate = sosPhaseRef.current === "idle";
        const escalationReason: JourneyEscalationReason = canEscalate
          ? "grace_period_elapsed"
          : "sos_blocked_by_existing_emergency";
        endJourneyRecord(canEscalate ? "escalated" : "expired", escalationReason, journey.duration * 60 + status.overdueElapsedSec);
        // Trigger SOS on next tick to avoid setState-during-render.
        setTimeout(() => triggerSOS(), 0);
      }
    };

    tick();
    journeyTimer.current = setInterval(tick, 1000);
    return () => {
      if (journeyTimer.current) { clearInterval(journeyTimer.current); journeyTimer.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey.active]);

  // ── Journey crash/background recovery: resume (or immediately escalate)
  // a journey timer left over from a previous process. Without this, a
  // journey silently loses its entire safety guarantee the moment the app
  // is backgrounded or killed, since the JS tick above — the only thing
  // that detects "overdue" and fires auto-SOS — simply stops running.
  // Runs once, on mount. ─────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      const persisted = await getActiveJourney();
      if (!persisted) return;

      journeyIdRef.current = persisted.journeyId;
      journeyStartedAtMsRef.current = persisted.startedAtMs;
      const status = computeJourneyStatus(
        {
          startedAtMs: persisted.startedAtMs,
          durationSec: persisted.durationSec,
          overdueGraceSec: persisted.overdueGraceSec,
        },
        Date.now(),
      );

      if (status.phase === "expired") {
        // The grace period fully elapsed while the app was away — exactly
        // the scenario this fix exists for. Escalate immediately rather
        // than silently doing nothing.
        journeyWasOverdueRef.current = true;
        const elapsedSec = persisted.durationSec + status.overdueElapsedSec;
        setJourney({
          active: true,
          duration: persisted.durationSec / 60,
          seconds: elapsedSec,
          overdue: true,
          overdueSeconds: 0,
        });
        trackJourneyEvent("journey_recovery", { recoveryOutcome: "expired", durationSec: elapsedSec });
        if (!persisted.autoSosTriggered) {
          journeyAutoSosFiredRef.current = true;
          const canEscalate = sosPhaseRef.current === "idle";
          const escalationReason: JourneyEscalationReason = canEscalate
            ? "grace_period_elapsed"
            : "sos_blocked_by_existing_emergency";
          endJourneyRecord(canEscalate ? "escalated" : "expired", escalationReason, elapsedSec);
          setTimeout(() => triggerSOS(), 0);
        }
        return;
      }

      // Still within the timer or the grace period — resume normally; the
      // tick effect above picks it up the instant `active` is true.
      journeyWasOverdueRef.current = status.phase === "overdue";
      const elapsedSec = status.phase === "active" ? status.elapsedSec : persisted.durationSec + status.overdueElapsedSec;
      trackJourneyEvent("journey_recovery", { recoveryOutcome: "resumed", durationSec: elapsedSec });
      void updateActiveJourney({ wasRecoveredFromBackground: true });
      setJourney({
        active: true,
        duration: persisted.durationSec / 60,
        seconds: elapsedSec,
        overdue: status.phase === "overdue",
        overdueSeconds: status.phase === "overdue" ? status.graceSecondsRemaining : OVERDUE_GRACE_SEC,
      });
    })();
    // Mount-only — deliberately not re-run on dependency changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schedule / cancel the local "are you safe?" notification — durable at
  // the OS level regardless of whether the JS engine ever runs again
  // before the deadline, unlike the tick-based auto-SOS mechanism above.
  // Scheduled using the seconds *remaining* until the original deadline
  // (from the wall-clock anchor), not the full duration — otherwise a
  // recovered/resumed journey would reschedule a full-duration
  // notification measured from the resume moment, firing far later than
  // the real deadline actually is.
  useEffect(() => {
    if (journey.active) {
      const startedAtMs = journeyStartedAtMsRef.current;
      const remainingSec = startedAtMs !== null
        ? Math.max(1, journey.duration * 60 - Math.floor((Date.now() - startedAtMs) / 1000))
        : journey.duration * 60;
      void scheduleLocalNotification(
        "Journey Timer Ended",
        "Your journey timer has ended — are you safe?",
        remainingSec,
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
