# 3. Memory

## Method

Every `setInterval`/`setTimeout`/subscription/listener in `features/` and `core/` was located and its cleanup path traced by reading the actual `useEffect` bodies — not inferred from comments. Two confirmed defects were found and fixed; everything else was confirmed clean (cleanup genuinely present and airtight), not assumed clean.

## Fixed in this pass

### 1. `SafetyContext.tsx`'s `dbRetryTimer` — dependency-churn bug (reliability + battery + memory-adjacent)

**Before**: the SOS DB-write-retry `useEffect` depended on `[sos.phase, sos.eventId, sos.coords, sos.address, insertOrAdopt]`. Since `sos.coords` updates on every incoming location ping (as often as every ~10 seconds during an active SOS — see `04-Battery.md`), the effect's cleanup-then-recreate cycle **tore down and restarted the 15-second retry interval on every single location update**. During a fast-moving emergency with pings arriving faster than the 15-second retry period, the interval could be perpetually reset before its callback ever fired — silently defeating the one mechanism whose entire purpose (per the code's own comment) is to guarantee an unconfirmed SOS write is never permanently lost.
**Fix**: introduced `sosCoordsRef`/`sosAddressRef` (always-current refs, mirroring this file's own established pattern for exactly this problem — `contactsRef`, `profileNameRef`, `sosPhaseRef` already existed for the same reason). The effect's dependency array is now `[sos.phase, sos.eventId, insertOrAdopt]` — it no longer restarts on a coords/address update; the interval callback reads the current value from the refs at fire-time instead of closing over a stale value from whichever render started it.
**Why this is correct, not just "less churn"**: the retry timer's *purpose* only cares about the current phase (is an SOS still active and unconfirmed?) — it was never supposed to depend on the coordinate value's identity, only read its current value when it actually fires. Moving coords/address to refs is the textbook fix for "value needed inside an interval callback, but must not be an effect dependency."
**Quantifiable impact**: previously, a moving emergency with location updates every ~10s could reset a 15s timer indefinitely (0 retry attempts ever executing for the duration of the emergency, if pings kept arriving faster than 15s). After the fix, the retry interval fires reliably every 15s regardless of location-update frequency — a concrete, measurable behavior change (bounded retry cadence restored) rather than a vague efficiency improvement.

### 2. `useSakhiChat.ts`'s `retryTimerRef` — missing unmount cleanup

**Before**: the auto-retry backoff timer (`RETRY_DELAYS_MS = [2000, 4000, 8000]`) was cleared in `clearChat()`, `submit()`, and `retryNow()`, but **never on unmount**. Leaving the Sakhi chat screen mid-retry left the pending `setTimeout` alive; when it fired, it still ran a network request and called `setState` on an unmounted hook instance.
**Fix**: added a dedicated unmount-only `useEffect(() => () => { if (retryTimerRef.current) clearTimeout(...) }, [])`.
**Impact**: eliminates a real (if narrow — only triggered by leaving the chat screen during the specific 2-8s retry window) wasted network call and a `setState`-after-unmount condition. See `09-Crash-Prevention.md` for the crash-prevention framing of the same fix.

## Confirmed clean (verified, not assumed)

| Mechanism | File | Verification |
|---|---|---|
| Countdown timer, SOS-elapsed timer, journey tick timer | `SafetyContext.tsx` | Each clears in both its "not active" branch and its effect's own cleanup — React's guaranteed cleanup-before-recreate ordering means at most one interval per purpose can ever exist |
| Background location start/stop pairing | `core/permissions/backgroundLocation.ts` | Every `start` (only reachable via SOS trigger or crash-recovery resume) has a matching `stop` (reachable via `cancelSOS()` or the `SafetyProvider`'s unconditional unmount cleanup) |
| Notification listeners (`addPushTokenListener`, `addNotificationReceivedListener`, `addNotificationResponseReceivedListener`) | `app/_layout.tsx` `Gate` | All three `.remove()` calls present in the effect's cleanup |
| Accelerometer shake detector | `features/sos/hooks/useShakeDetector.ts` | `.remove()` called both on unmount and every time `enabled` toggles off; the jolt-timestamp array is filtered every sample, so it can't grow unboundedly either |
| Firebase auth-state listener | `AuthContext.tsx` | Both the listener and its own 6s safety-net timeout are released in the effect's cleanup; confirmed to be the single canonical subscription (no redundant second listener anywhere) |
| DI container / repository lifecycle | `core/di/DependencyProvider.tsx`, `core/di/registry.ts` | Container built once via `useMemo([])`; every repository is a module-level singleton, never reconstructed per-render or per-resolve |
| SOS pulse animation loop | `features/sos/components/SosBottomSheet.tsx` | `Animated.loop(...).start()` is paired with `loop.stop()` in the effect's cleanup, firing both on phase change and unmount; uses the legacy `Animated` API (not Reanimated) with `useNativeDriver: true`, so per-frame work runs on the native/UI thread, not the JS thread |
| Background location TaskManager task body | `core/permissions/backgroundLocation.ts` | Stateless per invocation — only a single, overwritten (never appended) module-level `listener` reference; each call takes the latest location point, forwards it, and returns, with no historical-point array accumulated in memory |

## Unbounded-growth check

- `AppContext.tsx`'s `contacts` array is hard-capped at `MAX_CONTACTS = 5` — cannot grow unboundedly.
- `SafetyContext.tsx`'s `alertStatuses` is fully replaced (not appended to) on each dispatch and reset to `[]` when the SOS ends.
- No coordinate-history array exists anywhere client-side — `journeys.route_json` (the one schema column that could hold one) is confirmed dead/unwritten, consistent with `docs/backend-audit/technical-debt-report.md`'s independent finding.

## Realtime subscriptions

Supabase Realtime (`.channel(`, `postgres_changes`) is not used anywhere in this app — confirmed via a whole-repository grep, zero matches. There is no realtime-subscription leak surface to review because nothing subscribes; everything is poll/fetch-based (see `05-Network.md`).

## What would need a real device to further verify

Whether the `dbRetryTimer` fix produces an observable memory/CPU difference on a real device over a multi-hour SOS session (vs. the *logical* correctness improvement verified here) would need a heap-snapshot/CPU-profile comparison — not available in this environment. The fix's correctness (the interval no longer restarts on every location ping) is verified directly from the dependency-array change, not inferred.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run test`: 100/100 passing. `npx madge --circular`: clean.
