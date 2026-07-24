import fs from "fs";
import path from "path";
import type { ExpoConfig } from "expo/config";

const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "YOUR_GOOGLE_MAPS_API_KEY";
const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim() || "https://example.com";
const googleServicesPath = path.resolve(__dirname, "google-services.json");
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? (fs.existsSync(googleServicesPath) ? "./google-services.json" : undefined);

// The EAS project id ties this app to an Expo project for build/update/submit.
// `eas init` writes the real id here (or set EXPO_PUBLIC_EAS_PROJECT_ID). Until
// then it stays a placeholder and `updates`/`runtimeVersion` below are inert.
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || "TODO_EAS_PROJECT_ID";
// The Expo account/org that owns the project — set by `eas init`.
const easOwner = process.env.EXPO_PUBLIC_EAS_OWNER?.trim() || undefined;

const config: ExpoConfig = {
  name: "Sakhi Suraksha",
  slug: "sakhisuraksha",
  version: "1.0.0",
  owner: easOwner,
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "sakhisuraksha",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  // OTA JS-only updates via EAS Update. runtimeVersion is tied to the native
  // app version so a JS update only lands on builds with a compatible binary.
  runtimeVersion: { policy: "appVersion" },
  updates: {
    url: `https://u.expo.dev/${easProjectId}`,
    fallbackToCacheTimeout: 0,
  },
  splash: {
    image: "./assets/images/icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.sakhisuraksha.app",
    buildNumber: "1",
    usesAppleSignIn: true,
    config: {
      googleMapsApiKey: mapsKey,
      // No custom encryption beyond standard HTTPS — declaring this skips the
      // App Store Connect export-compliance prompt on every submission.
      usesNonExemptEncryption: false,
    },
    // NS*UsageDescription strings are supplied via the expo-location /
    // expo-image-picker / expo-contacts plugin config below, which writes
    // them into Info.plist at prebuild time — kept in one place so the
    // wording can't drift between two config sites.
    //
    // Apple Privacy Manifest (PrivacyInfo.xcprivacy) — Expo generates and
    // bundles this file at prebuild/build time from the declarations below
    // (supported since Expo SDK 50+; no native ios/ directory needed). See
    // docs/security-hardening/03-Privacy-Manifest.md for the full
    // per-declaration rationale.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePreciseLocation",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhoneNumber",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeEmailAddress",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhotosorVideos",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherUserContent",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeUserID",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          // Sentry crash reports (see core/analytics/crashReporting.ts) —
          // not linked to a user identity: this app never calls
          // Sentry.setUser()/setTag() with any identifying value.
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeCrashData",
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
      ],
      // "Required Reason" API categories — declared for the APIs this app's
      // own code and its bundled SDKs (Firebase, Sentry, AsyncStorage,
      // expo-secure-store, image picker) are known to touch. Reason codes
      // are Apple's own standard, publicly documented codes for exactly
      // this kind of Expo/React-Native + Firebase + Sentry app.
      NSPrivacyAccessedAPITypes: [
        {
          // AsyncStorage / expo-secure-store / Firebase / Sentry all read
          // or write this app's own UserDefaults-backed storage.
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          // Image picker / file-backed caches read file metadata inside
          // the app's own container.
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["0A2A.1"],
        },
        {
          // Sentry performance/crash timing and Firebase Analytics both
          // measure elapsed time within the app.
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
        {
          // Photo/incident-report upload flows check available space
          // before writing a temporary file.
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["85F4.1"],
        },
      ],
    },
  },
  android: {
    package: "com.sakhisuraksha.app",
    versionCode: 1,
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: "./assets/images/icon.png",
      backgroundColor: "#7C3AED",
    },
    permissions: [
      "CAMERA",
      "READ_CONTACTS",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "POST_NOTIFICATIONS",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
    ],
    googleServicesFile,
    config: {
      googleMaps: {
        apiKey: mapsKey,
      },
    },
  },
  web: {
    favicon: "./assets/images/icon.png",
  },
  plugins: [
    [
      "expo-router",
      {
        origin: "https://replit.com/",
      },
    ],
    "expo-font",
    "expo-web-browser",
    "expo-secure-store",
    "expo-task-manager",
    [
      "expo-notifications",
      {
        icon: "./assets/images/icon.png",
        color: "#7C3AED",
        sounds: [],
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Suraksha uses your location to share it with your trusted contacts during an SOS alert, show nearby police stations, hospitals, and shelters on the map, and include it in your incident reports.",
        // "Always" is only ever requested while an active SOS needs it (see
        // core/permissions/backgroundLocation.ts) — it keeps live location
        // updates reaching your trusted contacts if you switch apps or the
        // screen locks during an emergency, which is exactly when that's
        // most likely to happen. UIBackgroundModes:["location"] and the
        // Android background-location/foreground-service permissions are
        // added by this plugin from the two isXBackgroundLocationEnabled
        // flags below, rather than declared by hand, so they can't drift
        // out of sync with each other.
        locationAlwaysAndWhenInUsePermission:
          "Suraksha uses your location in the background only while an SOS is active, so your live location keeps reaching your trusted contacts if you switch apps or your screen locks during an emergency.",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Suraksha lets you choose a photo from your library for your trusted-contact avatar, your profile picture, or an incident report.",
        cameraPermission:
          "Suraksha uses your camera to take a photo for your trusted-contact avatar or to attach to an incident report.",
        microphonePermission: false,
      },
    ],
    [
      "expo-contacts",
      {
        contactsPermission:
          "Suraksha uses your contacts so you can quickly pick trusted contacts to receive your SOS alerts.",
      },
    ],
    "expo-apple-authentication",
    // Powers the opt-in App Lock feature (default off — see
    // features/security/hooks/useAppLock.ts and AppContext's
    // settings.appLockEnabled), which calls authenticateAsync() on iOS.
    [
      "expo-local-authentication",
      {
        faceIDPermission: "Suraksha can use Face ID to quickly and securely unlock the app.",
      },
    ],
    ...(process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME
      ? ([
          [
            "@react-native-google-signin/google-signin",
            { iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME },
          ],
        ] as [string, any][])
      : []),
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    googleMapsApiKey: mapsKey,
    backendUrl,
    eas: {
      projectId: easProjectId,
    },
  },
};

export default config;
