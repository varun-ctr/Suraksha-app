# 3. Session Lifecycle Diagram

```mermaid
stateDiagram-v2
    [*] --> ColdStart

    ColdStart --> RestoringSession: initFirebase() reads\nencryptedAuthStorage
    RestoringSession --> Anonymous: no persisted user,\nor decrypt failed (fail-closed)
    RestoringSession --> LegacyPlaintextRestore: persisted value predates\nenvelope encryption
    LegacyPlaintextRestore --> Authenticated: parses fine as before;\nnext write re-encrypts it
    RestoringSession --> Authenticated: persisted user decrypts\nand Firebase validates it

    state "6s safety timeout" as Timeout
    RestoringSession --> Timeout: onAuthStateChanged never\nfires (cold-start network delay)
    Timeout --> Anonymous: loading forced false;\nGate proceeds, no infinite splash

    Anonymous --> Authenticated: signIn / signUp / OTP verify /\nGoogle / Apple / custom token
    Authenticated --> Anonymous: explicit Sign Out\n(deregisters push token first)
    Authenticated --> AccountDeleted: Delete Account\n(deleteUser + best-effort backend cleanup)
    AccountDeleted --> Anonymous: local state wiped,\nfresh anonymous session

    Authenticated --> TokenRefreshing: getIdToken() called with\n<5 min until expiry
    TokenRefreshing --> Authenticated: Firebase SDK refreshes\ntransparently (no onAuthStateChanged fire)

    Authenticated --> Revoked: auth/user-disabled,\nauth/user-token-expired,\nor a backend 401 on any apiFetch call
    Revoked --> Anonymous: next onAuthStateChanged event\nreports null; anon fallback fires

    Authenticated --> Backgrounded: app backgrounded
    Backgrounded --> Authenticated: app foregrounded —\nFirebase SDK's own listeners\nare unaffected by RN app lifecycle
    Anonymous --> Backgrounded
    Backgrounded --> Anonymous

    Authenticated --> [*]: app killed — session persists\n(encrypted) for next cold start
    Anonymous --> [*]: app killed — anonymous uid\npersists for next cold start
```

## Notes on states the brief specifically asked about

- **App killed during login / interrupted OTP verification**: there is no multi-step server-side transaction to roll back — `requestCode` and `verifyCode` are independent, idempotent-from-the-client's-perspective HTTP calls. If the app is killed between requesting and verifying a code, the code is still valid (10 min TTL) and verifying it on next launch works normally. If killed mid-`verifyCode`, the backend has already deleted the code (one-time use) only on a *successful* verify — a killed request that never got a response leaves the code intact and the user can just re-enter it.
- **Network interruption**: every auth-adjacent network call (`apiFetch`, all `firebaseAuth.ts` functions) already returns a typed failure rather than throwing/crashing — `NetworkError` for unreachable backend, Firebase's own `auth/network-request-failed` mapped to a friendly message. Nothing hangs indefinitely; `apiFetch` has a bounded timeout (`AbortSignal.timeout`).
- **Disabled / deleted users**: Firebase's `onAuthStateChanged` reports these as a transition to `null` (Firebase invalidates the session server-side); the existing anonymous-fallback effect in `AuthContext` handles it identically to an explicit sign-out, with no special-casing needed.
- **Force logout**: not currently implemented as a *product* feature (no admin "kill this session" button), but the *mechanism* — signing the Firebase user out and letting `onAuthStateChanged` propagate — is exactly what `authService.signOut()` already does, so adding one would be a small, contained change to the backend + a push notification trigger, not an auth-architecture change.
