import { Router, type Request, type Response } from "express";
import * as https from "https";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function getBearerToken(req: Request): string | null {
  const h = req.headers["authorization"] ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
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
}

router.post("/sos/alert", async (req: Request, res: Response) => {
  // Verify Supabase JWT
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { data: { user }, error: authError } = await serviceSupabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Invalid token" });

    const body = req.body as AlertRequestBody;
    const { contacts, message } = body;

    if (!Array.isArray(contacts) || !message) {
      return res.status(400).json({ error: "contacts[] and message are required" });
    }

    const configured = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    );

    if (!configured) {
      return res.json({
        configured: false,
        results: contacts.map((c) => ({ id: c.id, success: false, error: "sms_not_configured" })),
      });
    }

    // Send SMS to every contact in parallel
    const results = await Promise.all(
      contacts.map(async (c) => {
        const result = await sendTwilioSms(c.phone, message);
        return { id: c.id, name: c.name, phone: c.phone, ...result };
      }),
    );

    return res.json({ configured: true, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return res.status(500).json({ error: msg });
  }
});

export default router;
