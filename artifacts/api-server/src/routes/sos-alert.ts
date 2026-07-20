import { Router, type Request, type Response } from "express";
import * as https from "https";
import { SendSosAlertBody } from "@workspace/api-zod";
import { getBearerToken, verifyFirebaseToken } from "../lib/firebaseAdmin";
import { getServiceSupabase } from "../lib/supabaseAdmin";
import { checkRateLimit } from "../lib/rateLimit";
import { normalizePhone } from "../lib/phone";
import { logger } from "../lib/logger";

const router = Router();

// Generous relative to the client's own retry behaviour (one bounded 2s
// retry per alert, see lib/sosAlert.ts) — this caps scripted abuse, not
// legitimate repeated real emergencies.
const RATE_LIMIT = { windowSeconds: 60 * 60, limit: 20 };

// ── Twilio SMS helper ─────────────────────────────────────────────────────────

interface TwilioResult {
  success: boolean;
  sid?: string;
  error?: string;
}

async function sendTwilioSms(to: string, body: string): Promise<TwilioResult> {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) return { success: false, error: "not_configured" };

  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const payload = params.toString();
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.twilio.com",
        path: `/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          try {
            const json = JSON.parse(data) as { sid?: string; message?: string };
            if (res.statusCode === 201) {
              resolve({ success: true, sid: json.sid });
            } else {
              resolve({ success: false, error: json.message ?? `HTTP ${res.statusCode}` });
            }
          } catch {
            resolve({ success: false, error: "parse_error" });
          }
        });
      },
    );
    req.on("error", (e: Error) => resolve({ success: false, error: e.message }));
    req.write(payload);
    req.end();
  });
}

// ── GET /sos/config — lets the app know if Twilio is ready ───────────────────

router.get("/sos/config", (_req: Request, res: Response) => {
  const smsReady = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
  res.json({ sms: smsReady });
});

// ── POST /sos/alert — send emergency SMS to all trusted contacts ─────────────

interface AlertResult {
  configured: boolean;
  results: { id: string; success: boolean; error?: string }[];
}

// Idempotency cache lives in Supabase (migrations/001_sos_idempotency_and_
// rate_limit.sql) rather than an in-memory Map: under autoscale, a client
// retry can land on a different backend instance than its original request,
// and an in-memory cache on the *other* instance wouldn't know the first
// attempt already succeeded — resulting in a duplicate SMS to a trusted
// contact during a real emergency. A shared store fixes that; if the store
// itself is unreachable, both helpers below return/no-op so the request
// still gets processed (once, without dedup) rather than failing SOS
// delivery over a caching concern.
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

async function getCachedAlertResult(key: string): Promise<AlertResult | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("sos_idempotency_cache")
    .select("result, expires_at")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    logger.warn({ err: error }, "Idempotency cache read failed — proceeding without dedup");
    return null;
  }
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data.result as AlertResult;
}

async function cacheAlertResult(key: string, result: AlertResult): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;

  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString();
  const { error } = await supabase
    .from("sos_idempotency_cache")
    .upsert({ key, result, expires_at: expiresAt });
  if (error) logger.warn({ err: error }, "Idempotency cache write failed");
}

router.post("/sos/alert", async (req: Request, res: Response) => {
  // Verify the caller's Firebase ID token.
  const user = await verifyFirebaseToken(getBearerToken(req));
  if (!user) {
    logger.warn({ path: "/sos/alert" }, "SOS alert rejected — invalid or missing token");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const rate = await checkRateLimit("sos_alert", user.uid, RATE_LIMIT);
  if (!rate.allowed) {
    logger.warn({ uid: user.uid, count: rate.count }, "SOS alert rate limit exceeded");
    return res.status(429).json({ error: "rate_limited", message: "Too many SOS alerts — please try again shortly." });
  }

  // Validate + bound the request: each contact's phone is fanned out to Twilio,
  // so an unbounded/malformed body would let an authenticated caller send
  // arbitrary text to unlimited arbitrary numbers on the account.
  const parsed = SendSosAlertBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }
  const { contacts, message, idempotencyKey } = parsed.data;

  try {
    if (idempotencyKey) {
      const cached = await getCachedAlertResult(idempotencyKey);
      if (cached) {
        logger.info({ uid: user.uid }, "SOS alert served from idempotency cache (retry of a prior request)");
        return res.json(cached);
      }
    }

    const configured = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    );

    if (!configured) {
      const result: AlertResult = {
        configured: false,
        results: contacts.map((c) => ({ id: c.id, success: false, error: "sms_not_configured" })),
      };
      if (idempotencyKey) await cacheAlertResult(idempotencyKey, result);
      logger.warn({ uid: user.uid, contactCount: contacts.length }, "SOS alert dispatched — Twilio not configured, no SMS sent");
      return res.json(result);
    }

    // Send SMS to every contact in parallel
    const results = await Promise.all(
      contacts.map(async (c) => {
        const result = await sendTwilioSms(normalizePhone(c.phone), message);
        return { id: c.id, name: c.name, phone: c.phone, ...result };
      }),
    );

    const result: AlertResult = { configured: true, results };
    if (idempotencyKey) await cacheAlertResult(idempotencyKey, result);

    const successCount = results.filter((r) => r.success).length;
    logger.info(
      { uid: user.uid, contactCount: contacts.length, successCount, failCount: contacts.length - successCount },
      "SOS alert dispatched",
    );
    return res.json(result);
  } catch (err) {
    logger.error({ err, uid: user.uid }, "SOS alert failed unexpectedly");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
