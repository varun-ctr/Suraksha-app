# 2. Journey State Machine

`JourneyState` (`features/sos/types.ts`) is unchanged in shape by this pass — `active`, `seconds`, `duration`, `overdue`, `overdueSeconds` — preserving every existing UI binding (`app/(tabs)/index.tsx` renders all five fields directly). What changed is how these values are *computed*: from wall-clock time via `domain/policies/journeyRecoveryPolicy.ts`, not from an incrementally-updated counter. See the Reliability Audit for why that distinction is the single most important fix in this pass.

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Active: startJourney()\n(persists startedAtMs locally +\nbest-effort Supabase journeys row;\nnotifies contacts once)

    Active --> Idle: checkInJourney() / endJourney()\n("I'm Safe" / manual end —\nclears local + backend record)

    state Active {
        [*] --> WithinDuration
        WithinDuration --> WithinDuration: tick (1s): recompute elapsed\nfrom wall clock — seconds shown\nto the user always matches\nDate.now() - startedAtMs,\nnever an independently-drifting counter
        WithinDuration --> Overdue: elapsed >= duration\n(computeJourneyStatus phase: "overdue")
        Overdue --> Overdue: tick (1s): grace-period\ncountdown, also wall-clock-derived
        Overdue --> Expired: grace period fully elapses\n(computeJourneyStatus phase: "expired")
        Expired --> [*]: triggerSOS() — journey state\nstays "overdue" underneath;\nthe SOS bottom sheet takes over\nthe screen (same as a manual SOS)
    }

    Idle --> Active: crash/background recovery on mount\n(persisted journey found, not expired)
    Idle --> Expired: crash/background recovery on mount\n(persisted journey found, already expired —\nauto-SOS fires immediately, no waiting\nfor "the ticks that should have happened")

    note right of Active
        journeyStartedAtMsRef anchors every
        computation. Whether the tick runs
        every second (foreground), resumes
        after a gap (backgrounded then
        foregrounded again), or the app was
        fully killed and relaunched, the very
        next evaluation of computeJourneyStatus
        against Date.now() is always correct —
        there is no "catching up" logic because
        there's nothing to catch up: the status
        was never actually wrong, only unobserved.
    end note
```

## Deterministic transitions — verified

| Transition | Guard | Verified |
|---|---|---|
| Idle → Active | `startJourney()` always sets `active:true` unconditionally — there is no "already active" guard | ✅ Matches original behavior (starting a new journey while one is active simply overwrites it — a deliberate, pre-existing UX choice not touched by this pass; the UI already hides the duration-picker while `journey.active`, so a double-start isn't reachable through normal navigation) |
| Active → Overdue | `computeJourneyStatus`'s pure boundary: `elapsedSec >= durationSec` | ✅ Unit-tested (`journeyRecoveryPolicy.test.ts`) at the exact boundary |
| Overdue → Expired | `overdueElapsedSec >= overdueGraceSec` | ✅ Unit-tested at the exact boundary |
| Expired → SOS | Guarded by `journeyAutoSosFiredRef` (in-memory) and `autoSosTriggered` (persisted) — fires at most once per journey | ✅ Both the live-tick path and the recovery path check this flag before calling `triggerSOS()` |
| Active/Overdue → Idle | `checkInJourney()` / `endJourney()` — both route through the same `endJourneyRecord()` helper, which clears local persistence, clears the wall-clock anchor, resets the guard refs, and ends the Supabase record best-effort | ✅ Single code path for both entry points — no way to end a journey without going through the same cleanup |
| Idle → Active (recovery, not expired) | Mount effect finds a persisted journey; `computeJourneyStatus` says `active` or `overdue` | ✅ Resumes into the exact matching UI state (including which countdown to show) rather than restarting from zero |
| Idle → Expired (recovery, already expired) | Mount effect finds a persisted journey; `computeJourneyStatus` says `expired` | ✅ Escalates to SOS immediately, guarded against re-firing via the persisted `autoSosTriggered` flag surviving across even a second recovery pass (e.g. a crash during the recovery effect itself) |

## No invalid transitions possible

There is no code path that can produce, for example, `overdue:true` while `active:false`, or a negative `overdueSeconds`/`seconds` — every value is derived in one place (`computeJourneyStatus`) from a `Math.max(0, ...)`-clamped elapsed calculation, then mapped into the `JourneyState` shape at the two call sites (the live tick and the recovery effect), both reviewed in this pass.
