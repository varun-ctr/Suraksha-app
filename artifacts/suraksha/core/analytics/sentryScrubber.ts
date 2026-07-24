/**
 * PII-scrubbing for outgoing Sentry events — a defense-in-depth net for
 * `Sentry.captureException`'s raw error objects (see crashReporting.ts),
 * which have no structural guarantee of being PII-free the way this app's
 * own telemetry payloads do (sosTelemetry.ts/journeyTelemetry.ts/
 * authTelemetry.ts/startupTelemetry.ts all use closed-enum-only payload
 * types, verified in docs/security-audit/03-Privacy-Audit.md — an Error's
 * `.message`/`.stack`, by contrast, is arbitrary text this module can't
 * control at the throw site).
 *
 * What this reliably catches: email addresses, bearer tokens/Authorization
 * headers, and decimal numbers matching typical GPS coordinate precision
 * (regex-detectable, low-false-positive patterns). What it does NOT
 * reliably catch: free-text street addresses or personal names — no
 * general-purpose regex can detect arbitrary addresses/names without
 * unacceptable false-positive/negative rates, so protection for those two
 * categories comes from the architectural guarantee that this app's own
 * telemetry never constructs a payload containing free text in the first
 * place (see the Privacy Audit doc above) — this scrubber is a second
 * layer for the one input source (raw exceptions) that guarantee doesn't
 * cover, not a replacement for it.
 *
 * Fails closed: if scrubbing itself throws for any reason, the event is
 * dropped entirely (return null — Sentry's documented way to discard an
 * event in `beforeSend`) rather than risk sending unscrubbed data.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
// Typical GPS precision (e.g. 12.9715987) has 4+ fractional digits — this
// avoids flagging ordinary low-precision decimals (prices, versions, "4.5
// stars") as false positives.
const COORD_RE = /-?\d{1,3}\.\d{4,}/g;
// Loose phone-number matcher: 8+ digits, optionally grouped/punctuated.
const PHONE_RE = /(?:\+?\d[\d\s\-().]{6,}\d)/g;

function scrubString(value: string): string {
  return value
    .replace(BEARER_RE, "Bearer [REDACTED]")
    .replace(EMAIL_RE, "[REDACTED_EMAIL]")
    .replace(COORD_RE, "[REDACTED_COORD]")
    .replace(PHONE_RE, "[REDACTED_PHONE]");
}

function scrubValue(value: unknown, depth: number): unknown {
  if (depth > 8) return value; // guard against pathological/circular structures
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
 * Sentry `beforeSend` hook. Strips any `user` field (this app never calls
 * `Sentry.setUser()`, but this is defensive in case a future change ever
 * attaches one without updating this scrubber), removes Authorization/
 * Cookie headers from `request.headers` if present, then recursively
 * scrubs every remaining string in the event.
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
