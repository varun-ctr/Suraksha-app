# Database migrations

Two categories of SQL, applied in this order.

## 1. One-time bootstrap (manual, first time only)

Run these once, in order, in the Supabase SQL Editor. They create the app
schema and convert it to Firebase-auth ownership; some are destructive, so they
are intentionally **not** run by the automated runner.

1. `../../suraksha/supabase/DATABASE_SETUP.sql` — base tables (Supabase-Auth shape)
2. `../../suraksha/supabase/emergency_contacts.sql`
3. `../../suraksha/supabase/community_reports.sql`
4. `../../suraksha/supabase/walkthrough_seen.sql`
5. `../../suraksha/supabase/MIGRATE_FIREBASE_AUTH.sql` — **destructive**, one-time UUID→TEXT (Firebase uid) conversion; run after the tables above exist.

## 2. Ongoing numbered migrations (automated + tracked)

The files in this directory (`001_…`, `002_…`, `003_…`) are additive and
idempotent. Apply them with the runner, which records each in a
`schema_migrations` table and never applies one twice or out of order:

```sh
SUPABASE_DB_URL='postgres://…' pnpm --filter @workspace/api-server migrate
```

- `SUPABASE_DB_URL` is the Postgres connection URI from
  **Supabase → Project Settings → Database → Connection string**.
- Safe to run on every deploy — up-to-date is a no-op.
- Each migration applies inside a transaction together with its
  `schema_migrations` bookkeeping row, so a failure rolls back cleanly and the
  file is retried in full next run.

Current numbered migrations:

| File | Purpose |
|------|---------|
| `001_sos_idempotency_and_rate_limit.sql` | SOS idempotency cache + shared rate-limit counters + `increment_rate_limit` RPC |
| `002_email_otp_codes.sql` | Email-OTP code hashes (sign-in) |
| `003_cleanup_jobs.sql` | pg_cron job purging expired rows from the above + OTP codes (needs the pg_cron extension; falls back to a manually-callable function if unavailable) |

Add a new migration by dropping a `NNN_name.sql` file here with the next
number — the runner picks it up automatically.
