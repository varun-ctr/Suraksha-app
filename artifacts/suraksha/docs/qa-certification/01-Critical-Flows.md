# 1. Critical User Journey Validation

## Method

Every flow below was traced to its actual code (file:line) rather than assumed. No live device/simulator session was available in this environment — each flow's "Required manual verification" line states specifically what cannot be confirmed from source alone.

## 1. User registration (email/password)

**Expected**: `useLoginScreen.ts:116-128` validates password ≥6 chars and match, calls `signUp()` → `firebaseAuth.ts:244-269`. If the current user is anonymous, links the credential (preserves UID/local data) via `linkWithCredential`; otherwise creates a fresh account + sends verification email.
**Failure scenarios**: `auth/email-already-in-use` on the anon-link path falls back to `signInWithEmailAndPassword` (`firebaseAuth.ts:256-259`); on fresh signup it shows "This email is already registered." Network failure → mapped connection-failed message.
**Recovery**: Inline error, retry or switch to sign-in.
**Manual verification required**: Real Firebase email-verification delivery and click-through.

## 2. Login

**Expected**: `useLoginScreen.ts:104-114` requires both fields, `firebaseAuth.ts:235-242` signs in; success routes via `goPostLogin` (`:241-255`) checking `profiles.walkthrough_seen`.
**Failure scenarios**: Wrong-password/user-not-found/invalid-credential all map to one generic message (`firebaseAuth.ts:353-356`) — deliberately enumeration-resistant, not a bug. Distinct messages exist for rate-limiting and network failure.
**Recovery**: Inline error, immediate retry allowed (no client-side lockout).
**Manual verification required**: Real Firebase rate-limit timing/thresholds.

## 3. Logout

**Expected**: `authService.ts:32-39` deregisters the push token, signs out of Firebase, then re-establishes anonymous auth so the app always has *some* Firebase user.
**Failure scenarios**: Both the sign-out and re-anon calls are wrapped so failures only `logger.warn` (`:35,38`) — the function still resolves regardless.
**Recovery**: N/A — UI always proceeds to signed-out state; `AppContext` clears cache on uid change (`AppContext.tsx:206-221`).
**Manual verification required**: Whether a warn-logged sign-out failure leaves stale session state server-side.

## 4. Password reset

**Expected**: `useLoginScreen.ts:130-139` validates `@` presence, calls `sendPasswordResetEmail` (`firebaseAuth.ts:290-297`).
**Failure scenarios**: Mapped Firebase errors; Firebase itself doesn't reveal whether the email exists (enumeration-safe by default).
**Recovery**: Inline error; "Back to sign in" link.
**Manual verification required**: Actual reset-email delivery and the out-of-app password-change link flow.

## 5. Apple Sign In

**Expected**: `firebaseAuth.ts:95-137` generates a random UUID nonce, SHA-256 hashes it, passes the hash to `AppleAuthentication.signInAsync`; the raw nonce + returned identity token build a Firebase OAuth credential (server-verified, replay-protected — see the prior security-hardening phase). Routes through the shared `_applyCredential` handling anon-link/credential-conflict identically to Google.
**Failure scenarios**: User cancellation → silent (`cancelled:true`, no error text). `auth/account-exists-with-different-credential` → account-linking flow requiring a 6+ char password.
**Recovery**: Dedicated link-accounts screen.
**Manual verification required**: The real native Apple auth sheet, nonce round-trip validation, and `isAppleSignInAvailable()` all require a physical iOS device — cannot be exercised in this environment at all.

## 6. OTP verification

**Expected**: Request validates email shape, starts a 30s resend cooldown, moves to verify step; verify guards double-tap and calls `signInWithCustomToken`.
**Failure scenarios**: Network failure → "Couldn't reach the server…"; backend codes mapped via `emailOtpErrorMapper.ts:16-32` (expired/wrong-code/too-many-attempts/rate-limited).
**Recovery**: Resend re-enables after cooldown; "Use a different email" resets the flow.
**Manual verification required**: Actual email delivery latency/spam-filtering and backend rate-limit thresholds.

