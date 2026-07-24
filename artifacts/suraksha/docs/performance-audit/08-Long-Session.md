# 8. Long Session Reliability

## Scenario assumed

The app remains open for several hours during a continuous journey or an active SOS, with multiple background/foreground transitions, network interruptions, and location changes over that period — exactly the scenario the brief specifies, and the scenario this app's core safety feature (SOS + journey tracking) is explicitly designed to survive.

## No memory growth — verified per mechanism, not assumed

Every stateful mechanism that runs for the duration of a long session was checked for unbounded growth (full detail and file:line evidence in `03-Memory.md`):

- **`AppContext.tsx`'s `contacts`**: hard-capped at 5, cannot grow.
- **`SafetyContext.tsx`'s `alertStatuses`**: fully replaced (not appended) on each dispatch, reset to `[]` on SOS end.
- **Background-location task**: stateless per invocation — only a single, overwritten `listener` reference at module scope; no historical-point array is ever accumulated, confirmed by reading the task body directly.
- **No coordinate-history/route array exists anywhere client-side** — `journeys.route_json` (the schema column that would back one) is confirmed dead/unwritten.

**Conclusion: no mechanism in this app accumulates memory proportional to session duration.** A 4-hour SOS or journey produces the same steady-state memory footprint as a 4-minute one, as far as this app's own code is concerned — the only external variable is whatever native modules (Google Maps SDK, Firebase, Sentry) do internally, which is outside this codebase's control and would need a real-device heap profile to verify independently.

## No listener accumulation — verified

Every listener/subscription registration was traced to its cleanup:
- Notification listeners (`app/_layout.tsx`): three `.remove()` calls in one effect cleanup, registered once for the app's lifetime (`Gate` doesn't remount during normal navigation) — cannot accumulate.
- Accelerometer shake detector: cleanup fires on every `enabled` toggle, not just unmount — confirmed it cannot double-register even if a user repeatedly toggles the "Shake to SOS" setting during a long session.
- Firebase auth-state listener: single canonical subscription, confirmed no redundant second listener exists anywhere.
- Background location start/stop: every `start` (SOS trigger or crash-recovery resume) is paired with a `stop` (cancel or provider unmount) — cannot double-start across a session's multiple background/foreground transitions, since `stopBackgroundLocationTracking()` is idempotent-safe (checks `hasStartedLocationUpdatesAsync` before calling `stop`).

## No stale timers — one real bug found and fixed

The `dbRetryTimer` dependency-churn bug (`03-Memory.md`) is exactly the kind of defect this long-session scenario is designed to surface: over a multi-hour SOS with continuous location updates, the timer could be reset dozens or hundreds of times without ever firing. **Fixed this pass** by moving `sos.coords`/`sos.address` to refs instead of effect dependencies — the timer now fires reliably every 15 seconds regardless of how many location updates arrive in between, for the entire duration of the session.

Every other timer in the app (countdown, SOS-elapsed, journey-tick) was confirmed to have airtight cleanup — React's guaranteed cleanup-before-recreate ordering means none of them can have two instances alive simultaneously, regardless of how many times their dependency changes over a long session.

## No duplicate subscriptions — verified

Covered above (listeners) and in `03-Memory.md` (Realtime — not used at all, so no subscription-duplication surface exists there either).

## Background/foreground transitions

- The background-location TaskManager task is registered once at module load and survives backgrounding/foregrounding by design (this is the entire reason it's registered at import time rather than lazily — see `01-Startup-Performance.md`).
- The new App Lock feature (prior security-hardening phase) correctly tracks background/foreground transitions via `AppState`, using a 30-second grace window so a long session with many brief app-switches (checking a notification, answering a call) doesn't force a repeated biometric prompt — reviewed here for its interaction with a long session and confirmed it adds no timer/listener leak risk (a single `AppState.addEventListener("change", ...)` subscription, cleaned up when the feature is disabled).

## Network interruptions

The `dbRetryTimer` fix directly improves this scenario: a network interruption during a long SOS now reliably retries every 15 seconds (not potentially zero times, as before the fix) until the write succeeds or the SOS ends. The Sakhi chat's bounded 3-attempt backoff-then-offline-fallback is unaffected by session length (it's scoped per-message, not per-session).

## Location changes over a multi-hour period

Confirmed the background-location task handles an effectively unbounded number of location updates over a long session without any accumulating cost (stateless per invocation, see above) — the fixed cadence (10s/10m, `Location.Accuracy.High`) is unchanged for the entire session by design (see `04-Battery.md` for why this isn't adaptive, and why that's a deliberate safety trade-off, not an oversight).

## What would need real-device validation

Actual multi-hour soak testing on a real device (leaving the app in an active SOS/journey state for 4+ real hours, with real background/foreground transitions and real network drops) to confirm the code-level guarantees above hold under real OS scheduling, memory pressure, and battery-saver interventions — this environment cannot run a multi-hour real-device soak test. Every claim in this document is a code-level guarantee (verified by reading the actual cleanup/dependency logic), not a measured multi-hour trace.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run test`: 100/100 passing. `npx madge --circular`: clean.
