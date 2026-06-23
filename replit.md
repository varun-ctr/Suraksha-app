# Suraksha — Women's Safety App

A React Native / Expo mobile app (iOS + Android) that helps women stay safe: SOS alerts, live location sharing, nearby safe places, an incident journal, and legal-rights guides.

## Run & Operate

- `pnpm --filter @workspace/suraksha run dev` — run the Expo dev server
- `pnpm --filter @workspace/api-server run dev` — run the Express API server (port from `PORT` env)
- `pnpm run typecheck` — full typecheck across all packages

## Required environment variables

| Variable | Where | Purpose |
|---|---|---|
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Replit Secret | Google Maps SDK key for Android + iOS native map tiles and Places API. Restrict this key to your app's package/bundle identifier in Google Cloud Console. Scopes needed: Maps SDK for Android, Maps SDK for iOS, Places API (New). |
| `GOOGLE_PLACES_API_KEY` | Replit Secret (server-side) | Server-side Google Places API (New) key used by the `/nearby-places` endpoint in `artifacts/api-server`. |
| `SUPABASE_URL` | Replit Secret | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Replit Secret | Supabase anon/publishable key |

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
