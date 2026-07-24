# 5. Network Efficiency

## Fixed in this pass

### 1. In-flight GET request de-duplication (`core/network/apiClient.ts`)

**Before**: `apiFetch()` had no request de-duplication at all — a fast double-tap on the map screen's category chips (no `disabled` guard while `loadingCategory === cat.key`, only a spinner shown) fired two concurrent, identical `/nearby-places` requests.
**Fix**: extracted a small, generic, unit-tested helper (`core/network/inFlightDedup.ts`, `dedupeInFlight`) and applied it to every GET request in `apiFetch`. A second call for the same path while one is already outstanding awaits the first one's result instead of firing its own network request. **Scoped to GET only** — POST/DELETE call sites (`/sos/alert`, OTP, `/auth/account`) are completely unaffected and go straight through, since they already carry their own call-site-specific idempotency-key/retry semantics that must never be silently intercepted by a generic layer.
**Correctness detail**: a `Response` body can only be consumed once, so every caller — including the one that triggered the actual fetch — receives `response.clone()`, never the shared original. This was verified against the Fetch API's documented `clone()` contract, not assumed.
**Why this required no UI change**: the fix lives entirely inside the network client; `map.tsx` itself was not touched for this specific fix (unlike the marker-memoization fix in `02-Rendering.md`, which did touch `map.tsx` but only added a `useMemo` wrapper, not new UI).

### 2. In-flight de-duplication for `db.profiles.getById` (`repositories/supabase/supabaseClient.ts`)

**Before**: two independent, unrelated modules — `LanguageContext.tsx`'s post-sign-in language sync and `useLoginScreen.ts`'s post-sign-in walkthrough-seen check — each call `db.profiles.getById(uid)` within moments of each other on every sign-in, with no coordination between them.
**Fix**: applied the same `dedupeInFlight` helper to this one query method. **No TTL/staleness window** — this only collapses genuinely concurrent calls; a call made after the first has already resolved always issues a fresh query, so no stale profile data is ever served.
**Why a shared helper instead of two one-off fixes**: both problems (map.tsx's double-tap, the sign-in double-fetch) are the same underlying pattern — "two near-simultaneous callers for identical data" — so one generic, tested utility fixes both and is available for any future call site with the same shape, rather than two bespoke, undertested inline fixes.

### 3. Removed unused dependency: `@tanstack/react-query`

Confirmed via a whole-repository grep — zero imports anywhere in the app. Removed from `package.json`; `pnpm install --filter @workspace/suraksha` was run to keep `pnpm-lock.yaml` in sync (a clean 3-line diff, confirmed). Metro only bundles what's actually imported, so this had zero runtime bundle-size impact either way — the value is dependency-graph/install-footprint hygiene, not a measurable runtime win.

## Reviewed, not changed (with reasoning)

- **Uniform `.select("*")` across every Supabase table helper** (`repositories/supabase/supabaseClient.ts`): over-fetches columns compared to an explicit column list, but every table in this schema is documented (prior backend audit) as small and flat with no blob/large-text columns — the realistic byte-cost difference is small. Rewriting all 7 tables' every method to an explicit column list would be a large, mechanical, cross-cutting diff requiring every consumer to be individually cross-checked for exactly which fields it reads (a real risk of silently breaking a consumer that reads a field not included in a hand-picked list) — disproportionate risk for the schema's documented size. Not changed.
- **Missing `.limit()` on a few `listForUser` queries** (`sos_events`, `journeys`, `community_reports` direct-Supabase-client methods): traced actual call sites and confirmed **none of these three methods are called from any screen or hook in the current app** — the mobile app's community-reports "mine" list goes through the backend's `/community-reports/mine` route (which already has appropriate handling), not this direct-client method; journeys/SOS history browsing isn't a shipped feature. Since these are dead code paths today, adding a limit has zero measurable effect on any current behavior — flagged as a low-priority (P3) recommendation for whichever future feature first calls them, not implemented against unused code in this pass.
- **`GET /community-reports/mine` (backend route) has no `.limit()`**: user-scoped (one user's own reports), not cross-user — low realistic risk, consistent with the prior backend audit's own assessment. Not changed.
- **No compression/`Accept-Encoding` handling in `apiClient.ts`**: not needed — React Native's underlying network stack (OkHttp on Android, NSURLSession on iOS) handles gzip automatically; this is normal, not a gap.

## Realtime traffic

Supabase Realtime is not used anywhere in this app (confirmed, whole-repo grep, zero matches for `.channel(`/`postgres_changes`) — everything is poll/fetch-based. This means there is no realtime-channel network/battery cost to optimize, but also no live-update mechanism for e.g. a live-tracking viewer, which would need to re-poll rather than subscribe — noted as an existing architectural characteristic, not a defect introduced or found in this pass.

## Offline queue / retry traffic

`features/sos/services/sosOfflineQueue.ts` is a pure local-persistence layer — it performs no network calls itself. The actual retry traffic comes from `SafetyContext.tsx`'s `dbRetryTimer` (fixed in `03-Memory.md`/`04-Battery.md`): a fixed 15-second cadence, no exponential backoff, for as long as an SOS is active and unconfirmed. This is deliberate (a real emergency's record must be retried promptly, not backed off), and — after this pass's fix — now actually fires reliably every 15s instead of being perpetually reset by incoming location pings.

## Caching that already existed (confirmed, not changed)

- `weatherRepository.ts`: a 10-minute, lat/lng-tolerance-based cache — already correctly implemented.
- Backend's `/nearby-places`: a 5-minute in-memory cache keyed by category+rounded-coordinates (confirmed in `api-server/src/routes/nearby-places.ts`) — already correctly implemented.
- `core/permissions/location.ts`'s `reverseGeocode` has **no cache** — every call hits the OS geocoder (native) or Nominatim (web) fresh. This is an inconsistency with the weather cache (both are driven by the same `point` value in some screens), but its current real-world impact is low since the only caller (`useIncidentScreen.ts`) is guarded to only call it once per screen mount (`if (point && !address)`). Documented as a minor, low-priority (P3) finding, not fixed — adding a cache here would need to consider reverse-geocoding accuracy requirements (a stale cached address for a different-but-nearby coordinate could matter for an incident report) that this pass isn't positioned to resolve safely without product input.

## Payload sizes / compression

No unusually large response payloads were found — every backend route reviewed returns small, flat JSON (confirmed in the prior backend audit, unchanged by this pass).

## What would need real-device/production-telemetry validation

Actual frequency of the map-screen double-tap scenario in real usage (this pass fixes the *mechanism*, not a measured incidence rate); actual network-latency improvement from the two de-dup fixes (the fix eliminates a redundant round-trip when it occurs, but how often it occurs in production is a telemetry question, not a code-review one — see `10-Production-Performance-Certification.md`'s observability notes).

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run test`: 100/100 passing (including 5 new tests for `dedupeInFlight` covering concurrent-call collapsing, post-settlement freshness, per-key isolation, rejection handling, and registry cleanup). `npx madge --circular`: clean.
