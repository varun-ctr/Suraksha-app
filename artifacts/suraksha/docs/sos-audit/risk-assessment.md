# 6. Risk Assessment

## P0 — must fix before launch

None outstanding. The one true P0 identified during this audit — **no iOS background execution capability, meaning live location tracking silently stopped within seconds of the app being backgrounded during an active emergency** — was fixed during this pass (`expo-task-manager` + `Location.startLocationUpdatesAsync` + `UIBackgroundModes` via the `expo-location` config plugin + scoped "Always" permission request). See Architecture Diagram and FMEA.

## P1 — should fix before launch, does not block it

| ID | Issue | Why it's P1, not P0 | Recommended fix |
|---|---|---|---|
| R1-1 | `sos_events` has no server-enforced idempotency key / unique constraint | Current best-effort dedup (`findRecentUnresolvedEvent`, 5-min window) closes the overwhelming majority of the duplicate-write window; a true race is narrow and the failure mode (a cosmetic duplicate row) is not a safety regression | Add an `idempotency_key` column + `UNIQUE (user_id, idempotency_key)` constraint via a proper Supabase migration — requires DB migration access this environment does not have |
| R1-2 | Location-permission-denied has no in-app path back to Settings | The SOS flow degrades gracefully (alert still sends, minus location) rather than blocking, so this is a UX gap, not a delivery failure | Add a "location disabled — open Settings" affordance to the countdown/active UI when `coords` stays null after the permission check specifically (vs. a slow GPS fix) |
| R1-3 | No Privacy Manifest (`PrivacyInfo.xcprivacy`) declared | Apple requires this for apps using "required reason" APIs and increasingly enforces it at submission; several bundled SDKs (Firebase, Sentry) may ship their own manifests already, which this app doesn't currently aggregate/declare | Generate via `npx expo prebuild` + Xcode's manifest tooling against the actual final dependency set at build time — not fabricated in this pass, since guessing the required-reason API list without running the real prebuild risks a wrong (and rejected) declaration |
| R1-4 | Sustained multi-minute backend outage exceeds the single 2s retry window | A single retry handles a transient blip; a genuinely down backend for several minutes falls through to native SMS/call (correct, not silent) but the user has no visibility into "backend delivery failed, falling back to manual" beyond per-contact badges | Add an explicit banner state distinguishing "delivered automatically" from "you'll need to confirm the SMS/call manually" |

## P2 — worth doing, not launch-blocking

| ID | Issue | Recommended fix |
|---|---|---|
| R2-1 | No automated alerting/monitoring dashboard on the `sos_*` telemetry breadcrumbs | Sentry breadcrumbs are useful for post-hoc crash investigation but nothing currently alerts a human in real time on a spike in `sos_db_write_failed`/`sos_alert_dispatch_failed` | Wire Sentry breadcrumb data into a dashboard or alert rule once there's an ops rotation to receive it — explicitly out of scope for a mobile-client-only pass |
| R2-2 | Live-session heartbeat window (5 min) is a fixed constant, not configurable per deployment | Reasonable default given the 10s background-update interval, but not validated against real device battery/throttling behavior | Revisit once real-device telemetry on background delivery cadence exists |
| R2-3 | No max-contacts-reached UX nudge beyond the existing cap enforcement | `MAX_CONTACTS` is enforced (from the auth/profile hardening pass) but a user who's alerting only 1-2 contacts isn't nudged toward adding more | Product decision, not a reliability gap |

## P3 — cosmetic / long-term

| ID | Issue |
|---|---|
| R3-1 | `sendJourneyAlerts` duplicates message-building logic that `sosAlertService.sendSosAlerts` delegates to `emergencyMessage.ts` — journey-start messages are built inline instead of through the same pure builder |
| R3-2 | No structured logging correlation ID linking a single SOS run's telemetry breadcrumbs together (currently distinguishable only by timestamp proximity) |

## Risks accepted as inherent to the platform, not software defects

- **Airplane mode / no cellular radio at all**: both backend Twilio and native SMS/call require *some* connectivity. No software fix exists for a device with zero radio connectivity; the manual action buttons (call/SMS/WhatsApp) remain available the instant connectivity returns, and this is disclosed in the Reliability Audit (#12) rather than hidden.
- **Empty trusted-contacts list**: a data/onboarding risk, not a code defect — correctly surfaced with a direct call-to-action rather than silently doing nothing.
- **iOS background-execution throttling under extreme Low Power Mode**: `pausesUpdatesAutomatically: false` is set to resist this as much as the API allows; iOS retains final authority over background CPU/radio budget under system-level low-power policy.
