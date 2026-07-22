# 4. Security Audit Report

Framework: OWASP MASVS (v2) and OWASP Mobile Top 10 (2024). Each item states the finding, the evidence (file/line), and the disposition (fixed this pass / accepted risk / not applicable).

## MASVS-STORAGE

| # | Requirement | Finding | Disposition |
|---|---|---|---|
| 1 | Sensitive data is not stored unencrypted | Firebase Auth's persisted session (refresh token, ID token, linked-provider metadata) was stored via `getReactNativePersistence(AsyncStorage)` — plaintext JSON in AsyncStorage's backing store. | **Fixed.** `repositories/firebase/encryptedAuthStorage.ts` now wraps AsyncStorage with AES-256-CBC + HMAC-SHA256 envelope encryption (`core/storage/cryptoBox.ts` / `aesCbcHmac.ts`); the AES/MAC keys live in the OS Keychain/Keystore via `expo-secure-store`. See risk assessment #1 for why full SecureStore-backed storage of the session blob itself wasn't chosen (2048-byte item limit). |
| 2 | Sensitive data in memory is cleared when no longer needed | React state holding `user`/`otpCode`/`pass` is garbage-collected normally on unmount; no manual buffer-zeroing is done (JS strings are immutable, this is normal for the platform). | Accepted — standard for a JS/RN app, no action taken. |
| 3 | No sensitive data written to application logs | Audited every `logger.*` call across the auth surface. All pass `AppError` instances (sanitized, user-facing messages) or non-sensitive metadata (HTTP status codes). No token, password, or OTP code is ever passed to `logger.*` or `console.*`. | **Verified clean.** |
| 4 | No sensitive data exposed via IPC / keyboard cache / app switcher | OTP and password `TextInput`s don't set `secureTextEntry` for the OTP code (correct — it's not secret in the same way a password is, and disabling it lets the user visually verify what they typed); password fields already use `secureTextEntry` (pre-existing, verified in `login.tsx`). | **Verified — no change needed.** |
| 5 | No secrets hardcoded (API keys, credentials) | Firebase config, Supabase URL/key, and the Google Sign-In web client ID are all read from `EXPO_PUBLIC_*` env vars (`app.config.ts`, `core/config/env.ts`) — these are Firebase/Supabase's public, client-side identifiers by design (not secrets; access is enforced server-side via Firebase security rules / Supabase RLS / the backend's service-role key, which never ships to the client). No `RESEND_API_KEY`, Firebase Admin credentials, or Supabase service-role key appear anywhere in `artifacts/suraksha` (only in `artifacts/api-server`, server-side). | **Verified clean.** |

## MASVS-AUTH

