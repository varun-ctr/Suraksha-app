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
import { firebaseAuth } from "@/lib/firebase";
import { buildEmergencyMessage, type Translate } from "@/lib/emergencyMessage";

export type SmsState  = "idle" | "sending" | "sent" | "opening" | "failed";
export type CallState = "idle" | "calling" | "done";

export interface AlertStatus {
  id: string;
  name: string;
  phone: string;
  sms:  SmsState;
  call: CallState;
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
  const backendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");

  // Initial statuses — all pending
  const statuses: AlertStatus[] = contacts.map((c) => ({
    id:    c.id,
    name:  c.name,
    phone: c.phone,
    sms:   "sending",
    call:  "idle",
  }));

  // ── 1. Try backend (Twilio auto-SMS) ─────────────────────────────
  let backendSent = false;
  try {
    const fbUser = firebaseAuth.currentUser;
    const token = fbUser ? await fbUser.getIdToken().catch(() => null) : null;

    if (token && backendUrl) {
      const res = await fetch(`${backendUrl}/sos/alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contacts: contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
          message,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        const data = await res.json() as {
          configured: boolean;
          results: { id: string; success: boolean; error?: string }[];
        };

        if (data.configured) {
          for (const r of data.results) {
            const s = statuses.find((x) => x.id === r.id);
            if (s) s.sms = r.success ? "sent" : "failed";
          }
          backendSent = data.results.some((r) => r.success);
        }
      }
    }
  } catch {
    // Backend unavailable — continue with native fallback
  }

  // ── 2. Native SMS fallback (opens SMS app, pre-filled) ───────────
  // Send per contact rather than one comma-joined recipient list: multi-
  // recipient sms: URIs are unreliable (iOS in particular silently drops all
  // but the first), so each contact gets their own message individually.
  if (!backendSent) {
    for (const c of contacts) {
      const s = statuses.find((x) => x.id === c.id);
      try {
        await sendSms(c.phone, message);
        if (s) s.sms = "opening";
      } catch {
        if (s) s.sms = "failed";
      }
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
