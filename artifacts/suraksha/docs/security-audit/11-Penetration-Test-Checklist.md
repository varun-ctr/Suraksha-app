# 11. Penetration Test Checklist

A structured checklist for a human/tooled penetration test, organized by MASVS category. Each item notes what this code review already established (✅ reviewed, likely pass / ⚠️ reviewed, known gap / ❓ needs live testing this environment couldn't perform) so a tester can prioritize.

## Authentication

- [ ] ❓ Attempt to bypass Firebase token verification on every route in the backend-route table (`06-Network-Security.md`) with a malformed/expired/forged token.
- [ ] ❓ Attempt to reuse an OTP code after `MAX_ATTEMPTS` failed guesses (expect: code invalidated, `too_many_attempts`).
- [ ] ❓ Attempt to brute-force an OTP within its 10-minute TTL despite the rate limits (expect: blocked by email+IP rate limit before exhausting the 900,000-code space).
- [ ] ❓ Verify Apple Sign-In nonce is actually checked server-side (not just generated) — attempt replaying a captured Apple credential with a stale/mismatched nonce.
- [ ] ⚠️ Confirm there is no app-level re-authentication prompt after backgrounding/returning to the app (known gap — no session lock exists).

## Authorization

- [ ] ❓ Attempt to read/write another user's `sos_events`/`journeys`/`live_sessions`/`emergency_contacts`/`profiles`/`subscriptions`/`notification_tokens` row directly via the Supabase REST API using a different user's anon-key session (expect: RLS denies).
- [ ] ❓ Attempt to read another user's `community_reports` row's `user_id` field or otherwise infer reporter identity from any client-facing surface (expect: not exposed anywhere in the UI).
- [ ] ❓ Attempt to submit `/community-reports` or `/sos/alert` with a `user_id`/owner field in the body set to a different user (expect: server ignores it, uses the verified token's uid — ✅ reviewed in code, confirmed correct).
- [ ] ❓ Attempt to invoke `get_overdue_journeys()` or other `SECURITY DEFINER` RPCs directly via the anon/authenticated Supabase client (expect: `REVOKE ALL ... FROM PUBLIC` denies this — ✅ reviewed).

## Storage

- [ ] ❓ Extract an unencrypted local backup (iTunes/Finder or ADB) and inspect `AsyncStorage` contents for the SOS offline queue and journey-state keys (expect: **plaintext GPS coordinates/address will be found** — known, documented gap, see `05-Secure-Storage.md`).
- [ ] ❓ Attempt to read the Keychain/Keystore entries for the AES/HMAC keys from a non-jailbroken/non-rooted device (expect: inaccessible without OS-level compromise).
- [ ] ❓ Tamper with the encrypted Firebase-session AsyncStorage value and confirm the app falls back to "no session" rather than trusting corrupted data (expect: fail-closed — ✅ reviewed in code).

## Cryptography

- [ ] ❓ Confirm IV/nonce uniqueness across many encryption operations in practice (not just by code review) — capture several encrypted session blobs across app restarts and diff the IV prefix.
- [ ] ❓ Attempt a padding-oracle attack against the AES-CBC session encryption (expect: blocked by the HMAC check happening before decryption — ✅ reviewed in code, worth live verification).

## Network

- [ ] ❓ Attempt a MITM with a device-installed custom root CA (expect: **succeeds** — no certificate pinning exists, a known/accepted gap for this Expo managed-workflow app).
- [ ] ❓ Attempt to downgrade any connection to HTTP (expect: fails — no cleartext config exists anywhere).
- [ ] ❓ Capture a valid bearer token and a request body, then replay it against `/community-reports` POST after the original request succeeded (expect: **succeeds again**, creating a duplicate report — known gap, no replay protection beyond SOS-specific idempotency).
- [ ] ❓ Fuzz every backend route's request body against its Zod/validation schema where present (`/sos/alert` has one; several other routes have lighter/no validation).

## RLS

- [ ] ❓ Directly query `community_reports` as the `anon` role using only the publishable key, post-migration-004 (expect: denied — **this is the single most important live test to run**, verifying the backend-hardening pass's fix actually took effect in the deployed database, since this pass could not execute the migration against a live project).
- [ ] ❓ Run the provided `api-server/migrations/tests/verify_backend_hardening.sql` script against a real staging Supabase project — it already encodes RLS/idempotency/cascade/constraint assertions as automated checks (see `docs/backend-hardening/08-Migration-Guide.md`).

## Offline attacks

- [ ] ❓ Put the device in airplane mode mid-SOS-trigger, confirm the offline queue persists the pending activation and retries once connectivity returns (expect: succeeds — established SOS-reliability behavior from a prior audit phase).
- [ ] ❓ Force-kill the app mid-SOS, confirm crash-recovery resumes/reconciles correctly using the persisted `idempotencyKey` (expect: succeeds, but the persisted data itself is unencrypted at rest — see Storage section above).

## Tampering

- [ ] ❓ Attempt to modify the app binary/bundle on a rooted/jailbroken device and observe whether the app detects it (expect: **no detection — known gap, no root/jailbreak detection exists**).
- [ ] ❓ Attempt to hook/instrument the running app (Frida, etc.) to bypass a client-side check (expect: succeeds for any client-side-only validation, since there's no anti-tampering/anti-debugging — a reminder that server-side validation, not client-side, is this app's actual trust boundary, and that boundary was reviewed as solid in `07-Backend-Security.md`).

## Reverse engineering

- [ ] ❓ Decompile/unpack the JS bundle and confirm no hardcoded server-only secrets are present (expect: **none found** — ✅ reviewed via source code cross-boundary grep; a live bundle-inspection pass would independently confirm this).
- [ ] ❓ Confirm the Supabase anon key and Firebase web config found in the bundle are the intentionally-public ones, not accidentally-exposed service-role/admin credentials (expect: confirmed by classification in `10-Secrets-Management` equivalent evidence — cross-check against a real built bundle).

## MITM

- Covered under Network above — no pinning, so a MITM with a trusted root CA on the device succeeds. This should be explicitly scoped/accepted or addressed as part of any formal pentest sign-off, since it's a known, structural limitation rather than a surprise finding.

## Replay

- Covered under Network/RLS above — SOS/journey/live-session writes are protected by idempotency keys; most other write routes (community reports, journey-alert dispatch) are not protected against a captured-request replay within the bearer token's lifetime.

## Injection

- [ ] ❓ Fuzz every backend route's string fields (`description`, `address`, `message`) for SQL injection (expect: **no injection surface exists** — the Supabase JS client's parameterized builder is used exclusively; ✅ reviewed, no raw SQL string interpolation found anywhere in route code).
- [ ] ❓ Fuzz for NoSQL/JSON injection into the JSONB columns (`contacts_notified`, `route_json`) (expect: these are written as structured objects by the app, never raw user string input directly — low risk, worth a quick live fuzz for completeness).

## Privilege escalation

- [ ] ❓ Attempt to call any `SECURITY DEFINER` function with a manipulated `search_path` (expect: blocked — every such function pins `search_path` explicitly; ✅ reviewed).
- [ ] ❓ Attempt to have a regular authenticated user trigger a service-role-only action (e.g. directly hitting a moderation-only capability) — expect: no such capability is exposed to regular clients today (no moderator role exists in the schema at all).
