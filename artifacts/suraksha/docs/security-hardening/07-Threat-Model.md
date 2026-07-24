# 7. Threat Model

Realistic adversaries and scenarios for this app, with residual risk after this pass's changes stated honestly — not minimized, not overstated.

## Lost device

**Before this pass**: Firebase session encrypted (AES-256-CBC+HMAC, keys in Keychain/Keystore); SOS/journey/live-session state in plaintext AsyncStorage.
**After this pass**: SOS/journey/live-session state now encrypted with the same envelope (`02-Offline-Encryption.md`). App Lock (opt-in) adds a biometric gate on top of the device's own lock screen.
**Residual risk**: If App Lock is not enabled (the default), a lost-but-unlocked device still exposes the app's full functionality with no additional gate — the device's own OS lock screen is the only barrier. If App Lock is enabled, a lost device requires either the enrolled biometric or the device passcode fallback to access the app. **Recommendation, not implemented**: consider defaulting App Lock to on for new installs once its UX has been validated with real users — left opt-in in this pass specifically to guarantee zero risk of disrupting the existing login flow for any current user.

## Abusive partner with physical access — the threat model unique to this app's category

**This is the threat this session's audits have consistently flagged as under-weighted by generic MASVS scoring.** An abuser with the victim's unlocked (or weak-passcode) phone can, without App Lock enabled, freely browse SOS history, journey history, trusted contacts, and community reports. With App Lock enabled, that same abuser is blocked unless they also control the victim's enrolled biometric or device passcode — which, in an abusive-relationship context, is a real and known limitation (an abuser may well know the victim's passcode, or coerce a fingerprint). No software control fully closes this gap; it is fundamentally bounded by device-level physical security, which this app cannot override. **What this pass adds**: a genuine, working App Lock option where none existed; encrypted local storage so a forensic/backup-extraction path is no longer plaintext. **What remains open**: this app has no "panic wipe," no hidden/duress mode, and no remote "sign out this device" capability (see `09-Incident-Response.md`-equivalent finding, carried from the security audit) — all of these are legitimate, larger product features outside a hardening pass's scope.

## Token theft

Firebase ID tokens are short-lived (~1 hour) and never appear in URLs/query strings (confirmed — always an `Authorization` header). A stolen token's blast radius is now further bounded by: the community-reports rate limit and duplicate-prevention (this pass), the OTP atomic-consume fix (this pass, closes a narrow replay window), and the existing SOS rate limit/idempotency. **Residual risk**: no server-side token revocation/blocklist exists for immediate invalidation before natural expiry (unchanged — this requires either a Firebase Admin `revokeRefreshTokens` integration or a deny-list layer, a genuine feature addition, not a hardening fix).

## MITM

No certificate pinning exists (confirmed, unchanged — a structural limitation of Expo's managed workflow without ejecting or a native config plugin). All traffic is HTTPS-only with no cleartext fallback anywhere. **Residual risk**: a MITM with a trusted (or maliciously installed) root CA on the device can intercept traffic. This is an accepted, documented limitation given the app's managed-workflow architecture, not something this pass could close without a native-code change outside "no architecture redesign."

## Replay

Reviewed every write operation this pass:

| Operation | Replay protection | Status |
|---|---|---|
| Authentication (sign-in) | Firebase's own short-lived ID tokens + refresh-token rotation | Adequate — delegated to Firebase, correctly not reimplemented |
| OTP verify | **Fixed this pass**: atomic consume (conditional `DELETE ... WHERE code_hash = ?` gated on actually removing a row) — closes a narrow race where two concurrent requests with the same correct code could both succeed | Improved |
| Journey start | Client-generated UUID primary key + retry-and-adopt (prior phase) | Adequate |
| SOS event / live session | DB-enforced idempotency key / UUID + retry-and-adopt (backend-hardening pass) | Adequate |
| Community reports | **New this pass**: content+time-window duplicate-prevention | Improved |
| Notification registration / push tokens | `UNIQUE(user_id, token)` upsert — a replay is a harmless no-op | Adequate |

**Residual risk**: no general request-signing/timestamp-nonce scheme exists for routes without their own natural idempotency (e.g. a captured bearer token replayed against `GET /community-reports/mine` just re-reads the same data — low value to an attacker since it's read-only and scoped to the token owner's own data). This is a broader architectural addition (HMAC-signed requests or a nonce header validated server-side) considered but not implemented this pass — it would add complexity to every route for a marginal benefit given the routes that actually matter (write operations with real consequences) already have specific, targeted protection.

## Tampering

No root/jailbreak detection, no code obfuscation, no runtime integrity checks — unchanged, a known MASVS-RESILIENCE gap standard for Expo managed-workflow apps. **What actually matters here**: this app's real trust boundary is server-side (Supabase RLS + verified Firebase tokens), reviewed as solid across every backend audit this session — a tampered client can only ever act within its own authenticated user's permissions, never escalate to another user's data or bypass server-side validation. Client-side tampering primarily harms the tampering user themselves (e.g., disabling their own rate limit locally does nothing, since the limit is server-enforced).

## Reverse engineering

No obfuscation. Every secret classification was re-verified this pass (unchanged from the security audit): no server-only secret (Supabase service-role key, Twilio auth token, Firebase Admin credentials) exists anywhere in the mobile bundle's source — cross-boundary grep confirms client-safe keys only (Supabase anon key, Firebase web config, Sentry DSN — all designed to be public). Decompiling the bundle would reveal application logic (as with any JS app) but no exploitable secret.

## Compromised backend

If `api-server` itself were compromised, an attacker would gain: the service-role key's access (full Supabase RLS bypass), Twilio credentials, and the ability to forge responses to any client. This is the most severe single-point compromise in the system's architecture. Mitigations already in place: secrets are env-var-only (rotatable without a code change), Sentry scrubbing now reduces what a compromised error-reporting pipeline could exfiltrate (`05-Sentry-Scrubbing.md`), and every write route still requires a valid Firebase token to reach the compromised code (raising the bar from "anyone" to "anyone with a token," though a fully compromised backend could in principle mint its own or bypass that check). **Residual risk, unchanged**: no backend kill-switch, no audit-log trail of who-accessed-what (both noted as P2 recommendations in the prior security audit, not addressed in this pass since they're operational/feature additions, not hardening of existing code).

## Rooted devices

No detection exists (see "Tampering"). A rooted device's owner can extract the now-encrypted local storage's ciphertext, but not decrypt it without also extracting the Keychain/Keystore-protected keys — which root access on Android *can* potentially expose (Android's hardware-backed keystore is more resistant than a software-only keystore, but not universally immune on all rooted configurations) while iOS's Secure Enclave-backed Keychain is substantially more resistant even to jailbreak on modern devices. This is a genuine platform-level asymmetry this app cannot control from application code.

## Summary: what changed this pass vs. what remains structurally open

**Closed or meaningfully improved**: unencrypted local safety data, no app-lock option, OTP replay race, community-report abuse/spam surface, Sentry PII exposure risk, missing Privacy Manifest.

**Remains structurally open** (documented, not silently dropped — see `docs/security-audit/12-Production-Certification.md` and this document's own sections above): no certificate pinning, no root/jailbreak detection, no remote session revocation, no backend audit-log trail, no request-signing/nonce scheme beyond targeted idempotency. Every one of these requires either a native-code/config-plugin change outside Expo managed workflow, a genuine new feature (not a fix to existing code), or live infrastructure this environment cannot provision — none are code defects left unaddressed by oversight.
