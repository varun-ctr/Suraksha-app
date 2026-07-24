# 8. App Store Compliance

## Status before vs. after this pass

| Item | Before | After |
|---|---|---|
| Privacy Manifest (`PrivacyInfo.xcprivacy`) | Missing entirely | **Declared in code** via `app.config.ts`'s `ios.privacyManifests` — Expo generates the actual file at prebuild/build time |
| App Privacy Nutrition Labels | Data inventory existed but no App-Store-Connect-ready mapping | **Ready-to-transcribe table** in `04-Privacy-Labels.md` |
| Background location justification | Already strong (narrow scoping, visible tracking indicator) | Unchanged — already reviewed as solid |
| In-app privacy policy | Present, substantive, bilingual | Unchanged |
| Permission usage strings | All present, specific, honest | Unchanged |
| `eas.json` placeholder App Store Connect / Apple Team IDs | Still placeholders | **Unchanged — see below, this is operational, not code** |

## Clearly separated: code limitations vs. platform limitations vs. operational limitations

### Code limitations (fixed or improvable within this codebase — this pass addressed what was practical)
- Privacy Manifest: **fixed** — now declared in `app.config.ts`.
- Sentry PII exposure risk: **fixed** — `beforeSend`/`beforeBreadcrumb` scrubbing added (`05-Sentry-Scrubbing.md`).
- Offline storage encryption: **fixed** for SOS/journey/live-session data (`02-Offline-Encryption.md`).
- App Lock: **added** as a working, opt-in feature (`01-App-Lock.md`).
- Community-report abuse surface: **fixed** — rate limiting, duplicate prevention, telemetry (`06-Abuse-Protection.md`).
- Camera/photo-library silent-denial inconsistency (`useContactsScreen.ts` vs. `useIncidentScreen.ts`, noted in the prior security audit): **not addressed this pass** — a small, low-risk UX fix that was out of this pass's explicit scope (the 12 sections requested didn't include general permission-UX polish); tracked as a follow-up.

### Platform limitations (Expo managed workflow — cannot be fixed without ejecting or a native config plugin, which "no architecture redesign" rules out)
- No certificate pinning.
- No root/jailbreak detection.
- No code obfuscation/anti-tampering.

These three are the entirety of the MASVS-RESILIENCE gap (`docs/security-audit/01-OWASP-MASVS.md`) and are standard, accepted limitations for React Native/Expo apps in this configuration — not oversights specific to this app.

### Operational limitations (require actions outside this codebase entirely)
- **`eas.json`'s placeholder `TODO_APP_STORE_CONNECT_APP_ID` / `TODO_APPLE_TEAM_ID`** — these can only be filled in with real values from an actual Apple Developer account and App Store Connect app record, which this environment has no access to. Not a code defect; a one-time setup step whoever owns the Apple Developer account must perform.
- **Filling in the actual App Store Connect "App Privacy" questionnaire** — `04-Privacy-Labels.md` provides every answer needed, but the questionnaire itself is a web form on Apple's dashboard, not a repository artifact.
- **Running `eas build`/Xcode validation** to confirm no additional third-party-SDK Required Reason API declarations are needed beyond what this pass declared (`03-Privacy-Manifest.md`'s own caveat) — requires an actual build, which this environment cannot perform.
- **Apple Developer Program enrollment, code signing, TestFlight distribution** — entirely outside code/repository scope.

## Net effect on App Store readiness

Before this pass, the Privacy Manifest gap alone was a likely-blocking submission issue. After this pass, the code-side blocker is resolved; what remains is exclusively account-specific configuration (Apple Developer/App Store Connect values) and a build-verification step — both expected, normal parts of any app's first submission, not defects introduced or left by this codebase.
