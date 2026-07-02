# Suraksha — Women's Safety App

A React Native / Expo mobile app (iOS + Android) that helps women stay safe: SOS alerts, live location sharing, nearby safe places, an incident journal, and legal-rights guides.

## Run & Operate

- `pnpm --filter @workspace/suraksha run dev` — run the Expo dev server
- `pnpm --filter @workspace/api-server run dev` — run the Express API server (port from `PORT` env)
- `pnpm run typecheck` — full typecheck across all packages

## Required environment variables

Auth is **Firebase** (identity) + **Supabase** (data). The backend verifies the
Firebase ID token the app sends; Supabase RLS authorizes on the Firebase uid via
Third-Party Auth. See "Firebase ↔ Supabase auth setup" below.

### Client — `EXPO_PUBLIC_*` (Replit Secret, embedded at **build time** by Metro/EAS)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_STORAGE_BUCKET` / `_MESSAGING_SENDER_ID` / `_APP_ID` | Firebase Web app config (Firebase Console → Project settings → your Web app). All required. |
| `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` | Optional — Firebase Analytics. |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL (Supabase → Project settings → API). |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key. |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps SDK (Android + iOS tiles + Places). Restrict to your bundle id. Scopes: Maps SDK for Android, Maps SDK for iOS, Places API (New). |
| `EXPO_PUBLIC_BACKEND_URL` | Deployed api-server base URL. Enables automatic SOS (Twilio), Sakhi chat, sessions. If unset, SOS falls back to the manual native-SMS path. |
| `EXPO_PUBLIC_LIVE_TRACKER_URL` | Optional — base URL of the live-tracking web page. If unset, the SOS message links to Google Maps instead. |
| `GOOGLE_SERVICES_JSON` | Path to Android `google-services.json` (FCM push). Firebase Console → Android app. |

### Server — `artifacts/api-server` (Replit Secret, runtime)

| Variable | Purpose |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` **or** `FIREBASE_PROJECT_ID` | Lets the backend verify Firebase ID tokens (`lib/firebaseAdmin.ts`). Service-account JSON (Firebase Console → Service accounts → Generate new private key) is recommended in prod; project id alone suffices for token verification. `GOOGLE_APPLICATION_CREDENTIALS` (path to a key file) is also honored. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | Twilio SMS gateway for automatic SOS (`/sos/alert`). All three required for auto-send; the phone number must be SMS-enabled. |
| `SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (secret) — server-side data cleanup only. |
| `GOOGLE_PLACES_API_KEY` | Server-side Google Places API (New) for `/nearby-places`. |
| `OPENAI_API_KEY` | Sakhi AI chat. |
| `REVENUECAT_WEBHOOK_SECRET` | RevenueCat subscription webhooks. |
| `CORS_ALLOWED_ORIGINS` / `LOG_LEVEL` / `NODE_ENV` | Config (comma-separated origins; log level; environment). |

### Auto-provided by Replit — do not set

`PORT`, `REPL_ID`, `EXPO_PUBLIC_REPL_ID`, `REPLIT_DEV_DOMAIN`, `REPLIT_INTERNAL_APP_DOMAIN`, `EXPO_PUBLIC_DOMAIN`, `BASE_PATH`.

## Firebase ↔ Supabase auth setup

The app signs in with Firebase and passes the Firebase ID token to both the
backend and Supabase. Two one-time setup steps are required for cloud features:

1. **Supabase Dashboard → Authentication → Third-Party Auth → add Firebase**
   (enter your Firebase project id). This makes Supabase trust the Firebase token
   and assign it the `authenticated` role.
2. **Run `artifacts/suraksha/MIGRATE_FIREBASE_AUTH.sql`** in the Supabase SQL
   Editor. It converts `id`/`user_id` columns from UUID to TEXT (Firebase uids)
   and rewrites RLS from `auth.uid()` to `auth.jwt() ->> 'sub'`. Run order and
   details are in the file header.

Without both, Supabase rejects the Firebase token and RLS denies every
client read/write.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9 (strict)
- Mobile: Expo SDK 54, React Native 0.81.5, Expo Router v4
- API: Express 5
- DB: Supabase (PostgreSQL)
- Maps: `react-native-maps` with `PROVIDER_GOOGLE`
- Build: EAS Build

## Where things live

- `artifacts/suraksha/` — Expo mobile app
- `artifacts/suraksha/app/(tabs)/` — tab screens (home, map, report, contacts, profile)
- `artifacts/suraksha/components/` — shared UI components
- `artifacts/suraksha/context/` — React contexts (AppContext, SafetyContext, ThemeContext, LanguageContext)
- `artifacts/suraksha/lib/` — services (location, nearbyPlaces, native, sosEvents, secureStore)
- `artifacts/suraksha/constants/` — colors/themes, i18n strings, data
- `artifacts/api-server/src/routes/` — Express API routes
- `artifacts/suraksha/app.config.ts` — dynamic Expo config (reads EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)

## Architecture decisions

- `NativeMap.tsx` / `NativeMap.web.tsx` pattern: react-native-maps is excluded from the web bundle via the `.web.tsx` extension stub — prevents the bundler crash.
- `PROVIDER_GOOGLE` used on all native builds; falls back to `undefined` on web (no-op stub).
- App config is `app.config.ts` (dynamic) rather than static `app.json` so env vars can be injected at EAS build time.
- Dark map style (`lib/mapStyle.ts`) is a static JSON array applied via `customMapStyle` — avoids a runtime fetch.
- `/nearby-places` backend endpoint uses a 5-minute in-memory cache keyed on category + lat/lng to stay within Google Places quota.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `EXPO_PUBLIC_*` vars are embedded at **build time** by Metro, not at runtime — set them before starting an EAS build, not just at dev server startup.
- Google Maps API key must be restricted in Google Cloud Console to the app's bundle identifier (`com.sakhisuraksha.app`) to prevent abuse after publishing.
