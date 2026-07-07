import { Router, type Request, type Response } from "express";
import * as https from "https";
import { getBearerToken, verifyFirebaseToken } from "../lib/firebaseAdmin";

const router = Router();

// ── Phone normalisation ───────────────────────────────────────────────────────
// Twilio requires E.164 format (+CountryCode…). Indian mobile numbers stored
// without a country code (10 digits, starting 6-9) get the +91 prefix added.
function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed;          // already E.164
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return trimmed;                                        // unknown format — pass as-is
}

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

interface ContactInput {
  id: string;
  name: string;
  phone: string;
}

interface AlertRequestBody {
  contacts: ContactInput[];
  message: string;
  /** Client-generated key, stable across its own retries of the same alert. */
  idempotencyKey?: string;
}

interface AlertResult {
  configured: boolean;
  results: { id: string; success: boolean; error?: string }[];
}

// Short-lived cache so a client retry after a lost response (not a lost
// request) returns the already-computed result instead of re-sending SMS
// via Twilio a second time. Bounded TTL keeps this from growing unbounded.
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const idempotencyCache = new Map<string, { result: AlertResult; expiresAt: number }>();

function getCachedAlertResult(key: string): AlertResult | null {
  const entry = idempotencyCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    idempotencyCache.delete(key);
    return null;
  }
  return entry.result;
}

function cacheAlertResult(key: string, result: AlertResult): void {
  idempotencyCache.set(key, { result, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS });
  for (const [k, v] of idempotencyCache) {
    if (v.expiresAt <= Date.now()) idempotencyCache.delete(k);
  }
}

router.post("/sos/alert", async (req: Request, res: Response) => {
  // Verify the caller's Firebase ID token.
  const user = await verifyFirebaseToken(getBearerToken(req));
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const body = req.body as AlertRequestBody;
    const { contacts, message, idempotencyKey } = body;

    if (!Array.isArray(contacts) || !message) {
      return res.status(400).json({ error: "contacts[] and message are required" });
    }

    if (idempotencyKey) {
      const cached = getCachedAlertResult(idempotencyKey);
      if (cached) return res.json(cached);
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
      if (idempotencyKey) cacheAlertResult(idempotencyKey, result);
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
    if (idempotencyKey) cacheAlertResult(idempotencyKey, result);
    return res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return res.status(500).json({ error: msg });
  }
});

export default router;
