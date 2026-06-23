import type { ExpoConfig } from "expo/config";

/**
 * Dynamic Expo config — reads EXPO_PUBLIC_GOOGLE_MAPS_API_KEY from the environment
 * so native builds pick up the Google Maps SDK key without hardcoding it.
 *
 * Required environment variables:
 *   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY  — Google Maps SDK key (Android + iOS)
 *     Scopes needed: Maps SDK for Android, Maps SDK for iOS, Places API (New)
 *
 * Set this in Replit Secrets or in a local .env file before running an EAS build.
 * The value is embedded into the native binary at build time — it is NOT a runtime
 * secret. Restrict the key to your app's package/bundle identifier in Google Cloud.
 */

const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const config: ExpoConfig = {
  name: "Sakhi Suraksha",
  slug: "sakhisuraksha",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "sakhisuraksha",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.sakhisuraksha.app",
    config: {
      googleMapsApiKey: mapsKey,
    },
  },
  android: {
    package: "com.sakhisuraksha.app",
    /**
     * FCM: download google-services.json from Firebase Console and place it at
     * the project root, then set GOOGLE_SERVICES_JSON env var to that path (or
     * leave unset to use the default). EAS Build will embed it automatically.
     */
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
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
    [
      "expo-notifications",
      {
        /**
         * Notification icon shown on Android (monochrome, white on transparent).
         * Replace with a dedicated 96×96 px monochrome asset for production.
         */
        icon: "./assets/images/icon.png",
        color: "#7C3AED",
        sounds: [],
        /**
         * FCM (Android) setup:
         *   1. Open Firebase Console → Project Settings → Your apps → Android app
         *   2. Download google-services.json and place it in the project root
         *   3. Set android.googleServicesFile = "./google-services.json" in this file
         *
         * APNs (iOS) setup:
         *   1. In Expo dashboard (expo.dev) → Credentials → iOS → Add APNs key (.p8)
         *   2. EAS Build picks it up automatically — no extra key needed here
         */
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    googleMapsApiKey: mapsKey,
  },
};

export default config;
