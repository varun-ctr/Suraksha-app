/**
 * SOS alert dispatch.
 *
 * On activation:
 *  1. Tries the backend /sos/alert route (Twilio — fully automatic, no user action).
 *  2. If backend not configured / unavailable → opens native SMS app pre-filled with
 *     all contacts and the emergency message (user taps Send once).
 *  3. Opens WhatsApp for the first contact with the same message.
 *  4. Initiates a phone call to the first contact.
 *
 * Each contact gets an AlertStatus so the UI can show per-contact delivery state.
 */

import type { Contact } from "@/context/AppContext";
import type { Coords } from "@/context/SafetyContext";
import { callNumber, locationLink, openWhatsApp, sendSms } from "@/lib/native";
import { supabase } from "@/lib/supabaseClient";

export type SmsState     = "idle" | "sending" | "sent" | "opening" | "failed";
export type WhatsAppState = "idle" | "opening" | "done";
export type CallState    = "idle" | "calling" | "done";

export interface AlertStatus {
  id: string;
  name: string;
  phone: string;
  sms:      SmsState;
  whatsapp: WhatsAppState;
  call:     CallState;
}

// ── Message builder ───────────────────────────────────────────────────────────

export async function buildEmergencyMessageAsync(
  userName: string,
  coords: Coords | null,
  shareUrl: string | null,
  address: string | null,
): Promise<string> {
  const link = shareUrl ?? (coords ? locationLink(coords.lat, coords.lng) : null);
  const now = new Date();
  const date = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const lines = [
    "🚨 EMERGENCY ALERT",
    "",
    `${userName || "Someone"} may be in danger and needs immediate help!`,
    `📅 ${date} at ${time}`,
  ];

  if (address) {
    lines.push(`📍 Location: ${address}`);
  } else if (coords) {
    lines.push(`📍 Coordinates: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
  }

  if (link) {
    lines.push("", "🗺️ Live tracking:", link);
  }

  lines.push(
    "",
    "Please call them or go to their location right away.",
    "— Sent via Suraksha Safety App",
  );
  return lines.join("\n");
}

/** Synchronous fallback (no battery, no async) — used when async is unavailable */
export function buildEmergencyMessage(
  userName: string,
  coords: Coords | null,
  shareUrl: string | null,
  address?: string | null,
): string {
  const link = shareUrl ?? (coords ? locationLink(coords.lat, coords.lng) : null);
  const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const lines = [
    "🚨 EMERGENCY ALERT",
    "",
    `${userName || "Someone"} may be in danger and needs immediate help!`,
    `⏰ Time: ${time}`,
  ];

  if (address) {
    lines.push(`📍 Location: ${address}`);
  } else if (coords) {
    lines.push(`📍 Coordinates: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
  }

  if (link) {
    lines.push("", "🗺️ Live tracking:", link);
  }

  lines.push(
    "",
    "Please call them or go to their location right away.",
    "— Sent via Suraksha Safety App",
  );
  return lines.join("\n");
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export async function sendSosAlerts(
  contacts: Contact[],
  coords: Coords | null,
  shareUrl: string | null,
  userName: string,
  address?: string | null,
): Promise<AlertStatus[]> {
  if (contacts.length === 0) return [];

  const message = await buildEmergencyMessageAsync(userName, coords, shareUrl, address ?? null);
  const backendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");

  // Initial statuses — all pending
  const statuses: AlertStatus[] = contacts.map((c) => ({
    id:       c.id,
    name:     c.name,
    phone:    c.phone,
    sms:      "sending",
    whatsapp: "idle",
    call:     "idle",
  }));

  // ── 1. Try backend (Twilio auto-SMS) ─────────────────────────────
  let backendSent = false;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

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
  if (!backendSent) {
    try {
      const phones = contacts.map((c) => c.phone).join(",");
      await sendSms(phones, message);
      statuses.forEach((s) => { s.sms = "opening"; });
    } catch {
      statuses.forEach((s) => { s.sms = "failed"; });
    }
  }

  // ── 3. WhatsApp for first contact ────────────────────────────────
  if (contacts.length > 0) {
    try {
      await openWhatsApp(contacts[0].phone, message);
      statuses[0].whatsapp = "opening";
    } catch {
      // WhatsApp not installed — skip
    }
  }

  // ── 4. Call first contact ────────────────────────────────────────
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
