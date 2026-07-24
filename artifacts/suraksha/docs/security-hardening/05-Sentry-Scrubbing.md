# 5. Sentry Privacy (`beforeSend` Scrubbing)

## The gap this closes

The prior security audit found both Sentry integrations (mobile `core/analytics/crashReporting.ts`, backend `api-server/src/lib/errorReporting.ts`) forwarded raw exception objects to `Sentry.captureException`/`captureError` with no `beforeSend`/`beforeBreadcrumb` configured — this app's own telemetry breadcrumbs were already verified PII-free by construction (closed-enum-only payload types), but a raw `Error.message`/`.stack` had no structural guarantee against embedding PII if a future code change ever threw an error built from user input.

## What was implemented

Two new, near-identical modules (duplicated rather than shared — the mobile app and `api-server` are separate packages with no shared module boundary, same precedent as the Edge Function's duplicated `normalizePhone` in the backend-hardening pass):

- `core/analytics/sentryScrubber.ts` (mobile)
- `api-server/src/lib/sentryScrubber.ts` (backend)

Both export `scrubSentryEvent(event)`, wired as both `beforeSend` and `beforeBreadcrumb` in their respective `Sentry.init()` calls, alongside `sendDefaultPii: false` (an explicit Sentry SDK option that stops the SDK from automatically attaching IP addresses/request data by default).

## What the scrubber does

1. **Deletes `event.user` entirely.** Neither integration ever calls `Sentry.setUser()`, but this is defensive: if a future change ever attaches one without updating this scrubber, it's still stripped before leaving the device/server.
2. **Deletes `Authorization`/`Cookie` headers** (both cases) from `event.request.headers`, if present.
3. **Recursively walks every remaining string** in the event (messages, breadcrumb text, `extra` context, nested objects/arrays) and applies four regex-based redactions, in order:
   - Bearer tokens → `Bearer [REDACTED]`
   - Email addresses → `[REDACTED_EMAIL]`
   - GPS-precision decimal coordinates (4+ fractional digits, e.g. `12.9715987`) → `[REDACTED_COORD]`
   - Phone-number-shaped digit sequences (8+ digits, optionally grouped/punctuated) → `[REDACTED_PHONE]`
4. **Fails closed.** If scrubbing itself throws for any reason, the function returns `null` — Sentry's documented way to discard an event entirely in `beforeSend`/`beforeBreadcrumb` — rather than risk sending an unscrubbed event.

## Verification: Email / Phone / GPS / Tokens / Auth headers removed

Directly unit-tested (`core/analytics/__tests__/sentryScrubber.test.ts` on mobile, `api-server/src/__tests__/sentryScrubber.test.ts` on the backend — 8 tests each, all passing):
- Redacts an email address anywhere in the event. ✅
- Redacts a Bearer token. ✅
- Redacts GPS-precision coordinates, while explicitly **not** redacting ordinary low-precision decimals (a false-positive guard, tested directly — `"4.5 seconds"`/`"v2.1"` are left untouched). ✅
- Redacts a phone number. ✅
- Removes `user` and `Authorization`/`Cookie` headers entirely, while leaving unrelated headers untouched. ✅
- Scrubs nested arrays/objects (breadcrumbs), not just top-level strings. ✅
- Leaves genuinely non-PII fields (numbers, booleans, closed-enum strings) untouched — scrubbing must not corrupt legitimate diagnostic data. ✅

## Honest limitation: Address and Names are NOT reliably regex-detectable

No general-purpose regex can detect an arbitrary street address or personal name without an unacceptable false-positive/false-negative rate (a name looks like any other word; an address has no fixed shape). This is stated plainly rather than papered over with a scrubber that would either miss real addresses/names or mangle unrelated text. Protection for these two categories instead comes from the **architectural guarantee** established in the prior security audit: this app's own telemetry payload types (`SosEventName`, `JourneyEventData`, `AuthEventData`, `StartupEventData`) are closed enums/numbers only — there is no code path today that constructs a telemetry payload containing free-text address or name fields in the first place. The scrubber here is a second layer specifically for the one input source that guarantee doesn't cover (raw `Error` objects passed to `captureException`), not a replacement for it.

## Verification performed

Mobile: `npx tsc --noEmit` 0 errors, `pnpm run test` 95/95 passing (including the 8 new scrubber tests). Backend: `pnpm run typecheck` 0 errors, `pnpm run test` 29/29 passing (including its own 8 scrubber tests). Both `madge --circular` clean.
