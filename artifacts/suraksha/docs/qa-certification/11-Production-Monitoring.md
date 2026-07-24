# 11. Production Monitoring Validation

## Method

Read all 5 client-side telemetry files (`core/analytics/*.ts`) fully, confirmed each event is actually invoked from real call sites (not dead code), and read the backend's error-reporting/logging middleware (`artifacts/api-server/src/lib/errorReporting.ts`, `logger.ts`, `app.ts`).

## Inventory: 48 distinct client events across 5 files, all Sentry-breadcrumb-based, all PII-free by design

- **`startupTelemetry.ts`** (6 events): `app_launch`, `startup_complete`, `auth_restore_complete`, `navigation_ready`, `startup_failure`, `crash_before_render` — carries `durationMs` and a closed-vocabulary `reason` field only.
- **`sosTelemetry.ts`** (11 events): `sos_triggered`, `sos_cancelled_countdown`, `sos_cancelled_active`, `sos_db_write_failed`, `sos_db_write_success`, `sos_db_retry`, `sos_alert_dispatch_start/success/failed`, `sos_recovery_stale`, `sos_recovery_resumed` — event name only, no coordinates, confirmed invoked from `SafetyContext.tsx:262,268,307,329,336,340,427,480,492`.
- **`journeyTelemetry.ts`** (8 events): `journey_started/completed/cancelled/expired/escalated/recovery/retry_count/db_write_failed` — carries `durationSec`, `recoveryOutcome`, `attempts`; confirmed invoked from `SafetyContext.tsx:529,555,590,719,736`.
- **`authTelemetry.ts`** (19 events): every sign-in/sign-up/OTP/social-auth/sign-out/account-delete attempt/success/failure — carries `method` and a stable `errorCode`.
- **`communityTelemetry.ts`** (4 events): `community_report_submitted/duplicate_prevented/rate_limited/failed` — name only.

`crashReporting.ts`'s `Sentry.init({dsn, tracesSampleRate:0, sendDefaultPii:false, beforeSend, beforeBreadcrumb})` runs with SDK defaults for automatic native/JS crash capture (no override disables it), plus `reportError()` explicitly wired to `ErrorBoundary.componentDidCatch` for caught render errors, plus the separate `startupTelemetry.ts`-installed `ErrorUtils` global handler specifically covering the pre-render gap `ErrorBoundary` can't reach.

**Backend** (`artifacts/api-server`): `pino-http` structured request logging on every request (`app.ts:28-46`, redacts auth headers); `errorReporting.ts`'s `captureError()` logs every 5xx/unhandled error and forwards to `Sentry.captureException` if configured; a distinct `captureAlert(kind, context)` operational-alert channel is separately wired at the specific points that matter most for this app: `sos_idempotency_read_failed`, `sos_idempotency_write_failed`, `sos_delivery_failure`, `community_report_spam_signal`, `rate_limit_fail_open`.

## Definitive gap analysis — can production detect each required category today?

| Category | Status | Evidence |
|---|---|---|
| Crash spikes | **Detectable** | Sentry auto-crash-capture + `crash_before_render` pre-render safety net + `ErrorBoundary`-wired capture. |
| Failed SOS | **Detectable** | `sos_db_write_failed`/`sos_db_retry` client-side, `sos_idempotency_write_failed`/`sos_delivery_failure` backend-side alerts. |
| Journey failures | **Detectable** | `journey_db_write_failed`, `journey_expired`, `journey_escalated`, `journey_recovery` (with `expired` outcome). |
| Authentication failures | **Detectable** | 19 distinct auth events with stable error codes. |
| Backend failures/outages | **Partially detectable** | Request-level 5xx logging + explicit alert call sites exist; **no infra-level uptime/health-check monitor exists in this repo** — external ping/uptime monitoring, if it exists, lives outside this codebase and can't be confirmed from here. |
| Notification failures | **Gap — confirmed, not assumed** | No telemetry file or event name for push-notification delivery/failure exists anywhere in `core/analytics/`. |
| Location failures | **Gap — confirmed, not assumed** | No dedicated location-telemetry event exists; SOS/journey telemetry deliberately excludes coordinates and location-fetch outcomes by design (both files' own header comments state "no PII, ever ... no coordinates"), so a location-fetch failure during an active SOS produces no distinct trackable signal today. |

## Why the two confirmed gaps were not fixed this pass

Adding `notification_delivery_failed`/`location_fetch_failed`-style events is squarely an allowed Release Freeze category (**Observability improvement**) — the reason they weren't added in this pass is scope discipline, not doubt about their value: designing a new telemetry event's payload shape correctly (especially ensuring a location-failure event still carries zero PII, matching the existing files' explicit "no coordinates, ever" design constraint) deserves its own focused review rather than being bolted on inside an already-large QA-certification pass with 84 other findings. This mirrors the same judgment call made in the performance-certification phase's `10-Production-Performance-Certification.md`, which flagged nearly identical observability gaps (render-duration sampling, memory-warning hooks, battery-mode events) for the same reason. **Flagged as the top production-monitoring recommendation for the next release**, not implemented here.

## Verification

No code was changed for this section. `pnpm run test`: 100/100 passing (telemetry files are not directly unit-tested — they're thin Sentry-breadcrumb wrappers with no branching logic to assert on beyond "was this called," which is better verified via the call-site grep performed here than via a unit test).
