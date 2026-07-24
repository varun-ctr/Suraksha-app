# 6. Startup Performance Score

## Score: 8 / 10

**Basis** (estimated — no device/profiler access in this sandbox, see Timing Report):

- **+** No blocking I/O at module-evaluation time — `initFirebase`/`initSupabase` are pure object construction, not network calls.
- **+** DI container creation is synchronous and cheap (a Map/object of factory functions, not eagerly-constructed repositories).
- **+** Every potentially-slow stage (auth restore, font loading) has an explicit, bounded timeout rather than an unbounded wait.
- **+** The one previously-uncapped risk (background-location native module resolution silently crashing the whole bundle) is now fully guarded and adds effectively zero overhead to the fast path (`safeRequire`'s cache means the guard only costs one `try/catch`-wrapped `require()` call, memoized).
- **−** Auth restore's 6-second ceiling is the single largest possible contributor to a slow launch — this is a *safety* bound, not a *performance* optimization, so a device with a genuinely slow/absent network could realistically hit close to this ceiling before the app becomes usable.
- **−** No real device measurement exists yet to confirm any of the above holds up under actual iOS Keychain/SecureStore latency, cold Metro bundle parse time in Expo Go, or real Firebase network round-trip time.

## What would raise this to 9-10

1. Real production telemetry (now instrumented via `core/analytics/startupTelemetry.ts`) showing p50/p95 durations for `startup_complete`, `auth_restore_complete`, and `navigation_ready` actually stay well under the theoretical ceilings above.
2. Confirming the 6-second auth timeout is rarely, if ever, actually hit in practice (i.e., `onAuthStateChanged` resolving well before it in the overwhelming majority of launches) — if telemetry shows it firing often, that ceiling itself becomes the next optimization target.
3. Closing the one remaining Technical Debt item (expo-notifications' unguarded native module surface) so there are zero remaining theoretical import-time crash risks, not just one fixed and one telemetry-covered.
