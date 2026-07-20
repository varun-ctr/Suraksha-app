# Suraksha — Store Launch Checklist (Phase B)

This is the owner-run checklist to take **Sakhi Suraksha** from the current
code to live builds on the **Apple App Store** and **Google Play**. The code
side (EAS config, RevenueCat integration, config hardening) is done — this
covers the accounts, credentials, and commands that must run on your side.

Legend: 🔑 = a secret/credential you provide · 💻 = a command you run ·
🏪 = a store/dashboard step.

---

## 0. Accounts you need

- 🏪 **Expo account** (free) — https://expo.dev
- 🏪 **Apple Developer Program** ($99/yr) — https://developer.apple.com
- 🏪 **Google Play Console** ($25 one-time) — https://play.google.com/console
- 🏪 **RevenueCat** (free tier fine) — https://www.revenuecat.com
- 🏪 **Google Cloud** project for the Maps SDK key
- 🏪 **Sentry** (optional but recommended) — https://sentry.io

---

## 1. EAS project + build

1. 💻 `npm i -g eas-cli` then `eas login`.
2. 💻 From `artifacts/suraksha`, run `eas init`. This writes the real
   **projectId** and **owner**. Either let it edit `app.config.ts`, or set
   `EXPO_PUBLIC_EAS_PROJECT_ID` and `EXPO_PUBLIC_EAS_OWNER` (the config already
   reads these; until then they're placeholders and OTA/updates are inert).
3. `eas.json` is already committed with `development` / `preview` / `production`
   profiles + a `submit` block.
4. 💻 First native dev build (needed to test RevenueCat — it does **not** work
   in Expo Go): `eas build --profile development --platform all`, install it on
   a device/simulator.

## 2. Config / secrets for the app build

Set these as **EAS environment variables** (`eas env:create`) or in your build
environment. All are read at build time via `app.config.ts` / `process.env`:

- 🔑 `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — Google Cloud → enable **Maps SDK for
  Android** + **Maps SDK for iOS**, create an API key. Without it the native
  map ships blank (the app warns in dev; see `lib/config.ts`).
- 🔑 `EXPO_PUBLIC_SENTRY_DSN` — Sentry project DSN. Without it crash reporting
  is silently off (`lib/crashReporting.ts`).
- 🔑 `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` —
  RevenueCat → Project → API keys (the **public** SDK keys, one per platform).
- The Firebase `EXPO_PUBLIC_FIREBASE_*` and `EXPO_PUBLIC_SUPABASE_*` vars
  (already in use) must also be present in the build env.
- ⚠️ **App art (owner-provided):** `app.config.ts` currently reuses
  `assets/images/icon.png` for the icon, splash, and Android adaptive icon.
  Supply a dedicated 1024×1024 icon, an adaptive-icon foreground, and a splash
  image before store submission (a full-bleed square icon gets clipped as an
  adaptive icon).

## 3. RevenueCat dashboard

1. 🏪 Create an **entitlement** with identifier exactly **`premium`** (the app
   checks `entitlements.active["premium"]` — see `lib/purchases.ts`).
2. 🏪 Create your **products** in App Store Connect and Google Play (see §4/§5),
   then add them to RevenueCat and attach them to the `premium` entitlement.
3. 🏪 Create a default **Offering** containing those packages. The paywall
   (`app/premium.tsx`) renders whatever packages the current offering returns,
   with **store-localized** prices — do not hardcode prices.
4. 🏪 **Webhook:** RevenueCat → Project → Integrations → Webhooks. URL:
   `<your-backend-url>/revenuecat-webhook`. Set the Authorization header value
   to a strong secret, and set the same value as 🔑 `REVENUECAT_WEBHOOK_SECRET`
   in the **backend** Replit Secrets. The backend
   (`api-server/src/routes/revenuecat.ts`) verifies it (constant-time) and
   flips `profiles.is_premium` on purchase/expiry.
5. What Premium unlocks today: **custom color themes** (rose / ocean / sunset —
   see `constants/colors.ts` `FREE_THEMES`). Add more entitlement-gated
   features over time; the paywall only advertises what's actually included.

## 4. Apple App Store

1. 🏪 App Store Connect → create the app (bundle id `com.sakhisuraksha.app`).
2. 🏪 Create your auto-renewable **subscription products**; note the product IDs
   and add them to RevenueCat.
3. Fill `eas.json` → `submit.production.ios`: `ascAppId` and `appleTeamId`
   (currently placeholders).
4. 💻 `eas build --profile production --platform ios` then
   `eas submit --profile production --platform ios` → TestFlight → App Review.

## 5. Google Play

1. 🏪 Play Console → create the app (package `com.sakhisuraksha.app`).
2. 🏪 Create your **subscription products**; add them to RevenueCat.
3. 🏪 Create a Google Play **service account** JSON for `eas submit`; save it as
   `google-play-service-account.json` (git-ignored — never commit) and point
   `eas.json` → `submit.production.android.serviceAccountKeyPath` at it.
4. 💻 `eas build --profile production --platform android` then
   `eas submit --profile production --platform android` → internal testing →
   production.

## 6. Backend (Replit Secrets) — confirm set

`OPENAI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_*`, `RESEND_API_KEY`,
`GOOGLE_PLACES_API_KEY`, `REVENUECAT_WEBHOOK_SECRET`, `CORS_ALLOWED_ORIGINS`.
See `artifacts/api-server/.env.example` for what each one gates.

## 7. Firebase console

- Enable **Anonymous** sign-in (the app auto-signs-in anonymously; without it
  every anonymous flow silently fails).
- Email/Password is already used for the OTP custom-token bridge.

## 8. Verify on a real build (cannot be done in Expo Go / this repo)

- Native dev build launches; the embedded map renders with a real Maps key.
- Open Premium → live plans load with store prices → complete a **sandbox**
  purchase → `premium` entitlement active → a locked theme (rose/ocean/sunset)
  becomes selectable → **Restore purchases** works on a reinstall.
- The RevenueCat webhook flips `profiles.is_premium` to `true` server-side.
- Trigger a test crash → it appears in Sentry.

---

## Deferred (Phase C / later)

- **Remote push (FCM/APNs).** Not wired to any sender today (SOS uses Twilio
  SMS). When you add server-sent push: create `google-services.json` (Android
  FCM) + an APNs key (iOS), add them to the build and EAS credentials, and wire
  a backend sender. Local notifications (journey timer) already work on a
  native build with none of this.
- Backend error tracking + SOS-delivery failure alerting; a tracked migration
  runner; pg_cron cleanup jobs.
