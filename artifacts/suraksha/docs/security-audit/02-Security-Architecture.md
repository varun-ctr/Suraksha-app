# 2. Security Architecture

## Identity and authorization model

- **Identity provider**: Firebase Authentication (Google, Apple, Email/OTP-via-custom-token, anonymous-to-verified upgrade). Not a custom auth stack — this is a deliberate, sound architectural choice that avoids the most common source of mobile-app auth vulnerabilities (home-grown token issuance/verification).
- **Authorization boundary — two layers, correctly separated**:
  1. **Supabase Row Level Security** authorizes the mobile client's *direct* reads/writes, keyed on `auth.jwt() ->> 'sub'` (the Firebase uid) rather than `auth.uid()` (which expects a native Supabase-Auth UUID) — a correct adaptation for a Firebase-Auth-on-Supabase-data architecture (`MIGRATE_FIREBASE_AUTH.sql`).
  2. **Server-side Firebase ID token verification** (`api-server/src/lib/firebaseAdmin.ts`'s `verifyFirebaseToken`) authorizes every backend route that touches PII or writes data — a real Admin-SDK verification, not a naive JWT decode (confirmed in a prior phase's audit and unchanged since).
  - Where the backend uses the **service-role key** (bypasses RLS: `community-reports.ts`, `sos-alert.ts`), the owning `user_id` is *always* taken from the verified token, never from client-supplied body/query fields — explicitly called out in-code as an IDOR fix (`community-reports.ts:21-24,76-79`).

## Session security architecture

- Firebase's own refresh-token rotation is the token-lifecycle mechanism — not reimplemented client-side.
- The session blob itself is encrypted at rest with an app-level AES-256-CBC+HMAC-SHA256 envelope, keyed by two 256-bit keys held in the OS Keychain/Keystore (`core/storage/cryptoBox.ts`, `repositories/firebase/encryptedAuthStorage.ts`) — see `04-Cryptography.md`/`05-Secure-Storage.md` for the full construction.
- Forced reauthentication is wired for the one operation that needs it (account deletion, via Firebase's `requires_recent_login` error surfaced to the client).
- **No app-level session lock exists** — this is the architecture's single biggest gap, discussed at length in `01-OWASP-MASVS.md`'s MASVS-AUTH section and `12-Production-Certification.md`.

## Data architecture and trust boundaries

```
Mobile app (Expo/React Native)
  │
  ├─ Firebase Auth (identity) ── independent failure domain from Supabase
  │
  ├─ Supabase (data) — RLS-authorized direct reads/writes for owner-scoped data
  │     (sos_events, journeys, live_sessions, emergency_contacts, profiles,
  │      subscriptions, notification_tokens, community_reports)
  │
  └─ api-server (Express backend) — Firebase-token-verified, mostly service-role writes
        ├─ /sos/alert          → Twilio SMS (idempotency-cached, rate-limited)
        ├─ /community-reports  → Supabase service-role insert (RLS bypassed, owner from token)
        ├─ /nearby-places      → Google Places proxy (protects the paid API key)
        ├─ /auth/email-otp/*   → Supabase-stored hashed OTP + Firebase custom-token mint
        ├─ /auth/sessions,/auth/account → session introspection, account deletion
        ├─ /sakhi/chat         → OpenAI-backed chat (optional auth, own rate limit)
        └─ /revenuecat-webhook → shared-secret bearer auth (not Firebase — correctly, since
                                   RevenueCat, not a user, calls this)
```

This is a repository-pattern-preserving, domain-layer-preserving architecture (Result<T,E>, AppError hierarchy, DI container) established across prior phases and **left untouched by this pass** — no architectural redesign was in scope or performed here.

## Defense-in-depth already in place (credit where due)

- Database-level idempotency for SOS events and live sessions (partial unique index / client-generated-UUID-and-retry pattern — backend-hardening pass).
- Database-level referential integrity via the `app_users` bridge table + cascade deletes (backend-hardening pass).
- RLS hardened on `community_reports` — the one previously-live vulnerability (unauthenticated `anon` read/write) closed in the prior phase.
- Shared, DB-backed rate limiting for `/sos/alert` (survives autoscale — not an in-memory-per-instance counter).
- Firebase and Supabase are architecturally independent failure domains (a Supabase-side disaster doesn't take out authentication).

## What this pass changed (see `12-Production-Certification.md` for the full list)

Two small, targeted backend fixes, no mobile app changes, no architecture changes:
1. `api-server/src/routes/sos-alert.ts`: stopped returning/caching trusted-contacts' `name`/`phone` in the `/sos/alert` response — the mobile client never read those fields (confirmed by reading its consuming type), so this was pure unnecessary PII exposure into a cache table.
2. `api-server/src/routes/email-otp.ts` + `api-server/src/lib/otp.ts`: added a pure, unit-tested `maskEmail()` helper and applied it to every log call that previously wrote a plaintext email address to server logs.

Everything else in this document set is **review and recommendation**, consistent with this phase's explicit "certify, don't redesign" objective.
