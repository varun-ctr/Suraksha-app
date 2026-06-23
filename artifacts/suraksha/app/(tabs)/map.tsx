import React, { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { withAlpha } from "@/constants/colors";
import type { IconName } from "@/constants/data";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useLocation } from "@/hooks/useLocation";
import { searchNearby, navigateTo } from "@/lib/native";
import { fetchNearbyPlaces, type NearbyPlace, type PlaceCategory } from "@/lib/nearbyPlaces";

interface CategoryDef {
  key: PlaceCategory;
  labelKey: string;
  query: string;
  icon: IconName;
  color: (c: ReturnType<typeof useTheme>["c"]) => string;
}

const CATEGORIES: CategoryDef[] = [
  { key: "police", labelKey: "map.police", query: "police station", icon: "shield", color: (c) => c.police },
  { key: "hospital", labelKey: "map.hospital", query: "hospital", icon: "hospital", color: (c) => c.hospital },
  { key: "pharmacy", labelKey: "map.pharmacy", query: "pharmacy", icon: "store", color: (c) => c.shops },
  { key: "shelter", labelKey: "map.shelter", query: "women shelter", icon: "home", color: (c) => c.shelter },
];

const INDIA = { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 24, longitudeDelta: 24 };

export default function MapScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { point, status } = useLocation();

  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [activeCategory, setActiveCategory] = useState<PlaceCategory | null>(null);
  const [loadingCategory, setLoadingCategory] = useState<PlaceCategory | null>(null);
  const [noResults, setNoResults] = useState(false);

  const coords = point ? { lat: point.lat, lng: point.lng } : null;

  const handleCategoryTap = async (cat: CategoryDef) => {
    // Always open external maps as a fallback
    void searchNearby(cat.query, coords);

    if (!coords) return;

    setLoadingCategory(cat.key);
    setNoResults(false);
    const results = await fetchNearbyPlaces(coords.lat, coords.lng, cat.key);
    setLoadingCategory(null);
    setActiveCategory(cat.key);

    if (results.length === 0) {
      setNoResults(true);
      setPlaces([]);
    } else {
      setNoResults(false);
      setPlaces(results);
    }
  };

  const activeCatDef = CATEGORIES.find((c) => c.key === activeCategory);

  if (Platform.OS === "web") {
    // Web keeps the original faux-map fallback
    const MapPreview = require("@/components/MapPreview.web").MapPreview;
    return (
      <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 10 }}>
          <Text style={{ fontSize: 19, fontFamily: "Inter_700Bold", color: c.text }}>{t("map.title")}</Text>
          <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>{t("map.sub")}</Text>
        </View>
        <MapPreview point={point} status={status} />
        <View style={[styles.notice, { backgroundColor: withAlpha(c.primary, 0.08), borderColor: withAlpha(c.primary, 0.2) }]}>
          <Icon name="search" size={14} color={c.primary} />
          <Text style={{ flex: 1, fontSize: 11.5, color: c.text, lineHeight: 17 }}>{t("map.note")}</Text>
        </View>
        <View style={styles.grid}>
          {CATEGORIES.map((cat) => (
            <Pressable key={cat.key} onPress={() => searchNearby(cat.query, coords)}
              style={[styles.catCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={[styles.catIcon, { backgroundColor: withAlpha(cat.color(c), 0.12) }]}>
                <Icon name={cat.icon} size={20} color={cat.color(c)} />
              </View>
              <Text style={{ flex: 1, fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.text }}>{t(cat.labelKey)}</Text>
              <Icon name="navigation" size={16} color={c.textFaint} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Live MapView */}
      <MapView
        style={StyleSheet.absoluteFill}
        showsUserLocation
        showsMyLocationButton={false}
        region={
          point
            ? { latitude: point.lat, longitude: point.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
            : INDIA
        }
      >
        {places.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            pinColor={activeCatDef ? activeCatDef.color(c) : c.primary}
          >
            <Callout onPress={() => navigateTo(p.lat, p.lng, p.name)}>
              <View style={styles.callout}>
                <Text style={styles.calloutName}>{p.name}</Text>
                {!!p.address && <Text style={styles.calloutAddr}>{p.address}</Text>}
                <Text style={styles.calloutNav}>{t("map.navigateTip")} →</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Header overlay */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff", textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>
          {t("map.title")}
        </Text>
      </View>

      {/* Bottom panel */}
      <View style={[styles.bottomPanel, { backgroundColor: c.card, paddingBottom: insets.bottom + 12 }]}>
        {status === "denied" && (
          <View style={[styles.notice, { backgroundColor: withAlpha(c.warning, 0.1), borderColor: withAlpha(c.warning, 0.25), marginHorizontal: 0, marginBottom: 8 }]}>
            <Icon name="info" size={13} color={c.warning} />
            <Text style={{ flex: 1, fontSize: 11, color: c.text }}>{t("map.locationOff")}</Text>
          </View>
        )}

        {noResults && (
          <View style={[styles.notice, { backgroundColor: withAlpha(c.textMuted, 0.08), borderColor: c.border, marginHorizontal: 0, marginBottom: 8 }]}>
            <Icon name="search" size={13} color={c.textMuted} />
            <Text style={{ flex: 1, fontSize: 11, color: c.textMuted }}>
              {t("map.noResults")}
            </Text>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 2, paddingBottom: 2 }}>
          {CATEGORIES.map((cat) => {
            const color = cat.color(c);
            const isLoading = loadingCategory === cat.key;
            const isActive = activeCategory === cat.key && places.length > 0;
            return (
              <Pressable
                key={cat.key}
                onPress={() => handleCategoryTap(cat)}
                style={[
                  styles.chipCard,
                  {
                    backgroundColor: isActive ? withAlpha(color, 0.15) : c.cardAlt,
                    borderColor: isActive ? color : c.border,
                    borderWidth: isActive ? 1.5 : 1,
                  },
                ]}
              >
                <View style={[styles.chipIcon, { backgroundColor: withAlpha(color, 0.12) }]}>
                  {isLoading
                    ? <ActivityIndicator size="small" color={color} />
                    : <Icon name={cat.icon} size={18} color={color} />}
                </View>
                <Text style={{ fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: c.text }}>{t(cat.labelKey)}</Text>
                <Icon name="navigation" size={13} color={c.textFaint} />
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={{ fontSize: 10, color: c.textFaint, marginTop: 8, textAlign: "center" }}>
          {t("map.note")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 18, paddingBottom: 12,
  },
  bottomPanel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 14, paddingTop: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 8,
  },
  notice: {
    flexDirection: "row", alignItems: "flex-start", gap: 9,
    borderWidth: 1, borderRadius: 12, padding: 10,
    marginHorizontal: 18, marginBottom: 12,
  },
  grid: { paddingHorizontal: 18, gap: 10 },
  catCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderRadius: 16, padding: 14,
  },
  catIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  chipCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
  },
  chipIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  callout: { width: 200, padding: 4 },
  calloutName: { fontSize: 13, fontWeight: "700", color: "#1A0A2E", marginBottom: 3 },
  calloutAddr: { fontSize: 11, color: "#555", marginBottom: 4, lineHeight: 15 },
  calloutNav: { fontSize: 11, color: "#7C3AED", fontWeight: "600" },
});
