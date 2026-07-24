# 4. Fifteen-Minute Smoke Test

Run on **every** build before it goes to any tester. One device. Stop and
report at the first failure — a failed smoke test means the build does not
ship, not that you keep going to collect more failures.

Total: 15 minutes. Timings are budgets, not targets.

---

## 0 · Setup — 1 min
- [ ] Install the build on a physical device (not a simulator — GPS, push, and
      biometrics all behave differently).
- [ ] Delete any prior install first, so this is a genuine cold start.

## 1 · Authentication — 3 min
- [ ] App launches to Home within ~5s. No white screen, no crash.
- [ ] Sign in with the test account. Succeeds.
- [ ] Sign out. Returns to a usable signed-out state.
- [ ] Sign back in. Session persists after a force-quit and relaunch.

## 2 · SOS — 3 min *(the highest-value 3 minutes in this document)*
- [ ] SOS control is visible on Home without scrolling.
- [ ] Tap it. Countdown appears **immediately**, Cancel visible from the first
      frame.
- [ ] Cancel during the countdown. Returns fully to idle.
- [ ] Force-quit, relaunch. The cancelled SOS does **not** reappear.
- [ ] *(Staging backend + tester-owned contacts only)* Let one countdown
      complete. "Saving emergency record…" resolves to "Emergency record
      saved". Then "I'm Safe" clears it.

## 3 · Journey — 2 min
- [ ] Start a journey with the shortest available duration.
- [ ] Force-quit and relaunch mid-journey. Journey is still active and the
      elapsed time is correct to wall-clock — not reset, not frozen.
- [ ] Check in ("I'm Safe"). Journey clears.

## 4 · Notifications — 1 min
- [ ] Permission prompt appeared at the expected point (not at cold start).
- [ ] Denying it does not break SOS or journey.

## 5 · Maps — 1 min
- [ ] Map tab renders; user position appears.
- [ ] One category chip loads nearby places and drops markers.

## 6 · Profile & Settings — 2 min
- [ ] Profile renders with the correct account.
- [ ] Add one trusted contact. It appears in the list.
- [ ] Toggle a setting, force-quit, relaunch — the setting persisted.
- [ ] Switch language; UI strings change.

## 7 · Premium — 1 min
- [ ] Premium screen opens without crashing and shows real prices (not
      placeholders or a blank list).
- [ ] "Restore Purchases" is present and tappable. *(Completing a real
      purchase is out of scope for smoke — see `06-Tester-Checklist.md`.)*

## 8 · Dark mode + accessibility spot-check — 1 min
- [ ] Switch the OS to dark mode. Home, SOS sheet, and Map are all legible;
      no white boxes, no invisible text.
- [ ] Turn on VoiceOver/TalkBack. The SOS trigger announces a real name, not
      "button" or silence.

---

## Result

**PASS** — every box ticked → build may go to testers.
**FAIL** — any box unticked → build is blocked. File the failure using
`07-Bug-Report-Template.md` and re-run the full smoke test on the fix build,
not just the failed section.
