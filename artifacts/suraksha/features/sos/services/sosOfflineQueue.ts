/**
 * Persists the one currently-active SOS's delivery state across app
 * restarts and network interruptions — the record that an SOS was
 * triggered, and how far its delivery (DB event write, contact alerts)
 * has gotten, must never live only in transient React state. A network
 * blip, an app kill, or a crash mid-request would otherwise silently drop
 * the emergency with no way to recover it.
 *
 * At most one activation is tracked at a time — SafetyContext already
 * only allows one active SOS run (`sos.phase !== "idle"` guards
 * triggerSOS), so a single persisted record (not a general queue) is
 * enough and much simpler to reason about.
 *
 * Encrypted at rest (AES-256-CBC + HMAC-SHA256, the same envelope
 * protecting the Firebase session — see core/storage/cryptoBox.ts) since
 * this record carries plaintext GPS coordinates and an address for a user
 * in active distress, arguably the single most sensitive data this app
 * persists locally. See core/storage/secureAsyncStorage.ts for the
 * encrypt/decrypt wrapper and its lazy-migration behavior for
 * already-persisted plaintext records.
 */
import { logger } from "@/core/logger/logger";
import { secureAsyncGet, secureAsyncSet, secureAsyncRemove } from "@/core/storage/secureAsyncStorage";

export const PENDING_ACTIVATION_KEY = "suraksha.sos.pendingActivation.v1";

export interface PendingSosActivation {
  /** Client-generated, stable for the lifetime of this activation — used to detect a retry of the same trigger. */
  idempotencyKey: string;
  userId: string;
  lat: number;
  lng: number;
  address: string | null;
  triggeredAtMs: number;
  /** Set once insertSosEvent has confirmed a row exists — null means the write hasn't been confirmed yet and should be retried. */
  dbEventId: string | null;
  /** Set once sendSosAlerts has run at least once for this activation — best-effort; re-running it after a crash is far safer than never alerting contacts, even if it means a duplicate SMS-compose prompt. */
  alertsDispatched: boolean;
}

export async function savePendingActivation(activation: PendingSosActivation): Promise<void> {
  try {
    await secureAsyncSet(PENDING_ACTIVATION_KEY, JSON.stringify(activation));
  } catch (e) {
    logger.warn("[sosOfflineQueue] failed to persist pending activation", e);
  }
}

export async function getPendingActivation(): Promise<PendingSosActivation | null> {
  try {
    const raw = await secureAsyncGet(PENDING_ACTIVATION_KEY);
    return raw ? (JSON.parse(raw) as PendingSosActivation) : null;
  } catch (e) {
    logger.warn("[sosOfflineQueue] failed to read pending activation", e);
    return null;
  }
}

/** Merges a partial update into the persisted activation, if one exists. No-ops if it was already cleared (e.g. cancelled concurrently). */
export async function updatePendingActivation(patch: Partial<PendingSosActivation>): Promise<void> {
  const current = await getPendingActivation();
  if (!current) return;
  await savePendingActivation({ ...current, ...patch });
}

export async function clearPendingActivation(): Promise<void> {
  try {
    await secureAsyncRemove(PENDING_ACTIVATION_KEY);
  } catch (e) {
    logger.warn("[sosOfflineQueue] failed to clear pending activation", e);
  }
}
