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
              Missing environment variables:
            </Text>
            {missing.map((key) => (
              <Text key={key} style={styles.devItem}>
                • {key}
              </Text>
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
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  devItem: {
    fontSize: 12,
    color: "#e2e8f0",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 5,
    lineHeight: 18,
  },
});
