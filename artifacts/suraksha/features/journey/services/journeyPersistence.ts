/**
 * Persists the one currently-active journey's timing across app restarts —
 * mirrors features/sos/services/sosOfflineQueue.ts's single-record pattern.
 *
 * `startedAtMs` (not an elapsed-seconds counter) is the load-bearing field:
 * see domain/policies/journeyRecoveryPolicy.ts for why deriving status from
 * wall-clock time, rather than trusting a counter that stops advancing the
 * moment the app is backgrounded or killed, is what actually closes the
 * "auto-SOS silently never fires" gap this audit found.
 *
 * At most one journey is tracked at a time — SafetyContext already only
 * allows one active journey (`startJourney` overwrites any prior state), so
 * a single persisted record is enough.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "@/core/logger/logger";

const ACTIVE_JOURNEY_KEY = "suraksha.journey.active.v1";

export interface PersistedJourney {
  startedAtMs: number;
  durationSec: number;
  overdueGraceSec: number;
  /** Set once the backend journeys-table row is confirmed written; null means the write hasn't been confirmed (best-effort — never blocks the local timer). */
  dbJourneyId: string | null;
  /** Set once the grace period has been observed to fully expire and auto-SOS has already been triggered for this journey, so a later resume/relaunch doesn't re-trigger it. */
  autoSosTriggered: boolean;
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
