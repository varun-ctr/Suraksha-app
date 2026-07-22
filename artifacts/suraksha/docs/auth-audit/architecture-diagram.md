# 1. Authentication Architecture Diagram

```mermaid
graph TD
    subgraph UI["app/ (Expo Router screens)"]
        Login["login.tsx"]
        Sessions["sessions.tsx"]
        Profile["profile.tsx"]
    end

    subgraph Features["features/authentication/"]
        AuthCtx["AuthContext.tsx\n(single onAuthStateChanged subscription)"]
        LoginHook["useLoginScreen.ts"]
        SessionsHook["useSessionsScreen.ts"]
        ProfileHook["useProfileScreen.ts (features/profile)"]
        AuthSvc["authService.ts\n(sign-out / delete-account orchestration)"]
    end

    subgraph DI["core/di (composition root)"]
        Registry["registry.ts"]
        Hooks["hooks.ts\nuseAuthRepository / useEmailOtpRepository"]
    end

    subgraph Domain["domain/ (zero external deps)"]
        AuthRepoIface["AuthRepository interface"]
        OtpRepoIface["EmailOtpRepository interface"]
        AuthUserEntity["AuthUser entity"]
        Errors["AppError hierarchy\nAuthError, OTPExpiredError,\nSessionExpiredError, NetworkError,\nValidationError, ..."]
        ResultType["Result&lt;T, E&gt;"]
    end

    subgraph Repos["repositories/ (concrete implementations)"]
        AuthRepo["firebase/authRepository.ts"]
        FirebaseAuth["firebase/firebaseAuth.ts\n(Google/Apple/email/password glue)"]
        FirebaseClient["firebase/firebaseClient.ts\n(initFirebase, persistence wiring)"]
        EncStorage["firebase/encryptedAuthStorage.ts"]
        OtpRepo["api/emailOtpRepository.ts"]
    end

    subgraph CoreInfra["core/ (cross-cutting)"]
        CryptoBox["storage/cryptoBox.ts\n+ aesCbcHmac.ts (pure, tested)"]
        SecureStoreMod["storage/secureStore.ts\n(Keychain/Keystore via expo-secure-store)"]
        Notifications["permissions/notifications.ts\n(deregisterPushToken)"]
        Logger["logger/logger.ts"]
        ApiClient["network/apiClient.ts\n(attaches Firebase ID token)"]
    end

    subgraph External["External services"]
        FirebaseSDK["Firebase Auth SDK\n(email/password, anonymous,\ncustom token, Google, Apple)"]
        Backend["api-server: /auth/email-otp/*,\n/auth/account, /auth/sessions"]
        Keychain["iOS Keychain / Android Keystore"]
        AsyncStorage["AsyncStorage\n(bulk, encrypted-at-rest blob)"]
    end

    Login --> LoginHook --> AuthCtx
    Login --> LoginHook --> Hooks
    Sessions --> SessionsHook --> AuthSvc
    Profile --> ProfileHook --> AuthSvc
    Profile --> ProfileHook --> AuthCtx

    AuthCtx --> Hooks
    AuthSvc --> AuthRepo
    AuthSvc --> Notifications
    Hooks --> Registry
    Registry --> AuthRepo
    Registry --> OtpRepo

    AuthRepo -.implements.-> AuthRepoIface
    OtpRepo -.implements.-> OtpRepoIface
    AuthRepoIface --> ResultType
    AuthRepoIface --> Errors
    AuthRepoIface --> AuthUserEntity
    OtpRepoIface --> ResultType
    OtpRepoIface --> Errors

    AuthRepo --> FirebaseAuth
    FirebaseAuth --> FirebaseClient
    FirebaseClient --> EncStorage
    EncStorage --> CryptoBox
    CryptoBox --> SecureStoreMod
    SecureStoreMod --> Keychain
    EncStorage --> AsyncStorage
    FirebaseClient --> FirebaseSDK
    FirebaseAuth --> FirebaseSDK

    OtpRepo --> ApiClient
    ApiClient --> Backend
    ApiClient --> FirebaseClient

    AuthSvc --> Backend

    AuthCtx --> Logger
    AuthRepo --> Logger
    OtpRepo --> Logger
```

## Layer rules this diagram enforces (checked by ESLint, see ADR 0001)

- `domain/` has zero outward dependencies — `AuthRepository`, `EmailOtpRepository`, `AuthUser`, and the whole `AppError`/`Result` vocabulary are pure TypeScript.
- `core/di` is the one place allowed to import concrete repository implementations (it's the composition root).
- `app/` and `features/` never call the Firebase SDK directly — the only two files that touch `repositories/firebase/firebaseClient.ts`'s `firebaseAuth` proxy outside of `repositories/` are `core/network/apiClient.ts` and `core/permissions/notifications.ts`, both with inline, justified `eslint-disable` comments (documented in `eslint.config.js`) because there's no domain-level indirection yet for "get the current auth token" / "read the current user for push-token registration."
- **One auth-state subscription.** Before this pass, `AuthContext`, `AppContext`, `LanguageContext`, and `app/_layout.tsx`'s `Gate` each ran their own independent `onAuthStateChanged` listener against the same Firebase instance. They now all derive from `AuthContext`'s single subscription (see the flow diagrams' "before/after" note and the technical debt report).
