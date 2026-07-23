# 11. Final Authentication Hardening Pass — Production Readiness Report

Follow-up to the initial audit (see `README.md` and the other documents in this directory). This pass reviewed and hardened 9 additional areas without changing any existing UI or authentication flow — no screen, route, or button behaves differently than before; the changes are either invisible security hardening (nonce, encryption already covered previously) or new, unwired capability (biometrics, reauthentication) or defensive fixes to edge cases (crash recovery) that only change behavior in scenarios that were previously broken.

## 1. Apple Sign In readiness — hardened

**Finding**: `signInWithApple()` called `provider.credential({ idToken })` with no nonce. Firebase's own documentation and Apple's guidance both specify that the ID token should carry a hashed nonce, verified server-side against a raw nonce supplied at credential-construction time — without it, a captured/leaked `identityToken` (e.g. via a compromised network proxy, a malicious library with log access, or MITM on a misconfigured connection) could in principle be replayed to sign in as the victim, since nothing tied that specific token to *this* sign-in attempt.

**Fix**: `repositories/firebase/firebaseAuth.ts`'s `signInWithApple()` now generates a random raw nonce (`Crypto.randomUUID()`), SHA-256 hashes it (`Crypto.digestStringAsync`), passes the hash to `AppleAuthentication.signInAsync({ nonce })`, and passes the raw nonce to `provider.credential({ idToken, rawNonce })`. Firebase's backend verifies the hash match before accepting the credential. Entirely invisible to the user — same button, same native Apple sheet, same three outcomes (success / cancelled / needs-link).

**Verification**: `tsc --noEmit` clean (confirms the `nonce`/`rawNonce` parameter names and types match `expo-apple-authentication`'s and `firebase/auth`'s actual signatures — not just assumed from documentation).

## 2. Account deletion — completed

**Finding**: the account-deletion orchestration (`deleteAccountAndResetLocalData`) already deleted the Firebase user, cleaned up 7 Supabase tables server-side (including `notification_tokens` and `live_sessions`), and wiped local storage — but did not stop an *in-memory* active SOS/live-tracking session (`SafetyContext`) before doing so, leaving the client to keep calling `updateLiveSession` against a row the backend had just deleted (harmless — Supabase no-ops an update on a missing row — but not a clean teardown).

**Fix**: `useProfileScreen.handleDeleteAccount` now calls `cancelSOS()`/`endJourney()` (from `useSafety()`) before the deletion sequence, but *only* as part of this explicit, user-initiated deletion — not tied to auth-state changes in general. This distinction matters: SafetyContext's tracking must never stop on its own because of an unrelated sign-out or session hiccup, which would be actively dangerous for a safety app mid-emergency. Deleting your account is a deliberate action where stopping tracking is clearly correct.

