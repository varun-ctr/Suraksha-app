# 6. Reliability Audit

## The core finding (fixed in this pass)

**Before this pass, a journey's entire safety guarantee depended on the JS engine staying alive and foregrounded for the full duration of the timer.** `journeyTimer`/`overdueTimer` were plain `setInterval`s incrementing a counter — these stop firing the moment iOS suspends the app's JS execution (which happens within seconds to at most a couple of minutes of backgrounding, well before any realistic check-in duration elapses) and never fire again if the app is killed. Since the auto-SOS escalation — the entire point of the feature — was driven exclusively by that counter reaching zero, **a user who started a 15-minute check-in timer and then locked their phone (the overwhelmingly common real-world case) received silent, complete loss of protection**: the countdown simply stopped advancing, "overdue" was never detected, and no automatic alert to trusted contacts was ever possible, with no error, no warning, and no indication to the user that anything had gone wrong. The existing local "are you safe?" notification still fired (it's OS-scheduled, independent of JS), but tapping it or ignoring it made no difference to the actual safety mechanism, which had already silently stopped working.

**Fix**: `domain/policies/journeyRecoveryPolicy.ts`'s `computeJourneyStatus()` derives elapsed/overdue/expired status from `Date.now() - startedAtMs` every time it's called — on every foreground tick, and critically, in a new mount-time recovery effect in `SafetyContext.tsx` that runs on every app launch/resume. This means:
- If the app resumes (foregrounded again) before the deadline: the countdown is instantly correct, no drift.
- If the app is killed and relaunched after the deadline already passed while it was gone: the recovery effect detects `phase: "expired"` immediately and triggers SOS right then, rather than silently never triggering it at all.
- If the app is simply reopened (for any reason — notification tap, unrelated navigation, a normal relaunch) after the grace period elapsed while backgrounded: same immediate, correct detection.

This does not achieve unconditional real-time background execution (see Background Execution Diagram) — it achieves **correctness the instant the app runs, for any reason**, which converts "silently and permanently broken the moment you lock your phone" into "correct on next resume, with one honestly-scoped residual gap" (see below).

## Section 12 — Failure Mode Analysis

| # | Scenario | Classification | Handling |
|---|---|---|---|
| 1 | GPS unavailable at journey start | Degraded | `useLocation()`'s `getCurrentLocation()` returns `null`; `sendJourneyAlerts` already handles a `null` coords gracefully (message omits location line) — journey timer itself doesn't depend on location at all, only the one-shot start alert does |
| 2 | Location permission revoked mid-journey | No impact | The journey timer has no location dependency once started — revoking permission affects only a *future* `getCurrentLocation()` call (e.g. if the user starts a new journey), not an already-running one |
| 3 | Low battery / Low Power Mode | No impact | No continuous GPS or background wake claimed by journeys at all — nothing for Low Power Mode to throttle |
| 4 | Airplane mode | Degraded, recoverable | Journey timer/overdue/auto-SOS logic has zero network dependency (pure AsyncStorage + wall clock). The one-shot backend record and contact alert degrade the same way already-audited SOS alerts do (native SMS fallback) |
| 5 | App killed | **Recoverable (fixed this pass)** | Mount-time recovery effect — see above |
| 6 | Phone reboot | **Recoverable (fixed this pass)** | Same recovery path as app-killed — a reboot is indistinguishable from a kill from the app's perspective, and `AsyncStorage` survives it |
| 7 | Storage full (AsyncStorage write fails) | Degraded, user-visible via existing logging | `saveActiveJourney`/`updateActiveJourney`/`clearActiveJourney` all try/catch and `logger.warn` on failure rather than throwing; a failed save means recovery won't be possible for that specific journey, but the live in-memory tick still works for as long as the app stays foregrounded |
| 8 | Location timeout | Not applicable | No location fetch is on the timer's critical path |
| 9 | Duplicate journeys | Not reachable | Single AsyncStorage slot + UI hides the start control while active — see Offline Sync Diagram |
| 10 | Backend unavailable | Degraded, non-blocking | `journeyRepository.startJourney`/`endJourney` failures are logged (`journey_db_write_failed` telemetry) and never block the local timer, which is the actual safety mechanism |
| 11 | Realtime disconnected | Not applicable | Journey has no realtime subscription (it's not a live-tracking session — that's SOS's `live_sessions` mechanism, already audited separately) |
| 12 | Location disabled entirely (device-wide) | Degraded | Same as #1/#2 — affects only the one-shot start-alert location, not the timer itself |
| 13 | Poor network | Degraded, non-blocking | Same as #10 |
| 14 | App backgrounded, never reopened before the deadline, and never reopened after | **Fatal, by platform constraint, not a code defect** | See "Residual gap" below — no client-side fix exists for this; flagged as the top Technical Debt item requiring a backend monitor |

## Residual gap — the one thing this pass cannot fully close from the mobile client

If the user backgrounds the app, the deadline (timer + grace period) passes, and the app is **never reopened again for any reason** before real danger occurs, no code is running to detect that and escalate. This is not a bug in this app's code — it is a fundamental property of non-critical-alert background execution on iOS (see Background Execution Diagram for why Significant Location Change / BackgroundTasks / a location-based background wake were all considered and rejected as false solutions to this specific problem). The architecturally correct fix — a server-side job monitoring the now-persisted `journeys` table for passed deadlines with no check-in — is out of mobile-client scope and requires backend access this environment doesn't have. It is the #1 item in the Technical Debt Report, not a silently-accepted gap: the local notification and instant-on-resume recovery meaningfully narrow this window (most real-world uses involve the phone being picked up again — for a call, a message, unlocking to check the time — well before the deadline passes), but they do not close it to zero.

## Summary

Of the reachable failure scenarios, all but one (#14) are recoverable, degraded-with-fallback, or not applicable to this feature's actual scope. The one severe gap this audit found — silent, complete loss of the auto-SOS mechanism on any backgrounding — is fixed. The one residual gap (#14) is honestly disclosed rather than papered over, with a concrete, correctly-scoped recommendation (server-side deadline monitoring) rather than a client-side workaround that would only create a false sense of security.
