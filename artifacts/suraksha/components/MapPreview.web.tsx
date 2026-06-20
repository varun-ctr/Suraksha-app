import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import type { GeoPoint, LocationStatus } from "@/lib/location";

/**
 * Web fallback: react-native-maps has no web implementation, so we render a
 * stylised faux-map. It only ever shows the user's own position — no fake
 * places — and surfaces an honest message when location is unavailable.
 */
export function MapPreview({
  point,
  status,
}: {
  point: GeoPoint | null;
  status: LocationStatus;
}) {
  const { c, radius } = useTheme();
  const { t } = useI18n();
  return (
    <View style={[styles.wrap, { borderRadius: radius + 2, borderColor: c.border }]}>
      <LinearGradient
        colors={["#CFE8D6", "#BFE0DB", "#D9E7C8", "#CFE0CF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.road, { top: "46%", left: 0, right: 0, height: 6 }]} />
      <View style={[styles.road, { left: "40%", top: 0, bottom: 0, width: 6 }]} />

      {point ? (
        <View style={[styles.userWrap, { left: "45%", top: "48%" }]}>
          <View style={[styles.userRing, { borderColor: c.primary }]} />
          <View style={[styles.userDot, { backgroundColor: c.primary }]} />
        </View>
      ) : (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={[styles.overlayText, { color: c.text, backgroundColor: c.card, borderColor: c.border }]}>
            {status === "loading" ? t("home.locating") : t("map.locationOff")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 230,
    overflow: "hidden",
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
  },
  road: { position: "absolute", backgroundColor: "rgba(255,255,255,0.65)" },
  userWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  userRing: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    opacity: 0.5,
  },
  userDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: "#fff" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  overlayText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
});