**Verified already-correct** (no change needed): Firebase deletion is authoritative and irreversible; backend cleanup necessarily happens *before* it (needs a valid ID token to authenticate the DELETE request — reordering isn't possible); `deleteAccount()`'s `auth/requires-recent-login` handling.

## 3. Token refresh lifecycle + forced reauthentication — hardened

**Finding**: Firebase's SDK already handles ID token refresh transparently (`user.getIdToken()` refreshes when <5 min from expiry) and already forces a local sign-out (firing `onAuthStateChanged(null)`) when a refresh fails with a terminal error (revoked/disabled/deleted user) — this was already correct and is unchanged. What was missing: a reusable, tested way to detect "this operation needs a fresh login" (previously checked one error code inline in one place), and any path to actually *re-authenticate* without a full sign-out/sign-in cycle.

**Fix**:
- `isReauthRequired(e)` extracted to `repositories/firebase/reauthCheck.ts` (pure, unit-tested), checking both `auth/requires-recent-login` and `auth/user-token-expired`. `authService.deleteAccount()` now uses it.
- `AuthRepository.reauthenticateWithPassword(password)` added (interface + Firebase implementation via `reauthenticateWithCredential`) — **not called from any screen**. It exists so a future "please confirm your password" prompt (triggered by `isReauthRequired`) is a UI addition away, not a new native-integration project.

## 4. Device registration and session metadata — reviewed, documented (not changed)

Firebase's client SDK has no concept of "list all my active sessions/devices" (unlike, e.g., Supabase GoTrue) — the backend's `/auth/sessions` endpoint already represents this honestly by synthesizing a single "current device" entry from the verified ID token, rather than pretending to show data that doesn't exist. Enriching this with real device metadata (model, OS version, app version, last-seen) would require a backend schema change and a client-side device-registration write path — out of scope for a client-only hardening pass that must not regress existing flows. Recommended as backend-team follow-up work, not implemented here.

## 5. Biometric unlock architecture — added (Face ID / Touch ID ready)

**Added**: `core/permissions/biometrics.ts` — `isBiometricUnlockAvailable()`, `getBiometricType()`, `authenticateWithBiometrics(promptMessage)`, all wrapping `expo-local-authentication` (pinned to `~17.0.8`, the version Expo SDK 54 actually bundles — checked against `bundledNativeModules.json` before installing, learning from an earlier mistake this session where `expo-crypto` initially resolved to a version built for a different SDK). `app.config.ts` now declares the `expo-local-authentication` config plugin with a real `NSFaceIDUsageDescription`, so the capability won't crash on iOS when it's eventually invoked — even though nothing calls it yet.

**Deliberately not done**: no settings toggle, no login-screen gate, no call site anywhere. Gating app access behind biometrics is a product decision (what triggers it — app launch? every SOS action? a settings opt-in?) that this hardening pass shouldn't make unilaterally by wiring it in silently.

## 6. Crash recovery during interrupted authentication — real bug found and fixed

This was the most significant finding of this pass. Tracing every point where the app could be killed mid-auth-operation:

- **Interrupted login/signup**: inherently safe — Firebase's sign-in calls are single atomic network requests; a kill before they resolve leaves no partial state (React state is in-memory and gone regardless), and a kill after they resolve means the session persisted normally (already covered by the encrypted-storage work in the initial audit).
- **Interrupted OTP verification**: already safe — the backend's one-time-use code deletion only happens on a *successful* verify, so a killed request just leaves the code intact for a retry.
- **Interrupted sign-out or account deletion — a real gap, now fixed.** `AppContext`'s local-storage-clearing logic only fired reactively, in-session, when it observed a real user transitioning to no-user *while mounted*. If the app was killed after Firebase's side of a sign-out or account deletion had already completed, but before that in-memory effect ran, the device's cached contacts/profile data from the old identity would survive to the next launch untouched — and could then be synced/merged into whatever *new* session (a fresh anonymous user, or a different account signing in on a shared device) came next, misattributing one identity's local data to another's account.

**Fix**: the locally-cached data now carries a persisted `ownerUid` marker (written alongside it on every save). On load, this marker is recovered *before* any sync decision is made; a fresh helper, `shouldClearLocalCache(persistedOwnerUid, currentUid)` (extracted as a pure, unit-tested function in `features/profile/context/localCacheOwnership.ts`), decides whether the cached data belongs to a different identity than the one now signed in — covering both the ordinary in-session case (unchanged behavior) *and* the across-a-kill case (the actual gap). Verified this does **not** disturb the existing, intentional anonymous-to-real-account upgrade path (Firebase's account-linking preserves the same uid, so that transition was never touched by either the old or new logic).

## 7. Authentication analytics and telemetry — added (privacy-safe)

**Added**: `core/analytics/authTelemetry.ts` — `trackAuthEvent(name, data)`, recorded as Sentry breadcrumbs (this app has no separate analytics/BI pipeline, and building one is out of scope). No-ops without a Sentry DSN, exactly like the existing `crashReporting.ts`. Wired into: email/social sign-in attempt/success/failure/cancelled/needs-link, sign-up, sign-out, OTP request/verify success/failure, and account-deletion attempt/success/failure. `data.errorCode` is always a closed, low-cardinality `AppError.code` (e.g. `"AUTH"`, `"OTP_EXPIRED"`) — **never** the raw user-facing message, which can echo back user input (an email address, an entered code) in some Firebase error shapes. No email, password, OTP code, uid, or token is ever recorded.

## 8. Offline recovery after interrupted login/logout — reviewed, already correct

Every network call in the auth surface (`apiFetch`, all of `firebaseAuth.ts`) already fails as a typed error rather than hanging or crashing when offline (`NetworkError`, Firebase's own `auth/network-request-failed` mapped to a friendly retry message). The crash-recovery fix in item 6 above also strengthens offline recovery specifically: previously, a sign-out interrupted by *going offline mid-request* (not just a process kill) had the same stale-local-data risk, now closed by the same mechanism.

## 9. OWASP MASVS L2 review

L2 adds "defense in depth" controls on top of the L1 baseline already covered in the initial audit's security report. Reviewed against this pass's changes specifically:

| MASVS-AUTH (L2) | Status |
|---|---|
| Step-up/re-authentication is available for sensitive transactions | **Improved**: `reauthenticateWithPassword` now exists at the repository layer (ready for a future UI prompt); `auth/requires-recent-login` detection is centralized and tested. |
| Biometric authentication, where offered, uses the platform's secure hardware-backed API | **Ready, not offered yet**: `expo-local-authentication` delegates entirely to the OS (Face ID/Touch ID/Keystore-backed biometric prompt) — no custom biometric handling was written, by design. |
| Replay protection on federated sign-in credentials | **Fixed this pass**: Apple Sign In nonce (item 1). Google Sign-In's flow (via `@react-native-google-signin/google-signin`) already goes through Google's own SDK-managed token exchange, which has its own replay protections at the Google Play Services / native layer — not something this pass needed to add. |
| Sensitive data does not persist beyond the intended session lifetime | **Fixed this pass**: the crash-recovery gap (item 6) was exactly a case of data outliving its intended owner's session across a killed process. |
