# Backend Contract for Future Server-Side Journey Monitoring (Review Only — Not Implemented)

This document specifies the recommended contract for the one gap the mobile client cannot close alone (see `reliability-audit.md`'s "residual gap": if the app is never reopened after a journey's deadline passes, no client-side code can run to escalate it). **Nothing in this document is implemented in this pass** — no backend jobs, Edge Functions, or cron were created. This is a specification for future backend work, informed by what the mobile client now persists (see the v2 hardening pass: `journeyId`, `deadlineAt`, `completedAt`, `cancelledAt`, `escalationReason`).

## Prerequisite: schema migration (not performed — no DB migration access in this environment)

The current `journeys` table (see `shared/types/database.ts`'s `JourneyRow`) has: `id`, `user_id`, `started_at`, `ended_at`, `duration_minutes`, `route_json`, `created_at`, `updated_at`. To support the events below, it needs:

```sql
ALTER TABLE public.journeys
  ADD COLUMN deadline_at TIMESTAMPTZ,           -- started_at + duration_minutes; computable, but storing it lets a monitor query it directly without recomputing
  ADD COLUMN completed_at TIMESTAMPTZ,          -- set when the user checks in
  ADD COLUMN cancelled_at TIMESTAMPTZ,           -- set when the user manually ends before overdue
  ADD COLUMN escalation_reason TEXT,             -- 'grace_period_elapsed' | 'sos_blocked_by_existing_emergency'
  ADD COLUMN outcome TEXT;                       -- 'completed' | 'cancelled' | 'escalated' | 'expired' | null while still active
```

`ended_at` (existing) stays as a generic "this journey is no longer active" timestamp for backward compatibility; `outcome` gives the precise reason, matching the mobile client's local `JourneyOutcome` model (`domain/entities/JourneyOutcome.ts`) exactly.

## Event contracts

```ts
/** Emitted by a scheduled job when a journey's deadline (+ grace period) has passed with no check-in and no client-side escalation was ever recorded. */
interface JourneyDeadlineEvent {
  journeyId: string;
  userId: string;
  deadlineAt: string;       // ISO 8601
  gracePeriodSec: number;
  detectedAt: string;       // ISO 8601 — when the monitor found it, not the deadline itself
}

/** Emitted when a journey resolves via check-in. */
interface JourneyCompletionEvent {
  journeyId: string;
  userId: string;
  startedAt: string;
  completedAt: string;
  durationSec: number;      // actual elapsed time, not the planned duration
}

/** Emitted when a journey resolves via manual cancellation before overdue. */
interface JourneyCancellationEvent {
  journeyId: string;
  userId: string;
  startedAt: string;
  cancelledAt: string;
  durationSec: number;
}
```

No coordinates, addresses, or contact information in any of these — consistent with the mobile client's own no-PII telemetry discipline (`core/analytics/journeyTelemetry.ts`).

## Recommended API contract

A small internal API (not public-facing) the mobile client already effectively has the write side of via `journeyRepository` — the additions here are read/notify endpoints for the monitor and any future ops tooling:

```
GET  /internal/journeys/overdue
     → JourneyDeadlineEvent[]   (journeys past deadline+grace with outcome IS NULL)

POST /internal/journeys/{journeyId}/escalate
     Body: { reason: "grace_period_elapsed" | "server_detected_no_client_response" }
     → 200 { outcome: "escalated" }
     Side effect: triggers the same contact-alert path the client's own
     auto-SOS uses (reuse api-server's existing /sos/alert route rather
     than building a parallel notification mechanism — see
     api-server/src/routes/sos-alert.ts, already audited and found solid
     in the SOS-hardening pass).
```

Idempotency: `POST /internal/journeys/{journeyId}/escalate` should be a no-op (200, no duplicate alert) if `outcome` is already set — mirroring the mobile client's own `autoSosTriggered` guard, just enforced server-side as the authoritative copy.

## Recommended webhook payload

If contact-alerting is delegated to an external workflow (rather than reusing `/sos/alert` directly), the webhook payload should carry exactly the `JourneyDeadlineEvent` shape above plus a pre-formatted, localized alert message — mirroring `sosAlertService.ts`'s existing message-building convention (`buildEmergencyMessage`) so there's one canonical place that formats emergency copy, not two.

## Recommended Supabase Edge Function responsibilities

A single Edge Function, e.g. `journey-deadline-check`:

1. Query `journeys WHERE outcome IS NULL AND deadline_at + (grace_period_sec * interval '1 second') < now()`.
2. For each match, call the escalate logic (either directly, or by invoking `/sos/alert` with the journey's owner's trusted contacts — requires a join against `emergency_contacts`, already RLS-scoped per-user).
3. Write `outcome = 'escalated'`, `escalation_reason = 'grace_period_elapsed'` (or a new reason value like `'server_detected'` to distinguish server-side detection from the client's own) back to the row.
4. Must be idempotent per invocation — re-running against the same overdue set must not re-alert a journey already marked `escalated`.
5. Should NOT attempt to re-derive anything the client already computed (e.g. don't try to recompute whether the client itself already escalated — trust `outcome IS NULL` as the single source of truth for "still needs server attention").

## Recommended cron responsibilities

- Invoke the Edge Function on a short, fixed interval (e.g. every 1–2 minutes) — journeys' grace periods are measured in tens of seconds to a few minutes (`OVERDUE_GRACE_SEC` client-side), so the monitor's own polling interval should be meaningfully shorter than that to keep server-side detection latency reasonable relative to the client-side mechanism it's backing up.
- Should alert engineering (not end users) if the Edge Function itself fails or times out repeatedly — this monitor is itself a safety-critical piece of infrastructure once built, and its own failure mode needs observability.
- Out of scope for the cron itself: any alerting logic — that belongs in the Edge Function, keeping the cron a thin, replaceable trigger.

## Why this is deliberately not built now

No backend/database migration access exists in this development environment (established constraint across every prior audit this session — see the SOS and auth hardening passes' equivalent backend-recommendation sections). Building this contract now, in code, without the ability to test it against a real migrated schema or a real cron/Edge Function runtime, would risk shipping something confidently wrong. This document is the complete, actionable specification a backend engineer needs to implement it correctly on the first attempt.
