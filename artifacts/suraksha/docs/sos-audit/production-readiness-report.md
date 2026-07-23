# 11. Production Readiness Report — SOS / Emergency Subsystem

## Scope recap

This audit covered the SOS and emergency subsystem only (trigger, countdown, alert dispatch, location capture, live tracking, journey escalation, offline resilience, crash recovery) for an iOS-first launch, per the explicit brief: treat this as life-critical software, always prefer reliability over performance/elegance, at-least-once delivery over best-effort.

## iOS Readiness (Section 14)

| Item | Status | Detail |
|---|---|---|
| Background Modes | ✅ Done this pass | `UIBackgroundModes: ["location"]` is written by the `expo-location` config plugin (`isIosBackgroundLocationEnabled: true`) rather than hand-edited, so it can't drift out of sync with the plugin's own Info.plist wiring |
| Location permission flow | ✅ | Foreground ("When In Use") requested at first location use (pre-existing); "Always" requested only when an SOS/live-tracking session actually starts (`startBackgroundLocationTracking`), scoped exactly as directed — never requested speculatively at app launch |
| Info.plist usage strings | ✅ | Both `locationWhenInUsePermission` and the new `locationAlwaysAndWhenInUsePermission` strings are explicit, accurate, and explain the "why" in user-facing language (App Review commonly rejects vague permission strings) |
| Critical Alerts | Not applicable | Critical Alerts require a special Apple entitlement (`com.apple.developer.usernotifications.critical-alerts`) granted only to specific app categories after a request process; this app's push notifications are informational (journey check-in reminders, contact acknowledgements), not alarm-clock-style critical alerts. Not pursued — would require an Apple entitlement request outside engineering scope, and the SOS flow's actual reliability doesn't depend on it (the emergency signal is the outbound SMS/call/live-location-share, not an inbound push to the victim's own device) |
| APNs | Unchanged, reviewed | Push token registration/deregistration (`core/permissions/notifications.ts`) reviewed in this pass (Section 9) and found already correctly handling rotation (delete-stale-then-upsert) and cleanup (deregister on sign-out); not modified since already correct |
| BackgroundTasks | Reviewed, decided against | Considered `expo-background-fetch`/BGTaskScheduler as a supplementary periodic wake-up mechanism; decided the background *location* task (via `expo-task-manager`, driven by real location deltas rather than a periodic OS-scheduled wakeup) is the correct primitive for this use case — BGTaskScheduler's minimum-15-minute, best-effort, not-guaranteed-to-run semantics would be strictly worse for an active emergency than the continuous location-delivery task already implemented |
| Privacy Manifest | ⚠️ Open (R1-3) | Not generated in this pass — doing so accurately requires running the real `expo prebuild`/Xcode tooling against the final dependency set, which this sandboxed environment cannot do. Flagged as a required pre-submission step, not silently skipped or fabricated |
| Battery | Reviewed, estimated only | See Performance Report — `pausesUpdatesAutomatically: false`, `distanceInterval: 10`, `Accuracy.High` (not `Highest`) are all deliberate battery/reliability trade-offs; real-device measurement still needed before launch |
| App Review compliance | Reviewed | Location usage strings clearly explain the emergency-safety purpose; background location is scoped to only run during an active SOS/journey, not continuously — both align with Apple's stated expectations for justified background-location use (emergency/safety apps are an explicitly recognized justified category in Apple's review guidelines) |

## P0 issues

**None outstanding.** One P0 was found and fixed during this audit (zero background execution capability for live tracking — see Risk Assessment and FMEA).

## P1 issues (should fix before launch, non-blocking)

4 items — see Risk Assessment: no server-enforced `sos_events` idempotency constraint (requires DB migration access this environment lacks), no location-denied Settings deep-link, no generated Privacy Manifest, no distinct "manual fallback needed" UI state for a fully-failed automatic dispatch.

## P2 issues

3 items — see Risk Assessment: no real-time alerting on SOS telemetry, unvalidated (estimate-only) heartbeat window, no max-contacts UX nudge.

