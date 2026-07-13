/**
 * SOS alert dispatch.
 *
 * On activation:
 *  1. Tries the backend /sos/alert route (Twilio — fully automatic, no user action).
 *  2. If backend not configured / unavailable → opens the native SMS app pre-filled
 *     with all contacts and the emergency message (user taps Send once).
 *  3. Initiates a phone call to the first contact.
 *
 * Each contact gets an AlertStatus so the UI can show per-contact delivery state.
 * The message itself is built by the pure, localized helper in
 * `lib/emergencyMessage.ts`.
 */

import type { Contact } from "@/context/AppContext";
import type { Coords } from "@/context/SafetyContext";
import { callNumber, sendSms } from "@/lib/native";
import { apiFetch } from "@/lib/apiClient";
import { firebaseAuth } from "@/lib/firebase";
import { getBackendUrl } from "@/lib/env";
import { buildEmergencyMessage, type Translate } from "@/lib/emergencyMessage";

// Cheap, synchronous check used to skip the backend attempt outright when it
// can never succeed (no backend configured) or would just round-trip to a
// guaranteed 401 (no signed-in user) — both previously skipped for free via
// `if (token && backendUrl)` before apiClient centralized the fetch. Without
// this, a real SOS activation pays a network round-trip (or a full
// BACKEND_RETRY_DELAY_MS retry cycle) for an outcome already known locally.
function canAttemptBackend(): boolean {
  return !!getBackendUrl() && !!firebaseAuth.currentUser;
}

export type SmsState  = "idle" | "sending" | "sent" | "opening" | "failed";
export type CallState = "idle" | "calling" | "done";

export interface AlertStatus {
  id: string;
  name: string;
  phone: string;
  sms:  SmsState;
  call: CallState;
}

type BackendAlertResult =
  | { ok: true; configured: boolean; results: { id: string; success: boolean; error?: string }[] }
  | { ok: false; retryable: boolean };

const BACKEND_RETRY_DELAY_MS = 2000;

/** One attempt at the backend Twilio dispatch. Never throws. */
async function attemptBackendAlert(
  contacts: Contact[],
  message: string,
  idempotencyKey: string,
): Promise<BackendAlertResult> {
  const { response } = await apiFetch("/sos/alert", {
    method: "POST",
    body: JSON.stringify({
      contacts: contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
      message,
      idempotencyKey,
    }),
    timeoutMs: 10_000,
  });

  // Network error, timeout, or no backend configured — transient from the
  // caller's perspective either way, worth one retry.
  if (!response) return { ok: false, retryable: true };

  if (response.ok) {
    try {
      const data = await response.json() as {
        configured: boolean;
        results: { id: string; success: boolean; error?: string }[];
      };
      return { ok: true, ...data };
    } catch {
      return { ok: false, retryable: true };
    }
  }
  // 5xx is likely transient (deploy restart, overload) — worth one retry.
  // 4xx (auth, bad request, rate limited) won't be fixed by retrying.
  return { ok: false, retryable: response.status >= 500 };
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export async function sendSosAlerts(
  t: Translate,
  contacts: Contact[],
  coords: Coords | null,
  shareUrl: string | null,
  userName: string,
  address?: string | null,
): Promise<AlertStatus[]> {
  if (contacts.length === 0) return [];

  const message = buildEmergencyMessage(t, userName, coords, shareUrl, address ?? null);

  // Initial statuses — all pending
  const statuses: AlertStatus[] = contacts.map((c) => ({
    id:    c.id,
    name:  c.name,
    phone: c.phone,
    sms:   "sending",
    call:  "idle",
  }));

  // ── 1. Try backend (Twilio auto-SMS), with one bounded retry ─────
  // The retry reuses the same idempotency key as the first attempt, so if
  // the first attempt actually succeeded server-side but its response was
  // lost (timeout, dropped connection), the backend can recognise the
  // retry and return the cached result instead of re-sending via Twilio.
  const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  let result: BackendAlertResult = { ok: false, retryable: false };
  if (canAttemptBackend()) {
    result = await attemptBackendAlert(contacts, message, idempotencyKey);
    if (!result.ok && result.retryable) {
      await new Promise((r) => setTimeout(r, BACKEND_RETRY_DELAY_MS));
      result = await attemptBackendAlert(contacts, message, idempotencyKey);
    }
  }

  if (result.ok && result.configured) {
    for (const r of result.results) {
      const s = statuses.find((x) => x.id === r.id);
      if (s) s.sms = r.success ? "sent" : "failed";
    }
  }

  // ── 2. Native SMS fallback (opens SMS app, pre-filled) ───────────
  // Per contact, not gated on the whole backend call — a contact whose
  // Twilio send specifically failed (while others succeeded) still needs
  // this fallback, and one comma-joined recipient list is unreliable
  // anyway (iOS in particular silently drops all but the first), so each
  // contact gets their own message individually.
  for (const c of contacts) {
    const s = statuses.find((x) => x.id === c.id);
    if (!s || s.sms === "sent") continue; // backend already delivered this one
    try {
      await sendSms(c.phone, message);
      s.sms = "opening";
    } catch {
      s.sms = "failed";
    }
  }

  // ── 3. Call first contact ────────────────────────────────────────
  if (contacts.length > 0) {
    try {
      await callNumber(contacts[0].phone);
      statuses[0].call = "calling";
    } catch {
      // Dialer unavailable (web) — skip
    }
  }

  return statuses;
}

// ── Journey start alert ───────────────────────────────────────────────────────
// Notifies trusted contacts when the user starts a journey timer. Tries the
// Twilio backend first (fully automatic); falls back to opening the native SMS
// composer if the backend is unavailable.

export async function sendJourneyAlerts(
  contacts: Contact[],
  coords: Coords | null,
  durationMin: number,
  userName: string,
  address?: string | null,
): Promise<void> {
  if (contacts.length === 0) return;

  const name = userName.trim() || "Someone";
  const now  = new Date();
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const lines: string[] = [
    "🚶 Journey Started",
    "",
    `${name} has started a journey at ${time} and set a ${durationMin}-minute check-in timer.`,
    "If they don't check in safely, an automatic SOS alert will follow.",
  ];

  if (address) {
    lines.push("", `📍 Location: ${address}`);
  } else if (coords) {
    lines.push("", `📍 Coordinates: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
  }

  if (coords) {
    lines.push("", `🗺️ Live location: https://maps.google.com/?q=${coords.lat},${coords.lng}`);
  }

  lines.push("", "— Sent via Suraksha Safety App");
  const message = lines.join("\n");

  let backendSent = false;

  const response = canAttemptBackend()
    ? (await apiFetch("/sos/alert", {
        method: "POST",
        body: JSON.stringify({
          contacts: contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
          message,
        }),
        timeoutMs: 8_000,
      })).response
    : null;

  if (response?.ok) {
    try {
      const data = (await response.json()) as {
        configured: boolean;
        results: { success: boolean }[];
      };
      if (data.configured && data.results.some((r) => r.success)) {
        backendSent = true;
      }
    } catch {
      // Malformed response — fall through to native SMS
    }
  }

  // Native SMS fallback: open pre-filled SMS composer for each contact
  if (!backendSent) {
    for (const c of contacts) {
      try {
        await sendSms(c.phone, message);
      } catch {
        // Ignore per-contact failures
      }
    }
  }
}
