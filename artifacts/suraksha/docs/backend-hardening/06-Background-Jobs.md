# 6. Background Jobs

## Already existing (credit where due, unchanged by this pass)

`api-server/migrations/003_cleanup_jobs.sql`'s `cleanup_expired_operational_rows()`, scheduled via `pg_cron` every 15 minutes, purging `sos_idempotency_cache`/`rate_limit_counters`/`email_otp_codes`. Idempotent, `SECURITY DEFINER` + pinned `search_path`, degrades gracefully (raises a clear notice, doesn't fail the migration) if `pg_cron` isn't available.

## 1. Zombie live-session cleanup — extended in this pass

`cleanup_expired_operational_rows()` (`api-server/migrations/009_retention_and_background_jobs.sql`) now also runs:

```sql
DELETE FROM public.live_sessions WHERE created_at < NOW() - INTERVAL '30 days';
```

on the same existing 15-minute schedule — no new cron entry needed. See `05-Retention.md` for why 30 days and why keyed on `created_at` rather than `expires_at`.

Note this is distinct from the **write-time** zombie cleanup that already existed (`liveSessionRepository.startLiveSession`'s `endAllActiveForUser`, built in a prior pass) — that closes (`is_active = false`) a user's own stale sessions the moment they start a new one; this new cron-based cleanup instead *deletes* old rows regardless of whether their owner ever opens the app again, which the write-time mechanism structurally cannot do (it only runs when that same user takes an action).

## 2. Journey deadline monitor — new in this pass

**The gap**: the mobile client's own wall-clock tick (`features/sos/context/SafetyContext.tsx`) is the only thing that detects an overdue journey and auto-escalates to SOS, and it only runs while the JS engine is alive. If the app is killed and never reopened before the deadline+grace period passes, nothing ever notices server-side.

**Design — split between SQL detection and Edge Function escalation**, since SQL alone cannot send an SMS:

- **`journey_escalations`** table (`journey_id UUID PRIMARY KEY REFERENCES journeys(id) ON DELETE CASCADE, escalated_at TIMESTAMPTZ`) — one row per journey the server has already escalated. Its mere existence is the idempotency guard against re-alerting the same journey on a later run.
- **`get_overdue_journeys()`** — a `SECURITY DEFINER` SQL function (service-role-only execute) returning journeys where `ended_at IS NULL`, `duration_minutes IS NOT NULL`, no row yet exists in `journey_escalations`, and `started_at + duration_minutes + 60s grace < NOW()`. The 60-second grace matches `OVERDUE_GRACE_SEC` in `SafetyContext.tsx` exactly — if that constant ever changes, this function must be updated to match.
- **`supabase/functions/journey-deadline-check/index.ts`** — a new Supabase Edge Function (Deno), **written but not deployed** (no Supabase project access in this environment). Calls `get_overdue_journeys()` via RPC with the service-role key, and for each match: inserts into `journey_escalations` **first** (so a concurrent/overlapping invocation's insert fails on the PK conflict and skips straight past — guaranteeing at most one alert per journey even under overlapping cron runs), then fetches that user's `emergency_contacts` (service-role bypasses RLS) and sends an SMS directly via Twilio's REST API.

### Why the Edge Function sends SMS directly rather than calling `POST /sos/alert`

`api-server/src/routes/sos-alert.ts`'s `/sos/alert` requires a verified end-user Firebase ID token — there is no server-to-server/machine-auth path on it, and building one is out of this pass's scope. The Edge Function instead duplicates the minimal Twilio-call + phone-normalization logic (`normalizePhone`, mirrored exactly from `api-server/src/lib/phone.ts` — duplicated rather than imported because this function runs on Deno and `api-server` runs on Node, with no shared module boundary between the two runtimes today).

### Deliberately NOT added: new columns on `journeys` itself

`docs/journey-audit/backend-contract.md` (a prior pass's specification) proposed adding `deadline_at`/`outcome`/`escalation_reason`/`completed_at`/`cancelled_at` columns to `journeys`. This pass takes a narrower approach instead: the deadline is fully computable from already-existing columns (`started_at + duration_minutes`), and "already escalated" is tracked in the new sibling `journey_escalations` table. This keeps the safety-critical `journeys` table itself untouched and requires **zero mobile-app code changes** — the trade-off is that the server can't (yet) distinguish *why* a journey ended, which is acceptable since the mobile client already tracks that locally (`domain/entities/JourneyOutcome.ts`) and this monitor exists purely as a backstop for the one case where the client-side mechanism never got to run at all.

### Scheduling (not wired in this pass — requires project-specific configuration)

Journey grace periods are tens of seconds to a few minutes, so this monitor needs to run roughly **every 1 minute** — much more frequent than `pg_cron`'s typical use here. Rather than wiring `pg_cron` + the `pg_net` extension to make an HTTP call out to an Edge Function from inside Postgres (which would require hardcoding a project-specific Edge Function URL and a shared secret into a checked-in SQL file — inappropriate for a migration), the recommended path is Supabase's own **Scheduled Edge Functions** (Dashboard → Edge Functions → your function → Cron, or a `schedule` entry in `supabase/config.toml`) at `* * * * *`. See `08-Migration-Guide.md` for exact deployment steps.

- Should alert engineering (not end users) if the Edge Function itself fails or times out repeatedly — this monitor is itself safety-critical infrastructure once deployed, and its own failure mode needs observability (see `07-Monitoring.md`).

## 3. Notification-token cleanup — not implemented, not urgent

No expiry concept exists for stale push tokens today. Not a real problem at current scale (a token only goes stale if a user uninstalls without signing out); revisit if push-delivery failure rates are ever observed correlating with stale tokens.

## 4. Rate limiting — already implemented, unchanged

`increment_rate_limit` RPC (`api-server/migrations/001`), atomic, service-role-only. No further work needed.
