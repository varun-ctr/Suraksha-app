# 1. Startup Performance

## Method

Read `app/_layout.tsx` in full and traced every synchronous module-load-time side effect vs. every effect that runs after first render. No profiler/Instruments/Flipper trace was run (no real device in this environment) — every timing claim below is either (a) a hard-coded constant already in the code, or (b) a structural observation about what blocks vs. doesn't block `SplashScreen.hideAsync()`, not a measured wall-clock number.

## Cold start — traced in full

**Synchronous, at module load (before React mounts):**
`installCrashBeforeRenderHandler()` → `trackStartupEvent("app_launch")` (no-op without a Sentry DSN) → `validateConfig()` (pure env-var presence check, no I/O) → `initCrashReporting()` (`Sentry.init`, synchronous SDK constructor) → if config valid: `initFirebase(...)` + `initSupabase(...)` (both synchronous client constructors — `initializeApp`/`createClient` do not make network calls themselves) → importing `backgroundLocation.ts` for its `ACTIVE_SHARE_ID_KEY` export triggers that module's top-level `TaskManager.defineTask(...)` registration (guarded against throwing in Expo Go) → `void migrateLegacyPlaintextKeys([...])` (explicitly fire-and-forget, cannot block) → `SplashScreen.preventAutoHideAsync()`.

**None of this performs blocking network I/O.** Every SDK `init` call is a synchronous constructor; the one async call (`migrateLegacyPlaintextKeys`) is deliberately never awaited.

**After first render, gating splash dismissal:**
- `useFonts(...)` — async, with an explicit **4-second safety-net timeout** (`RootLayout`, `app/_layout.tsx`): if fonts haven't resolved by then, `fontsTimedOut` is set and the app renders with system fonts instead, recording `startup_failure`/`fonts_timed_out` telemetry.
- `Gate`'s `allReady = appReady && themeReady && langReady && authChecked` — the last of these, `authChecked`, is backed by `AuthContext.tsx`'s own **6-second safety-net timeout** (`AUTH_STATE_TIMEOUT_MS`), forcing `loading=false` if Firebase's `onAuthStateChanged` never fires.
- `SplashScreen.hideAsync()` fires exactly once, guarded by `splashHiddenRef`, the instant `allReady` becomes true.
- A separate, dedicated effect calls `hideAsync()` directly when `!APP_CONFIG.ok`, since `Gate` (the only other caller) never mounts on that path — otherwise the native splash would hang forever over `ConfigErrorScreen` (a bug already found and fixed in a prior startup-audit phase).

**Conclusion: cold-start splash duration is bounded by two documented, telemetry-backed safety nets (4s fonts, 6s auth) rather than being unbounded, and nothing found in this pass adds a new blocking step.** No code change was made to this path — it was already well-hardened by a prior phase.

## Warm start / resume from background

No cold-start-specific code re-runs on a warm resume — `app/_layout.tsx`'s module-level `initFirebase`/`initSupabase`/`TaskManager.defineTask` calls only execute once per process lifetime (JS module caching), and `Gate`'s effects are keyed on state that doesn't reset on a foreground/background transition. The one thing that *does* run on every resume is the new **App Lock** feature's `AppState` listener (`features/security/hooks/useAppLock.ts`, added in the prior security-hardening phase) — this is a cheap state check (`shouldRequireUnlock`, a pure timestamp comparison), not a re-fetch or re-render of the whole app.

## Auth restore

`AuthContext.tsx`'s single canonical `onFirebaseAuthStateChanged` subscription (see `03-Memory.md` for its confirmed-clean listener lifecycle) is the only auth-restore mechanism — no redundant second listener exists anywhere in the app (verified directly, not assumed).

## DI initialization

`core/di/DependencyProvider.tsx`'s container is built via `useMemo(() => createAppContainer(overrides), [])` — constructed **exactly once** for the app's lifetime, since `DependencyProvider` sits at the provider root and is never remounted during normal navigation. Every repository it registers is a **module-level singleton object literal** (e.g. `export const liveSessionRepository: LiveSessionRepository = {...}`), not a class instantiated per-call — so `Container.resolve()` is an O(1) `Map.get` returning the same reference every time. **No redundant instantiation exists anywhere in the DI layer** — this was verified directly, not assumed, and required no fix.

## Repository initialization

Same finding as above — every repository is ready (as a plain object) the moment its module is first imported, which happens during the same synchronous import graph that resolves before `RootLayout` even renders. There is no separate "repository warm-up" cost distinct from ordinary JS module evaluation.

## Configuration loading

`validateConfig()` (`core/config/config.ts`) is a synchronous, in-memory check of `process.env.EXPO_PUBLIC_*` presence — no I/O, negligible cost, already reviewed as fine in a prior startup-audit phase.

## Splash duration

Bounded by the two safety nets above (4s fonts, 6s auth); both already emit telemetry (`fonts_timed_out`, `startup_complete`/`durationMs`) so a regression in either would be observable in Sentry once configured — see `docs/performance-audit/10-Production-Performance-Certification.md`'s observability notes.

## Lazy loading / code splitting

Expo Router uses file-based routing with per-route bundle chunks by default (Metro's route-based code splitting for web; for native, the whole JS bundle ships as one file per platform, which is standard for React Native — native code-splitting isn't a meaningful lever the way it is for web). No screen in this app does its own manual `React.lazy()`/dynamic `import()` — this is consistent with a small-to-medium app where the added complexity of manual lazy-loading isn't yet justified by bundle size (see `07-Bundle-Analysis.md`).

## Startup bottleneck measurement — what this pass could and couldn't do

**Could verify directly (code-level):** every step in the synchronous import graph; both safety-net timeout values; the DI/repository singleton lifecycle; the absence of blocking network calls before `hideAsync()`.
**Could not verify (needs a real device):** actual wall-clock cold-start time in milliseconds, actual font-fetch latency in Expo Go vs. a production build, actual Hermes bytecode parse/JS-engine-startup time on a real low-end Android device. No number in this document is a measured benchmark — see `10-Production-Performance-Certification.md` for what's explicitly flagged as requiring real-device validation.

## Changes made in this pass

**None to this section specifically** — startup was already well-instrumented and bounded by a prior phase; this pass's review found no new bottleneck to fix here. The fixes in `02-Rendering.md`/`05-Network.md` (tab-bar icon hoisting, request de-duplication) indirectly help the render cost right after `Gate` mounts, but don't change the startup *sequence* itself.
