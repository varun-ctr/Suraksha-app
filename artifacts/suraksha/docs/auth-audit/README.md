# Authentication Module — Production Readiness Audit (iOS-first launch)

Date: 2026-07-22
Scope: `features/authentication/`, `repositories/firebase/`, `repositories/api/emailOtpRepository.ts`, `core/permissions/notifications.ts`, `core/storage/`, and the auth-adjacent parts of `app/_layout.tsx`, `AppContext.tsx`, `LanguageContext.tsx`, `useProfileScreen.ts`, `useSessionsScreen.ts`. Backend (`artifacts/api-server`'s `/auth/*` routes) was read and audited but not modified except where noted — it was already solid.

This directory is the full deliverable set. Start here, then follow the links below for depth.

## Documents

1. [Architecture diagram](./architecture-diagram.md)
2. [Authentication & session flow diagrams](./flow-diagrams.md)
3. [Session lifecycle diagram](./session-lifecycle.md)
4. [Security audit report](./security-audit-report.md) (OWASP MASVS / Mobile Top 10)
5. [Risk assessment](./risk-assessment.md)
6. [Technical debt report](./technical-debt-report.md)
7. [Code changes](./code-changes.md)
8. [Migration notes](./migration-notes.md)
9. [Test report](./test-report.md)
10. [iOS readiness report](./ios-readiness-report.md)

## Scores

**Overall score: 7.5 / 10** — solid foundations (Firebase Auth done correctly, a genuinely well-built backend OTP endpoint, anonymous-first UX that never leaves the user stuck signed-out), hardened significantly this pass (repository pattern, DI, Result/AppError, one consolidated auth-state listener, encrypted session storage, push-token hygiene on sign-out). What's left is mostly two categories: (a) one architecturally significant decision intentionally left to the user — native-SDK migration for session storage — and (b) backend-side reconciliation for account deletion, which is out of this pass's scope (mobile client).

**Estimated production readiness: ~85%.** The remaining ~15% is: the account-deletion server-side reconciliation gap (P1, backend work), broader test coverage requiring a device/simulator (P2, this sandbox can't run one), and a couple of nice-to-haves (P3) that don't block a launch.

### Critical issues (P0)

None found that block a launch. The closest candidate — session tokens in plaintext AsyncStorage — is addressed this pass (envelope encryption, see risk assessment #1) rather than left open.

### High-priority issues (P1)

1. **Account-deletion server-side cleanup has no retry path** if the backend call fails (client proceeds to delete the Firebase user regardless, by design — see `authService.ts`). Orphaned Supabase rows are now at least logged; a proper fix needs a Firebase Auth "user deleted" Cloud Function or a scheduled reconciliation job on the backend. Out of scope for a mobile-client-only pass — flagged for the backend team.
2. **No native-Keychain-backed session storage.** This pass adds AES-256-CBC+HMAC-SHA256 envelope encryption over the existing AsyncStorage persistence (key material in Keychain/Keystore via SecureStore), which meaningfully raises the bar (protects against unencrypted-backup extraction) without the reliability risk of forcing the whole session blob through SecureStore's 2048-byte limit. The fully "correct" long-term fix — `@react-native-firebase/auth`, which uses the native SDK's own Keychain-backed session storage — is a bigger migration (native rebuild, no JS-only path) intentionally not done here.

### Medium issues (P2)

1. Test coverage for the auth module is limited to pure logic (error mapping, entity mapping, crypto primitives) — anything requiring a live Firebase instance, a device, or React rendering needs a simulator/device this sandbox doesn't have. See the test report for what's covered vs. not.
2. Backend rate limiting is per-email/per-IP only; no per-device signal (e.g., App Attest/Play Integrity) yet — reasonable for launch, worth revisiting post-launch.
3. No Sentry/crash-reporting breadcrumbs specifically tagged for auth failures (the `logger` calls added this pass are a foundation for that, not the integration itself).

### Nice-to-haves (P3)

1. Apple Sign In is implemented; native biometric (Face ID) gating of the app itself (as opposed to Apple's own biometric prompt during Sign in with Apple) is not implemented — reasonable to defer, `AuthUser` domain entity and the repository pattern make it a contained addition later.
2. Universal Links for password reset (currently: Firebase's own hosted reset page, no deep link back into the app) would improve UX but isn't a security or store-compliance requirement.
3. `AuthUser` domain entity is now used additively (`useAuth().authUser`) but most existing call sites still read the raw Firebase `user` — a full migration is future work, deliberately not forced in this pass (see technical debt report).
