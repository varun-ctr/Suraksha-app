# 5. OS Version Testing

## What the repo's config actually states

`app.config.ts` sets no explicit `ios.deploymentTarget` and no explicit Android `minSdkVersion`/`compileSdkVersion`/`targetSdkVersion` anywhere. `package.json` pins `"expo": "~54.0.36"`. There is no `ios/` or `android/` native project directory in this repo (Expo's Continuous Native Generation — native projects are generated at build time), so no native-project config file exists here to cite a version number from directly.

## From general Expo SDK knowledge (explicitly not from this repo's config — flagged as such per the acceptance criteria's "do not invent" standard)

Expo SDK 54 is built on React Native 0.81 and, per Expo's own published compatibility guidance (general knowledge, not verifiable by reading this repo), targets an iOS deployment minimum in the iOS 15–16 range and an Android `minSdkVersion` in the low-20s (API level) range, with Xcode 16 and a recent Android Gradle Plugin required for the build toolchain. **This document intentionally does not assert a specific version number as fact** — doing so would violate the "do not invent findings" standard, since the actual authoritative value only exists in the generated native project, which isn't present in this repository.

## Requested OS coverage vs. what can be certified here

| OS target | Status |
|---|---|
| iOS 17+ | **Cannot be confirmed as the actual supported minimum from this repo's config.** The app should be tested on iOS 17 devices/simulators as part of the manual QA pass (`09-Manual-QA.md`), but whether iOS 17 is genuinely the floor (vs. an older or newer version) requires inspecting the actual generated `ios/Podfile` from a real `eas build`/`expo prebuild` run. |
| iOS 18+ | Same caveat — should be tested, but the authoritative minimum-OS answer isn't derivable from this repo alone. |
| Latest Android LTS | Same caveat for `minSdkVersion`/`targetSdkVersion` — should be tested against the generated `android/build.gradle`'s actual values from a real build. |
| Latest Android release | Same. |

## Why this matters for the certification

App Store and Play Store review both check the submitted binary's actual `MinimumOSVersion`/`minSdkVersion` against their own current policy floors (e.g. Apple periodically requires a minimum iOS version for new submissions) — a mismatch here is a genuine **App Store rejection risk category** per the release-freeze Launch Blocker criteria, but it is **not currently verifiable from source code**, and this document will not fabricate a specific version number to appear more complete. This is the single most important "requires real infrastructure" gap in the entire QA certification — see `12-QA-Certification.md`'s Production Impact / Launch Readiness sections.

## Recommended action (not performed in this pass — requires build infrastructure this environment doesn't have)

1. Run `eas build --platform ios --profile production` (or `npx expo prebuild --platform ios` locally) and read the generated `ios/Podfile`'s `platform :ios, 'X.Y'` line.
2. Run the Android equivalent and read `android/build.gradle`'s `minSdkVersion`/`targetSdkVersion`.
3. Cross-check both against the current App Store/Play Store minimum-OS submission policy at the time of actual submission (policies change over time; a value correct today could be stale by the time of a real release).
4. Update this document with the confirmed, sourced values once available.

## Verification

No code was changed for this section — it is a documentation-and-gap-identification exercise. The gap identified (native-project config not present in this repo) is real and was confirmed by checking for `ios/`/`android/` directories directly (absent, consistent with Expo's CNG model) rather than assumed.
