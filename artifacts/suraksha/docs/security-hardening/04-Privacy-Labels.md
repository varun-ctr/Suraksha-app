# 4. Privacy Nutrition Labels

This document maps this app's actual data-handling behavior (verified across every audit phase this session, most recently `docs/security-audit/03-Privacy-Audit.md`) to the exact categories Apple's App Store Connect "App Privacy" questionnaire asks for, so filling out that form is a transcription exercise, not a research one. The `PrivacyInfo.xcprivacy` declaration (`03-Privacy-Manifest.md`) covers the same ground in machine-readable form for Apple's build-time validation; this document is for the human-facing App Store Connect submission step.

## Data collection table

| Data type | Collected? | Purpose | Linked to user | Used for tracking | Retention | Deletion |
|---|---|---|---|---|---|---|
| Precise Location | Yes | App Functionality | Yes | No | Indefinite by default (product decision, documented in `docs/backend-hardening/05-Retention.md`) — historical SOS/journey location is arguably a user-facing safety-history feature | Full account deletion cascades every location-bearing table (`sos_events`, `journeys`, `live_sessions`) via the `app_users` bridge + `ON DELETE CASCADE` (backend-hardening pass) |
| Contact Info — Phone Number | Yes | App Functionality | Yes | No | Retained until the contact/account is deleted | Deleted with the owning contact record or full account deletion |
| Contact Info — Email Address | Yes | App Functionality | Yes | No | Retained until account deletion | Deleted with the account |
| Contacts (device address book access) | Only read transiently via the native contact **picker** (`Contacts.presentContactPickerAsync`) to let the user select trusted contacts — the full device address book is never bulk-read or uploaded | App Functionality | Yes (only the specific contacts the user selects) | No | Same as Contact Info above | Same as above |
| Photos or Videos | Yes (contact avatar, profile picture, incident-report attachment) | App Functionality | Yes | No | Retained until the referencing record/account is deleted | Deleted with the account; orphaned storage-object cleanup after a single photo/avatar deletion is a documented, open follow-up (`docs/backend-hardening/05-Retention.md`) |
| User Content — Other (incident report text) | Yes | App Functionality | Yes | No | Indefinite by default (documented product decision, same as Location) | Cascades with account deletion; individual report deletion also supported |
| User ID (Firebase uid) | Yes | App Functionality | Yes | No | For the lifetime of the account | Deleted with the account |
| Crash Data | Yes, only if `EXPO_PUBLIC_SENTRY_DSN` is configured | App Functionality (bug fixing) | **No** — never linked to a user identity (no `setUser`/`setTag` calls anywhere) | No | Per Sentry project retention settings (external to this app) | Not user-initiated; governed by the Sentry project's own data-retention configuration |
| Push Notification Token | Yes | App Functionality | Yes | No | Until sign-out/account deletion or the OS invalidates it | Deleted on sign-out and account deletion (established in the auth-hardening pass) |

## What is explicitly NOT collected

- **Precise or approximate location for advertising/tracking purposes** — location is used exclusively for SOS/journey/community-map features.
- **Any analytics/advertising identifier (IDFA, GAID)** — none found anywhere in the codebase.
- **Health, financial, or browsing-history data** — not applicable to this app.
- **Microphone audio** — the app explicitly disables the microphone permission (`microphonePermission: false` in `app.config.ts`) and never requests it.

## App Store Connect submission values (ready to paste)

For each data type Apple's questionnaire asks about, the two questions it asks and this app's honest answers:

- **"Is this data linked to the user's identity?"** — Yes for every category except Crash Data (see table above).
- **"Is this data used for tracking?"** — **No for every category.** This app does not track users across other companies' apps or websites; App Tracking Transparency (ATT) is not implicated because no tracking occurs.
- **Purpose, for every category collected** — "App Functionality" is the correct answer for all of them; none of this app's data collection serves Analytics, Product Personalization, Advertising, or Third-Party Advertising purposes as Apple defines them.

## Data retention and deletion — the underlying policy this table reflects

See `docs/backend-hardening/05-Retention.md` for the full retention-policy reasoning (unchanged by this pass) — the short version: ephemeral/operational data (idempotency caches, rate-limit counters, OTP codes, stale live sessions) has automatic, cron-driven expiry already implemented; safety-history data (SOS events, journeys, community reports) is retained indefinitely by deliberate product choice (a documented decision, not an oversight), with full account deletion as the mechanism a user can invoke to remove everything regardless of that default.
