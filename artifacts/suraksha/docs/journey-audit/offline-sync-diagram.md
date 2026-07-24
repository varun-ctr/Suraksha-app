# 4. Offline Sync Diagram

## Scope note

Journey has no continuous location stream, so there is no "offline location queue" of GPS points to design (unlike SOS's live-tracking heartbeat). What *does* need offline-safe handling: (1) the local timer/persistence (must work with zero network at all — it's pure AsyncStorage + wall-clock math), and (2) the one-shot backend record (`journeys` row) and the one-shot "journey started" contact alert, both of which need graceful degradation when offline.

```mermaid
sequenceDiagram
    actor User
    participant Ctx as SafetyContext
    participant Storage as journeyPersistence.ts\n(AsyncStorage — always available, no network)
    participant Repo as journeyRepository.ts
    participant DB as Supabase journeys table
    participant Alert as sendJourneyAlerts()\n(backend Twilio → native SMS fallback)

    User->>Ctx: startJourney() — fully offline device
    Ctx->>Storage: saveActiveJourney(...) — succeeds unconditionally,\nno network required
    Ctx->>Ctx: local timer/tick/overdue/auto-SOS logic\nfully functional using only Storage + wall clock
    Ctx->>Repo: journeyRepository.startJourney(duration) [best-effort]
    Repo->>DB: insert — fails (offline)
    Repo-->>Ctx: Result.err — logged via trackJourneyEvent("journey_db_write_failed"),\nnever blocks the local journey from proceeding

    Note over Ctx: journeyDbIdRef stays null — the backend\nrow was simply never created for this\njourney. No retry loop exists for this\n(see Technical Debt — unlike sos_events,\nwhich does retry, a missed journey-start\nrecord is not itself safety-critical: the\nlocal timer is the actual safety mechanism)

    User->>Alert: startJourney also fires sendJourneyAlerts()\n[via useJourney.ts, not SafetyContext]
    Alert->>Alert: backend attempt fails (offline) →\nfalls through to native SMS compose\n(same fallback cascade already audited\nfor SOS — reviewed, found unchanged/correct)

    Note over User,DB: Network reconnects at some later point
    Note over Ctx: No reconnect-triggered retry exists for\nthe missed journeys-table insert — it is\nsimply never retried. Flagged as Technical\nDebt (P2): low severity, since the row is\nonly a historical/monitoring record, not\nload-bearing for the safety mechanism itself
```

## Guarantee: no *safety-relevant* state is ever lost

| What | Where it lives | Survives offline? | Survives app kill? |
|---|---|---|---|
| Journey timing (`startedAtMs`, `durationSec`, `overdueGraceSec`) | `AsyncStorage` via `journeyPersistence.ts` | ✅ Always — no network dependency at all | ✅ Read back on next launch by the recovery effect |
| Overdue/expired detection | Computed fresh from wall-clock time on every tick and every recovery | ✅ Doesn't require network | ✅ Doesn't require the process to have stayed alive |
| Auto-SOS escalation | `triggerSOS()` — and everything downstream of it (offline queue, DB retry, alert dispatch) already audited and hardened in the SOS pass | ✅ Inherits SOS's own offline-queue/retry guarantees | ✅ Inherits SOS's own crash-recovery guarantees |
| "Journey started" backend record (`journeys` table row) | Supabase, via `journeyRepository` | ❌ Best-effort only, no retry | N/A — not safety-critical, see above |
| "Journey started" contact notification | `sendJourneyAlerts()` (backend Twilio → native SMS fallback) | ✅ Falls back to native SMS compose, matching SOS's already-audited cascade | N/A — one-shot, not something to "recover" mid-flight |

## Duplicate-journey / conflict prevention

There is exactly one persisted-journey slot (`ACTIVE_JOURNEY_KEY`, a single AsyncStorage key, not a list) — starting a new journey while one is already persisted simply overwrites it, matching the existing (pre-this-pass) UX where the duration-picker UI is hidden while a journey is active, so a genuine double-start isn't reachable through normal navigation. No duplicate-row risk exists on the backend side either, since each `startJourney()` call performs exactly one `insert` (no retry loop that could double-insert, unlike `sos_events`'s retry-driven dedup concern) — the trade-off being that a failed insert is simply never retried (see above), not that it risks a duplicate.
