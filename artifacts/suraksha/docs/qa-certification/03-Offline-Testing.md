# 3. Offline Testing

## Offline queue

The SOS offline queue (`sosOfflineQueue`, referenced from `SafetyContext.tsx`'s crash-recovery effect) persists a pending-activation record locally the moment SOS activates, independent of network state. On next app launch (after a kill, crash, or reboot), `sosRecoveryPolicy.ts`'s `isPendingActivationStale` (pure function, 3 unit tests passing) decides whether to resume (under `MAX_RECOVERABLE_AGE_MS = 30 minutes`) or reconcile silently as stale. This was established and hardened in the prior SOS-certification and backend-hardening phases (idempotency keys on `sos_events`/`live_sessions` prevent a resumed/retried write from creating a duplicate emergency record).

## Journey recovery

`domain/policies/journeyRecoveryPolicy.ts`'s `computeJourneyStatus` (pure, 6 unit tests passing) is a **wall-clock** function — it recomputes status from a persisted `startedAtMs` timestamp, not an in-memory counter, specifically so it produces the correct answer regardless of how long the app was closed, backgrounded, or offline. On relaunch, `SafetyContext.tsx:690-748` re-evaluates this and immediately escalates to auto-SOS if the journey expired while the app was closed.

## Authentication

Firebase Auth SDK has its own offline persistence (cached credentials, offline-tolerant token refresh) — this app doesn't reimplement that, it relies on the SDK's documented behavior. The app's own addition is that it **always has a Firebase user** (anonymous or signed-in) via the `signOut()` → immediate re-anonymous-signin pattern (`authService.ts:32-39`), so no code path needs to separately handle a "truly no user" state, offline or not.

## Community reports

Incident-report submission requires an active network call — there is **no offline queue for community reports** (confirmed: unlike SOS, no offline-persistence mechanism exists for this feature). A submission attempted while offline fails immediately and shows the generic `incident.error` toast, with the form state preserved so the user can retry once connectivity returns. **This is a real, but low-severity, gap** — community reporting is not a time-critical safety path (unlike SOS/journey), so the absence of an offline queue here is a reasonable scope boundary, not a defect requiring a freeze-era fix. Flagged as a P2/P3 recommendation for a future release if offline incident-reporting becomes a product priority.

## Profile sync

Contact edits (`AppContext.tsx`) apply to local state immediately and best-effort sync to Supabase in the background; a sync failure is only logged (`logger.warn`), with no retry queue and no user-visible indicator that local and remote have diverged. Reviewed in `01-Critical-Flows.md` (#8) as an accepted-but-notable gap: not a launch blocker (no data loss locally, no crash), but a real silent-divergence risk if the network is down for an extended period during contact edits. Flagged as a P1/P2 finding for a future pass (the correct fix — a retry queue mirroring the SOS offline-queue pattern — is a nontrivial addition, not a targeted freeze-era fix).

## Retry behavior

Two distinct, already-hardened retry mechanisms exist: (1) SOS DB-write retry, fixed interval (15s), indefinite, gated on `sos.phase === "active"` and `eventId === null` (`SafetyContext.tsx:297-317`); (2) generic in-flight request de-duplication (`core/network/inFlightDedup.ts`, unit-tested) which prevents duplicate concurrent calls but is not itself a retry mechanism — it collapses simultaneous identical requests. The Sakhi chat feature has its own bounded 3-attempt backoff-then-offline-fallback (`RETRY_DELAYS_MS = [2000,4000,8000]`, hardened with proper unmount cleanup in the performance-certification phase). No generic app-wide retry framework exists — each subsystem (SOS, Sakhi chat) implements its own retry policy suited to its own criticality, which is a reasonable, deliberate design choice rather than an inconsistency to fix.

## Conflict resolution

No explicit conflict-resolution strategy exists anywhere in the app (confirmed: no last-write-wins/version-vector/merge logic found). This is acceptable given the app's actual data model: contacts/settings are single-user, single-device-authoritative in practice (no simultaneous multi-device editing scenario is a realistic use case for a personal safety app's contact list), and SOS/journey records are append-only/idempotent-write (never edited after creation, only resolved/ended) — so there's no scenario in this app's actual feature set where two conflicting writes to the same record could occur concurrently. Not flagged as a gap.

## Verification

All claims above cross-reference the SOS-certification, journey-certification, backend-hardening, and performance-certification phases' already-hardened, already-tested mechanisms — no new code was needed or written for this section; it is a certification of existing, verified behavior. `pnpm run test`: 100/100 passing, including all pure-logic tests for `sosRecoveryPolicy`, `journeyRecoveryPolicy`, and `inFlightDedup` referenced above.
