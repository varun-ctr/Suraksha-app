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
    // Not yet invoked anywhere in the app (see core/permissions/biometrics.ts
    // — the capability is ready but not wired into a login/unlock flow yet).
    // Declared now so NSFaceIDUsageDescription is already in place in
    // Info.plist for when it is, rather than needing a config change at the
    // same time as the first feature that actually calls authenticateAsync().
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
