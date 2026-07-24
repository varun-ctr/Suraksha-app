# 3. Row Level Security Matrix

Source: `DATABASE_SETUP.sql` + `MIGRATE_FIREBASE_AUTH.sql` (which superseded the original `auth.uid()` policies with `auth.jwt() ->> 'sub'` ones, since Firebase uids aren't UUIDs) + `supabase/emergency_contacts.sql` + `supabase/community_reports.sql` + `api-server/migrations/001-002`. No live database connection exists in this environment — if these files diverged from what's actually deployed, this matrix reflects the files, not necessarily production.

| Table | SELECT | INSERT | UPDATE | DELETE | Anon access | Service-role access |
|---|---|---|---|---|---|---|
| `profiles` | Owner only (`jwt.sub = id`) | Owner only (same policy, `FOR ALL`) | Owner only | Owner only | ❌ None | Full (bypasses RLS, as always) |
| `emergency_contacts` | Owner only | Owner only | Owner only | Owner only | ❌ None | Full |
| `sos_events` | Owner only | Owner only | Owner only | Owner only | ❌ None | Full |
| `journeys` | Owner only | Owner only | Owner only | Owner only | ❌ None | Full |
| `community_reports` (per `DATABASE_SETUP.sql`) | **Any authenticated user** (by design — map display) | Owner only | Owner only | Owner only | ❌ None | Full |
| `community_reports` (per `supabase/community_reports.sql`) | ⚠️ **`anon` role: `USING (true)` — literally everyone, no auth at all** | ⚠️ **`anon` role: `WITH CHECK (true)` — no ownership check, no auth at all** | (not granted to anon) | (not granted to anon) | ⚠️ **Full read + insert** | Full |
| `subscriptions` | Owner only | Owner only | Owner only | Owner only | ❌ None | Full |
| `notification_tokens` | Owner only | Owner only | Owner only | Owner only | ❌ None | Full |
| `live_sessions` | Owner only (direct table) + **anyone with a valid, unexpired `share_id`** (via the `get_live_session` SECURITY DEFINER RPC, not a table policy) | Owner only | Owner only | Owner only | ❌ direct table; ✅ via RPC only, and only for one specific non-expired session | Full |
| `sos_idempotency_cache` | ❌ RLS enabled, zero policies | ❌ | ❌ | ❌ | ❌ | Full (only accessor) |
| `rate_limit_counters` | ❌ RLS enabled, zero policies | ❌ | ❌ | ❌ | ❌ | Full (only accessor) |
| `email_otp_codes` | ❌ RLS enabled, zero policies | ❌ | ❌ | ❌ | ❌ | Full (only accessor) |

## P0 finding: `community_reports`'s two conflicting policy sets

`DATABASE_SETUP.sql` and `supabase/community_reports.sql` both define policies for the same table, and **both can be simultaneously active** — Postgres RLS policies are permissive-by-default (OR'd together), so if `supabase/community_reports.sql` was ever run against a database that also has `DATABASE_SETUP.sql`'s policies, the `anon` role gains full read access to every report (including ones an app expects to eventually be `photo_url`-linked to private storage) and can insert an arbitrary row with any `user_id` string it likes, `WITH CHECK (true)` performing no validation at all.

**Context that limits (but doesn't eliminate) the real-world exposure**: the mobile app itself never talks to Supabase directly for this table — `communityReportsRepository.ts` goes through the backend API (`POST /community-reports`, `GET /community-reports/mine`), which verifies the Firebase token server-side and uses the **service-role key** (bypasses RLS entirely — the anon policies are irrelevant to this legitimate path). This means the anon grant is not needed for the app to function *at all*. It exists purely as attack surface: **the Supabase anon/publishable key is bundled inside the mobile app binary and is not a secret** (this is normal, expected Supabase usage — RLS is what's supposed to make it safe to embed). Anyone who extracts that key (trivial — it's client-side, by design) and calls the Supabase REST API directly, with no Firebase token at all, can read every community report and insert forged ones if these anon policies are active.

**Recommendation (exact SQL, not run — no DB access from this environment):**

```sql
DROP POLICY IF EXISTS anon_server_insert ON public.community_reports;
DROP POLICY IF EXISTS anon_server_select ON public.community_reports;
REVOKE INSERT, SELECT ON public.community_reports FROM anon;
```

This is safe to run with zero functional impact: the backend already prefers the service-role key (`getSupabaseClient()` in `community-reports.ts` — `SUPABASE_SERVICE_ROLE_KEY` first, anon key only as a fallback if the service-role key isn't configured). The correct fix for the *fallback* case is to ensure `SUPABASE_SERVICE_ROLE_KEY` is always set in the backend's environment, not to leave a permissive anon policy as a safety net — a safety net that itself is the vulnerability.

## Anonymous access review — everything else

Every other table correctly has zero anon access. The one deliberate, reviewed, necessary exception is `live_sessions`'s share-link lookup, and it's implemented the right way: **not** a table policy (which would leak every active session to anyone), but a `SECURITY DEFINER` function (`get_live_session`) that returns only the one row matching a caller-supplied `share_id`, filtered to `is_active = true AND (expires_at IS NULL OR expires_at > now())`, in a narrow public shape (`LiveSessionPublic` — no `user_id` exposed). This was already reviewed and confirmed correct in the SOS-hardening audit.

## Service-role access

Every table grants the service-role key full access by default (Supabase's standard behavior — service-role always bypasses RLS). This is correct and expected: `sos-alert.ts` and `community-reports.ts` both use it deliberately, with the owner derived from a **server-verified Firebase token**, never from client-supplied input — reviewed and confirmed clean of IDOR in both routes (the `community-reports.ts` route's own code comment documents a prior IDOR bug, since fixed, where `?user_id=` was read unauthenticated from the query string).

## Privilege escalation review

No path found where a user can act as another user or gain elevated privileges:
- Every owner-scoped table's policy compares against `auth.jwt() ->> 'sub'`, which is the verified subject claim from Supabase's own JWT verification (via the configured Firebase Third-Party Auth integration) — not client-supplied, not spoofable.
- No table grants `UPDATE`/`DELETE` to `anon`.
- No RLS policy references another table's data in a way that could be manipulated (no cross-table policy logic exists in this schema at all — every policy is a single self-referential ownership check).
- The one `SECURITY DEFINER` function (`get_live_session`) is narrowly scoped, has `SET search_path = public` pinned (preventing search-path-hijacking, a classic `SECURITY DEFINER` vulnerability class), and returns no privilege-relevant data.
- `increment_rate_limit` (api-server migration 001) is similarly `SECURITY DEFINER` + pinned search path + execute revoked from `PUBLIC`, granted only to `service_role`.
