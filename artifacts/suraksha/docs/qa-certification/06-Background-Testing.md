# 6. Background Reliability

This section cross-references the prior performance-certification phase's `08-Long-Session.md` (which already covered a 4-hour-session assumption in depth) rather than re-deriving it, and adds the QA-specific test-case framing this phase requires.

## Journey running 4 hours

**Mechanism**: `computeJourneyStatus` (`domain/policies/journeyRecoveryPolicy.ts`) is a pure wall-clock function — status is recomputed from `Date.now() - startedAtMs`, not accumulated via an interval counter, so a 4-hour session produces the identical correct answer as a 4-minute one regardless of how many times the app was backgrounded/foregrounded/killed in between. No coordinate-history or route array is ever accumulated (confirmed dead/unwritten `journeys.route_json` column, cross-referenced with the backend audit) — memory footprint is flat across a 4-hour session, not proportional to duration.
**Test case**: Start a journey with a 4-hour duration, background/foreground the app repeatedly (at least 10 times) and lock/unlock the device throughout, confirm the elapsed-time display remains accurate to real wall-clock time at every check, and confirm no memory growth is observable via Xcode Instruments/Android Studio Profiler (real-device tooling required — not measurable in this environment).

## SOS recovery

**Mechanism**: `sosRecoveryPolicy.ts`'s `isPendingActivationStale` (3 unit tests passing) gates whether a pending SOS activation found on app launch should resume (< 30 minutes old) or reconcile as stale.
**Test case**: Trigger SOS, force-quit the app within the 30-minute window, relaunch, confirm the SOS resumes (countdown/active phase correctly restored, not reset to idle). Repeat with the app closed for over 30 minutes, confirm it's correctly treated as stale rather than incorrectly resumed.

## Background tracking

**Mechanism**: The background-location `expo-task-manager` task is registered once at module load (not lazily) specifically so it survives the app being backgrounded (this was the deliberate startup-sequencing decision documented in the startup-certification phase). Location updates use a fixed `10s`/`10m` high-accuracy configuration for the duration of an active SOS — a documented safety trade-off, not adaptive (performance-certification phase, `04-Battery.md`).
**Requires real-device validation**: actual OS-level background execution time limits (iOS's background location entitlement behavior, Android's battery-optimization allowlisting) are platform behaviors this environment cannot simulate.
**Test case**: Trigger SOS, background the app for an extended period (30+ minutes), confirm location updates continue arriving at roughly the expected 10-second/10-meter cadence (observable via the live-tracking share link, or via Sentry `sos_db_retry`/location-adjacent breadcrumbs).

## Location updates

Covered above and in `02-Emergency-Testing.md`'s GPS-unavailable/inaccurate sections.

## Notification delivery

**Mechanism**: A local notification is scheduled as a durability backstop for journey-overdue detection (`SafetyContext.tsx:758-773`), independent of JS-engine wake-up — this is the mechanism specifically designed to work even if the background JS tick doesn't fire.
**Test case**: Start a short-duration journey, background the app, wait past the overdue threshold, confirm the local notification fires even if the app was never brought back to foreground JS execution during that window.

## Background kill

**Mechanism**: iOS: a user-force-quit app does not resume background execution (platform limitation) — the app relies entirely on the relaunch-time recovery effect. Android: the background-location task may survive an app kill depending on OS battery-optimization settings, subject to the same relaunch-recovery mechanism regardless.
**Test case**: Force-quit the app during an active SOS/journey on both iOS and Android, relaunch after a delay, confirm the recovery effect produces the correct resumed/reconciled state on both platforms — expect (and document, don't treat as a bug) any platform difference in how much background tracking continued before relaunch.

## Resume

**Mechanism**: On resume (relaunch or foreground), `SafetyContext.tsx`'s recovery effects (`:421-468` SOS, `:690-748` journey) re-derive state from persisted timestamps rather than assuming continuity — this is what makes "resume" correct regardless of how long the gap was.
**Test case**: Confirm the countdown/elapsed-timer/status displays are immediately correct upon resume, with no visible "catch-up" animation or incorrect transient state.

## State restoration

**Mechanism**: Covered by the same recovery effects — SOS and journey state (phase, coords, eventId, contacts-alerted status) are all restored from persisted storage, not re-derived from scratch or reset. The App Lock feature's 30-second grace window (prior security-hardening phase) prevents a repeated biometric prompt from interrupting this restoration flow on frequent brief app-switches.
**Test case**: Confirm that after any of the above kill/resume scenarios, the SOS bottom sheet (or journey status card) renders with the exact same information a continuously-foregrounded session would have shown — no data loss, no incorrect phase, no orphaned "loading" state.

## What this phase could NOT verify (requires real-device validation)

Every "requires real-device validation" note above is real and specific — this environment has no iOS/Android device, simulator, or Instruments/Profiler access. The code-level guarantees (wall-clock recovery, persisted state, idempotent writes) are the strongest evidence available without one; they are necessary but not sufficient for a full background-reliability certification. A genuine multi-hour soak test on real hardware, across both platforms, covering lock/unlock/kill/reboot combinations, remains the outstanding validation step before this section can be marked fully closed.

## Verification

`pnpm run test`: 100/100 passing, including all pure-logic tests referenced above (`sosRecoveryPolicy`, `journeyRecoveryPolicy`). No code changed this phase.
