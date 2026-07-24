import { randomInt, createHash } from "crypto";

// Pure, side-effect-free helpers for the email-OTP flow. Extracted from the
// route so they can be unit-tested without importing email-otp.ts, which pulls
// in the Resend/Supabase/Firebase clients at load time.

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;

/** SHA-256 hex hash — codes are never stored in plaintext. */
export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Cryptographically-random 6-digit code (100000–999999). */
export function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

/**
 * Masks an email for logging (e.g. "jo***@example.com") — keeps enough of
 * the local part to correlate repeated log lines/support tickets without
 * writing the full address to log storage. Never throws on malformed input;
 * falls back to a fully-masked placeholder instead.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***${domain}`;
}

export function isValidCodeFormat(code: string): boolean {
  return CODE_RE.test(code);
}

/** True if an ISO expiry timestamp is at or before `now` (default: current time). */
export function isExpired(expiresAtIso: string, now: number = Date.now()): boolean {
  return new Date(expiresAtIso).getTime() < now;
}
