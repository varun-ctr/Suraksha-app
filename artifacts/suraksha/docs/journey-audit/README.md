# Journey Tracking Subsystem — Production Readiness Audit (Phase 4)

Date: 2026-07-24
Scope: `features/journey/`, the journey slice of `features/sos/context/SafetyContext.tsx`, `domain/entities/Journey.ts` (new), `domain/repositories/JourneyRepository.ts` (new), `domain/policies/journeyRecoveryPolicy.ts` (new), `repositories/supabase/journeyRepository.ts` (new), `core/analytics/journeyTelemetry.ts` (new), and their DI registration.

**Read this first**: "Journey Tracking" in this app is a **timed check-in feature** (start a timer, get auto-escalated to SOS if you don't check in), not continuous GPS route tracking. There is no destination picker, no continuous location breadcrumb trail, and no geofencing — the brief's 15-phase structure assumes a richer feature than exists today. This audit reviews and hardens what's actually there, and explicitly names every requested capability that doesn't exist (geofencing, adaptive GPS frequency, route tracking) as a scoped recommendation rather than fabricating it. See the Architecture Diagram's scope note for the full explanation.

## Documents

1. [Journey architecture diagram](./architecture-diagram.md)
2. [Journey state machine](./state-machine.md)
3. [Background execution diagram](./background-execution-diagram.md)
4. [Offline sync diagram](./offline-sync-diagram.md)
5. [Battery optimisation report](./battery-optimization-report.md)
6. [Reliability audit](./reliability-audit.md) — the core finding and fix
7. [Security audit](./security-audit.md)
8. [Performance report](./performance-report.md)
9. [Test report](./test-report.md)
10. [Technical debt report](./technical-debt-report.md)
11. [Production readiness report](./production-readiness-report.md) (score, P0–P3, certification verdict)

## Summary

**Journey Tracking Score: 8/10. Battery Efficiency: 10/10. Reliability: 8.5/10. Estimated production readiness: 88%.**

**The core finding**: before this pass, a journey's entire safety mechanism — the timer that detects "overdue" and auto-escalates to a real SOS — was driven by a plain `setInterval` counter. This silently and completely stops working the moment the app is backgrounded (a user locking their phone during a normal check-in journey — the overwhelmingly common real case) or killed, with zero indication to the user that their protection had lapsed. This is fixed: `domain/policies/journeyRecoveryPolicy.ts` derives elapsed/overdue/expired status from wall-clock time (`Date.now() - startedAtMs`) rather than an incrementing counter, and a new crash/background recovery effect in `SafetyContext.tsx` re-derives the correct status the instant the app runs again — on foreground resume, on relaunch after a kill, or after a device reboot — and immediately escalates to SOS if the deadline already fully passed while the app was away.

Alongside that fix, this pass also **completed the repository pattern for journeys** (the `journeys` Supabase table existed with a DB helper but zero code ever called it — now has a full domain entity, repository interface, Supabase implementation, and DI wiring), added journey-specific privacy-safe telemetry, and fixed a notification-rescheduling bug that would otherwise have shipped alongside the recovery feature (a resumed journey would have rescheduled a full-duration "are you safe?" reminder measured from the resume moment instead of the original deadline).

### Critical issues (P0)

None outstanding — the one found was fixed in this pass.

### High-priority issues (P1)

1. No server-side monitor exists for journeys whose deadline has passed with no check-in. This is the one gap the mobile client genuinely cannot close alone: if the app is never reopened after the deadline passes, no client-side code can run to escalate. The `journeys` table now has everything a backend job would need (`started_at`, `duration_minutes`, `ended_at`) — building that job is out of mobile-client scope for this pass.

### Medium issues (P2)

1. A failed journey-start backend insert is never retried (non-safety-critical — affects only the historical record, not the local timer).
2. No `durationMinutes` range validation at the repository layer (not reachable through the current fixed-preset UI).

### Nice-to-haves (P3)

1. No journey-history read path (`listForUser`) implemented — no UI need exists yet.
2. Mock-location spoofing detection not implemented anywhere in the app (shared concern with SOS's location capture, not journey-specific).

### What was explicitly reviewed and found not to apply (not built, not fabricated as done)

Geofencing, continuous route/breadcrumb tracking, distance-filter/speed/heading/altitude tuning, and adaptive GPS frequency all assume continuous location tracking, which this feature doesn't do. Each is named as a legitimate future-feature recommendation in the Technical Debt Report, following the same "flag as a product decision, don't build it silently" precedent used for biometric unlock and forced reauthentication in the earlier authentication-hardening passes.
