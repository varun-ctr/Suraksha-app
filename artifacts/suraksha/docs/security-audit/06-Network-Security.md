# 6. Network Security

## HTTPS enforcement

Every network destination in the codebase is HTTPS — confirmed by reading `core/network/apiClient.ts`, `repositories/supabase/supabaseClient.ts`, and every hardcoded URL found via a whole-repo grep for `http://` (zero matches) and `https://` (all legitimate: Nominatim, Twilio, Google Places, Google Maps deep-links). No `NSAllowsArbitraryLoads`/`usesCleartextTraffic`/cleartext configuration exists anywhere in `app.config.ts` or the wider tree.

**Note for future audits**: this repo has both a static `app.json` and a dynamic `app.config.ts` — Expo resolves `app.config.ts` as authoritative when both exist, and it's the one with all the real permission/plugin configuration. `app.json` is effectively stale/vestigial; reading it alone would miss the actual shipped configuration.

## Certificate validation / TLS

No custom TLS configuration exists — the app relies entirely on the OS's default trust store validation via the platform's native networking stack (through Firebase SDK, Supabase JS client, and plain `fetch`). No custom trust managers, no disabled certificate validation, no accept-all-certs code anywhere.

## Timeouts

| Client | Timeout | Mechanism |
|---|---|---|
| `apiClient.ts` (app's own backend) | 10s default (`DEFAULT_TIMEOUT_MS`), per-call override (e.g. 8s for journey alerts) | `AbortSignal.timeout(timeoutMs)` |
| Supabase — `sos_events`/`journeys`/`live_sessions` | 10s | `timeoutSignal()` (backend-hardening pass) |
| Supabase — `profiles`/`community_reports`/`subscriptions`/`notification_tokens` | **None** | Documented, lower-priority carry-over gap (`supabaseClient.ts:78-82`) |

## Retries

No unbounded retry loops anywhere. SOS/journey alert dispatch gets exactly one bounded retry (`BACKEND_RETRY_DELAY_MS = 2000`), and only for retryable failures (network error, timeout, or 5xx — never 4xx, since a 4xx won't be fixed by retrying) — `features/sos/services/sosAlertService.ts:66-83,116-122`. Every other call site (Sakhi chat, nearby places, OTP, account deletion, sessions) has no retry, which is appropriate for non-emergency-critical, user-initiated actions (a failed request simply surfaces an error rather than silently hammering the backend).

## Certificate pinning

**Not implemented.** Confirmed via whole-repo grep for `pinning`, `sslPinning`, `TrustKit`, `publicKeyHash`, `certificate` — zero matches. This is the expected, standard limitation of a pure Expo **managed workflow** app: no `ios/`/`android/` native project directories exist, and native cert pinning generally requires either ejecting from managed workflow or a dedicated config plugin with native code, neither of which is present. This is tracked as a MASVS-RESILIENCE item (see `01-OWASP-MASVS.md`), not treated as an oversight in a specific commit.

## MITM resistance

Given no pinning, MITM resistance rests entirely on: (a) HTTPS-only endpoints (confirmed above), (b) the OS's own trust-store validation, (c) Firebase ID tokens being short-lived and bound to the legitimate Firebase project. A MITM with a trusted (or maliciously-installed) root CA on the device could intercept traffic — this is the direct, expected consequence of having no pinning, not a separate/new finding.

## API authentication — every backend route reviewed

| Route | Auth | Rate limiting |
|---|---|---|
| `GET /healthz`, `/health`, `/api`, `/ready` | None (public health checks) | None — appropriate |
| `POST /sakhi/chat` | Optional/advisory (proceeds unauthenticated if no valid token) | Yes — in-memory, 30/hour, keyed `uid` or IP fallback |
| `GET /nearby-places` | **Required** (Firebase token) | **None** — only a 5-min response cache |
| `POST /revenuecat-webhook` | Shared-secret bearer, `timingSafeEqual` compare | N/A (third-party webhook, not user-triggered) |
| `GET /auth/sessions` | **Required** | None |
| `DELETE /auth/account` | **Required** | None |
| `GET /sos/config` | None (public — reports only whether Twilio is configured, no PII) | None — appropriate |
| `POST /sos/alert` | **Required** | **Yes** — Supabase-backed, shared across instances, 20/hour/uid |
| `POST /community-reports` | **Required** | None |
| `GET /community-reports/mine` | **Required** | None |
| `POST /auth/email-otp/request` | None (this *is* the login step) | **Yes** — 5/hour per email + 20/hour per IP |
| `POST /auth/email-otp/verify` | None (verifies a one-time code) | Bounded by `MAX_ATTEMPTS`, not a time-window rate limit |

Global middleware (`api-server/src/app.ts`): CORS allowlist for browser origins, security headers (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, HSTS in production), 100kb body-size cap.

**Assessment**: every route touching user PII or writing data requires a verified Firebase token. The routes without a numeric rate limit (`/nearby-places`, `/auth/sessions`, `/auth/account`, both `/community-reports` routes) rely on Firebase auth alone — a signed-in-but-malicious account could call these without a hard cap, though `/nearby-places` at least caches responses (protecting the paid Google API budget) and the others are naturally low-value targets for abuse (session introspection, account deletion, incident reporting — see `08-Abuse-Prevention.md` for the full assessment and recommendation).

## Request signing / replay protection

No request signing (HMAC-over-body, signed timestamps) exists anywhere — confirmed via grep for `nonce`, `signature`, `hmac`, `x-timestamp`, `replay` across `api-server/src` (zero matches beyond the SOS idempotency-key mechanism, which is dedup, not anti-replay). A captured, still-valid bearer token plus a captured request body is technically replayable against most routes — the only structural defense against a *duplicate* SOS/journey/live-session write is the idempotency-key/UUID mechanisms built in the backend-hardening pass, which prevent duplicate *records* but don't prevent a replayed request from being *processed* again if it wasn't naturally idempotent (e.g., a replayed `/community-reports` POST would create a second, distinct report — there's no dedup on that route). This is a genuine architectural gap worth closing with a lightweight nonce/timestamp scheme on write routes, tracked as a recommendation in `12-Production-Certification.md`.

## Permissions — reviewed for justification, timing, and denial handling

| Permission | iOS usage string (verbatim) | Requested at | Denial handling |
|---|---|---|---|
| Location (foreground) | *"Suraksha uses your location to share it with your trusted contacts during an SOS alert, show nearby police stations, hospitals, and shelters on the map, and include it in your incident reports."* | Onboarding, map screen mount, every SOS trigger | Graceful — returns `null`, features degrade without crashing |
| Location (background/"Always") | *"Suraksha uses your location in the background only while an SOS is active, so your live location keeps reaching your trusted contacts if you switch apps or your screen locks during an emergency."* | Only at first SOS activation (`startBackgroundLocationTracking`) — never at launch/onboarding | Graceful — returns `false`, falls back to foreground-only tracking; SOS never fails outright over a missing "Always" grant |
| Camera | *"Suraksha uses your camera to take a photo for your trusted-contact avatar or to attach to an incident report."* | On-demand (contact avatar, incident report) | **Inconsistent**: contacts screen silently swallows denial (`useContactsScreen.ts:146-147`, bare `catch { }`); incident screen shows an explicit toast (`useIncidentScreen.ts:93-97`) |
| Photo library | *"Suraksha lets you choose a photo from your library for your trusted-contact avatar, your profile picture, or an incident report."* | On-demand | Same inconsistency as camera |
| Microphone | **Explicitly disabled** (`microphonePermission: false`) | N/A — never requested | N/A |
| Contacts | *"Suraksha uses your contacts so you can quickly pick trusted contacts to receive your SOS alerts."* | Native contact-picker on the contacts screen | Graceful, wrapped in try/catch with toast |
| Notifications | (OS dialog, no usage string needed) | Automatically right after non-anonymous sign-in (`app/_layout.tsx:106-110`) | Graceful — typed result distinguishes `denied` from other errors |
| Face ID / biometrics | *"Suraksha can use Face ID to quickly and securely unlock the app."* declared, but **never invoked anywhere** | N/A — dead code path | N/A |

Overall pattern: consistently fail-open/no-crash on denial, with one real inconsistency (camera/photo-library silent-fail vs. incident-report's explicit toast) worth a small UX fix.

## Background location — full trace

`core/permissions/backgroundLocation.ts`'s `TaskManager` task is registered unconditionally at module load (so it survives a background app relaunch), but the task body checks a persisted `ACTIVE_SHARE_ID_KEY` and no-ops if no SOS/live-session is active — meaning although the task is always *registered*, it only actually **starts delivering location updates** during an active SOS, and is explicitly stopped when the SOS/live session ends. Update cadence during an active SOS: every 10 seconds or 10 meters, high accuracy, with a persistent, user-visible foreground-service notification on Android ("Suraksha SOS is active — Sharing your live location with your trusted contacts") — a user-visible indicator that background tracking is live, which is exactly the kind of transparency Apple's App Store review looks for when scrutinizing "Always" location usage. The permission *request* itself is correctly deferred until first SOS activation, never requested at launch/onboarding — supporting a strong least-privilege story for App Store review.
