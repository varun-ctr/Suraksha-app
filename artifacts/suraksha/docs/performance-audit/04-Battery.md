# 4. Battery Usage

## Method

Every GPS-polling configuration, timer cadence, and background-execution mechanism was read directly from source. This app is explicitly safety-critical (SOS/journey tracking), so every recommendation below is evaluated against **"does not reduce safety"** as a hard constraint, per this pass's own brief — several genuine battery-cost patterns are documented as deliberate, justified trade-offs rather than "fixed," because reducing them would reduce the app's actual safety guarantees.

## GPS polling / location accuracy — reviewed, confirmed deliberate, not changed

`core/permissions/backgroundLocation.ts`'s `startLocationUpdatesAsync` call: `accuracy: Location.Accuracy.High`, `timeInterval: 10000` (10s), `distanceInterval: 10` (10m), `pausesUpdatesAutomatically: false`, a persistent Android foreground service (`killServiceOnDestroy: false`). **This is a fixed, non-adaptive configuration for the entire duration of an active SOS**, however long that runs — there is no code that reduces accuracy or lengthens the interval as a session ages.

**This is the single largest confirmed battery-drain design choice in the app, and it is not being changed in this pass.** The file's own header comments justify it: `watchPositionAsync` (foreground-only) stops delivering within seconds-to-minutes of backgrounding, which is exactly the moment live tracking matters most in a real emergency. An adaptive scheme (e.g., reducing accuracy after N minutes) would need real device/field validation to confirm it doesn't create a scenario where a trusted contact's live-tracking view goes stale during an actual emergency — validating that safely requires a real device and is explicitly out of what this pass could responsibly implement blind. **Recommendation, not implemented**: if battery complaints are observed in production telemetry (see `10-Production-Performance-Certification.md`'s observability section) for multi-hour SOS sessions specifically, consider a time-based step-down (e.g., `Balanced` accuracy after 30 minutes) validated on real hardware first.

Foreground `getCurrentLocation()` (`core/permissions/location.ts`) is a **one-shot** `getCurrentPositionAsync` call, not a recurring poll — used once per SOS trigger and once for the map screen's initial fix. Confirmed not a recurring battery cost.

## Heartbeat / timer intervals — reviewed

| Timer | Cadence | Backs off? | Checks `AppState`? | Assessment |
|---|---|---|---|---|
| `dbRetryTimer` (SafetyContext) | 15s, fixed | No | No | Deliberate — see below |
| Countdown/SOS-elapsed/journey-tick timers | 1s each | N/A (display-only) | No | Correctly always-on: these drive UI a user is actively looking at, or (journey tick) the auto-escalation logic that must keep working in the background |
| Sakhi chat retry | 2s/4s/8s | Yes | No (foreground-screen-scoped) | Already correctly implemented |

None of `SafetyContext`'s four timers check `AppState` — **this is correct, not a bug**: an active SOS's retry/tick timers must keep running whether the app is foregrounded or backgrounded (the Android foreground service keeps the JS runtime alive specifically so this works), since pausing them on backgrounding would directly reduce the safety guarantee the whole feature exists for. Flagging this explicitly as reviewed-and-intentional, not overlooked.

The `dbRetryTimer`'s fixed (non-backoff) 15s cadence is also deliberate, not a defect: an unconfirmed real emergency should be retried promptly and predictably, not with an ever-lengthening backoff that could leave a real SOS unconfirmed for minutes. This pass's actual fix to this timer (see `03-Memory.md`) was to stop it from being *reset* by every location ping — not to change its cadence or add backoff, both of which would be safety-reducing changes explicitly out of scope.

## Network frequency / wakeups

No polling exists for community/incident/journey status beyond the timers already covered above — confirmed via an exhaustive `setInterval`/`setTimeout` grep across `features/`. Every other network call is triggered by a specific user action (screen mount, form submit, pull-to-refresh) or the SOS-specific retry timer, not a background poll.

## Realtime subscriptions

Not used anywhere (see `03-Memory.md`/`05-Network.md`) — no battery cost from maintaining a realtime socket connection, since none exists.

## Notifications

Push notifications are delivered via the OS (Firebase Cloud Messaging / APNs), not a client-side poll — no battery cost pattern to review beyond the already-confirmed-clean listener lifecycle (`03-Memory.md`).

## Animations

The SOS pulse animation (`SosBottomSheet.tsx`) uses the legacy `Animated` API with `useNativeDriver: true` — per-frame interpolation runs on the native/UI thread, not the JS thread, which is the correct, low-overhead choice for a looping animation. No JS-thread wakeups per animation frame.

## Adaptive behavior — what exists vs. what doesn't

**Exists**: the Sakhi chat's retry backoff (2s → 4s → 8s → give up), which reduces network/wake frequency the longer a failure persists for a non-safety-critical feature.
**Does not exist**: any adaptive behavior for the location-tracking cadence during SOS/journey — by deliberate design (see above), since this app's core safety promise depends on consistent, high-frequency location delivery during an emergency.

## Battery optimizations recommended, without reducing safety

1. **Implemented this pass**: fixed the `dbRetryTimer` restart bug (`03-Memory.md`) — this is itself a minor battery win too, since a perpetually-restarting-but-never-firing interval was doing setup/teardown work (clearing and re-creating a JS interval, re-evaluating the effect) on every location ping for no benefit; the fixed version does that setup/teardown only on genuine phase transitions.
2. **Recommended, not implemented (needs real-device validation)**: a time-based accuracy step-down for very long (multi-hour) SOS sessions specifically, only if production telemetry (once configured) shows this is a real user complaint, not a hypothetical one.
3. **Recommended, not implemented**: none of the always-on 1-second UI timers (countdown, SOS-elapsed, journey-tick) should be touched — they're correctly matched to features that need second-level responsiveness (a countdown a user is watching; an escalation clock that must not drift).

## What would need real-device validation

Actual battery-drain percentage/mAh over a multi-hour SOS session, actual GPS chip wake-frequency at the OS level (vs. the JS-level `timeInterval` requested, which the OS may coalesce or adjust), and whether Android's Doze/App Standby buckets interact with the foreground service in a way that changes effective battery cost — none of these are measurable from source code alone and would need a real device with a battery-usage profiler (Android Studio's Energy Profiler, or Xcode's Energy Log). No number in this document claims to be a measured mAh/percentage figure.

## Verification

No functional code change was made specifically for battery in this pass beyond the `dbRetryTimer` fix already covered in `03-Memory.md` (verified there: `tsc`/`test` clean). Every other item in this document is review-and-recommend, per the explicit "without reducing safety" constraint.
