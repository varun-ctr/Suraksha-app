import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Props {
  missing: string[];
}

/** Where to get each required var's value, shown next to it in dev. */
const VAR_SOURCE: Record<string, string> = {
  EXPO_PUBLIC_SUPABASE_URL: "Supabase Dashboard → Project Settings → API → Project URL",
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "Supabase Dashboard → Project Settings → API → anon/publishable key",
  EXPO_PUBLIC_FIREBASE_API_KEY: "Firebase Console → Project Settings → General → Your apps → Web app config",
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "Firebase Console → Project Settings → General → Your apps → Web app config",
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: "Firebase Console → Project Settings → General → Project ID",
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: "Firebase Console → Project Settings → General → Your apps → Web app config",
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "Firebase Console → Project Settings → Cloud Messaging → Sender ID",
  EXPO_PUBLIC_FIREBASE_APP_ID: "Firebase Console → Project Settings → General → Your apps → Web app config",
};

export function ConfigErrorScreen({ missing }: Props) {
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconBadge}>
          <Text style={styles.iconGlyph}>⚙</Text>
        </View>

        <Text style={styles.title}>Configuration Error</Text>

        <Text style={styles.body}>
          Some required application services are not configured.
          {"\n\n"}
          Please contact the administrator.
        </Text>

        {__DEV__ && missing.length > 0 && (
          <View style={styles.devBox}>
            <Text style={styles.devTitle}>
              Missing environment variables ({missing.length})
            </Text>
            <Text style={styles.devIntro}>
              Add each one in Replit → Tools → Secrets, then restart the Expo
              workflow so the new values are picked up.
            </Text>
            {missing.map((key) => (
              <View key={key} style={styles.devItemRow}>
                <Text style={styles.devItemKey}>• {key}</Text>
                {VAR_SOURCE[key] && (
                  <Text style={styles.devItemSource}>{VAR_SOURCE[key]}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1e293b",
    borderWidth: 2,
    borderColor: "#e11d48",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  iconGlyph: {
    fontSize: 36,
    color: "#e11d48",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f1f5f9",
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 23,
    maxWidth: 320,
  },
  devBox: {
    marginTop: 36,
    width: "100%",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 16,
  },
  devTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#f59e0b",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  devIntro: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 17,
    marginBottom: 14,
  },
  devItemRow: {
    marginBottom: 10,
  },
  devItemKey: {
    fontSize: 12.5,
    color: "#e2e8f0",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 18,
  },
  devItemSource: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
    marginLeft: 12,
    lineHeight: 15,
  },
});
