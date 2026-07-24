/**
 * Persists the one currently-active journey's timing and identity across
 * app restarts — mirrors features/sos/services/sosOfflineQueue.ts's
 * single-record pattern.
 *
 * `startedAtMs` (not an elapsed-seconds counter) is the load-bearing field:
 * see domain/policies/journeyRecoveryPolicy.ts for why deriving status from
 * wall-clock time, rather than trusting a counter that stops advancing the
 * moment the app is backgrounded or killed, is what actually closes the
 * "auto-SOS silently never fires" gap the original audit found.
 *
 * `journeyId` (added in the v2 hardening pass) is a client-generated UUID,
 * stable for the lifetime of the journey — it doubles as the backend
 * journeys-table row's primary key (see repositories/supabase/
 * journeyRepository.ts), which is what makes that repository's retry logic
 * genuinely idempotent rather than a best-effort time-window heuristic.
 *
 * At most one journey is tracked at a time — SafetyContext already only
 * allows one active journey (`startJourney` overwrites any prior state), so
 * a single persisted record is enough. The record is cleared once a
 * terminal outcome is reached; it is not a history log (see
 * docs/journey-audit/technical-debt-report.md TD-5 for why a "past
 * journeys" feature is out of scope here).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "@/core/logger/logger";
import type { JourneyOutcome, JourneyEscalationReason } from "@/domain/entities/JourneyOutcome";

const ACTIVE_JOURNEY_KEY = "suraksha.journey.active.v2";

export interface PersistedJourney {
  /** Client-generated UUID, stable across app restarts — also the backend row's primary key. */
  journeyId: string;
  startedAtMs: number;
  /** Precomputed startedAtMs + durationSec*1000, for quick access and for mapping onto the future backend `deadline_at` contract (see docs/journey-audit/backend-contract.md) without recomputing it everywhere. */
  deadlineAtMs: number;
  durationSec: number;
  overdueGraceSec: number;
  /** Set the moment the user successfully checks in. */
  completedAtMs: number | null;
  /** Set the moment the user manually ends the journey before any overdue state. */
  cancelledAtMs: number | null;
  /** Only meaningful once `outcome` is "escalated" or "expired" — see domain/entities/JourneyOutcome.ts. */
  escalationReason: JourneyEscalationReason | null;
  /** Null while still active/overdue; set the instant a terminal outcome is determined, immediately before the record is cleared. */
  outcome: JourneyOutcome | null;
  /** Set once the grace period has been observed to fully expire and auto-SOS has already been attempted for this journey, so a later resume/relaunch doesn't re-attempt it. */
  autoSosTriggered: boolean;
  /** True once this journey has been resumed by the crash/background recovery effect at least once — a separate dimension from `outcome` (see domain/entities/JourneyOutcome.ts's file header for why "recovered" isn't a 5th outcome value). */
  wasRecoveredFromBackground: boolean;
}

export async function saveActiveJourney(journey: PersistedJourney): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_JOURNEY_KEY, JSON.stringify(journey));
  } catch (e) {
    logger.warn("[journeyPersistence] failed to persist active journey", e);
  }
}

export async function getActiveJourney(): Promise<PersistedJourney | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_JOURNEY_KEY);
    return raw ? (JSON.parse(raw) as PersistedJourney) : null;
  } catch (e) {
    logger.warn("[journeyPersistence] failed to read active journey", e);
    return null;
  }
}

/** Merges a partial update into the persisted journey, if one exists. No-ops if it was already cleared (e.g. ended concurrently). */
export async function updateActiveJourney(patch: Partial<PersistedJourney>): Promise<void> {
  const current = await getActiveJourney();
  if (!current) return;
  await saveActiveJourney({ ...current, ...patch });
}

export async function clearActiveJourney(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_JOURNEY_KEY);
  } catch (e) {
    logger.warn("[journeyPersistence] failed to clear active journey", e);
  }
}
