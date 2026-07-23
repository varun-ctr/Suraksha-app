# 1. Startup Sequence Diagram

```mermaid
sequenceDiagram
    participant OS as iOS/Android OS
    participant Native as Native Splash
    participant JS as JS Bundle (app/_layout.tsx module scope)
    participant Config as validateConfig()
    participant DI as DependencyProvider
    participant Logger as core/logger/logger.ts
    participant Providers as Theme/Auth/Language/App/Safety/Bookmarks/Toast
    participant Repos as repositories/* (Firebase, Supabase)
    participant Auth as AuthProvider (onAuthStateChanged)
    participant Nav as Gate (expo-router)
    participant Home as (tabs) / onboarding

    OS->>Native: App Launch — native splash shown
    OS->>JS: Load & evaluate JS bundle
    JS->>JS: installCrashBeforeRenderHandler() + trackStartupEvent("app_launch")
    JS->>Config: validateConfig()
    Config-->>JS: { ok, missing[] }
    alt config invalid
        JS->>JS: trackStartupEvent("startup_failure", {reason:"missing_config"})
        JS-->>Home: render ConfigErrorScreen (splash never explicitly hidden — see Risk Assessment)
    else config valid
        JS->>Repos: initFirebase(...), initSupabase(...)
        Repos-->>JS: singletons ready (lazy — no network call yet)
        JS->>Native: SplashScreen.preventAutoHideAsync()
        JS->>JS: mount RootLayout (React tree starts)
        JS->>DI: <DependencyProvider> — createAppContainer() (synchronous)
        DI-->>Providers: container ready via context
        Providers->>Auth: AuthProvider mounts — subscribe onAuthStateChanged (+6s timeout)
        Providers->>Providers: Theme/Language/App/Safety/Bookmarks/Toast mount in parallel
        Note over Providers,Logger: Logger is a plain object, no async init — available synchronously to all of the above
        Auth-->>Providers: loading=false (auth resolved OR 6s timeout fired) — trackStartupEvent("auth_restore_complete")
        Providers->>Nav: Gate renders — allReady = appReady && themeReady && langReady && authChecked
        Nav->>Nav: markRenderConfirmed() + trackStartupEvent("startup_complete")
        Nav->>Native: SplashScreen.hideAsync()
        Nav->>Nav: trackStartupEvent("navigation_ready")
        Nav->>Home: router.replace("/onboarding" | "/(tabs)")
    end
```

## Where startup can fail (measured against this diagram)

| Stage | Failure mode | Current mitigation |
|---|---|---|
| JS Bundle evaluation | Unconditional import of an optional native module throws synchronously (the expo-task-manager/Expo Go incident) | Fixed: `core/capabilities/nativeCapabilities.ts` — see Section 4. `installCrashBeforeRenderHandler()` now also catches any *future* mistake of this shape in this exact window |
| Config validation | Missing required env var | `validateConfig()` returns `{ok:false}`; `RootLayout` renders `ConfigErrorScreen` instead of crashing. **Known gap**: splash is never explicitly hidden on this path — see Risk Assessment R-1 |
| DI container creation | `createAppContainer()` throws during repository registration | Synchronous, in `useMemo` — an uncaught throw here would be caught by the `ErrorBoundary` that wraps `DependencyProvider` (confirmed: `ErrorBoundary` sits **above** `DependencyProvider` in the tree) |
| AuthProvider | `onFirebaseAuthStateChanged` never fires (dead network, broken persistence read) | 6-second timeout forces `loading=false` regardless — confirmed unconditional, always resolves |
| Font loading | Google Fonts fetch stalls (Expo Go dev mode, fetched over the network) | 4-second timeout renders with system fonts instead |
| Navigation | `Gate` never renders `<RootLayoutNav>` | Only possible if `allReady` never becomes `true` — traced to each of its 4 inputs above, all of which have a bounded resolution path |
