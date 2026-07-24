# 5. TestFlight Guide

## Blocking prerequisites — resolve before any submission

These are read directly from the repository and are **currently unresolved**:

| Item | Current value | Required action |
|---|---|---|
| `eas.json` → `submit.production.ios.ascAppId` | `TODO_*` placeholder | Fill with the real App Store Connect app ID |
| `eas.json` → `submit.production.ios.appleTeamId` | `TODO_*` placeholder | Fill with the real Apple Team ID |
| `app.config.ts` → `backendUrl` | Falls back to `https://example.com` when the env var is unset | Confirm the production URL is injected at build time |
| `app.config.ts` → `easProjectId` | Falls back to `TODO_EAS_PROJECT_ID` | Confirm the real project ID is injected |
| `ios.buildNumber` / `android.versionCode` | `1` / `1` | `production` profile has `autoIncrement: true`, so this self-manages — verify it actually incremented on the build |
| Minimum OS versions | Not determinable from this repo | See `03-Device-Matrix.md` — must be read off a real build |

A build produced with the `example.com` fallback will install and launch but
every backend call will fail. Verify the injected config *before* distributing,
not after a tester reports that nothing works.

## Build and submit

```bash
# Production build (autoIncrement handles build number / versionCode)
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit to TestFlight
eas submit --platform ios --profile production
```

`eas.json` profiles, verified: `development` (dev client, internal, simulator
enabled), `preview` (internal, `preview` channel, APK on Android), `production`
(`production` channel, `autoIncrement: true`).

Use **`preview`** for the Maestro suite and internal device testing — it
produces an installable APK/simulator build without consuming a production
build number.

## Internal TestFlight (up to 100 App Store Connect users)

No Apple review required; builds are available in minutes.

**Gate before inviting internal testers:**
- [ ] `09-Regression-Gate.md` fully passed
- [ ] `04-Smoke-Test.md` passed on a physical device
- [ ] Injected production config verified (table above)
- [ ] `10-TestFlight-Certification.md` known-issues list current

## External TestFlight (up to 10,000 testers)

Requires Apple's Beta App Review — a real review that can reject.

**Additional gate before submitting for external review:**
- [ ] Everything from the internal gate
- [ ] Beta App Description written, accurate, and free of "coming soon"
      language about features that are visible in the build
- [ ] **Demo account credentials provided.** Non-negotiable: this app gates
      most functionality behind sign-in, and reviewers reject builds they
      cannot get into.
- [ ] **Background location justification written.** The app requests
      `NSLocationAlwaysAndWhenInUseUsageDescription`. Explain in the review
      notes that background location activates *only* during an active SOS or
      journey, and point to the in-app onboarding copy that says so. This is
      the single most likely rejection trigger for this app.
- [ ] Privacy policy URL reachable and current
- [ ] `docs/ux-audit/11-App-Review.md`'s open item resolved: confirm whether
      the premium "coming soon" copy is accurate for this build
- [ ] Device matrix (`03-Device-Matrix.md`) executed on at least the minimum
      pool

## Reviewer notes template

```
Suraksha is a personal-safety app. Core features are SOS emergency alerting
and journey ("walk with me") tracking.

DEMO ACCOUNT
  Email:    <demo@example.com>
  Password: <...>

BACKGROUND LOCATION
  Requested only when the user starts an SOS or a journey — never at launch.
  It is used to share the user's live location with the trusted contacts they
  have explicitly added, for the duration of that emergency or trip only.
  Onboarding discloses this before any permission prompt.

TESTING SOS SAFELY
  Tapping SOS starts a 3-second countdown with a Cancel button. Cancelling
  during the countdown sends nothing to anyone. To see the full flow without
  contacting anyone, add a trusted contact with a number you control.

NOTES
  - iPhone only; iPad is not supported (supportsTablet: false).
  - Premium subscriptions are handled via RevenueCat.
```

## Distribution hygiene

- One group for internal testers, one for external. Do not mix.
- Every build gets release notes from `08-Release-Notes-Template.md` — never
  ship "Bug fixes and improvements" to a safety-app tester who needs to know
  what changed.
- Expire a build in TestFlight when it is superseded, so testers cannot keep
  reporting against stale binaries.
