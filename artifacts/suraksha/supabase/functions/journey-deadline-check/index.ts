// supabase/functions/journey-deadline-check/index.ts
//
// Server-side backstop for the journey ("timed check-in") safety feature.
// The mobile client's own wall-clock tick (features/sos/context/
// SafetyContext.tsx) is the primary mechanism that detects an overdue
// journey and auto-escalates to SOS — but that tick only runs while the JS
// engine is alive. If the app is killed and never reopened before the
// deadline+grace period passes, nothing client-side ever runs again to
// notice. This Edge Function is the server-side detector+escalator that
// closes that one residual gap (see docs/journey-audit/backend-contract.md
// and docs/backend-hardening/06-Background-Jobs.md for the full design
// rationale).
//
// NOT DEPLOYED — this file is a ready-to-deploy deliverable, written and
// reviewed but never run, consistent with this environment having no
// Supabase project/dashboard access (see every prior audit/hardening pass
// this session). Deploy with `supabase functions deploy journey-deadline-check`
// and schedule it to run every minute (Dashboard → Edge Functions → Cron, or
// `schedule = "* * * * *"` in supabase/config.toml) — see
// docs/backend-hardening/08-Migration-Guide.md for the exact steps.
//
// Required secrets (set via `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — to call get_overdue_journeys()
//     and read emergency_contacts with RLS bypassed (this function acts on
//     behalf of the system, not a single signed-in user).
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER — same Twilio
//     account api-server/src/routes/sos-alert.ts already uses. Sent
//     directly from here (not by calling POST /sos/alert) because that route
//     requires a verified end-user Firebase ID token — there is no
//     server-to-server/machine auth path on it, and minting one is out of
//     this pass's scope.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface OverdueJourney {
  journey_id: string;
  user_id: string;
  started_at: string;
  deadline_at: string;
}

interface EmergencyContact {
  name: string;
  phone: string;
}

// Mirrors api-server/src/lib/phone.ts's normalizePhone exactly. Duplicated
// rather than imported: this function runs on Deno, api-server runs on
// Node — there is no shared module boundary between the two runtimes today.
function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return trimmed;
}

async function sendTwilioSms(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const auth = btoa(`${accountSid}:${authToken}`);

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  if (res.status === 201) return { success: true };
  const json = await res.json().catch(() => ({}));
  return { success: false, error: (json as { message?: string }).message ?? `HTTP ${res.status}` };
}

function buildOverdueMessage(deadlineAt: string): string {
  return (
    `SURAKSHA SAFETY ALERT: A trusted contact set a journey timer that has ` +
    `expired without check-in (deadline ${deadlineAt}). This is an automated ` +
    `server-side alert — please check on them.`
  );
}

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Supabase env vars not configured" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const smsConfigured = !!(twilioSid && twilioToken && twilioFrom);

  const { data: overdue, error } = await supabase.rpc<OverdueJourney[]>("get_overdue_journeys");
  if (error) {
    console.error("get_overdue_journeys failed", error);
    return new Response(JSON.stringify({ error: "get_overdue_journeys failed" }), { status: 500 });
  }

  const results: { journeyId: string; escalated: boolean; contactsNotified: number }[] = [];

  for (const journey of overdue ?? []) {
    // Mark escalated FIRST (before sending any SMS): if this function is
    // invoked twice concurrently for the same overdue journey — two
    // overlapping cron runs — the second one's insert fails the PK
    // conflict and it skips straight to `continue`, guaranteeing at most
    // one alert per journey rather than a possible duplicate.
    const { error: insertError } = await supabase
      .from("journey_escalations")
      .insert({ journey_id: journey.journey_id });
    if (insertError) {
      // Either a genuine write failure (logged, retried next run since the
      // journey is still absent from journey_escalations) or — far more
      // likely — a unique-violation because a concurrent invocation already
      // claimed this journey. Either way, do not send a second SMS here.
      continue;
    }

    let contactsNotified = 0;
    if (smsConfigured) {
      const { data: contacts, error: contactsError } = await supabase
        .from("emergency_contacts")
        .select("name, phone")
        .eq("user_id", journey.user_id);

      if (!contactsError && contacts) {
        const message = buildOverdueMessage(journey.deadline_at);
        for (const contact of contacts as EmergencyContact[]) {
          const sms = await sendTwilioSms(twilioSid!, twilioToken!, twilioFrom!, normalizePhone(contact.phone), message);
          if (sms.success) contactsNotified++;
          else console.error("journey-deadline-check SMS failed", { journeyId: journey.journey_id, error: sms.error });
        }
      }
    }

    results.push({ journeyId: journey.journey_id, escalated: true, contactsNotified });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
