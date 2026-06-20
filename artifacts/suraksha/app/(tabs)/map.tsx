import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { MapPreview } from "@/components/MapPreview";
import { withAlpha } from "@/constants/colors";
import type { IconName } from "@/constants/data";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useLocation } from "@/hooks/useLocation";
import { searchNearby } from "@/lib/native";

interface CategoryDef {
  key: string;
  labelKey: string;
  /** English search term passed to the maps provider. */
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

export default function MapScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { point, status } = useLocation();

  const coords = point ? { lat: point.lat, lng: point.lng } : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 10 }}>
        <Text style={{ fontSize: 19, fontFamily: "Inter_700Bold", color: c.text }}>{t("map.title")}</Text>
        <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>{t("map.sub")}</Text>
      </View>

      <MapPreview point={point} status={status} />

      {status === "denied" && (
        <View
          style={[
            styles.notice,
            { backgroundColor: withAlpha(c.warning, 0.1), borderColor: withAlpha(c.warning, 0.25) },
          ]}
        >
          <Icon name="info" size={14} color={c.warning} />
          <Text style={{ flex: 1, fontSize: 11.5, color: c.text, lineHeight: 17 }}>{t("map.locationOff")}</Text>
        </View>
      )}

      <View
        style={[
          styles.notice,
          { backgroundColor: withAlpha(c.primary, 0.08), borderColor: withAlpha(c.primary, 0.2) },
        ]}
      >
        <Icon name="search" size={14} color={c.primary} />
        <Text style={{ flex: 1, fontSize: 11.5, color: c.text, lineHeight: 17 }}>{t("map.note")}</Text>
      </View>

      <View style={styles.grid}>
        {CATEGORIES.map((cat) => {
          const color = cat.color(c);
          return (
            <Pressable
              key={cat.key}
              onPress={() => searchNearby(cat.query, coords)}
              style={[styles.catCard, { backgroundColor: c.card, borderColor: c.border }]}
            >
              <View style={[styles.catIcon, { backgroundColor: withAlpha(color, 0.12) }]}>
                <Icon name={cat.icon} size={20} color={color} />
              </View>
              <Text style={{ flex: 1, fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.text }}>{t(cat.labelKey)}</Text>
              <Icon name="navigation" size={16} color={c.textFaint} />
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 18,
    marginBottom: 12,
  },
  grid: { paddingHorizontal: 18, gap: 10 },
  catCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  catIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
});
