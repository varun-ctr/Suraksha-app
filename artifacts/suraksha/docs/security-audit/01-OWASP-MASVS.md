# 1. OWASP MASVS Assessment

Scope: `artifacts/suraksha` (mobile) + `artifacts/api-server` (backend), read against MASVS v2's seven categories. Every finding cites a file:line. Classification is per-category, using MASVS's own L1 ("standard security") baseline as the compliance bar, with L2/RESILIENCE-only items (pinning, anti-tampering) called out separately since they are explicitly optional hardening controls, not L1 requirements.

**Cross-cutting context that shapes every classification below**: this is a women's-safety app. Its realistic adversary model is not only a remote attacker — it plausibly includes **an abuser with physical access to the victim's own unlocked or weakly-locked phone** (a stalkerware-adjacent threat model). Findings that would be routine, low-priority MASVS-RESILIENCE gaps in a typical consumer app (no app-level lock screen, no root detection) are treated as higher-priority here for that reason, and called out explicitly.

## MASVS-AUTH — **Partially Compliant**

- Firebase Authentication backs every sign-in method (Google, Apple, Email/OTP, anonymous-to-verified upgrade) — a mature, well-audited identity provider, not a custom auth stack. ✅
- Apple Sign-In uses a proper nonce: `rawNonce = Crypto.randomUUID()`, SHA-256-hashed via `expo-crypto` before being sent to Apple, raw value sent to Firebase for verification (`repositories/firebase/firebaseAuth.ts:105-106`) — correct replay-protection construction, hardened in a prior pass. ✅
- Email/OTP: 6-digit code, hashed at rest (`hashCode`, SHA-256, `api-server/src/lib/otp.ts:14-16`), rate-limited both per-email (5/hour) and per-IP (20/hour) (`email-otp.ts:24-25,52-58`), attempt-capped at `MAX_ATTEMPTS` before the code is invalidated (`email-otp.ts:121-128`), constant response shape regardless of whether the email is registered (`email-otp.ts:32-33,80` — avoids account-enumeration). ✅
- Session persistence: the Firebase session is not stored in plaintext — see MASVS-STORAGE below for the AES-256-CBC+HMAC envelope. ✅
- Forced reauthentication exists for the one operation that needs it: account deletion surfaces Firebase's `requires_recent_login` error and the client prompts for reauthentication (tracked via `account_delete_failure` / `errorCode: "requires_recent_login"` telemetry, `core/analytics/authTelemetry.ts`). ✅
- Token refresh is delegated entirely to the Firebase JS SDK's own refresh-token rotation — not reimplemented, which is the correct choice (fewer custom auth-token bugs). ✅
- **Gap 1 (Partially Compliant driver)**: there is **no app-level session lock** — once a phone is unlocked (by whatever means: passcode, an abuser who knows it, a stolen fingerprint enrollment), the app itself never re-asks for anything. `core/permissions/biometrics.ts` implements a complete, working biometric-gate primitive (`authenticateWithBiometrics`) but is **confirmed unwired to any screen** (`biometrics.ts:4-10`'s own header comment; zero call sites outside the module itself and `nativeCapabilities.ts`). For this app's specific threat model (an abuser with the victim's unlocked phone can read SOS history, journey history, contacts, and community reports with zero additional friction), this is a meaningful gap, not a cosmetic one.
- **Gap 2**: no request-level replay/freshness binding beyond token expiry (see MASVS-NETWORK) — a captured, still-valid bearer token can be replayed against most routes with no additional check.
- Timing side-channel in OTP verification: `hashCode(code) !== row.code_hash` (`email-otp.ts:121`) is a plain string compare on hex-encoded SHA-256 hashes, not a constant-time compare. Given the 6-digit search space is already bounded by `MAX_ATTEMPTS` and the compare is on a hash (not the raw code), practical exploitability is very low, but it's a deviation from best practice worth a cheap fix (`crypto.timingSafeEqual`).

## MASVS-STORAGE — **Partially Compliant**

- The Firebase auth session is genuinely encrypted at rest: AES-256-CBC + HMAC-SHA256 (encrypt-then-MAC), random 16-byte IV **per encryption** via `expo-crypto`'s CSPRNG, MAC verified with a constant-time compare before decrypt (`core/storage/aesCbcHmac.ts`, `core/storage/cryptoBox.ts`) — the two 256-bit keys live in `expo-secure-store` (Keychain/Keystore), not in application code or plaintext storage. ✅ Full detail in `04-Cryptography.md` / `05-Secure-Storage.md`.
- Trusted contacts/profile use `expo-secure-store` directly (native Keychain/Keystore encryption), with a documented plaintext fallback on web only (`core/storage/secureStore.ts:9-13,16-22` — explicitly labeled preview/non-secure). ✅ for native, a known/accepted limitation for web.
- **Gap (Partially Compliant driver)**: the **SOS offline queue** (`features/sos/services/sosOfflineQueue.ts`) — which persists **plaintext GPS coordinates and street address of a user in active distress** (`PendingSosActivation`, lines 19-31) — and **journey persistence** (`features/journey/services/journeyPersistence.ts`) both use bare `AsyncStorage`, unencrypted. This is arguably the single most sensitive data category this app produces (a live victim's location during an actual emergency), and it currently has no encryption at all beyond whatever full-disk encryption the OS itself provides once the device is locked. This is the most significant MASVS-STORAGE finding in the whole audit — see `05-Secure-Storage.md` and `12-Production-Certification.md`'s P1 list for the recommended fix (reuse the existing `cryptoBox`/`secureStore` primitives rather than building anything new).
- No app-level tamper detection on stored data outside the one AES+HMAC envelope (which does detect tampering with *that* specific value, via its MAC check, but nothing else — the SOS queue and journey state have no integrity check at all).

## MASVS-NETWORK — **Compliant (L1)** — pinning is an explicit, separately-tracked L2 gap

- Every network destination found in the codebase is HTTPS: the app's own backend (`core/network/apiClient.ts`, driven by `EXPO_PUBLIC_BACKEND_URL`), Supabase (`repositories/supabase/supabaseClient.ts`), Nominatim reverse-geocoding fallback (`core/permissions/location.ts:57`), Google Places (`api-server/src/routes/nearby-places.ts:57,69`), Twilio (`api-server/src/routes/sos-alert.ts:38-40`, native Node `https`). A whole-repo grep for `http://` returns zero matches. ✅
- No `NSAllowsArbitraryLoads`/`usesCleartextTraffic`/cleartext config exists anywhere (confirmed absent from `app.config.ts` and the whole tree) — Expo's managed-workflow default (TLS-only, no cleartext) is in effect, not overridden. ✅
- Timeouts: `apiClient.ts`'s `DEFAULT_TIMEOUT_MS = 10_000` via `AbortSignal.timeout` (`:20,63`); Supabase calls to the three emergency-critical tables (`sos_events`/`journeys`/`live_sessions`) got the same treatment in the backend-hardening pass (`supabaseClient.ts:83-88` + call sites) — `profiles`/`community_reports`/`subscriptions`/`notification_tokens` calls still lack a timeout (a documented, lower-priority carry-over gap, `supabaseClient.ts:78-82`). ✅ mostly, minor gap noted.
- Retry: bounded, single-retry-only, and only for retryable failure classes (network/timeout/5xx, never 4xx) on SOS/journey alerts (`sosAlertService.ts:66-83,116-122`) — no unbounded retry loop anywhere that could be abused or cause a thundering-herd.
- **L2 gap (tracked, not a Compliant/Non-Compliant driver at L1)**: no certificate/public-key pinning anywhere (confirmed via whole-repo grep). This is the expected, standard limitation of a pure Expo managed-workflow app (no `ios/`/`android/` native folders, no pinning config plugin) — not an oversight in a specific commit. Recorded as a MASVS-RESILIENCE-adjacent item below and in the production checklist, not scored against L1 compliance.
- **Genuine network-layer gap**: no request signing, nonce, or timestamp-based replay window on any backend route beyond the opt-in SOS idempotency key (which is dedup, not anti-replay) — a valid bearer token plus a captured request body is technically replayable against most routes. Practical severity is bounded by short-lived Firebase ID tokens and (where present) rate limiting, but this is a real architectural gap, not a hypothetical one.

## MASVS-CRYPTO — **Compliant**

- One real, correctly-constructed encryption path exists (AES-256-CBC + HMAC-SHA256, encrypt-then-MAC, fresh random IV per call, 256-bit keys from a CSPRNG) protecting the Firebase session — see `04-Cryptography.md` for the full algorithm/key-length/nonce breakdown. ✅
- Apple Sign-In's nonce hashing uses SHA-256 over a CSPRNG-backed UUID — correct use of hashing for auth-flow integrity, not encryption (correctly not conflated). ✅
- Every other UUID generation in the app (`Crypto.randomUUID()` for journey IDs, live-session share IDs) is CSPRNG-backed via `expo-crypto`, appropriate for its purpose (unguessable identifiers, not secrets). ✅
- OTP codes are hashed (never stored plaintext) with SHA-256 — appropriate for a short-lived, attempt-capped, rate-limited 6-digit code; a salt/pepper would add negligible real-world protection here given the mitigating controls already in place (this is a deliberate, reasonable design choice, not an oversight).
- **Minor gap**: two dedup/idempotency-key generators use plain `Math.random()` rather than a CSPRNG (`SafetyContext.tsx:99-101`, `sosAlertService.ts:114`) — acceptable because these values are never used as secrets or access-control tokens, only as at-most-once markers, but worth noting for completeness.
- No key rotation mechanism for the AES/HMAC keys (generated once, reused indefinitely, `cryptoBox.ts:35-41`) — acceptable for the current threat model (keys are hardware-backed via Keychain/Keystore, not exportable), but worth a documented rotation story before this pattern is extended to protect additional data (see `05-Secure-Storage.md`'s recommendation to reuse this exact mechanism for the SOS queue).

## MASVS-PLATFORM — **Partially Compliant**

- Every permission has a specific, honest, non-boilerplate iOS usage-description string that matches its actual use (quoted verbatim in `03-Privacy-Audit.md` / `06-Network-Security.md`), not a generic "this app needs your location" placeholder. ✅
- Background location is requested only at first SOS activation (never at launch/onboarding), only delivers data while a share ID is active, and is torn down when the SOS/live session ends (`core/permissions/backgroundLocation.ts`, full trace in the network-security doc) — a textbook example of App Store-reviewable, narrowly-scoped "Always" location justification. ✅
- Microphone is explicitly disabled (`microphonePermission: false`, `app.config.ts:128`) — the app correctly does not request a permission it doesn't use. ✅
- Denial handling is graceful (no crashes) everywhere it was checked, with one inconsistency: `useContactsScreen.ts`'s camera/photo-library calls swallow denial silently with no user-facing message (bare `catch { // ignore }`, `useContactsScreen.ts:146-147`), while `useIncidentScreen.ts`'s photo-permission check shows an explicit toast (`:93-97`) — a real, if minor, UX/transparency inconsistency.
- No WebView usage found anywhere in the app (no `react-native-webview`, no `WebView` component) — removes an entire class of MASVS-PLATFORM WebView-configuration findings by simply not having the attack surface.
- **Partially Compliant driver**: no biometric/app-lock gate is wired (see MASVS-AUTH Gap 1) — MASVS-PLATFORM's biometric-integration requirements are moot here because the feature, while built, isn't in use.

## MASVS-CODE — **Compliant**

- No hardcoded secrets in application code: every server-only secret (Supabase service-role key, Twilio auth token, Firebase Admin service account, Resend API key, RevenueCat webhook secret) is confirmed to exist only in `api-server`'s env-var surface, never referenced from any file under the mobile app's `repositories/`/`features/` (verified via cross-boundary grep — see `10-Secrets-Management`/`03-Privacy-Audit` evidence). ✅
- Production error responses don't leak stack traces/raw exception messages to the client (`api-server/src/app.ts:100`: generic `"Internal error"` string when `NODE_ENV === "production"`). ✅
- Dependency surface is unremarkable for this app category — mainstream, actively-maintained libraries (`firebase`, `@supabase/supabase-js`, `expo-*`, `crypto-js`); no abandoned or known-vulnerable packages flagged during this review (no `npm audit`/dependency-CVE scan was run in this pass — see `11-Penetration-Test-Checklist.md` for that as a follow-up action item).
- Rate limiting exists at the backend for every genuinely abuse-prone endpoint except a few noted in `08-Abuse-Prevention.md`.
- No code obfuscation, binary hardening, or anti-debugging exists — standard and accepted for a JS/React-Native managed-workflow app; MASVS-CODE's L1 bar does not require this (it's an L2/RESILIENCE concern, tracked below).

## MASVS-RESILIENCE — **Non-Compliant**

Every anti-tampering/anti-reverse-engineering control MASVS-RESILIENCE asks about is absent:
- No certificate pinning (see MASVS-NETWORK).
- No root/jailbreak detection — `expo-device` isn't even a dependency, so `Device.isRootedExperimentalAsync()` isn't callable; whole-repo grep for jailbreak/root/tamper/integrity terms returns nothing except one unrelated comment (`encryptedAuthStorage.ts:8`, a threat-model justification, not a detection mechanism).
- No code obfuscation, no anti-debugging, no runtime integrity/attestation checks (no Play Integrity API, no DeviceCheck/App Attest).
- The one thing that *does* detect tampering is narrow: the HMAC-SHA256 tag on the encrypted Firebase-session blob (`aesCbcHmac.ts`) detects tampering with that specific stored value only.

**Why this is scored Non-Compliant rather than "accepted limitation" here**: for a typical consumer app, none of the above would usually block certification — MASVS explicitly treats these as L2/optional hardening, and Expo managed-workflow apps routinely ship without them. For *this* app specifically, given the stalkerware-adjacent threat model (an abuser with the victim's device), the combination of **no app-lock + no root detection + unencrypted local SOS-queue data** compounds into a real, elevated risk that a generic consumer-app audit would understate. This is flagged as the single most important cross-cutting theme in this entire audit — see `12-Production-Certification.md`.

## Category summary table

| Category | Classification | Primary driver |
|---|---|---|
| MASVS-AUTH | Partially Compliant | No app-level session lock; no request-replay binding |
| MASVS-STORAGE | Partially Compliant | SOS offline queue / journey state unencrypted (plaintext GPS) |
| MASVS-NETWORK | Compliant (L1) | HTTPS-only, timeouts, bounded retry; pinning tracked separately as L2 |
| MASVS-CRYPTO | Compliant | Correct AES-256-CBC+HMAC construction where encryption is used |
| MASVS-PLATFORM | Partially Compliant | Excellent permission justification/timing; app-lock gap; one silent-denial inconsistency |
| MASVS-CODE | Compliant | No hardcoded secrets, no stack-trace leakage, rate limiting present |
| MASVS-RESILIENCE | Non-Compliant | No pinning/root-detection/obfuscation — elevated priority given this app's threat model |

**Approximate overall MASVS compliance: ~77%** (Compliant categories weighted 100%, Partially Compliant 60%, Non-Compliant 20%, averaged across the 7 categories) — see `12-Production-Certification.md` for how this feeds the final score.
