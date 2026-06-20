import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { MapPreview } from "@/components/MapPreview";
import { Card, Chip, IconBadge } from "@/components/ui";
import { type IconName, type Place, type PlaceCategory, PLACES } from "@/constants/data";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { callNumber, navigateTo } from "@/lib/native";

const FILTERS: { key: PlaceCategory | "All"; labelKey: string }[] = [
  { key: "All", labelKey: "map.all" },
  { key: "Police", labelKey: "map.police" },
  { key: "Hospital", labelKey: "map.hospital" },
  { key: "Shelter", labelKey: "map.shelter" },
  { key: "Shops", labelKey: "map.shops" },
];

const CAT_ICON: Record<PlaceCategory, IconName> = {
  Police: "shield",
  Hospital: "hospital",
  Shelter: "home",
  Shops: "store",
};

export default function MapScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<PlaceCategory | "All">("All");
  const [expanded, setExpanded] = useState<number | null>(null);

  const colorFor = (cat: PlaceCategory) =>
    ({ Police: c.police, Hospital: c.hospital, Shelter: c.shelter, Shops: c.shops })[cat];

  const filtered = useMemo(
    () => (filter === "All" ? PLACES : PLACES.filter((p) => p.category === filter)),
    [filter],
  );

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

      <MapPreview places={filtered} colorFor={colorFor} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 18, paddingBottom: 14 }}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={t(f.labelKey)}
            active={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 18 }}>
        {filtered.map((p: Place) => {
          const isOpen = expanded === p.id;
          const color = colorFor(p.category);
          return (
            <Card key={p.id} style={{ marginBottom: 10, padding: 14 }}>
              <Pressable
                onPress={() => setExpanded(isOpen ? null : p.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <IconBadge name={CAT_ICON[p.category]} color={color} size={17} box={38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.text }}>{p.name}</Text>
                  <Text style={{ fontSize: 11.5, color: c.textMuted, marginTop: 1 }}>{p.address}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 }}>
                    <Text style={{ fontSize: 11, color: c.textMuted }}>{p.distance}</Text>
                    <View style={[styles.safeBadge, { backgroundColor: c.successSoft }]}>
                      <Text style={{ fontSize: 10.5, fontFamily: "Inter_700Bold", color: c.success }}>
                        ✓ {t("map.safe")}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}>
                  <Icon name="chevronDown" size={16} color={c.textFaint} />
                </View>
              </Pressable>

              {isOpen && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border }}>
                  <Pressable
                    onPress={() => {
                      showToast(`${t("common.calling")} ${p.name}…`);
                      callNumber(p.phone);
                    }}
                    style={[styles.actBtn, { backgroundColor: c.success }]}
                  >
                    <Icon name="phone" size={14} color="#fff" />
                    <Text style={styles.actText}>{t("map.callNow")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      showToast(`${t("common.navigatingTo")} ${p.name}…`);
                      navigateTo(p.lat, p.lng, p.name);
                    }}
                    style={[styles.actBtn, { backgroundColor: c.primary }]}
                  >
                    <Icon name="navigation" size={14} color="#fff" />
                    <Text style={styles.actText}>{t("map.navigate")}</Text>
                  </Pressable>
                </View>
              )}
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  actBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  actText: { color: "#fff", fontSize: 12.5, fontFamily: "Inter_700Bold" },
});
