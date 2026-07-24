# 4. Initialization Risk Assessment

## Section 2 checks (Initialization Safety)

| Check | Result | Evidence |
|---|---|---|
| No module performs native initialization during import | ⚠️ Mostly true, one residual risk found (see below) | `core/permissions/backgroundLocation.ts` and `core/permissions/biometrics.ts` now both load their optional native modules lazily via `core/capabilities/nativeCapabilities.ts`. **Residual**: `expo-notifications` (imported statically at `app/_layout.tsx:8`) internally uses the same `requireNativeModule()` pattern for several of its own sub-modules (`NotificationScheduler`, `NotificationPresenterModule`, `BadgeModule`, etc. — confirmed by reading `expo-notifications/build/*.native.js`). This has never manifested as a failure in Expo Go across this entire project (notifications are one of Expo's oldest, most universally-bundled modules, unlike TaskManager's background-execution surface, which Expo Go's own docs say is unsupported) — so this is **not treated as a P0/P1** — but it is structurally the same fragility class. See Technical Debt Report TD-1 |
| No side effects occur at module scope | ⚠️ One pre-existing, low-risk exception | `core/permissions/notifications.ts` calls `enableNotificationHandler()` at module load (line 45) — this sets a JS-side callback (`Notifications.setNotificationHandler`), not a native registration; low risk, but it IS a module-scope side effect. Everything else audited (`app/_layout.tsx`'s `installCrashBeforeRenderHandler()`/`trackStartupEvent("app_launch")`/`validateConfig()`/`initCrashReporting()`/`initFirebase()`/`initSupabase()`) is intentional, already-reviewed, and none of it performs I/O — all pure object construction |
| Native modules initialize only after capability checks | ✅ for the two genuinely-optional modules | `getTaskManager()` / `getLocalAuthentication()` — both routed through `nativeCapabilities.ts`'s guarded `safeRequire` |
| Initialization order is deterministic | ✅ | ES module imports execute top-to-bottom, once; `DependencyProvider`'s container creation is synchronous (`useMemo`, no async gap); provider mount order is fixed by JSX nesting in `app/_layout.tsx` (`DependencyProvider` → `ThemeProvider` → `AuthProvider` → `LanguageProvider` → `AppProvider` → `SafetyProvider` → `BookmarksProvider` → `ToastProvider` → `Gate`) — this order has not changed in this pass |
| No hidden dependency cycles exist | ✅ | `madge --circular` run against all 189 files in the project: **no circular dependency found** (re-verified after every change in this pass) |
| Providers never depend on incomplete initialization | ✅ | `DependencyProvider` sits above every consumer of `useXRepository()` hooks and constructs its container synchronously before any child renders — no provider can observe a container mid-construction. `AuthProvider`'s `loading` flag is the one genuinely-async piece of provider state, and `Gate` correctly gates on it (`authChecked = !authLoading`) rather than assuming it's ready |

## Section 9 checks (Code Quality)

| Check | Result | Evidence |
|---|---|---|
| No startup race conditions | ✅ | `Gate`'s `splashHiddenRef`/`navigationReadyRef` guards ensure each telemetry event and the splash-hide/navigation-decision effects fire exactly once even under React's double-invoke-in-dev behavior or rapid readiness-flag changes |
| No import-time side effects (beyond the one documented exception above) | ✅ | See above |
| No duplicate initialization | ✅ | `initFirebase`/`initSupabase` are called exactly once, at module scope, gated by `APP_CONFIG.ok`; `DependencyProvider`'s container is memoized with an empty dependency array — never recreated across re-renders |
| No provider deadlocks | ✅ | No provider's readiness effect depends on a *sibling* provider's state — each of `appReady`/`themeReady`/`langReady`/`authChecked` resolves independently and is only combined, read-only, in `Gate` |
| No infinite loading state | ✅ | Every readiness flag has a bounded resolution path: `AppContext`'s `ready` is set in a `finally` block (always runs); `LanguageContext`'s `ready` likewise; `ThemeContext` untouched by any recent change; `AuthContext`'s `loading` is bounded by the 6-second timeout |
| No unresolved Promises | ✅ | Every async IIFE audited (`AppContext`'s load effect, `SafetyContext`'s crash-recovery effect, `cryptoBox`'s key load) either resolves or is caught — no `await` without a corresponding catch/finally was found |
| No startup memory leaks | ✅ | Every subscription with a cleanup path has one: `AuthContext`'s `unsub()` + `clearTimeout`, `Gate`'s notification listener `.remove()` calls in its effect cleanup. `installCrashBeforeRenderHandler()` is idempotent (`handlerInstalled` guard) so Fast Refresh can't stack duplicate global handlers |

## Findings summary

No P0. One P1-adjacent structural observation (expo-notifications' internal `requireNativeModule` usage) that has never manifested and is now at least telemetry-visible if it ever does, via `installCrashBeforeRenderHandler()`. No provider deadlocks, no race conditions, no leaks, no dependency cycles.
