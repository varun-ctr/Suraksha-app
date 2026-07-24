# 5. Data Retention

## Design principle for this app

This is a personal-safety app; its historical record (past SOS events, past journeys) is arguably a **user-facing safety-history feature**, not incidental data — a legitimate product argument exists for retaining it far longer than a typical app would, distinct from data that should just be deleted after a fixed window. The retention decisions below draw a hard line between:

1. **Ephemeral operational data** — pure implementation-detail rows with no user-facing value once expired. Implemented, deleted automatically.
2. **Emergency-history data** (`sos_events`, `journeys`, `community_reports`) — retained indefinitely by default; an explicit product/legal decision, not an oversight. Documented, not deleted, pending an actual product decision.
3. **Session/operational-adjacent data** (`live_sessions`) — a middle case: the row itself has no lasting user-facing value after the tracking session ends (unlike an SOS event, nobody looks back at "here's a live-tracking session from 3 months ago" as a feature), so it gets a retention window.

## Implemented in this pass

| Table | Retention | Mechanism |
|---|---|---|
| `sos_idempotency_cache` | `expires_at` (minutes) | Already existed (`api-server/migrations/001` + `003`'s cron) |
| `rate_limit_counters` | `expires_at` (minutes) | Already existed |
| `email_otp_codes` | `expires_at` (minutes) | Already existed |
| `live_sessions` | **30 days from `created_at`** | **New in this pass** — `cleanup_expired_operational_rows()` extended (`api-server/migrations/009_retention_and_background_jobs.sql`) to `DELETE FROM live_sessions WHERE created_at < NOW() - INTERVAL '30 days'`, running on the existing 15-minute `pg_cron` schedule. Deliberately independent of `expires_at` (the heartbeat field), which controls something entirely different — whether a session is *currently shareable* — and is never itself a deletion trigger. |

## Not implemented — requires a product/legal decision (documented, not deferred by oversight)

| Table | Current state | Recommendation |
|---|---|---|
| `sos_events` | Retained indefinitely | Define explicitly: retain-indefinitely-as-a-safety-history-feature is a legitimate, defensible choice here — but it should be a documented decision, not silence. If a retention window is ever chosen instead, the mechanism would mirror `live_sessions`' new cleanup (a `created_at`-based `DELETE`, gated behind the resolved status so an *unresolved* emergency's own record is never purged out from under an in-progress incident). |
| `journeys` | Retained indefinitely | Same reasoning — a user's journey history has direct product value (a personal safety log) |
| `community_reports` | Retained indefinitely | Same reasoning, plus a cross-user dimension: these are read by other users too (the community map), so any future retention/expiry decision needs to also consider whether an old report should stop being shown on the map before its row is actually deleted |
| `notification_tokens` | No expiry concept | Not urgent at current scale — a token becomes invalid only if a user uninstalls without signing out first. Worth revisiting if push-delivery failure rates ever correlate with stale tokens. |
| `emergency_contacts` / `profiles` / `subscriptions` | Retained indefinitely | Standard for account-scoped data — deleted only via account deletion (`ON DELETE CASCADE` from `app_users`, see `02-Constraints.md`), not by an age-based policy |

## GDPR / right-to-delete considerations

The `app_users` bridge table + `ON DELETE CASCADE` chain built in this pass (see `02-Constraints.md`) is the mechanism that makes a right-to-delete request completable in one statement: `DELETE FROM app_users WHERE id = ?` would now cascade every table listed in that chain atomically. This pass does **not** wire that single-statement delete into the existing account-deletion flow — the current multi-step, client-driven deletion sequence (tracked separately as BE-P0-3 in `docs/backend-audit/technical-debt-report.md`) is unchanged, per this pass's "no application-behavior changes" constraint. The schema now *supports* an atomic version of that flow; adopting it is a follow-up, not part of this hardening pass.

## Storage (photos/avatars) — unchanged from the prior audit's findings

No storage-object cleanup job exists for `community-reports`/`avatars`/`contact-avatars` buckets — an old report's photo, or a contact's avatar after the contact is deleted, is never removed from storage even after its referencing row is deleted. Out of scope for this pass (no retention *policy* has been decided yet for the referencing rows themselves, so a storage-cleanup job would have nothing authoritative to key off of); revisit once the emergency-data retention decisions above are actually made.
