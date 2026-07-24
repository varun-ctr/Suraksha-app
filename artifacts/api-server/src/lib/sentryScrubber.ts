/**
 * PII-scrubbing for outgoing Sentry events — mirrors the mobile app's
 * core/analytics/sentryScrubber.ts (duplicated rather than shared: this
 * package and the mobile app have no shared module boundary, same
 * precedent as supabase/functions/journey-deadline-check's duplicated
 * phone-normalization helper). Defense-in-depth on top of this backend's
 * existing pino redaction (lib/logger.ts, which only covers headers) and
 * the email-masking already applied at log call sites (lib/otp.ts's
 * maskEmail — see docs/security-audit/03-Privacy-Audit.md).
 *
 * What this reliably catches: email addresses, bearer tokens/Authorization
 * headers, and decimal numbers matching typical GPS coordinate precision.
 * What it does NOT reliably catch: free-text street addresses or personal
 * names — no general-purpose regex can detect arbitrary addresses/names
 * without unacceptable false-positive/negative rates; this backend's own
 * captureAlert() call sites are reviewed to only pass structured,
 * non-free-text context (uid, route, counts — see 03-Privacy-Audit.md),
 * which is what actually keeps those two categories out, not this
 * scrubber.
 *
 * Fails closed: if scrubbing itself throws, the event is dropped (return
 * null) rather than risk sending unscrubbed data.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const COORD_RE = /-?\d{1,3}\.\d{4,}/g;
const PHONE_RE = /(?:\+?\d[\d\s\-().]{6,}\d)/g;

function scrubString(value: string): string {
  return value
    .replace(BEARER_RE, "Bearer [REDACTED]")
    .replace(EMAIL_RE, "[REDACTED_EMAIL]")
    .replace(COORD_RE, "[REDACTED_COORD]")
    .replace(PHONE_RE, "[REDACTED_PHONE]");
}

function scrubValue(value: unknown, depth: number): unknown {
  if (depth > 8) return value;
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = scrubValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Sentry `beforeSend` hook. Strips `user` and `request.headers`
 * Authorization/Cookie values, then recursively scrubs every remaining
 * string in the event.
 */
export function scrubSentryEvent<T extends Record<string, unknown>>(event: T): T | null {
  try {
    const cloned = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
    delete cloned.user;

    const request = cloned.request as { headers?: Record<string, unknown> } | undefined;
    if (request?.headers) {
      delete request.headers["Authorization"];
      delete request.headers["authorization"];
      delete request.headers["Cookie"];
      delete request.headers["cookie"];
    }

    return scrubValue(cloned, 0) as T;
  } catch {
    return null;
  }
}
