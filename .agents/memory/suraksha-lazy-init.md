---
name: Suraksha lazy init pattern
description: How Firebase and Supabase are lazily initialized to avoid placeholder URLs and Metro crash-on-load
---

## The pattern

Both `lib/firebase.ts` and `lib/supabaseClient.ts` export:
1. An `init*()` function (`initFirebase(config)`, `initSupabase(url, key)`)
2. A module-level `Proxy` object (`firebaseAuth`, `supabase`) that forwards property access to the real singleton once initialized

`app/_layout.tsx` module-level code (runs before any React render):
```ts
const APP_CONFIG = validateConfig();
if (APP_CONFIG.ok) {
  initFirebase({ apiKey: ..., ... });
  initSupabase(url, key);
}
```

## Why

Metro evaluates ALL imported modules at bundle load time — you cannot prevent a module from loading via conditional imports. Without lazy init, `createClient()` / `initializeApp()` would run with empty/undefined env vars before React renders.

The Proxy approach lets the existing import graph (`supabase.from(...)`, `firebaseAuth.currentUser`) continue working without refactoring every call site to `getSupabase().from(...)`.

## How to apply

- `firebaseAuth.currentUser` returns `null` safely before init (handled in Proxy get)
- Any other `firebaseAuth.*` access before `initFirebase()` throws with a clear error message
- `supabase.*` access before `initSupabase()` always throws — the config gate ensures this never happens in normal operation
- If adding new env vars: update `lib/config.ts` REQUIRED_VARS array; the gate handles the rest automatically

## Gotcha

`user.uid` is the Firebase user identifier (NOT `user.id` which is Supabase). Every DB write using a user identifier must use `user.uid`. The `db.*` helpers in supabaseClient.ts take `userId: string` as first arg — always pass `user.uid`.
