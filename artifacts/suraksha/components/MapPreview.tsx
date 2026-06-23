import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";

import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import type { GeoPoint, LocationStatus } from "@/lib/location";
import { DARK_MAP_STYLE } from "@/lib/mapStyle";

/** Neutral fallback region (India) used only until the real location is known. */
const INDIA = { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 24, longitudeDelta: 24 };

export function MapPreview({
  point,
  status,
}: {
  point: GeoPoint | null;
  status: LocationStatus;
}) {
  const { c, radius, isDark } = useTheme();
  const { t } = useI18n();

  const provider = Platform.OS !== "web" ? PROVIDER_GOOGLE : undefined;

  return (
    <View style={[styles.wrap, { borderRadius: radius + 2 }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={provider}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        customMapStyle={isDark ? DARK_MAP_STYLE : []}
        region={
          point
            ? {
                latitude: point.lat,
                longitude: point.lng,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }
            : INDIA
        }
      />
      {!point && (
        <View style={styles.overlay} pointerEvents="none">
          <Text
            style={[
              styles.overlayText,
              { color: c.text, backgroundColor: c.card, borderColor: c.border },
            ]}
          >
            {status === "loading" ? t("home.locating") : t("map.locationOff")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 230, overflow: "hidden", marginHorizontal: 18, marginBottom: 14 },
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
