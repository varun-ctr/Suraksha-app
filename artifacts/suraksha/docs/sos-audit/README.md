# SOS / Emergency Subsystem — Production Readiness Audit (iOS-first launch)

Date: 2026-07-23
Scope: `features/sos/`, `repositories/supabase/sosEventsRepository.ts`, `repositories/supabase/liveSessionRepository.ts`, `core/permissions/backgroundLocation.ts`, `core/permissions/location.ts`, `core/permissions/notifications.ts`, `core/analytics/sosTelemetry.ts`, `domain/policies/liveSessionPolicy.ts`, and the SOS-adjacent parts of `app.config.ts` and `app/_layout.tsx`. The backend (`artifacts/api-server/src/routes/sos-alert.ts`) was read and audited but not modified — it was already solid (idempotency cache, rate limiting, Zod validation).

This directory is the full deliverable set. Start here, then follow the links below for depth.

## Documents

1. [Architecture diagram](./architecture-diagram.md)
2. [SOS state machine](./state-machine.md)
3. [Emergency sequence diagram](./sequence-diagram.md) (happy path + crash-recovery path)
4. [Reliability audit](./reliability-audit.md) — all 17 named failure scenarios, classified
5. [FMEA](./fmea.md)
6. [Risk assessment](./risk-assessment.md)
7. [Security audit](./security-audit.md)
8. [Performance report](./performance-report.md)
9. [Test report](./test-report.md)
10. [Technical debt report](./technical-debt-report.md)
11. [Production readiness report](./production-readiness-report.md) (includes iOS readiness, P0–P3 issue lists, score, and release verdict)

## Summary

**Overall score: 8/10. Estimated production readiness: 85%.**

One P0 was found — this app had **zero iOS background execution capability**, meaning live location tracking during an active SOS silently stopped within seconds of the app being backgrounded, exactly when an emergency is most likely to involve the phone leaving the user's hand or the screen locking. This was fixed: `expo-task-manager` + `expo-location`'s background-capable `startLocationUpdatesAsync` API, `UIBackgroundModes` via the config plugin, and an "Always" location permission scoped to only be requested while an SOS/live-tracking session is actually active.

Alongside that fix, this pass also implemented an offline queue with crash recovery for in-flight SOS activations (at-least-once delivery, best-effort duplicate prevention pending a DB migration this environment can't perform), closed a zombie/duplicate live-session gap via a heartbeat-based `expires_at` mechanism, fixed a genuine pre-existing architecture violation (a presentational component owning the emergency-alert-dispatch side effect), and added privacy-safe SOS telemetry. `sosAlertService.ts` (backend Twilio + native SMS/call fallback + idempotency) and the backend `/sos/alert` route were both reviewed in depth and found already well-built — left unmodified.

### Critical issues (P0)

None outstanding — the one found was fixed in this pass.

### High-priority issues (P1)

1. `sos_events` has no server-enforced idempotency key/unique constraint — duplicate-write prevention is client-side best-effort. Needs a Supabase migration; this environment has no DB migration access.
2. No in-app path back to Settings when location permission is denied (the SOS flow still completes without location — this is a UX gap, not a delivery failure).
3. No Privacy Manifest (`PrivacyInfo.xcprivacy`) generated yet — requires a real `expo prebuild` against the final dependency set, not fabricated in this pass.
4. No distinct UI state for "automatic delivery failed entirely, please confirm manually" beyond the existing per-contact status badges.

### Medium issues (P2)

1. No real-time alerting/dashboard on the new SOS telemetry breadcrumbs (Sentry breadcrumbs are useful post-hoc, not proactive yet).
2. The 5-minute live-session heartbeat window is a reasoned estimate, not validated against real-device background-delivery cadence.
3. No max-contacts-reached UX nudge.

### Nice-to-haves (P3)

1. `sendJourneyAlerts` duplicates message-building logic instead of using the shared `emergencyMessage.ts` builder.
2. No correlation ID linking one SOS run's telemetry breadcrumbs together.

### What requires a real device / cannot be done in this sandbox

Background-location delivery is implemented and reasoned through carefully but has not been executed against real hardware or a genuine background-relaunch event — this sandbox has no native runtime. Real-device battery, location-acquisition-time measurement, and generating the Privacy Manifest all require the same thing: an actual build. See the production readiness report's release verdict for the specific pre-submission checklist.
