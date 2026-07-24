# 9. Incident Response

This section assesses readiness, not a runbook execution — no incident has occurred; this documents what the codebase/architecture currently supports and what's missing, building on `docs/backend-audit/disaster-recovery-plan.md` (unchanged, not re-litigated) where relevant.

## Credential compromise (a user's Firebase account)

- **Detection**: no anomaly-detection exists in this codebase (would be a Firebase/Google Cloud-side capability, not something this app's code implements). Not assessable from code alone.
- **Response readiness**: sign-out is straightforward (Firebase SDK); account deletion cascades across Firebase + Supabase + push tokens + live sessions + contacts + storage (prior auth-hardening pass). A compromised account's emergency contacts/SOS history would be visible to whoever holds the session until it's terminated — there is no current mechanism to force-terminate *other* active sessions on a specific device (Firebase's session model is refresh-token-based; revoking requires Firebase Admin's `revokeRefreshTokens`, not currently wired into any admin/support tooling in this codebase).
- **Gap**: no self-service "sign out of all other devices" feature exists in the app today. Worth considering for a safety app specifically, since credential compromise here could mean an abuser gaining access to a victim's SOS/contact/location history.

## Database leak (Supabase)

- RLS is the primary defense-in-depth layer if the anon/publishable key were ever fully exposed with RLS intact (it already is bundled by design) — the closed `community_reports` anon hole (backend-hardening pass) was the one scenario where a leak of the *already-public* key would have mattered; that's fixed.
- A leak of the **service-role key** would be far more severe (bypasses RLS entirely) — this key is correctly confined to `api-server`'s and the Edge Function's env surfaces only (verified via cross-boundary grep, `03-Privacy-Audit.md`/`10-Secrets-Management.md`). Response readiness: rotating this key requires Supabase dashboard access (operational, not code) and would require redeploying `api-server` and the Edge Function with the new value — no code changes needed, since the key is read from env at runtime, never hardcoded.
- PITR/backup verification remains an open operational item (carried over from `docs/backend-audit/disaster-recovery-plan.md`, unchanged).

## API compromise (api-server)

- Every server-only secret (service-role key, Twilio auth token, Firebase Admin credentials, Resend API key, RevenueCat webhook secret) is env-var-based, never hardcoded — rotation is an env-var change + redeploy, not a code change.
- The RevenueCat webhook uses a shared-secret bearer token compared with `timingSafeEqual` — correct defense against a timing side-channel on that specific secret compare.
- No API-key-scoped kill-switch exists (e.g. a way to instantly disable `/sos/alert` without a full redeploy) — for a safety-critical route, a simple env-var-gated feature flag would improve incident-response agility. Not implemented in this pass (a genuine new operational capability, not a bug fix).

## Lost device

- The Firebase session is encrypted at rest (AES-256-CBC+HMAC, keys in Keychain/Keystore) — a lost device without an unlock passcode is the realistic worst case, and OS-level device encryption is the primary control there, which this app's own session encryption complements rather than replaces.
- **No remote sign-out / device-list revocation feature exists** — same gap as "credential compromise" above. For a lost/stolen device scenario specifically, this means the only mitigation is the device's own lock screen and eventually Firebase's token expiry (natural rotation, not an instant kill switch).
- The SOS offline queue and journey state being unencrypted (see `05-Secure-Storage.md`) is most relevant here: a lost, unlocked device (or one with a weak/known passcode) exposes plaintext recent-emergency location data via local extraction tooling.

## Token theft

- Bearer tokens are short-lived (Firebase ID token expiry, typically ~1 hour) and never appear in URLs/query strings (confirmed — always an `Authorization` header). A stolen token's blast radius is bounded by its natural expiry plus whatever the attacker can do with it before then, across whichever routes lack additional rate-limiting/replay protection (see `08-Abuse-Prevention.md`).
- No server-side token revocation list/blocklist exists for immediate invalidation before natural expiry — relies entirely on Firebase's own token lifetime. Acceptable for most apps; worth explicit consideration for a safety app given the elevated threat model.

## Key rotation

- No rotation mechanism exists for the mobile app's own AES/HMAC keys (see `04-Cryptography.md`) — acceptable given they're Keychain/Keystore-backed and non-exportable, but worth a documented plan before extending this pattern.
- Backend secrets rotate via env-var update + redeploy — standard, adequate, no code changes required.

## Backend outage

- Firebase Auth and Supabase are architecturally independent failure domains (established architectural strength, unchanged) — a Supabase outage doesn't take down authentication.
- SOS's own reliability doesn't depend on `api-server` being up: the native SMS/call fallback (`sendSms`/`callNumber` in `sosAlertService.ts`) activates automatically whenever the backend Twilio path is unavailable or fails, meaning the single most safety-critical feature has a working degraded mode even during a full backend outage. This is a significant, already-existing strength worth highlighting for this section specifically.
- `api-server`'s own health checks (`/healthz`, `/health`, `/ready`) exist for external monitoring to key off — but no monitoring/alerting is actually wired up yet (see `docs/backend-hardening/07-Monitoring.md`, unchanged by this pass).

## Emergency rollback

- Every backend-hardening migration is reversible with an inline rollback block (`docs/backend-hardening/09-Rollback-Guide.md`) — unchanged, still current.
- This pass's two code changes (`sos-alert.ts`, `email-otp.ts`/`otp.ts`) are trivial, low-risk, and independently revertible via a plain `git revert` — no migration/schema dependency, no data migration needed to roll back.

## Summary of incident-response gaps (operational/product, not code defects)

1. No self-service "sign out of all devices" / remote session revocation.
2. No audit-log trail for security-relevant reads/writes (see `07-Backend-Security.md`).
3. No monitoring/alerting wired to the health-check endpoints or Sentry (carried over from the backend-hardening pass, unchanged).
4. No documented, tested restore-from-backup drill (carried over, unchanged).
5. No kill-switch/feature-flag for rapidly disabling a specific route during an active incident.
