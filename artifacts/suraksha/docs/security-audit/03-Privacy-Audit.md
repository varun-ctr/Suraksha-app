# 3. Privacy Audit

## Data inventory and where it lives

| Data category | Storage | Cross-user visibility |
|---|---|---|
| Profile (name, phone, language, avatar) | Supabase `profiles`, owner-only RLS | None |
| Emergency contacts | Supabase `emergency_contacts` (owner-only RLS) + SecureStore locally | None |
| SOS events (coords, address, resolution) | Supabase `sos_events` (owner-only RLS) + plaintext AsyncStorage locally (pending-activation queue) | None |
| Journey sessions | Supabase `journeys` (owner-only RLS) + plaintext AsyncStorage locally (active-journey state) | None |
| Community reports | Supabase `community_reports` — **readable by any authenticated user** (by design — a shared safety map), writable/editable only by the owner | **Intentional**: location + description + optional photo of an incident, visible to all signed-in users |
| Live location (share link) | Supabase `live_sessions`, looked up only via a `SECURITY DEFINER` function scoped to one `share_id` — never a table-wide read | Only whoever holds the specific share URL |
| Push notification tokens | Supabase `notification_tokens` (owner-only RLS) + AsyncStorage locally | None |
| Auth tokens / session | Encrypted (AES-256-CBC+HMAC) in AsyncStorage, keys in Keychain/Keystore | None (device-local only) |

## Location collection — reviewed in full

Location is collected in exactly three contexts, all justified and narrowly scoped:
1. **Foreground, on-demand**: every SOS trigger (`getCurrentLocation()`, `core/permissions/location.ts:21-36`), the map screen, and onboarding's location-permission step.
2. **Background, SOS-only**: `startBackgroundLocationTracking` runs only from `SafetyContext.tsx`'s SOS-activation path, delivers updates only while a live-session share ID is active, and is explicitly torn down when the SOS/live session ends (`core/permissions/backgroundLocation.ts` — full trace in `06-Network-Security.md`). It is never active for ordinary app usage.
3. **Reverse geocoding**: `location.ts:57` calls the public Nominatim API (web fallback only) with just a lat/lng pair — no other PII in that request.

No location data is sent anywhere except: (a) Supabase, under RLS, (b) the backend, under a verified token, for SMS alert composition, (c) trusted contacts, via the SMS/call the user's own emergency contacts receive (the entire point of the feature).

## Emergency contacts

Stored via `expo-secure-store` (native Keychain/Keystore encryption). Transmitted to the backend only as part of an SOS/journey alert dispatch, always scoped to the authenticated user's own contact list (never another user's). The `/sos/alert` response previously echoed each contact's `name`/`phone` back to the client and persisted that into a 5-minute idempotency cache table for no functional reason (the mobile client already holds this data locally and matches responses by `id` only) — **fixed in this pass**, see `02-Security-Architecture.md`.

## Notification tokens

Registered automatically right after a non-anonymous sign-in (`app/_layout.tsx:106-110`) — not gated by an explicit "enable notifications?" screen, but this matches the OS's own permission-prompt gate (the user still sees and can deny the native iOS/Android notification permission dialog; the app doesn't silently register without the OS-level grant). Stored owner-scoped in Supabase; deleted on sign-out/account-deletion (established in a prior auth-hardening pass).

## Community reports — the one genuinely cross-user data category

By design, any signed-in user can read any other user's community safety report (location, incident type, optional description/photo) — this is the entire point of a shared community safety map, not an oversight. What matters privacy-wise: the **reporter's identity is never exposed** to other readers — `community_reports` rows carry `user_id` but no UI surface in this codebase displays "reported by X" to other users (confirmed: the map/list screens render report content, not reporter identity). Moderation status exists (`pending`/`reviewed`/`removed`) but no moderator UI exists yet in the app (see `docs/backend-hardening/01-RLS-Hardening.md`).

## Analytics / telemetry — independently re-verified in this pass, not just re-asserted

Every one of the four telemetry modules (`core/analytics/sosTelemetry.ts`, `journeyTelemetry.ts`, `authTelemetry.ts`, `startupTelemetry.ts`) was read line-by-line and every payload's TypeScript interface was checked field-by-field:
- `sosTelemetry.ts`: `trackSosEvent(name)` — **no data parameter exists at all**. Every event is a bare closed-enum string.
- `journeyTelemetry.ts`: payload is `{durationSec?, recoveryOutcome?, attempts?}` — numbers and a 2-value enum only.
- `authTelemetry.ts`: payload is `{method?, errorCode?}` — both closed enums; the module's own comments explicitly document that the raw Firebase error message is deliberately never forwarded ("can echo back user input... in some Firebase error shapes").
- `startupTelemetry.ts`: payload is `{durationMs?, reason?}` where `reason` is a closed 4-value enum, never the underlying exception's message/stack.

