# 8. Performance Report

No physical device or profiler is available in this environment (sandbox, no native build/run access — consistent with every prior hardening pass this session). This report is therefore a **code-path analysis and estimate**, not a measured benchmark, and is labeled as such throughout.

## Trigger latency (tap → countdown UI visible)

Estimated **near-instant (<50ms)** — `triggerSOS()` is a single synchronous `setSos(...)` call plus a haptic; no network or disk I/O sits between the tap and the countdown UI appearing. Location fetch, live-session creation, and DB writes all begin in parallel with the countdown, not blocking it.

## Location acquisition time

Not measurable without a device. Governed entirely by `expo-location`'s `getCurrentPositionAsync` under the hood — typical cold-GPS-fix times on real hardware range from ~1-15s depending on sky visibility, cached-fix availability, and device. This pass did not change foreground acquisition; it only added the *background*-capable continuation via `startLocationUpdatesAsync` once tracking is underway. The UI does not block on this — the countdown/active transition proceeds regardless of whether a fix has arrived yet (see Reliability Audit #15).

## Backend response time (`/sos/alert`)

Bounded by the explicit `timeoutMs: 10_000` in `attemptBackendAlert`, plus one retry after a fixed 2s backoff — worst case ~22s before falling through to the native SMS/call fallback if the backend is fully unreachable. This is a deliberate bound, not an accident: a real emergency must never wait indefinitely on a network call before falling back to a mechanism (native SMS) that doesn't need the backend at all.

## Live-tracking update interval

- Foreground/background location updates requested at `timeInterval: 10000` (10s) / `distanceInterval: 10` (meters) — a reasonable balance between tracking freshness and battery/network use for a feature whose entire purpose is "someone else needs to know where I am, soon."
- Heartbeat/`expires_at` window is 5 minutes (30x the nominal update interval) — generous enough to absorb normal jitter/throttling without falsely expiring a session that's still genuinely updating, while still bounding how long a truly-dead session appears live.

## Battery impact

Not measurable without a device. Mitigations already in place at the code level:
- `distanceInterval: 10` avoids pushing updates for sub-10-meter movement noise.
- `accuracy: Location.Accuracy.High` is deliberately used (not `Highest`) — the audit's own directive to prioritize reliability over optimization argues against dropping this further, since a materially worse fix accuracy directly degrades the feature's core value (accurate location for rescuers).
- Live tracking only runs while an SOS (or journey) is actually active — there is no always-on background location subscription outside of an active emergency.

## Memory / render cost

- `SafetyContext`'s state updates are narrowly scoped (`sos`, `journey`, `alertStatuses`, `alertSending`) and memoized via `useMemo` for the context value — consumers re-render only on an actual state change, not on every provider re-render.
- `SosBottomSheet` remaining purely presentational (this pass's architecture fix) has a secondary performance benefit: its own effect/state churn (the removed `sendSosAlerts` call + local `alertStatuses`/`alertSending`) no longer re-runs on component remount (e.g. a screen navigation causing the bottom sheet to unmount/remount while `phase !== "idle"`), since that state now lives in the provider and simply flows down as props.

## Network requests during an active SOS

Per trigger: 1 live-session insert, 1 sos_events insert (+ retries only on failure), 1 `/sos/alert` POST (+ 1 retry only on failure), then 1 `live_sessions` update per background location tick (~every 10s while active). This is a small, bounded, mostly-idempotent request set — no request pattern found in this review that would scale unboundedly with time or trigger unbounded retries.

## Recommendation

Real-device battery and location-acquisition-time measurement should be performed before App Store submission — this is explicitly out of reach in the current sandboxed environment and is flagged as a pre-launch action item, not silently assumed to be fine.
