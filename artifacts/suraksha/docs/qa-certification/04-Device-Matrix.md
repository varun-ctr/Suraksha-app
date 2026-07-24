# 4. Device Compatibility Matrix

## Method

`app.config.ts` sets no explicit `ios.deploymentTarget` and no explicit `android.minSdkVersion`/`compileSdkVersion`/`targetSdkVersion` — both platforms inherit whatever Expo SDK 54 (`package.json`: `"expo": "~54.0.36"`) defaults to at prebuild time. `ios.supportsTablet: false` is explicitly set (`app.config.ts:40`) — **iPad is explicitly not supported/optimized**, confirmed in config, not assumed.

## iPhone matrix

| Device | Minimum OS | Recommended OS | Known limitations |
|---|---|---|---|
| iPhone SE (any generation) | Whatever Expo SDK 54 prebuild defaults to (see `05-OS-Matrix.md`) | Latest available for the device | Smallest screen in the matrix — layout was not visually verified against this screen size in this environment; the app's fixed-header + scroll-body pattern (per the UX-certification phase) should degrade gracefully, but this needs real-device confirmation, especially for the SOS active-sheet's contact-list scroll length (see `docs/ux-audit/08-Emergency-UX.md`'s "I'm Safe may require scrolling" finding — most acute on this device) |
| iPhone 12 | Same | Latest available | No app-specific limitation identified |
| iPhone 13 | Same | Latest available | No app-specific limitation identified |
| iPhone 14 | Same | Latest available | No app-specific limitation identified |
| iPhone 15 | Same | Latest available | No app-specific limitation identified |
| iPhone 16 | Same | Latest available | No app-specific limitation identified; Dynamic Island presence has no known interaction with this app's UI (no custom status-bar-area content) |
| Latest iPad | N/A | N/A | **Explicitly not supported** (`supportsTablet: false`) — the app is not expected to be tested on iPad for this certification; if `supportsTablet` is ever flipped on in a future (non-freeze) release, the entire UI would need a fresh compatibility pass, since no layout in this codebase was built with a tablet form factor in mind |

## Android matrix

| Size class | Minimum OS | Recommended OS | Known limitations |
|---|---|---|---|
| Small (e.g. compact/budget devices) | Whatever Expo SDK 54 prebuild defaults to | Latest available | `react-native-maps` requires Google Play Services — absent/degraded on GMS-less devices (some China-market and Amazon Fire hardware); this is a platform constraint, not an app defect |
| Medium (typical flagship) | Same | Latest available | No app-specific limitation identified |
| Large (large-screen phones) | Same | Latest available | No app-specific limitation identified |
| Tablet | Same | Latest available | No explicit tablet support/optimization exists in the Android config either (no tablet-specific layout branch found in the codebase) — same caveat as iPad: functional but unverified for tablet form factors |

## Native-dependency-driven constraints (apply across both platforms)

- **`react-native-maps`** (Google Maps SDK): requires Google Play Services on Android; unaffected on iOS (uses Apple/Google map providers per platform config).
- **`expo-local-authentication`** (App Lock feature, opt-in, off by default): requires Face ID/Touch ID (iOS) or fingerprint/biometric hardware (Android) — devices without enrolled biometrics simply can't enable this optional feature; reviewed in `01-Critical-Flows.md` (#18) and confirmed to fail gracefully (toast, toggle stays off) rather than crash.
- **`react-native-purchases`** (RevenueCat, premium/subscription): requires a valid App Store/Play Store account; non-functional on devices without store access.
- **`expo-notifications`**: push delivery requires FCM (Android)/APNs (iOS) reachability — degraded on GMS-less Android devices for the same reason as Maps.
- **`@react-native-google-signin/google-signin`**: requires Google Play Services on Android.
- **`expo-apple-authentication`**: iOS-only; correctly a no-op on Android (confirmed via the platform-gated `isAppleSignInAvailable()` check).

## What requires real-device validation (cannot be certified from code/config alone)

Every row's "Minimum/Recommended OS" column above states "whatever Expo SDK 54 defaults to" rather than a specific version number — this environment has no `ios/`/`android/` native project directories (Expo's Continuous Native Generation model — the native projects are generated at build time, not checked into this repo), so the actual effective minimum OS version cannot be read from a config file that doesn't exist in this repo. **This is a genuine gap that must be closed before a real submission**: running an actual `eas build` (or a local `expo prebuild`) and inspecting the generated `ios/Podfile`'s deployment target and `android/build.gradle`'s `minSdkVersion` is the only way to get an authoritative answer, and that requires build infrastructure this environment doesn't have.

## Verification

All findings above are sourced directly from `app.config.ts`, `package.json`, and `eas.json` — no device/OS-version claim was invented; every "Expo SDK 54 default" reference is explicitly labeled as general platform knowledge, not a repo-specific fact, per the general knowledge disclosed in `05-OS-Matrix.md`.
