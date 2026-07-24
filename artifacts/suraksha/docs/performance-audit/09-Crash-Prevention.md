# 9. Crash Prevention

## Fixed in this pass

### Unhandled promise / setState-after-unmount: `useSakhiChat.ts`'s retry timer

**Before**: leaving the Sakhi chat screen while a network-retry backoff (2s/4s/8s) was pending left the `setTimeout` alive. When it fired, it ran `sendSakhiMessage(...)` (a network call) and then called `handleResult(...)`, which calls `setPending`/`setMessages`/etc. — `setState` on an unmounted hook instance. React logs a warning for this in development; more importantly, it's wasted work (a network call whose result nobody can use) and a code smell that could mask a real bug if the timing ever changed.
**Fix**: added a dedicated unmount-only cleanup effect that clears `retryTimerRef` if it's still pending when the hook unmounts.
**Why this matters for crash prevention specifically**: `setState` on an unmounted component doesn't crash the app in modern React (it's a no-op with a dev warning, not a hard error), but the underlying pattern — an async continuation that assumes its component is still alive — is exactly the shape of bug that *does* crash an app when the continuation touches something less forgiving than `setState` (e.g., a ref to a native view, or a navigation call). Fixing the root cause (the timer outliving its owner) closes the whole class of risk, not just today's `setState` symptom.

### Reliability bug, adjacent to crash risk: `SafetyContext.tsx`'s `dbRetryTimer`

Covered in full in `03-Memory.md`/`08-Long-Session.md` — while this bug's primary effect was "the retry timer can be perpetually reset and never fire" (a silent reliability failure, not a crash), it shares the same root-cause shape as the above: state that should have been read via a ref at fire-time was instead captured in a closure via the effect's dependency array, causing the effect to tear down and rebuild more often than intended. Fixed identically (moved to refs).

## Reviewed and confirmed clean — no fix needed

### Race conditions

`SafetyContext.tsx`'s `sosRunIdRef` pattern (a monotonically-incrementing run counter) is used consistently across every async continuation in the file (`fetchLocationAndStartTracking`, `activateSosDb`, the `dbRetryTimer` callback) to detect whether a stale async operation from a *previous, already-cancelled* SOS run is still trying to update state — every such continuation checks `sosRunIdRef.current !== runId` before touching state. This was reviewed across every call site in the file and confirmed to be applied consistently, not just in some places — no new race condition was introduced by this pass's edits (the `dbRetryTimer` fix preserves this exact guard, only changing which values are refs vs. dependencies).

### Subscription cleanup

Every listener/subscription in the app was traced to a cleanup path — full detail in `03-Memory.md`. None were found missing cleanup except the one `useSakhiChat.ts` case fixed above.

### Error boundaries

`shared/components/ErrorBoundary.tsx` (reviewed, unchanged) wraps the entire app (`app/_layout.tsx`) with `onError={reportError}` wired to Sentry (with PII scrubbing, from the prior security-hardening phase) — a render-time crash in any screen is caught and reported rather than taking down the whole app. Not modified in this pass since no gap was found in its coverage.

### Native module failures

`core/capabilities/nativeCapabilities.ts`'s lazy `require()`-and-cache pattern (used by `getTaskManager()`, `getLocalAuthentication()`, etc.) was reviewed — every native-module access in the app that could throw in Expo Go (background TaskManager, biometrics) goes through this guarded accessor rather than a top-level `import`, which is what prevents a repeat of the previously-fixed Expo Go blank-screen crash (documented in `docs/startup-audit/`). No new unguarded native-module import was introduced by this pass — the one new module-scope side effect this session added across all phases (the Privacy Manifest declaration, the App Lock feature) either doesn't touch a native module directly at import time (App Lock's `biometrics.ts` was already guarded before this session) or is pure configuration (the Privacy Manifest, evaluated by Expo's build tooling, not at runtime).

### Async cleanup in newly-added code this pass

- `core/network/inFlightDedup.ts`: reviewed for its own async-cleanup correctness as part of writing its tests — the internal bookkeeping chain (`promise.then(release, release)`) was specifically written to avoid creating an unhandled-rejection edge case (an earlier draft used `.finally()`, which re-throws on a rejected promise and did produce a genuine unhandled rejection, caught by this pass's own test suite before being shipped — see the "Testing caught a real bug in this pass's own new code" note below).
- `repositories/supabase/supabaseClient.ts`'s `profiles.getById` dedup: uses the same reviewed helper, so it inherits the same correctness guarantee.

## Testing caught a real bug in this pass's own new code

Worth stating plainly: while writing the unit tests for `dedupeInFlight` (see `08-Testing`-equivalent coverage below and `05-Network.md`), the test `"a rejection releases the key immediately"` initially failed with an `unhandledRejection` — the first implementation used `promise.finally(() => {...})` for internal cleanup, and `.finally()`'s documented behavior is to re-throw whatever the original promise rejected with, into a *new*, unobserved promise. This was fixed by switching to `promise.then(release, release)` (both branches return normally, so the internal chain never itself rejects). This is exactly the kind of crash-adjacent bug (an unhandled rejection can, depending on the JS engine/RN configuration, terminate the process or at minimum spam error logs in production) that this pass's own "add tests" requirement is meant to catch before shipping — and it did, in this pass's own code, before merge.

## OOM risks

No new large in-memory structure was introduced by this pass. The `inFlightGetRequests`/`inFlightProfileGetById` Maps are self-cleaning (every entry is removed once its promise settles, verified by a dedicated test) and bounded by "however many distinct concurrent requests exist right now," not by session duration — cannot grow unboundedly over a long session.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run test`: 100/100 passing (including the rejection-handling test that caught the bug described above). `npx madge --circular`: clean.
