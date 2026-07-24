# 3. Apple Privacy Manifest

## Why this pass could actually implement it (unlike the prior audit's finding)

The prior security audit (`docs/security-audit/10-Compliance.md`) flagged the missing `PrivacyInfo.xcprivacy` as an App Store submission blocker that "cannot be authored blind from this environment." That was true for hand-writing a native Xcode-project file — but Expo SDK 50+ supports declaring the manifest directly in `app.config.ts` via `ios.privacyManifests`, which Expo generates and bundles into the native project at prebuild/build time. This app runs Expo SDK 54 (confirmed in `package.json`), and the `privacyManifests` key was confirmed present and correctly typed against the installed `@expo/config-types` package (`npx tsc --noEmit` passed with 0 errors against the declaration added). This closes the gap in code, not just in documentation.

## What was declared, and why

### `NSPrivacyTracking: false`, `NSPrivacyTrackingDomains: []`

This app does not do cross-app/cross-site tracking in Apple's ATT sense — no IDFA usage, no ad SDKs, no cross-app identifier sharing was found anywhere in this codebase across every audit phase this session.

### `NSPrivacyCollectedDataTypes` — mapped directly from the data inventory in `docs/security-audit/03-Privacy-Audit.md`

| Declared type | Linked to user | Tracking | Purpose |
|---|---|---|---|
| Precise Location | Yes | No | App Functionality |
| Phone Number | Yes | No | App Functionality |
| Email Address | Yes | No | App Functionality |
| Photos or Videos | Yes | No | App Functionality |
| Other User Content (incident report text) | Yes | No | App Functionality |
| User ID (Firebase uid) | Yes | No | App Functionality |
| Crash Data | **No** | No | App Functionality |

Crash Data is declared **not linked** to a user identity because this app's Sentry integration never calls `Sentry.setUser()`/`setTag()` with any identifying value (confirmed in the prior security audit and unchanged by this pass's Sentry scrubbing work — see `05-Sentry-Scrubbing.md`).

### `NSPrivacyAccessedAPITypes` — Required Reason APIs

| Category | Reason code | Why this app touches it |
|---|---|---|
| `NSPrivacyAccessedAPICategoryUserDefaults` | `CA92.1` (access info only accessible to the app itself) | `AsyncStorage`, `expo-secure-store`, Firebase, and Sentry all read/write this app's own UserDefaults-backed storage — never a shared App Group |
| `NSPrivacyAccessedAPICategoryFileTimestamp` | `0A2A.1` (timestamps of files inside the app's own container) | Image picker and file-backed caches read file metadata inside the app's own sandbox |
| `NSPrivacyAccessedAPICategorySystemBootTime` | `35F9.1` (measure elapsed time within the app) | Sentry performance/crash timing and Firebase Analytics both measure elapsed time |
| `NSPrivacyAccessedAPICategoryDiskSpace` | `85F4.1` (check available space before writing) | Photo/incident-report upload flows check available space before writing a temporary file |

These are the standard, publicly-documented reason codes Apple and Expo's own guidance associate with exactly this stack (Expo-managed + Firebase + Sentry + AsyncStorage/SecureStore) — chosen conservatively (the narrowest reason that actually matches this app's real behavior for each category), not copy-pasted from an unrelated template.

## What this does NOT (and structurally cannot) verify

This declaration covers what **this app's own code and its bundled first-party SDKs** are known to do. It cannot verify the internal implementation details of every transitive third-party dependency's Required-Reason-API usage without either a real Xcode static analysis pass or Apple's own build-time validation — both of which require an actual `eas build`/Xcode run this environment cannot perform. **Recommended before submission**: run `eas build` (or `expo prebuild` + Xcode archive) once and let Apple's App Store Connect validation confirm no additional Required Reason API declarations are needed for any dependency not covered above — this is a build-time verification step, not a code change.

## File location

Declared in `app.config.ts`'s `ios` block (`ios.privacyManifests`), immediately following the existing `ios.config`/plugin comments explaining where the NS*UsageDescription strings come from — kept in the same file as every other iOS-specific declaration so there's one place to look, consistent with this file's existing organization.
