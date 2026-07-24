# 2. Emergency Scenario Testing

For each scenario: the mechanism that's supposed to keep SOS safe, whether it's verified by code/tests or requires real-device validation, and the specific test case to run.

## No network

**Mechanism**: SOS activation, countdown, and cancellation are entirely local — none of them call the network. The DB write (confirming the event server-side) and alert dispatch (SMS/calls) are the only network-dependent steps, and both are designed to degrade safely: the DB write retries every 15 seconds indefinitely (`SafetyContext.tsx:297-317`, hardened in the performance-certification phase) without blocking the active-SOS UI; manual call/SMS/WhatsApp buttons remain available as a backup regardless of alert-dispatch success (`SosBottomSheet.tsx`). The UX-certification phase added a visible "Saving emergency record… / Emergency record saved" indicator so this state is no longer silent to the user.
**Verified by code**: the retry loop's dependency-churn bug (SOS never firing its retry due to being reset by location pings) was found and fixed in the performance-certification phase; the record-status indicator was verified this session.
**Test case**: Trigger SOS with the device in airplane mode (see below), confirm the countdown and cancellation both work with zero network, confirm the "Saving emergency record…" indicator is visible and never silently disappears.

## Weak network

**Mechanism**: Same DB-retry mechanism as "no network," plus request de-duplication (`core/network/inFlightDedup.ts`, unit-tested) prevents a slow/retried request from being fired twice concurrently.
**Verified by code**: `inFlightDedup` has 5 passing unit tests (concurrent-call collapsing, rejection handling, per-key isolation).
**Requires real-device validation**: actual behavior under real packet loss/high latency (simulated weak network via a real device's network-link conditioner) — this environment cannot simulate real network degradation.
**Test case**: Use Xcode's Network Link Conditioner or Android's equivalent to simulate 3G/high-latency conditions during an active SOS; confirm the retry cadence and UI status indicator behave as expected.

## Airplane mode

**Mechanism**: Identical to "no network" — the app has no separate airplane-mode detection; it degrades purely based on request failure, not OS-reported network state.
**Test case**: Enable airplane mode, trigger SOS, confirm activation/countdown/cancellation all work, confirm the DB-write retry keeps attempting (observable via Sentry breadcrumbs — `sos_db_retry` event) and succeeds once airplane mode is disabled.

## GPS unavailable

**Mechanism**: `sos.loading`/`sos.coords` states handle a null location gracefully — the countdown and activation are **not** blocked by a missing location (`SafetyContext.tsx:180-183`); the UI shows "Location unavailable — enable GPS to share it" (`sos.locationUnavailable`) rather than stalling.
**Verified by code**: confirmed the activation path doesn't gate on `coords` being non-null.
**Test case**: Disable location services entirely, trigger SOS, confirm activation still completes and the alert message correctly indicates no location is available rather than sending a stale/wrong coordinate.

## GPS inaccurate

**Mechanism**: The app uses `Location.Accuracy.High` for the duration of an active SOS (a deliberate, documented safety trade-off — not adaptive, per the performance-certification phase's `04-Battery.md`). No client-side accuracy-threshold rejection exists (a low-accuracy fix is still shared rather than withheld) — this is intentional: any location is better than none in an emergency.
**Requires real-device validation**: actual GPS accuracy in real-world conditions (urban canyon, indoors) cannot be measured in this environment.
**Test case**: Trigger SOS indoors/in a location with known poor GPS reception; confirm the app still shares whatever coordinate it obtains rather than blocking on accuracy.

## Low battery

**Mechanism**: No client-side low-battery-specific behavior change exists (confirmed: no `expo-battery` usage found in the SOS path). The app does not reduce its own functionality based on battery level — this means SOS behavior is identical regardless of battery percentage, which is the safe default (no risk of the app "helpfully" disabling itself at a low-battery threshold during an emergency). OS-level Low Power Mode may throttle background location independent of app code.
**Requires real-device validation**: actual OS Low-Power-Mode throttling behavior on background location during an active SOS.
**Test case**: Enable Low Power Mode (iOS)/Battery Saver (Android), trigger SOS and a journey, confirm background location updates continue (possibly at a reduced OS-throttled rate) rather than stopping entirely.

## Device locked

**Mechanism**: SOS activation from the home screen requires the app to be foregrounded and unlocked at trigger time; once active, background location tracking (`expo-task-manager`-based) is designed to continue while the device is locked (this is the entire reason the background task is registered at module load rather than lazily — see the prior startup-certification phase). The App Lock feature (opt-in biometric gate) has a 30-second grace window specifically so it doesn't interfere with an active-SOS return-to-app.
**Requires real-device validation**: actual background execution continuation while the device is locked is an OS-scheduling behavior this environment cannot simulate.
**Test case**: Trigger SOS, lock the device, wait several minutes, unlock and confirm the elapsed timer and live-tracking status are consistent with continuous background operation.

## Background execution

Covered in depth in `06-Background-Testing.md`.

## Device reboot

**Mechanism**: No specific "survive a reboot mid-SOS" mechanism exists beyond the general crash-recovery effect that reads persisted SOS/journey state on next app launch (`SafetyContext.tsx:421-468` for SOS, `:690-748` for journey) and either resumes or reconciles based on staleness (`sosRecoveryPolicy.ts`'s `MAX_RECOVERABLE_AGE_MS = 30 minutes`). A reboot mid-SOS means background tracking stops entirely until the user manually relaunches the app — this is an OS-level limitation common to all non-VoIP/non-specially-entitled background apps, not something this codebase's own logic can override.
**Requires real-device validation**: real reboot behavior and whether the OS's own "relaunch app after reboot" entitlements (if any are configured) actually fire.
**Test case**: Trigger SOS, reboot the device, relaunch the app manually, confirm the recovery effect either resumes the SOS (if under 30 minutes old) or correctly reconciles it as stale.

## App kill

**Mechanism**: Same recovery-effect mechanism as reboot — `sosOfflineQueue`'s pending-activation record is read on next launch. A background-location task registered via `expo-task-manager` is designed to survive an app kill on Android (subject to OS battery-optimization allowances) but not on iOS (where a user-force-quit app does not resume background execution — a platform limitation, not a code defect).
**Requires real-device validation**: actual OS behavior differs meaningfully between "user swipe-kills the app" and "OS kills the app under memory pressure" and between iOS/Android — needs real-device testing on both platforms.
**Test case**: Trigger SOS, force-quit the app (not just background it), relaunch, confirm the same recovery/reconciliation behavior as the reboot case.

## Memory pressure

**Mechanism**: No specific memory-pressure hook exists client-side (confirmed in the performance-certification phase: no `didReceiveMemoryWarning`-equivalent telemetry). The app's own memory footprint was audited in that phase and found to have no unbounded-growth mechanism (contacts capped at 5, alert statuses replaced not appended, no coordinate-history array). This means the app itself isn't a likely *cause* of memory pressure, but has no special handling if the OS kills it *due to* memory pressure from other apps — falls back to the same app-kill recovery path above.
**Requires real-device validation**: real OOM-kill behavior during an active SOS.
**Test case**: Run several memory-heavy apps alongside Suraksha during an active SOS to induce background-kill pressure; confirm recovery on relaunch.

## Notification delay

**Mechanism**: A local notification is scheduled as a durability backstop for journey-overdue detection (`SafetyContext.tsx:758-773`), independent of whether the JS engine gets to run its own tick. Push notifications to trusted contacts are dispatched via the alert-dispatch path (SMS/call are the actual delivery mechanism for contacts, not push notifications — push notifications in this app are for the SOS sender's own device, e.g. the overdue-journey local notification).
**Requires real-device validation**: actual OS notification-delivery latency is entirely OS/carrier-dependent and cannot be measured here.
**Test case**: Start a journey with a short duration, background the app, confirm the overdue local notification fires within a reasonable window of the actual overdue time.

## Notification denied

**Mechanism**: `core/permissions/notifications.ts`'s `registerForPushNotifications()` never throws on denial — returns `{denied:true}` and the relevant toggle simply doesn't enable (reviewed in the UX-certification phase). SOS/journey core functionality (activation, countdown, DB write, SMS/call dispatch) does **not** depend on notification permission at all — only the local-notification overdue-backstop does.
**Verified by code**: confirmed notification denial doesn't throw or block any other subsystem.
**Test case**: Deny notification permission entirely, confirm SOS activation/cancellation/DB write/SMS dispatch all still work normally; confirm only the overdue-backstop local notification is absent (its absence is silent — this is a known, accepted limitation, not a bug, since the in-app overdue UI itself is the primary mechanism).

## Emergency contact unavailable

**Mechanism**: If a contact's phone is off/unreachable, SMS/WhatsApp dispatch attempts still fire (fire-and-forget via `Linking.openURL`/wa.me — these succeed or fail at the OS/carrier level, not detectable by this app) and the per-contact status badge reflects "opening"/"sent"/"failed" based on what the OS API call itself reports, not actual delivery confirmation to the contact's device. **This app cannot detect true message delivery** to an unreachable contact — it can only detect whether the OS successfully handed off the send request. Manual call/SMS/WhatsApp buttons remain available for every contact regardless of automated-dispatch status, so a user isn't stuck if one contact's automated alert silently fails.
**Requires real-device validation**: real message-delivery confirmation would require a receipt-based protocol (e.g., WhatsApp read receipts) that this app doesn't currently implement — flagged as a known limitation, not a defect to fix (delivery confirmation is a feature addition, out of scope under Release Freeze).
**Test case**: Use a contact number with airplane mode enabled on the receiving device; confirm the sending app doesn't hang or crash, and that manual backup actions remain available.

## Summary — does SOS still behave safely across all 14 scenarios?

**Yes, for everything code-verifiable in this environment.** Every scenario above either (a) has an established, previously-hardened mechanism (DB retry, offline queue, wall-clock recovery, request de-dup) already verified by unit tests and prior-phase code review, or (b) is an inherent OS/platform limitation (background execution after force-quit, real notification delivery latency, true message-delivery confirmation) that no client-side code change could fully solve, and which the app already degrades from safely (manual backup actions always remain available). No scenario was found where SOS could silently fail with no recovery path and no backup action — the closest thing to a gap is the lack of true delivery-confirmation receipts, which is a feature enhancement, not a regression or defect.
