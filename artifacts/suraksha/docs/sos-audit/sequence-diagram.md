# 3. Emergency (SOS) Sequence Diagram

Happy path — manual trigger, backend Twilio available, live tracking succeeds:

```mermaid
sequenceDiagram
    actor User
    participant Btn as SOS Button
    participant Ctx as SafetyContext
    participant Loc as core/permissions/location.ts
    participant BgLoc as core/permissions/backgroundLocation.ts
    participant LiveRepo as liveSessionRepository
    participant SosRepo as sosEventsRepository
    participant Queue as sosOfflineQueue
    participant Alert as sosAlertService
    participant Backend as api-server /sos/alert
    participant DB as Supabase

    User->>Btn: tap
    Btn->>Ctx: triggerSOS()
    Ctx->>Ctx: phase: idle -> countdown\nnew sosRunId, idempotencyKey=null
    Ctx->>Loc: getCurrentLocation()
    par countdown UI (3s, cancellable)
        Ctx->>User: haptic tick x3, then warning haptic
    and location + live session (parallel, not after countdown)
        Loc-->>Ctx: coords
        Ctx->>Loc: reverseGeocode(coords)
        Loc-->>Ctx: address
        Ctx->>LiveRepo: startLiveSession(coords)
        LiveRepo->>DB: endAllActiveForUser(uid) [zombie cleanup]
        LiveRepo->>DB: insert live_sessions (expires_at = now+5m)
        DB-->>LiveRepo: shareId, shareUrl
        LiveRepo-->>Ctx: session
        Ctx->>BgLoc: startBackgroundLocationTracking(shareId)
        BgLoc->>BgLoc: persist activeShareId, request "Always" permission
        BgLoc->>BgLoc: Location.startLocationUpdatesAsync(...)
    end
    Ctx->>Ctx: countdown reaches 0: phase -> active

    Ctx->>Queue: savePendingActivation({idempotencyKey, coords, dbEventId: null, alertsDispatched: false})
    Ctx->>SosRepo: insertSosEvent(uid, coords, address)
    SosRepo->>DB: insert sos_events
    DB-->>SosRepo: event row
    SosRepo-->>Ctx: event
    Ctx->>Queue: updatePendingActivation({dbEventId: event.id})
    Ctx->>Ctx: sos.eventId = event.id

    Ctx->>Alert: dispatchAlerts(coords, shareUrl)
    Alert->>Backend: POST /sos/alert {contacts, message, idempotencyKey}
    Backend->>Backend: rate-limit + idempotency-cache check
    Backend-->>Alert: {configured: true, results: [...]}
    Alert->>Alert: per-contact status = sent/failed
    alt any contact not sent via Twilio
        Alert->>Alert: native SMS compose (per contact)
    end
    Alert->>Alert: call first contact
    Alert-->>Ctx: AlertStatus[]
    Ctx->>Queue: updatePendingActivation({alertsDispatched: true})
    Ctx-->>User: SosBottomSheet shows live status, timer, per-contact badges

    loop background location task (10s interval, survives backgrounding)
        BgLoc->>LiveRepo: updateLiveSession(shareId, newCoords)
        LiveRepo->>DB: update lat/lng + expires_at = now+5m [heartbeat]
    end

    User->>Ctx: "I'm Safe" (cancelSOS)
    Ctx->>SosRepo: resolveSosEvent(eventId)
    Ctx->>Queue: clearPendingActivation()
    Ctx->>LiveRepo: endLiveSession(shareId)
    Ctx->>BgLoc: stopBackgroundLocationTracking()
    Ctx->>Ctx: phase -> idle
```

## Degraded-path sequence — DB write fails, app is killed, then relaunched

```mermaid
sequenceDiagram
    actor User
    participant Ctx as SafetyContext
    participant Queue as sosOfflineQueue
    participant SosRepo as sosEventsRepository
    participant OS as OS (process kill)
    participant Boot as app cold start

    User->>Ctx: triggerSOS() -> countdown -> active
    Ctx->>Queue: savePendingActivation(idempotencyKey, coords, dbEventId: null)
    Ctx->>SosRepo: insertSosEvent(...)
    SosRepo--xCtx: network error
    Note over Ctx: sos.eventId stays null;\n15s retry timer starts
    OS--xCtx: process killed (low memory / user swipe / crash)

    Boot->>Ctx: SafetyProvider mounts
    Ctx->>Queue: getPendingActivation()
    Queue-->>Ctx: {idempotencyKey, coords, dbEventId: null, triggeredAtMs}
    Ctx->>Ctx: isPendingActivationStale(triggeredAtMs, now)?
    alt under 30 minutes old
        Ctx->>Ctx: resume full "active" UI\n(reuse idempotencyKey, alertsDispatched flag)
        Ctx->>Ctx: fetchLocationAndStartTracking (fresh live session\n— prior share id not recoverable)
        Note over Ctx: the still-active retry-effect-equivalent\n(insertOrAdopt) fires again once phase=active\nand eventId=null, deduped via\nfindRecentUnresolvedEvent
    else 30+ minutes old
        Ctx->>SosRepo: findRecentUnresolvedEvent(uid, since)\n then insertSosEvent if none found
        Note over Ctx: reconciled silently in the background —\nUI stays at idle, no surprising stale\n"SOS active" screen for a resolved emergency
    end
```
