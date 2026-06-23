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
