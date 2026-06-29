import fs from "fs";
import path from "path";
import type { ExpoConfig } from "expo/config";

const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "YOUR_GOOGLE_MAPS_API_KEY";
const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim() || "https://example.com";
const googleServicesPath = path.resolve(__dirname, "google-services.json");
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? (fs.existsSync(googleServicesPath) ? "./google-services.json" : undefined);

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
    [
      "expo-notifications",
      {
        icon: "./assets/images/icon.png",
        color: "#7C3AED",
        sounds: [],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    googleMapsApiKey: mapsKey,
    backendUrl,
  },
};

export default config;
