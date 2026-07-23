# 10. Technical Debt Report

## Carried forward from before this pass (found during the audit, not introduced by it)

| ID | Debt | Impact | Why not fixed now |
|---|---|---|---|
| TD-1 | `sos_events` has no `idempotency_key` column or unique constraint | Duplicate-write prevention is client-side best-effort (`findRecentUnresolvedEvent`, 5-min lookback) rather than DB-enforced | Requires a Supabase schema migration; this environment has no database migration access. Documented as the honest limit of what's fixable from the mobile client alone — same constraint pattern as the account-deletion backend gap found in the auth-hardening pass |
| TD-2 | `SosBottomSheet.tsx` previously owned `sendSosAlerts` dispatch + its own `alertStatuses`/`alertSending` state | Architecture violation (a presentational component driving a business-critical side effect); state didn't survive component remount and wasn't reachable by crash recovery | **Fixed in this pass** — moved into `SafetyContext.tsx`, passed down as props. Listed here for the historical record since it was a real defect, not a style nit |
| TD-3 | `attemptBackendAlert`'s retry is a single fixed 2s backoff, not exponential/jittered | Sufficient for a brief blip; a sustained few-minutes outage still falls through to the (working) native SMS fallback, so this is not a delivery-loss risk, just a slower-than-ideal automatic path | Left as-is deliberately — the native SMS fallback already provides the reliability guarantee; adding a longer/smarter retry schedule delays that fallback firing, which cuts against "prefer graceful degradation over waiting" |
| TD-4 | `sendJourneyAlerts` builds its emergency message inline rather than through `emergencyMessage.ts`'s shared, tested, localized builder | Journey-start messages aren't localized/tested the same way SOS messages are; a future locale addition would need updating in two places | Not touched in this pass — pre-existing, low-risk (journey-start messages are informational, not the emergency alert itself), and out of the explicit scope (SOS/emergency subsystem, not the journey-start notification copy) |
| TD-5 | Crash-recovery's `PendingSosActivation` record is stored in plain (non-encrypted) AsyncStorage, unlike the auth session blob's envelope-encrypted storage | Contains the user's own current-emergency coordinates in plaintext local storage | Intentional trade-off, not an oversight (see Security Audit) — recovery must work before any decryption machinery is guaranteed initialized at boot; revisit if that ordering constraint changes |

## Introduced by this pass, and already tracked above in Risk Assessment as P1/P2

- No location-denied → Settings deep-link affordance (R1-1 in Risk Assessment)
- No Privacy Manifest declared yet (R1-3) — deliberately not fabricated without a real `expo prebuild` run against final dependencies
- No explicit "automatic delivery failed, please confirm manually" UI state distinct from the existing per-contact status badges (R1-4)
- Fixed 5-minute live-session heartbeat window is a reasonable estimate, not device-validated (R2-2)

## Explicitly NOT technical debt (verified solid, intentionally left unmodified)

- `sosAlertService.ts`'s core dispatch logic (backend → native SMS → call-first-contact cascade) — reviewed in depth, already correctly designed before this pass
- Backend `api-server/src/routes/sos-alert.ts` — already has server-side idempotency caching, rate limiting, and Zod validation; out of mobile-client scope and unmodified
- RLS policies on `sos_events`/`journeys`/`live_sessions` — correct owner-only scoping, verified against `DATABASE_SETUP.sql`
- `get_live_session` `SECURITY DEFINER` RPC — correctly minimal public shape, correctly filters on `is_active` and `expires_at`

## Debt paid down in this pass

1. Zero iOS background execution capability for live tracking (the P0 — see Risk Assessment).
2. No offline queue / crash recovery for an in-flight SOS activation.
3. No client-side duplicate-write mitigation for `sos_events` (now best-effort, pending TD-1's proper fix).
4. Zombie/duplicate `live_sessions` rows accumulating indefinitely after a crash (now self-cleaning via `endAllActiveForUser` + heartbeat expiry).
5. `SosBottomSheet` architecture violation (TD-2 above).
6. No SOS-specific privacy-safe telemetry (`core/analytics/sosTelemetry.ts` did not exist before this pass).
