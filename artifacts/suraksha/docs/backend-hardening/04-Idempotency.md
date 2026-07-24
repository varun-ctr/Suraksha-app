# 4. Idempotency — SOS Events, Journeys, Live Sessions

## The problem (P0-2, resolved)

`sos_events` had no server-enforced idempotency key or unique constraint — a retried insert after a lost response could, in a narrow window, create two rows for one real emergency. A client-side mitigation existed (`findRecentUnresolvedEvent`, a 5-minute lookback) but was best-effort, not structurally guaranteed. `journeys` already had a structural guarantee (client-generated UUID primary key, built in a prior pass); `live_sessions` did not.

## `sos_events` — new DB-enforced idempotency key

- **Schema**: `sos_events.idempotency_key TEXT` (nullable — safe for historical rows written before this column existed) + a **partial unique index** `(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL`. Migration: `api-server/migrations/005_emergency_data_idempotency.sql`.
- **Client**: `features/sos/context/SafetyContext.tsx`'s `idempotencyKeyRef` already generated one key per SOS activation and reused it across the countdown-timer write, the 15s db-retry timer, and the crash-recovery resume path (built in a prior pass, wiring was incomplete). This pass threads that same key through to every `insertSosEvent` call site.
- **Repository**: `domain/repositories/SosEventsRepository.ts`'s `insertSosEvent` now takes `idempotencyKey: string`. `repositories/supabase/sosEventsRepository.ts` passes it through. `repositories/supabase/supabaseClient.ts`'s `db.sosEvents.insert` now **upserts** on `(user_id, idempotency_key)` instead of plain-inserting whenever a key is supplied — a retried write with the same key is now a true, atomic, DB-enforced no-op. Callers that don't supply a key (none remain, but the fallback exists for safety) still plain-insert, unchanged from prior behavior.
- The existing `findRecentUnresolvedEvent` check remains in place as a harmless secondary/defense-in-depth layer — the DB-level upsert is now the authoritative mechanism.

Why nullable + partial: Postgres already treats `NULL <> NULL` in a full unique index, so a nullable column plus a partial index (`WHERE idempotency_key IS NOT NULL`) is safe to add against a production table with existing historical rows — no backfill required, no risk of the migration failing on old data.

## `journeys` — unchanged, already correct

`journeys.id` is a client-generated UUID (`Crypto.randomUUID()`), used directly as the row's own primary key. `journeyRepository.startJourney()` retries up to 3 times with exponential backoff, checking `db.journeys.getById(journeyId)` before each retry to adopt a possibly-already-succeeded prior insert rather than risk a duplicate. This was built in a prior pass and needed no changes — documented here because `live_sessions` (below) was extended to mirror it exactly.

## `live_sessions` — extended to the same client-generated-id + retry pattern

Previously, `startLiveSession` did a single plain insert with a server-generated `share_id` — a lost response with no retry meant the client had no way to know whether the session had actually started, and no way to safely retry (a retry would risk a second live-tracking row for the same emergency).

Now:
- `domain/repositories/LiveSessionRepository.ts`'s `startLiveSession` takes a **client-generated `shareId: string`** (the mobile client generates it via `Crypto.randomUUID()` in `SafetyContext.tsx`'s `fetchLocationAndStartTracking`, mirroring how journey IDs are generated).
- `repositories/supabase/liveSessionRepository.ts`'s `startLiveSession` now retries up to 3 times with exponential backoff (`domain/policies/retryBackoff.ts`, the same helper `journeyRepository` uses), checking `db.liveSessions.getByShareId(shareId)` before each retry to adopt a prior successful insert rather than risk a duplicate live session.
- `shared/types/database.ts`'s `LiveSessionInsert` gained an optional `share_id` field so the client can override the column's `DEFAULT gen_random_uuid()` with its own value — the column itself is unchanged.

This makes duplicate live-session creation from this code path structurally impossible (an exact `share_id` lookup, not a time-window heuristic), matching the guarantee `journeys` already had.

## Why this required no mobile UX/behavior change

Every change above is either purely internal to the repository layer (the upsert, the retry loop) or additive (a new nullable column, a new optional insert field). The public behavior of triggering SOS, starting live tracking, and starting a journey is byte-for-byte the same from the user's perspective — only the failure-mode guarantees improved.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors (9 pre-existing warnings, unrelated). `pnpm run test`: 82/82 passing (no new pure-logic surface was added — the retry loop mirrors `journeyRepository`'s existing, already-tested pattern; the upsert branch is a thin Supabase-client conditional with no independent business logic to unit-test in isolation from a live database). `npx madge --circular`: clean. `npx expo export --platform web`: builds clean.