**No coordinates, phone numbers, names, addresses, or tokens appear in any telemetry payload anywhere in the current codebase.** This was verified structurally (the TypeScript types don't have a field that *could* carry free-text PII), not just by reading a few call sites.

## Crash reporting — a real gap found

Both the mobile (`core/analytics/crashReporting.ts`) and backend (`api-server/src/lib/errorReporting.ts`) Sentry integrations forward **raw exception objects** to `Sentry.captureException`/`captureError` with **no `beforeSend`/`beforeBreadcrumb` scrubbing configured** (`grep` for those Sentry options returns zero matches in either repo). Today's telemetry breadcrumbs riding alongside those exceptions are clean (see above), but if any component ever throws an `Error` whose `.message` happens to embed a user's name/coordinates/address (not found in the current code, but not structurally prevented either), it would reach Sentry unfiltered. This is a real, documented gap — see `12-Production-Certification.md` for why it's tracked as a recommendation rather than fixed in this pass (scrubbing rules need careful design and a live Sentry environment to validate against, neither of which this pass can safely do blind).

## Logging — one real, currently-shipping finding, fixed in this pass

`api-server/src/routes/email-otp.ts` wrote the caller's **plaintext email address** to server logs on five call sites (rate-limit warnings, request/lookup/mint failures, attempt-cap invalidation) — pino's `redact` config only covers `Authorization`/`Cookie` headers, not these explicit body fields. **Fixed**: added `maskEmail()` (`api-server/src/lib/otp.ts`, unit-tested) and applied it to all five call sites, so logs now show e.g. `jo***@example.com` instead of the full address — enough to correlate repeated log lines/support tickets without writing the complete address to log storage. The client IP is still logged in full at one of those sites (`email-otp.ts:55`) — left as-is, since IP correlation is a standard, defensible anti-abuse control for rate-limit disputes (see `08-Abuse-Prevention.md`), not a gratuitous PII exposure.

Every other logging call site sampled across the mobile app (~20 representative sites) passes either a closed-vocabulary string, a structured non-PII object (`{status}`, `{count}`), or an `AppError` instance — never a raw `Contact`, `Coords`, or `User` object.

## Consent and user-facing disclosure

`app/privacy.tsx` renders a real, localized (English + Hindi) in-app privacy policy (`shared/utils/legal.ts`'s `PRIVACY_SECTIONS`), covering: what's stored only on-device, login/account data, location use, the Sakhi AI chat feature, community reports, nearby-places search, how alerts are dispatched, and — notably — a dedicated **"Deleting your data"** section. This is genuine, substantive privacy disclosure, not a placeholder.

## Data minimization, retention, and deletion

- Retention policy for `sos_events`/`journeys`/`community_reports` remains an open product decision (retain-indefinitely-as-a-safety-history-feature is legitimate but should be explicit) — already documented in `docs/backend-hardening/05-Retention.md`, unchanged by this pass; not re-litigated here.
- Account deletion is user-initiated, covers Firebase + Supabase + push tokens + live sessions + contacts + storage (built in a prior auth-hardening pass) and now sits on top of a schema that *could* cascade atomically via the `app_users` bridge table (backend-hardening pass) — the deletion flow itself wasn't rewired to that atomic path in this or the prior pass (explicitly out of scope; see `docs/backend-hardening/10-Production-Checklist.md`).
- Data minimization win from this pass: the `/sos/alert` response/cache no longer carries contact `name`/`phone` beyond what's functionally needed.

## Privacy Manifest / App Privacy Nutrition Labels

No `PrivacyInfo.xcprivacy` file or Expo privacy-manifest config plugin exists anywhere in the repo (confirmed by search). Apple requires an aggregated Privacy Manifest for apps that use "required reason" APIs or bundle third-party SDKs that themselves ship one (Firebase and Sentry's iOS SDKs both ship their own manifests as of their current versions) — the app-level aggregation step has not been done here. This is an **App Store submission-configuration gap**, not a code defect this pass can fix blind (it requires knowing the exact final set of third-party SDK manifests at build time) — tracked in `10-Compliance.md` and `12-Production-Certification.md`.
