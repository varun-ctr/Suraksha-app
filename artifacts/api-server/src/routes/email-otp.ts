import { randomInt, createHash } from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { Resend } from "resend";
import { getServiceSupabase } from "../lib/supabaseAdmin";
import { checkRateLimit } from "../lib/rateLimit";
import { getOrCreateUserByEmail, mintCustomToken } from "../lib/firebaseAdmin";
import { optionalEnv } from "../lib/env";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const RESEND_API_KEY = optionalEnv("RESEND_API_KEY");
const RESEND_FROM_EMAIL = optionalEnv("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const REQUEST_RATE_LIMIT = { windowSeconds: 60 * 60, limit: 5 };
const REQUEST_RATE_LIMIT_IP = { windowSeconds: 60 * 60, limit: 20 };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

// ---------------------------------------------------------------------------
// POST /auth/email-otp/request
//
// Generates a 6-digit code, stores its hash (never the plaintext) with a
// short expiry in Supabase, and emails it via Resend. Always returns the
// same success shape regardless of whether the email is registered, to
// avoid leaking account existence.
// ---------------------------------------------------------------------------
router.post("/auth/email-otp/request", async (req: Request, res: Response) => {
  const { email: rawEmail } = req.body as { email?: string };
  const email = rawEmail?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "invalid_email", message: "Enter a valid email address." });
    return;
  }

  const supabase = getServiceSupabase();
  if (!supabase || !resend) {
    res.status(503).json({
      error: "not_configured",
      message: "Email sign-in is not configured on the server.",
    });
    return;
  }

  const emailRate = await checkRateLimit("email_otp_request", `email:${email}`, REQUEST_RATE_LIMIT);
  const ipRate = await checkRateLimit("email_otp_request_ip", `ip:${req.ip}`, REQUEST_RATE_LIMIT_IP);
  if (!emailRate.allowed || !ipRate.allowed) {
    logger.warn({ email, ip: req.ip }, "Email OTP request rate limit exceeded");
    res.status(429).json({ error: "rate_limited", message: "Too many requests. Please wait and try again." });
    return;
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  try {
    const { error } = await supabase
      .from("email_otp_codes")
      .upsert({ email, code_hash: hashCode(code), attempts: 0, expires_at: expiresAt });
    if (error) throw error;

    await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: email,
      subject: `${code} is your Suraksha sign-in code`,
      text: `Your Suraksha sign-in code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    });
  } catch (err) {
    logger.error({ err, email }, "Email OTP request failed");
    // Don't reveal failure details to the caller — same response either way.
  }

  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /auth/email-otp/verify
//
// Checks the submitted code against the stored hash, then bridges to
// Firebase via a custom token (see firebaseAdmin.ts) so the client can
// complete sign-in with the ordinary Firebase client SDK.
// ---------------------------------------------------------------------------
router.post("/auth/email-otp/verify", async (req: Request, res: Response) => {
  const { email: rawEmail, code } = req.body as { email?: string; code?: string };
  const email = rawEmail?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || !code || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "invalid_request", message: "A valid email and 6-digit code are required." });
    return;
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    res.status(503).json({ error: "not_configured", message: "Email sign-in is not configured on the server." });
    return;
  }

  const { data: row, error: fetchError } = await supabase
    .from("email_otp_codes")
    .select("code_hash, attempts, expires_at")
    .eq("email", email)
    .maybeSingle();

  if (fetchError) {
    logger.error({ err: fetchError, email }, "Email OTP lookup failed");
    res.status(500).json({ error: "server", message: "Could not verify code. Please try again." });
    return;
  }

  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: "invalid_or_expired", message: "That code is invalid or has expired." });
    return;
  }

  if (hashCode(code) !== row.code_hash) {
    const attempts = row.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await supabase.from("email_otp_codes").delete().eq("email", email);
      logger.warn({ email }, "Email OTP invalidated after too many failed attempts");
      res.status(400).json({ error: "too_many_attempts", message: "Too many incorrect attempts. Request a new code." });
      return;
    }
    await supabase.from("email_otp_codes").update({ attempts }).eq("email", email);
    res.status(400).json({ error: "invalid_code", message: "Incorrect code. Please try again." });
    return;
  }

  // Correct code — one-time use, invalidate immediately.
  await supabase.from("email_otp_codes").delete().eq("email", email);

  try {
    const uid = await getOrCreateUserByEmail(email);
    const customToken = await mintCustomToken(uid);
    res.json({ customToken });
  } catch (err) {
    logger.error({ err, email }, "Email OTP: minting Firebase custom token failed");
    res.status(503).json({
      error: "not_configured",
      message: "Email sign-in isn't available — the server's Firebase Admin credentials aren't fully configured.",
    });
  }
});

export default router;