## 7. Profile setup (onboarding)

**Expected**: 3 steps (name, optional contact, location permission); "Skip" advances regardless of unresolved errors.
**Failure scenarios**: Contact-add failure shows inline error without blocking progression; location denial leaves `locationGranted:false` with no retry prompt on this specific screen.
**Recovery**: Skip is always available.
**Manual verification required**: Real permission-dialog behavior across iOS/Android versions.

## 8. Emergency contact management

**Expected**: `AppContext.tsx` enforces the 5-contact limit and phone-number de-dup, persists locally then background-syncs to Supabase.
**Failure scenarios**: Remote sync failures are only `logger.warn`'d (`:255,296,338,356`) — local and remote state can silently diverge with no user-visible indication.
**Recovery**: None automatic for a failed remote sync; local edits always succeed.
**Manual verification required**: Actual cross-device contact-sync consistency.

## 9. Journey creation

**Expected**: `SafetyContext.tsx:521-559` anchors to wall-clock `Date.now()` (not a counter, deliberately — survives backgrounding), persists locally, best-effort backend write, then notifies contacts.
**Failure scenarios**: Backend write failure never blocks the local timer (by design); contact-alert failures aren't awaited for success.
**Recovery**: N/A — local timer is authoritative.
**Manual verification required**: Whether trusted contacts actually receive the "journey started" notification in the field.

## 10. Journey completion (check-in)

**Expected**: `checkInJourney` (`:611-617`) computes elapsed time, updates the backend idempotently, persists the outcome, clears state.
**Failure scenarios**: Backend `endJourney` failure only logged — local state always clears regardless, so a completed journey could remain "active" server-side if the call never lands.
**Recovery**: None needed client-side.
**Manual verification required**: Server-side reconciliation of any orphaned "active" journey rows.

## 11. Journey timeout / auto-SOS escalation