## P3 issues

2 items — see Risk Assessment: journey-alert message duplication vs. the shared builder, no cross-breadcrumb correlation ID.

## Acceptance criteria checklist (from the brief)

| Criterion | Status |
|---|---|
| No UI regressions | ✅ — `SosBottomSheet`'s visible behavior, copy, and layout are unchanged; only its *ownership* of alert-dispatch state moved to the provider |
| No route changes | ✅ — no navigation/routing files touched |
| Repository pattern preserved | ✅ — all new Supabase access goes through `sosEventsRepository`/`liveSessionRepository`, resolved via DI in component code |
| DI preserved | ✅ — one documented, justified exception (`backgroundLocation.ts`'s direct repository import for headless-task use), consistent with the two pre-existing exceptions from the auth-hardening pass |
| No architecture violations | ✅ — the one pre-existing violation found (`SosBottomSheet` owning alert dispatch) was fixed, not left in place |
| No TypeScript errors | ✅ — `tsc --noEmit` clean |
| No ESLint errors | ✅ — 0 errors (8 pre-existing-pattern warnings, not architecture-boundary violations) |
| All existing tests pass | ✅ — 58/58 pre-existing tests still pass |
| New reliability tests added | ✅ — 5 new tests (`sosRecoveryPolicy`, `liveSessionPolicy`) |
| No circular dependencies | ✅ — `madge --circular` clean across 186 files |
| At-least-once SOS delivery | ✅ — offline queue + DB-write retry + crash recovery together ensure a triggered SOS's DB record and alert dispatch are eventually completed, not silently dropped by a network blip or process kill |
| Duplicate SOS prevention | ⚠️ Best-effort — client-side dedup window closes the practical majority of cases; a DB-enforced constraint (TD-1) is the structurally complete fix and requires migration access not available here |
| Offline queue implemented | ✅ — `sosOfflineQueue.ts` + crash-recovery mount effect in `SafetyContext.tsx` |
| Background execution verified | ⚠️ Implemented, not device-verified — requires a native rebuild and a real device/simulator to confirm actual OS-level background delivery behavior, which this sandboxed environment cannot run. Code-path review only |
| Live tracking resilient | ✅ — background-capable delivery, zombie-session cleanup, heartbeat-based staleness detection |
| iOS production-ready | ⚠️ Mostly — one open item (Privacy Manifest) requires a real prebuild to close, and device-level verification of background delivery/battery is still needed |

## Overall Score: 8/10

## Estimated Production Readiness: 85%

The remaining 15% is concentrated in exactly two things this sandboxed environment cannot do: **(1)** a real device/simulator run to verify actual iOS background-location delivery behavior end-to-end (implemented and reasoned through carefully, but never executed against real hardware or a real background-relaunch event), and **(2)** the Privacy Manifest, which requires a genuine `expo prebuild` against the final dependency set to generate correctly rather than being guessed. Everything within reach of static analysis, code review, and the available test runner — architecture, reliability logic, offline queue, crash recovery, live-session hygiene, security/RLS posture — is verified and in good shape.

## App Store release approval verdict

**Conditional approval — not yet cleared for submission.** The engineering work in this pass closes the one P0 (background execution) and materially improves reliability across offline handling, duplicate prevention, and live-tracking hygiene, with 0 TypeScript/ESLint errors and all tests passing. Before actual App Store submission, the following must happen outside this environment:

1. A real device build (`eas build` or local Xcode) to verify background location delivery actually survives backgrounding, a kill, and a background relaunch as designed — this cannot be validated in a sandbox with no native runtime.
2. Generate and bundle the Privacy Manifest against the final dependency tree.
3. Address the 4 P1 items in the Risk Assessment, at minimum the location-denied Settings affordance and the "manual fallback needed" UI state, both of which are small, contained UI additions.
4. Real-device battery and location-acquisition-time measurement (Performance Report).

None of these four are architectural — they are verification and small-UI-affordance work, not redesign. Once (1) and (2) are done and confirmed working on a real device, this subsystem should be considered ready for submission.