| # | Requirement | Finding | Disposition |
|---|---|---|---|
| 1 | Password policy is enforced | Client enforces 6+ characters (`useLoginScreen.handleSignUp`); Firebase enforces its own minimum (6 chars) server-side regardless of client bypass. | Acceptable for launch; consider raising to 8+ post-launch (P3, not a blocker — Firebase's server-side floor is still enforced either way). |
| 2 | Excessive authentication attempts are rate-limited | Firebase's own `auth/too-many-requests` throttling covers email/password. The backend's email-OTP endpoints have explicit per-email (5/hr) and per-IP (20/hr) rate limits, plus a 5-attempt cap on code verification that invalidates the code — all implemented server-side (`api-server/src/routes/email-otp.ts`, `lib/rateLimit.ts`), which is the only place rate limiting can be trustworthy. Client now also adds a 30s resend cooldown (`useLoginScreen.ts`) as a UX/defense-in-depth layer — it does not replace the server-side limit. | **Verified adequate; client-side cooldown added this pass.** |
| 3 | Biometric/step-up auth for sensitive operations is available where appropriate | Not implemented. Firebase's `auth/requires-recent-login` is already handled for account deletion (surfaces "please sign in again"), which is the standard re-auth gate Firebase provides. Device biometric gating of the *app itself* is a separate, larger feature. | **Deferred (P3)** — `AuthUser`/repository pattern make this a contained future addition. |
| 4 | Session tokens are invalidated on logout | `authService.signOut()` calls Firebase `signOut()`, which invalidates the client-side session; Firebase does not support server-side single-session revocation for the JS SDK (documented limitation, reflected accurately in `useSessionsScreen.ts`'s existing code comment). | **Accepted — SDK limitation, correctly represented in the UI, not a bug.** |
| 5 | Anonymous/guest access is scoped appropriately | The app deliberately keeps *some* Firebase user (anonymous or real) signed in at all times so SOS/location features work before the user creates an account — this is a documented, intentional design choice for a safety app, not an auth bypass: anonymous users get a distinct `uid` and no elevated Supabase RLS permissions beyond what an anonymous user should have. | **Verified intentional, not a vulnerability.** |

## MASVS-NETWORK

| # | Requirement | Finding | Disposition |
|---|---|---|---|
| 1 | TLS is used for all network communication | Firebase SDK and Supabase client both enforce HTTPS; `apiFetch`'s `getBackendUrl()` is expected to be an `https://` URL in production (Expo env config, not verified at runtime — see technical debt report). | Acceptable — enforcing this is an infra/config concern (EAS build env vars), not an app-code gap. |
| 2 | The ID token is only sent to the app's own backend, over an Authorization header | Confirmed in `core/network/apiClient.ts` — token attached as `Bearer` header, never as a query param (which would leak into server logs). | **Verified clean.** |

## MASVS-CODE / Mobile Top 10 (M1–M10, 2024 revision)

| Top 10 category | Finding |
|---|---|
| M1 Improper Credential Usage | No hardcoded credentials found (see MASVS-STORAGE #5). Google Sign-In and Apple Sign-In both use the platform-native SDKs correctly (no manual OAuth redirect handling that could be intercepted). |
| M2 Inadequate Supply Chain Security | New dependencies added this pass (`expo-crypto`, `crypto-js`, `@types/crypto-js`) were checked against Expo SDK 54's `bundledNativeModules.json` for version compatibility — the initial `pnpm add` pulled `expo-crypto@57.0.1` (built against Expo SDK 57, not 54), which was caught and re-pinned to the SDK-54-correct `~15.0.9` before this ships. `crypto-js` is a widely-used, mature pure-JS package with no native code (auditable, no native supply-chain surface). |
| M3 Insecure Authentication/Authorization | Covered under MASVS-AUTH above. |
| M4 Insufficient Input/Output Validation | Email format validated client-side (`useLoginScreen.ts`) and server-side (`isValidEmail` in `api-server/src/lib/otp.ts`); OTP code validated as exactly 6 digits both places. |
| M5 Insecure Communication | Covered under MASVS-NETWORK above. |
| M6 Inadequate Privacy Controls | Covered in the Privacy Audit (see the security-audit companion, "Section 10" folded into this report below). |
| M7 Insufficient Binary Protections | Out of scope for a JS-only pass — no code obfuscation/anti-tampering was added or assessed; standard for Expo/RN apps and not something this pass can address without native tooling changes. |
| M8 Security Misconfiguration | `assertConfig()` (added in the prior architecture-hardening pass) fails fast for missing required env vars in non-UI contexts; `app/_layout.tsx` deliberately keeps the graceful `ConfigErrorScreen` path for the actual app boot. Verified this is still correct and untouched by this pass. |
| M9 Insecure Data Storage | Covered under MASVS-STORAGE above — this is where the bulk of this pass's security work landed. |
| M10 Insufficient Cryptography | The new `aesCbcHmac.ts` module deliberately does NOT roll ad hoc crypto: it uses `crypto-js`'s AES-CBC + HMAC-SHA256 (encrypt-then-MAC, verified before decrypt to avoid padding-oracle exposure), with all randomness (keys, IVs) sourced from `expo-crypto.getRandomBytesAsync` (a real CSPRNG backed by the OS), never `Math.random()` or crypto-js's own non-RN-safe `WordArray.random()`. See the test report for what's verified. |

## Privacy audit (brief's Section 10)

- **Minimum data collection**: sign-in collects only email (+ password, held client-side only long enough to submit) or OAuth identity claims (name/email from Google/Apple, standard scopes only — `FULL_NAME`, `EMAIL` for Apple). No unnecessary PII requested.
- **Delete Account flow**: exists, orchestrated by `deleteAccountAndResetLocalData` — deletes the Firebase user, wipes local device state, and best-effort cleans up Supabase rows across every user-data table (see risk assessment #2 for the one gap: no retry if that best-effort call fails).
- **Consent / Privacy Policy**: `app/privacy.tsx` and `app/terms.tsx` exist and are linked from onboarding (pre-existing, not part of this pass's diff — verified present, not verified for legal completeness, which is outside an engineering audit's scope).
- **Location / Notification / Camera / Microphone permissions**: each is requested contextually (location on first SOS/journey use, notifications via explicit toggle, camera via image picker for avatar upload) rather than all upfront — matches Apple's App Store guidance to request permissions only when the corresponding feature is used.