**Expected**: `OVERDUE_GRACE_SEC = 60`; `computeJourneyStatus` is a pure wall-clock function (not an incrementing counter, specifically so backgrounding doesn't stop overdue detection); a mount-time recovery effect re-evaluates status from persisted `startedAtMs` on relaunch and escalates immediately if already expired.
**Failure scenarios**: If another SOS is already active, the escalation attempt no-ops (telemetry label only, doesn't gate behavior). A scheduled local OS notification is a durability backstop independent of JS execution.
**Recovery**: N/A.
**Manual verification required**: Whether iOS/Android actually wakes the JS engine to run this check while backgrounded — the code's own comments note this is not guaranteed; needs real-device background testing.

## 12. SOS activation

**Expected**: 3-second countdown, guarded against re-entry; location fetch + live-tracking start in parallel; on countdown end, DB write + alert dispatch fire.
**Failure scenarios**: DB write failure retries every 15s indefinitely while active (hardened in the performance-certification phase); location failure leaves `coords:null` without blocking activation.
**Recovery**: A crash-recovery effect resumes an in-progress SOS from the offline queue on relaunch if under 30 minutes old.
**Manual verification required**: Actual SMS/call delivery and real-world GPS accuracy.

## 13. SOS cancellation

**Expected**: Countdown-cancel and active-phase "I'm Safe" share one `cancelSOS()` path — single tap, no confirmation dialog (by design, so a false alarm is never harder to stop than to start).
**Failure scenarios**: Backend event-resolve failure only logged — cancellation always succeeds client-side regardless.
**Recovery**: None needed.
**Manual verification required**: Whether an unresolved backend `sos_events` row (from a failed resolve call) triggers any downstream false-alarm handling — backend-side, out of this repo's direct control.

## 14. Fake call

**Expected**: Pure client-side timers, no network. Schedule → ring (repeating haptic) → accept (connected phase with elapsed counter) → hang up (resets).
**Failure scenarios**: None meaningful — no network/backend dependency; haptics are fire-and-forget.
**Recovery**: N/A.
**Manual verification required**: Whether the ring timing and UI feel convincing enough — a human-judgment, real-device question.

## 15. Community reporting

**Expected**: Requires sign-in and a resolved GPS point; optional photo upload (failure silently skipped); submits via the community-reports API.
**Failure scenarios**: Generic failure → toast + telemetry; HTTP 429 specifically detected → a distinct rate-limited message.
**Recovery**: Form state preserved on failure; resets and switches tabs on success.
**Manual verification required**: Actual backend rate-limit window and photo-upload reliability under poor connectivity.

## 16. Premium purchase

**Expected**: Native RevenueCat paywall (preferred) or an inline fallback path; both reload entitlements on success.
**Failure scenarios**: `isPurchasesAvailable()` gates everything on a valid platform API key — a misconfigured key makes purchasing silently unavailable. Cancellation → no error toast. Any other failure → one generic message, no differentiation shown to the user.
**Recovery**: A `busy` state prevents double-submission; retry is always available.
**Manual verification required**: The real RevenueCat sandbox/production purchase flow and the backend webhook that flips `is_premium` — cannot be verified from client code alone.

## 17. Subscription restoration

**Expected**: Calls `Purchases.restorePurchases()`, checks both the current and legacy entitlement keys, shows "Restored" or "No purchases found" accordingly.
**Failure scenarios**: Any thrown error → one generic message, no differentiation between "not signed into store" and a network failure.
**Recovery**: Retry via the same button; concurrent taps blocked.
**Manual verification required**: Real App-Store/Play-Store account-linked restore behavior with a prior purchase.

## 18. Settings

**Expected**: Notification toggle requests OS permission and only flips on grant; App Lock toggle checks biometric availability first; language via a picker modal.
**Failure scenarios**: The background-location toggle sets local state with no accompanying OS permission check — reviewed and assessed as a **preference flag**, not a permission grant (the actual OS permission is requested at SOS-trigger time regardless of this toggle's state), so this is not confirmed as a functional bug — flagged for further product clarification, not fixed.
**Recovery**: Notification toggle self-corrects on next screen mount if permission was externally revoked.
**Manual verification required**: Real OS-level background-location and biometric-enrollment states across devices.

## 19. Account deletion

**Expected**: 2-step confirmation (type "DELETE" verbatim to enable the final button); tears down any active SOS/journey first; calls the backend's `DELETE /auth/account` (which authoritatively deletes `emergency_contacts`/`sos_events`/`journeys`/`live_sessions` server-side, keyed to the request's verified Firebase UID — **confirmed by reading `artifacts/api-server/src/routes/auth.ts:9-15,56-87`**) *before* the client calls Firebase's `deleteUser()`.
**Failure scenarios**: Backend cleanup failure is logged but non-fatal — Firebase deletion proceeds regardless (by design, so a stuck backend never blocks account deletion). **Verified non-issue**: the client-side `resetAllData()`'s own `contactsRepository.deleteAllContacts(userId)` call is skipped post-`deleteUser()` (uid is null by then) — this looked like a gap in isolation, but is confirmed harmless since the backend has already authoritatively deleted those rows moments earlier, before the Firebase user record was removed. **Genuine, minor gap**: `auth/requires-recent-login` shows a "please sign in again" message, but no in-app reauthentication screen is wired to it (`reauthenticateWithPassword` exists in `firebaseAuth.ts:278-288` but is not called from any screen) — the user must manually sign out and back in. Not a crash, not data loss, not a blocked deletion — a UX dead end requiring a manual workaround. **P2 finding**, not a launch blocker.
**Recovery**: General failures show a toast and allow retry; the reauth case requires manual sign-out/in.
**Manual verification required**: Whether the backend's deletion is transactionally complete in production (not just reachable in code) needs a live deletion test against a real account.

## Verification

All 19 flows traced to real, currently-existing code — no flow was found to reference a route, function, or state transition that doesn't exist. `npx tsc --noEmit`: 0 errors. `pnpm run test`: 100/100 passing (no test-covered logic was touched by this research phase).
