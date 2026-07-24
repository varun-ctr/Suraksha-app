# 7. Stress Testing

These are test-case designs for real-device execution — this environment has no device to run them against. Each includes what code-level property it's actually checking and what would constitute a pass/fail.

## Repeated login/logout

**What it checks**: `authService.ts`'s `signOut()` → re-anonymous-signin pattern, and the sign-in path's session/state cleanup, for leaks or state corruption across many cycles.
**Test case**: Sign in → sign out → sign in (different or same account) × 50 cycles in quick succession. **Pass criteria**: no growing memory footprint (observable via Instruments/Profiler), `AppContext`'s per-uid cache correctly clears and repopulates each cycle (no stale prior-user contacts/settings ever visible), no crash, no duplicate anonymous-user creation left behind.

## 100 SOS attempts (safe test mode)

**What it checks**: The countdown/cancel/DB-write/idempotency-key path under repeated load — specifically whether the idempotency-key generation (`core/permissions` / `SafetyContext.tsx`'s `idempotencyKeyRef`, backend-hardening phase) ever collides or leaks across attempts, and whether the 15-second DB-retry timer is correctly torn down and recreated each time rather than accumulating orphaned intervals.
**Test case**: **Must be run against a test/staging backend, never production** — trigger SOS, immediately cancel during countdown, repeat × 100. Then trigger SOS, let it fully activate, immediately hit "I'm Safe," repeat × 100. **Pass criteria**: no orphaned `setInterval`/`setTimeout` handles (verify via a memory profiler that the count of live timers doesn't grow across iterations — the codebase's own dependency-array design should guarantee React's cleanup-before-recreate ordering prevents this, per the performance-certification phase's review, but this needs empirical confirmation under real repetition), no duplicate `sos_events` rows created for the same logical attempt (idempotency-key check), no memory growth, no crash.
**Explicit safety note**: this test case must not fire real SMS/calls/push notifications to real trusted contacts — requires a test-mode backend flag or test contact list with numbers the tester controls.

## Repeated journeys

**What it checks**: The same wall-clock recovery/persistence path as above, plus whether `journeyRepository`'s idempotent `startJourney`/`endJourney` calls (backend-hardening phase) handle rapid repeated start/end cycles without creating duplicate or orphaned rows.
**Test case**: Start a journey → immediately check in → repeat × 50. **Pass criteria**: no duplicate active-journey rows server-side, no growing client-side memory, elapsed-timer always resets correctly to zero on each new start.

## Rapid navigation

**What it checks**: Whether rapid tab-switching or rapid push/pop navigation exposes any of the fixed re-render issues from the performance-certification phase (map markers, tab-bar icon identity) or triggers any not-yet-discovered unmount-race condition (e.g. a component unmounting mid-async-operation and calling `setState` after).
**Test case**: Rapidly switch between all 5 tabs and the Sakhi FAB in a tight loop (e.g. 100 taps in under 30 seconds), and rapidly push/pop between a pushed screen (contacts, incident, settings) and its parent tab. **Pass criteria**: no crash, no console warning about `setState` on an unmounted component, no visually broken/frozen tab bar.

## Repeated permission changes

**What it checks**: Whether toggling OS permissions (location, notifications, contacts, camera, biometrics) repeatedly while the app is running causes any of the permission-handling code paths (`core/permissions/*.ts`) to enter an inconsistent state — e.g. a stale cached "granted" assumption after the user revokes permission via OS Settings mid-session.
**Test case**: With the app foregrounded, background it, revoke location permission via OS Settings, foreground the app again, confirm the app correctly detects the revocation on next permission-dependent action (not just on next full app launch). Repeat for notifications and contacts. **Pass criteria**: no crash, no silently-stale permission assumption that lets a denied-permission code path proceed as if granted.

## Large contact lists

**What it checks**: The app enforces a hard cap of `MAX_CONTACTS = 5` (`AppContext.tsx`) — this test case is really about confirming that cap is enforced correctly under adversarial input, not about testing an unbounded list (since the app's own design prevents one from existing).
**Test case**: Attempt to add a 6th contact after reaching the cap; attempt to add contacts with duplicate/near-duplicate phone numbers in different formats (with/without country code, spacing); attempt rapid concurrent add/edit/delete operations. **Pass criteria**: the 6th-contact attempt is correctly rejected with the existing `contacts.limitReached` message, phone-number de-dup correctly normalizes and rejects functional duplicates, no data corruption from concurrent operations.

## Poor connectivity

**What it checks**: Combines the offline/weak-network scenarios from `02-Emergency-Testing.md`/`03-Offline-Testing.md` under sustained, not momentary, poor conditions.
**Test case**: Run the app for an extended session (1+ hour) with a network-link-conditioner simulating intermittent 2G-equivalent connectivity, exercising SOS trigger, journey start, incident report, and Sakhi chat during that window. **Pass criteria**: each subsystem's own established degradation behavior holds (SOS retries silently, journey's local timer stays authoritative, incident report shows a clear failure+retry, Sakhi chat's 3-attempt backoff-then-offline-fallback engages) — no subsystem should hang indefinitely or crash.

## Long sessions

**What it checks**: Directly overlaps with `06-Background-Testing.md`'s 4-hour-journey case, extended further — whether ANY part of the app (not just SOS/journey) shows degradation over a very long single session (e.g. 8+ hours), which would surface a memory leak or accumulating-state bug not caught by the 4-hour assumption used elsewhere in this certification.
**Test case**: Leave the app open and in active use (not just idle) for 8+ hours, periodically triggering different features (map, incident report, Sakhi chat, settings) alongside a continuously-running journey. **Pass criteria**: no progressive memory growth, no progressive slowdown, no accumulated duplicate listeners (cross-reference the performance-certification phase's confirmed-clean listener-cleanup audit — this test case is the real-device confirmation of that code-level claim).

## Verification

All 8 scenarios above are **test-case designs**, not executed tests — this environment has no device to run them against. Each cites the specific code-level mechanism it's meant to validate, so a QA engineer with device access can execute them directly against this certification's claims rather than starting from scratch.
