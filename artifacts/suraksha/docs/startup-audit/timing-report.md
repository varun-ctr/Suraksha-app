# 2. Startup Timing Report

No physical device or profiler is available in this sandboxed environment (consistent with every prior hardening pass this session — no native build/run access). This is a **code-path analysis and estimate**, not a measured benchmark, labeled as such throughout. `core/analytics/startupTelemetry.ts`'s `getElapsedSinceStart()` now records the real numbers on every actual launch (`app_launch`, `startup_complete`, `auth_restore_complete`, `navigation_ready` durations) — this report should be replaced with real percentile data once telemetry has collected production launches.

| Stage | What it measures | Estimated cost | Basis |
|---|---|---|---|
| JS bundle evaluation | Module-load-time code in `app/_layout.tsx` and its eager import graph (config, Firebase/Supabase singleton setup, background-location task registration) | Low, single-digit ms | All module-scope work is synchronous object construction / lazy `require()` — no network or disk I/O happens at this stage (`initFirebase`/`initSupabase` only construct client objects, they don't make a request) |
| Config validation | `validateConfig()` — an array `.filter()` over 8 env var names | <1ms | Pure, synchronous, no I/O |
| DI initialization | `createAppContainer()` inside `DependencyProvider`'s `useMemo` | Low, single-digit ms | Registers repository implementations into a plain object/Map — no I/O, confirmed by reading `core/di/registry.ts` |
| Logger | `core/logger/logger.ts` | ~0ms | A plain object literal with dev-gated methods — no initialization step at all |
| Repository creation | Same as DI initialization — repositories are constructed, not connected, at this point | ~0ms extra beyond DI | Firebase/Supabase clients are lazy; the actual network round-trip for auth-state restore happens later, in AuthProvider, not here |
| Auth restore | `AuthProvider`'s `onAuthStateChanged` subscription resolving (persisted session read + decrypt via `encryptedAuthStorage`/`cryptoBox`, or a fresh anonymous sign-in) | Variable — a few hundred ms on a warm SecureStore read; bounded at 6000ms by `AUTH_STATE_TIMEOUT_MS` regardless of outcome | `AuthContext.tsx`'s explicit timeout is a **hard ceiling**, not an estimate — this is the single largest possible contributor to startup time and the only stage with a multi-second bound |
| Navigation | `Gate`'s redirect effect running once `allReady` is true | <1ms of JS work; the visible cost is whatever screen (`onboarding` or `(tabs)`) mounts next | Router replace is synchronous from the app's perspective; the target screen's own mount cost isn't part of "startup" per this report's scope |
| First screen render | Time from `RootLayoutNav` mounting to the first frame of `(tabs)` or `onboarding` painting | Not measurable without a device/profiler | Standard React Native mount cost for whichever screen is first — out of scope for this audit (that's the *next* screen's own performance, not startup) |
| Splash hide | `SplashScreen.hideAsync()` call in `Gate`'s effect | Fires the instant `allReady` flips true — no additional delay is introduced by the call itself | Confirmed: this is a single unconditional call the moment the readiness gate opens, not gated behind anything else |

## The realistic critical path

For a typical launch (valid config, fonts load fast, SecureStore read succeeds quickly): **JS eval → config → DI → providers mount → auth resolves (fast path, likely under 500ms on a warm session) → splash hides → navigate.** Total: almost entirely bounded by how quickly `onAuthStateChanged` fires, which depends on network reachability to Firebase and the local SecureStore/AsyncStorage read latency — not by anything introduced in this session's changes.

For a degraded launch (auth state genuinely never resolves — e.g. airplane mode with no cached session): the 6-second `AUTH_STATE_TIMEOUT_MS` ceiling is what bounds the wait, and is therefore the single biggest lever if startup time is found to be a problem in production telemetry.

## Recommendation

Once telemetry (Section 6) has collected real launches, replace the "Estimated cost" column above with actual p50/p95 durations per event, split by Expo Go vs. dev/release build (the same JS logic runs in all three, but network/disk characteristics genuinely differ between a Metro-connected Expo Go session and a standalone release binary).
