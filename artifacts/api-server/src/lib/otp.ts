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

export function isValidCodeFormat(code: string): boolean {
  return CODE_RE.test(code);
}

/** True if an ISO expiry timestamp is at or before `now` (default: current time). */
export function isExpired(expiresAtIso: string, now: number = Date.now()): boolean {
  return new Date(expiresAtIso).getTime() < now;
}
