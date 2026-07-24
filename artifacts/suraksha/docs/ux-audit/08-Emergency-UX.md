# 8. Emergency UX

This is the most safety-critical section of the certification. Suraksha's core purpose is SOS/emergency alerting and journey (walk-with-me) tracking, so every finding here was verified against actual code — file:line — rather than assumed, and every proposed change was weighed specifically against "does this reduce or increase the risk of a missed, delayed, or accidentally-triggered/cancelled emergency."

## Activation mechanism

Single tap (not a hold — despite the component being internally named `HoldSOSButton`, `app/(tabs)/index.tsx:183` uses `onPress`, not `onLongPress`) fires a **3-second countdown** (`COUNTDOWN_START = 3`, `SafetyContext.tsx:75`) with a visible, always-present Cancel button before transitioning to the active alert state. The button's own subtext discloses the cancel window *before* the user even taps ("3-second cancel window," `sos.cancelWindowHint`). **Assessment**: deliberate, disclosed friction — correctly balances "fast enough in a genuine emergency" against "not a single accidental tap away." **No change needed.**

## Cancellation

Both countdown-phase Cancel and active-phase "I'm Safe" are single-tap with no confirmation dialog — cancellation is at least as fast as activation, which is the correct design (a user should never be deterred from cancelling a false alarm by extra friction). **Friction risk identified**: in the active phase, "I'm Safe" sits at the bottom of a scrollable panel, below the location and contacts panels (which can hold up to 5 contacts, each with its own 3-button action row) — on a small screen with several contacts, reaching it may require scrolling. **Not changed this pass**: reordering the active-SOS layout to guarantee "I'm Safe" is always on-screen without scrolling is a structural layout change to the single highest-stakes screen in the app, and doing it safely requires real-device verification across screen sizes that this environment cannot provide. Flagged as a **P1 finding requiring real-device validation** before any layout change is attempted.

## Countdown UI glanceability

Large text (72px), high contrast (white on a dark purple/near-black gradient), accompanied by haptic pulses on every tick. **Compliant, no gap** — good for both stress and low-light legibility.

## Journey expiry / escalation clarity

**Gap identified, not fixed this pass**: the auto-SOS escalation behavior is not disclosed to the user *before* starting a journey — the start screen only describes the feature generally ("Time your trip and share your location..."); the specific auto-SOS-on-overdue mechanic is first mentioned only once a journey is already overdue. Once overdue, the 60-second grace window does correctly offer both "I'm Safe" and "Send SOS Now" with clear countdown copy — so the *in-the-moment* experience is good, only the *upfront disclosure* is missing. **Not fixed this pass**: the correct fix is a content addition to the journey-start screen copy, which is safe in principle, but requires locating and rewriting the exact start-flow copy across every locale-consuming call site without disturbing the flow's layout — given the volume of other fixes already made this pass, this is deferred as a **P1 recommendation** for the next scheduled release rather than rushed in alongside everything else.

## One-handed / thumb-zone reach

The SOS button is embedded mid-scroll on the home screen (after the header and Safety Score card), not a fixed/floating bottom element — may require scrolling to reach on shorter screens rather than always being in the thumb zone. **Not changed this pass**: relocating the SOS button to a fixed position is a layout/navigation-shaped change to the home screen, explicitly out of scope for Release Freeze without a specific confirmed-bug or accessibility justification. Flagged as a **P2 recommendation**, not a defect — the button remains reachable, just not guaranteed above-the-fold on every device.

## Touch target / gloved-hand usability

SOS circle is 164×164pt — far above the 44pt minimum, good for gloved or imprecise input. **Compliant, no gap.**

## Shake-to-SOS / accidental activation

Off by default, opt-in via Settings. When enabled, requires 3 sharp jolts (≥2.2g) within a 1200ms window plus a 3-second cooldown — tuned against single bumps/drops. **Reviewed, no gap** — reasonable false-positive protection, not tightened or loosened this pass (no evidence of either too many false triggers or too many missed triggers to justify a threshold change).

## Offline mode

**Gap identified and fixed this pass**: no network-status detection exists anywhere in the codebase, and the active-SOS UI never surfaced whether the emergency database record had actually been saved — the DB-write retry (hardened in the prior performance-certification phase to fire reliably every 15 seconds) was entirely silent to the user. A user during a real emergency had no way to know whether their SOS was "on record" or still silently retrying in the background. **Fixed**: `SosBottomSheet.tsx` now shows "Saving emergency record…" (with a warning-colored icon) while `sos.eventId` is null, and "Emergency record saved" (with the same success-colored dot used for live-tracking status) once confirmed — directly adjacent to the existing live-location panel, using the same established visual pattern already in that panel. **Category**: Data-loss-scenario transparency / emergency usability. **Risk**: low — purely additive, reads an already-existing state field (`sos.eventId`), no new state or logic. **Regression risk**: none. **Rollback**: remove the added conditional row. Per-contact manual call/SMS/WhatsApp buttons remain available as backup regardless of this record's status, unchanged.

## Summary of this section's one code change

| Fix | File | Category | Risk |
|---|---|---|---|
| SOS record save-status indicator | `SosBottomSheet.tsx` | Data-loss transparency / emergency usability | Low — additive only |

## Deferred, with reasons (not silently dropped)

| Finding | Why deferred |
|---|---|
| "I'm Safe" may require scrolling with many contacts | Layout change to the highest-stakes screen; needs real-device screen-size validation |
| Journey auto-SOS not disclosed upfront | Safe in principle but needs a dedicated, carefully-scoped copy pass across all locale call sites |
| SOS button not in a fixed thumb-zone position | Layout/navigation-shaped change, no accessibility/bug justification found to force it into this freeze pass |

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors. `pnpm run test`: 100/100 passing. `npx madge --circular`: clean. No change to SOS activation, cancellation, countdown timing, or escalation logic — only a new, additive status indicator.
