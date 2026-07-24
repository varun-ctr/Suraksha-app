# 1. RLS Hardening — `community_reports`

## The vulnerability (P0-1, resolved)

Two separate SQL files created policies on the same table and neither dropped the other's:

- `DATABASE_SETUP.sql` / `MIGRATE_FIREBASE_AUTH.sql` created the correct, owner-scoped `authenticated`-role policy set.
- `supabase/community_reports.sql` additionally granted the **`anon`** role unauthenticated `SELECT`/`INSERT` (`USING (true)` / `WITH CHECK (true)`), plus a table-level `GRANT INSERT, SELECT ... TO anon`.

Postgres RLS policies are **permissive by default** — every applicable policy is OR'd together per operation. So both policy sets were live simultaneously: the correct one *and* the anon hole. Since the Supabase anon/publishable key ships inside the mobile app bundle (by design — RLS is supposed to be the safety net, not the key itself), anyone extracting that key could read every user's community safety report (locations, harassment/stalking/unsafe-area descriptions) and insert forged ones — completely bypassing this app's own correct server-side Firebase-token verification in `api-server/src/routes/community-reports.ts`, because that verification only matters to callers going through the backend, not callers hitting Supabase directly.

## Before / after

| Policy | Role | Operation | Condition | Status |
|---|---|---|---|---|
| `anon_server_insert` | `anon` | INSERT | `WITH CHECK (true)` | **Removed** |
| `anon_server_select` | `anon` | SELECT | `USING (true)` | **Removed** |
| `community_reports: auth read` | `authenticated` | SELECT | `true` | Kept |
| `community_reports: owner insert` | `authenticated` | INSERT | `auth.jwt()->>'sub' = user_id` | Kept |
| `community_reports: owner update` | `authenticated` | UPDATE | `auth.jwt()->>'sub' = user_id` | Kept |
| `community_reports: owner delete` | `authenticated` | DELETE | `auth.jwt()->>'sub' = user_id` | Kept |
| `GRANT INSERT, SELECT ... TO anon` | `anon` | — | — | **Revoked** |

After this pass, no policy or grant on `community_reports` targets `anon` at all. Only the four ownership-scoped `authenticated` policies remain in effect.

## Why every legitimate caller keeps working

1. **The mobile app** (`repositories/supabase/supabaseClient.ts`'s `communityReports.*`) always calls Supabase using the current signed-in Firebase session — every real client request already goes through the `authenticated` role, never `anon`. Removing the `anon` policies changes nothing for it.
2. **The backend** (`api-server/src/routes/community-reports.ts`) prefers `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely. It never needed, and never used, the `anon` grants.
3. **Moderator/admin access**: no such role or client-side moderation UI exists anywhere in this codebase today (`db.communityReports.listAll()` in `supabaseClient.ts` is defined but unreferenced by any feature). If a moderation surface is built later, it should run through the service-role key exactly like the backend's other routes — not need its own RLS carve-out.

## Migration

`api-server/migrations/004_community_reports_rls_hardening.sql`:
- Drops both `anon` policies (`DROP POLICY IF EXISTS`).
- Revokes the `anon` grant (`REVOKE INSERT, SELECT ... FROM anon`).
- Re-asserts the four correct `authenticated` policies verbatim, so the migration is a complete, self-contained statement of the correct end state (safe even against a database that never ran `MIGRATE_FIREBASE_AUTH.sql`, or where a policy was hand-edited since).
- Re-confirms `ENABLE ROW LEVEL SECURITY` is set.

The source file `supabase/community_reports.sql` itself was also corrected (not just the migration) so a **future fresh deployment** running that file from scratch doesn't reintroduce the hole.

Idempotent, reversible (rollback re-opens the hole — see the file's rollback block, included only for completeness; there is no legitimate reason to run it in production).

## Verification

Reviewed by direct SQL reading (no live Supabase project in this environment — see `docs/backend-hardening/10-Production-Checklist.md` for what must be confirmed once one is available: run the migration, then attempt an anonymous `select * from community_reports` and an anonymous insert using only the publishable key — both must now be denied).
