# Backend, Database & Infrastructure — Production Readiness Audit (Phase 5)

Date: 2026-07-25
Scope: `DATABASE_SETUP.sql`, `MIGRATE_FIREBASE_AUTH.sql`, `supabase/*.sql`, `api-server/migrations/*.sql`, `api-server/src/routes/*`, `api-server/src/lib/firebaseAdmin.ts`, every mobile-side repository in `repositories/` and its Supabase client wrapper. **No live Supabase project, dashboard, billing tier, or database connection is accessible from this environment** — every finding below comes from reading the actual SQL/TypeScript source, not from introspecting a running system. Where that distinction matters, it's called out explicitly.

**No mobile architecture was changed.** Two small, targeted mobile-side repository improvements were made (see "What changed in this pass" below) — everything else is review and recommendation, consistent with the "backend/database access not available from this environment" constraint established across every prior audit this session.

## Documents

1. [Database ER diagram](./er-diagram.md)
2. [Repository flow diagram](./repository-flow-diagram.md)
3. [RLS matrix](./rls-matrix.md) — **read this first if you only read one document**
4. [Transaction matrix](./transaction-matrix.md)
5. [Index report](./index-report.md)
6. [Performance report](./performance-report.md)
7. [Scalability report](./scalability-report.md) (assumes 1M users, per the brief)
8. [Disaster recovery plan](./disaster-recovery-plan.md)
9. [Technical debt report](./technical-debt-report.md) — full P0–P3 list
10. [Production readiness report](./production-readiness-report.md) — scores, monitoring/storage/background-processing recommendations, final verdict

## What changed in this pass (mobile-side, implemented and verified)

- **`repositories/supabase/supabaseClient.ts`**: added `.abortSignal(AbortSignal.timeout(10_000))` to every `sos_events`/`journeys`/`live_sessions` Supabase call — these previously had no timeout at all (unlike `core/network/apiClient.ts`'s calls to this app's own backend, which already did), meaning a degraded connection could leave an emergency-critical write hanging indefinitely instead of failing fast into the retry/offline-queue paths that already exist for exactly that case.

Everything else in this document set is **review and recommendation only** — no schema migrations, RLS policy changes, cron jobs, or Edge Functions were created or run, since this environment has no database or Supabase-project access.

## Verification

`npx tsc -p tsconfig.json --noEmit`: 0 errors. `pnpm run lint`: 0 errors (9 pre-existing-pattern warnings). `pnpm run test`: 82/82 passing (unchanged — this pass added no new mobile-side pure logic beyond the timeout wrapper, which has no independent business logic to unit-test). `npx madge --circular`: no circular dependencies across 203 files. `npx expo export --platform web`: builds clean.

## The one finding that matters most

**`supabase/community_reports.sql` grants the `anon` role unauthenticated SELECT and INSERT on the entire `community_reports` table**, with no ownership check at all (`USING (true)` / `WITH CHECK (true)`). Because the Supabase anon/publishable key is bundled inside the mobile app (by design — that's how Supabase's client-side auth model normally works, with RLS as the safety net), anyone extracting that key could read every user's safety-incident reports and insert forged ones — entirely bypassing the backend's own correctly-implemented Firebase-token verification, which this policy makes irrelevant for any caller willing to hit Supabase directly instead of through the backend API. See the RLS Matrix for the exact two-statement fix (`DROP POLICY` ×2 + `REVOKE`) — trivial to apply, zero functional impact, since the backend already prefers its service-role key over these anon grants.

## Final scores

| Dimension | Score |
|---|---|
| Backend Architecture | 8/10 |
| Database Design | 6/10 |
| Security | 5/10 |
| Scalability | 6/10 |
| Operational Readiness | 5/10 |

**P0: 3** (community_reports anon RLS; sos_events idempotency; non-atomic account deletion) · **P1: 6** · **P2: 3** · **P3: 3** — full detail in the Technical Debt Report.

**Estimated Backend Production Readiness: 68%**

## Certification verdict

**Not yet — conditionally, pending one specific, trivial, already-fully-specified fix** (the `community_reports` RLS gap). Once applied and verified, this backend is production-ready for the thousands-to-100k-user range immediately; the Index Report's recommendations should be completed before scaling meaningfully past that toward the 1M-user target this audit was asked to plan for. See the Production Readiness Report for the full reasoning.
