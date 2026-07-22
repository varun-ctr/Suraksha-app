# 5. Risk Assessment

Each risk is scored Likelihood × Impact (Low/Medium/High) with the disposition taken this pass.

## 1. Session tokens at rest — plaintext AsyncStorage → envelope-encrypted (RESOLVED THIS PASS)

- **Likelihood**: Low (requires physical device access, a jailbroken/rooted device, or unencrypted-backup extraction — not remotely exploitable).
- **Impact**: High if it occurs (a stolen refresh token grants persistent account access until revoked/rotated).
- **Options considered**:
  1. *Do nothing, document only* — zero implementation risk, leaves the gap open.
  2. *Move the whole session blob into `expo-secure-store`* — rejected: SecureStore has a **hard 2048-byte per-item limit** (documented in the SDK itself), and Firebase's persisted blob (tokens + linked-provider metadata) can realistically exceed that with multiple linked providers, risking **silent session-persistence failures** — a reliability regression worse than the storage gap it would fix.
  3. *iOS-only SecureStore swap* — rejected: still hits the same size ceiling on iOS (the 2048-byte limit isn't Android-specific), and would need real device testing this sandbox can't do.
  4. **Envelope encryption (chosen, user-approved)**: a small (32-byte) AES key + a 32-byte HMAC key live in SecureStore (well under the size limit); the bulk ciphertext stays in AsyncStorage. This is implemented as a drop-in storage adapter (`encryptedAuthStorage.ts`) satisfying Firebase's own `ReactNativeAsyncStorage` interface — Firebase's persistence internals are untouched.
- **Residual risk**: A malicious library with arbitrary code execution *inside* the app process could call the same `expo-secure-store` APIs and read the key — this defends against passive extraction (backups, filesystem dumps), not a fully compromised app process. That's the correct, honestly-scoped threat model for this mechanism; a compromised app process is a much bigger problem than session storage alone.
- **Verification**: 11 unit tests on the pure crypto primitives (round-trip, tamper detection via HMAC, wrong-key fail-closed behavior, IV uniqueness) run in plain Node — see the test report. Legacy plaintext sessions are read-through (not force-invalidated) so no existing signed-in user is logged out by this upgrade; the next routine write re-persists encrypted.
- **Longer-term fix (not done this pass, too large for a non-behavior-changing hardening pass)**: migrate to `@react-native-firebase/auth`, whose native SDK stores session state in the platform Keychain/Keystore directly. Requires a native rebuild and EAS config changes — a deliberate, separate decision for the team, not a JS-only fix.

## 2. Account-deletion backend cleanup is best-effort with no retry

- **Likelihood**: Low-Medium (requires the backend call to fail — network blip, backend downtime — at the exact moment of account deletion).
- **Impact**: Medium (orphaned rows in Supabase for a deleted account — a data-hygiene and privacy-compliance issue, not an active security hole, since the Firebase account itself is gone and can't be used to access that data).
- **Disposition**: Now logged (`authService.ts` — previously silent) so it's at least observable. Not fixed further this pass because the correct fix (a Firebase Auth "user-deleted" Cloud Function, or a scheduled reconciliation job comparing Supabase rows against still-existing Firebase UIDs) is backend infrastructure work outside a mobile-client-scoped audit. **Flagged as P1 for the backend team.**

## 3. Four redundant `onAuthStateChanged` listeners (RESOLVED THIS PASS)

- **Likelihood**: N/A (not a security risk) — a performance/reliability risk instead.
- **Impact**: Medium — each of `AuthContext`, `AppContext`, `LanguageContext`, and `app/_layout.tsx`'s `Gate` ran an independent subscription to the same underlying Firebase event stream, meaning every sign-in/out fired 4 separate React state updates and effect cascades, and made the "real sign-out transition" detection logic in `AppContext` fragile (relying on its own independently-initialized `prevUidRef`, racing against 3 other listeners with no ordering guarantee between them).
- **Disposition**: Consolidated to one subscription in `AuthContext`; the other three now derive from `useAuth()`. See the flow diagrams and technical debt report for the before/after.

## 4. Push notifications continued after sign-out (RESOLVED THIS PASS)

- **Likelihood**: Medium (affects every user who signs out without also disabling notifications, which is most users — toggling notifications off is not a natural part of "signing out").
- **Impact**: Low-Medium — a former user's device kept a valid `notification_tokens` row, so backend-triggered pushes (that the app maintainers might not think of as "user-specific" but which are) would still reach that device.
- **Disposition**: `deregisterPushToken()` (extracted from the pre-existing toggle-off code, previously only reachable that way) now runs on every sign-out.

## 5. Auth module bypassed the app's own repository/DI/Result pattern (RESOLVED THIS PASS)

- **Likelihood**: N/A — an architectural-consistency and long-term-maintainability risk, not a runtime security risk today.
- **Impact**: Medium over time — at 100k+ LOC / 1M+ users scale, an auth module that doesn't follow the same patterns as the rest of the codebase (Result/AppError, DI-testable repositories) becomes the one place new engineers have to learn a different mental model, and the one place a swap-in test double or alternate backend can't happen without touching call sites directly.
- **Disposition**: `AuthRepository` and `EmailOtpRepository` domain interfaces added, concrete implementations wired through DI, `AuthContext` and `useLoginScreen` rewired to consume them, all seven `AppError` subclasses (including two added this pass — `SessionExpiredError`, `OTPExpiredError`) used where they fit.

## 6. iOS-specific: no OTP autofill support (RESOLVED THIS PASS)

- **Likelihood**: N/A — a UX/conversion risk, not a security risk (arguably a *minor* security positive too: autofill reduces the chance of a user reading a code aloud or screenshotting it).
- **Impact**: Low — users had to manually read and type the 6-digit code from their email.
- **Disposition**: `textContentType="oneTimeCode"` and `autoComplete="one-time-code"` added to the OTP `TextInput`, enabling iOS QuickType/Mail-code suggestions.
