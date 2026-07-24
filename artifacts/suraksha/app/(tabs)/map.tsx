import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NativeMap } from "@/features/journey/components/NativeMap";
import { Icon } from "@/shared/components/Icon";
import { withAlpha } from "@/shared/theme/colors";
import { useI18n } from "@/features/settings/context/LanguageContext";
import { useTheme } from "@/shared/theme/ThemeContext";
import { navigateTo, searchNearby } from "@/shared/utils/native";
import { CATEGORIES, useMapScreen } from "@/features/journey/hooks/useMapScreen";

export default function MapScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const {
    isDark, point, status, refresh,
    coords, useExternalMaps,
    places, activeCategory, loadingCategory, noResults,
    handleCategoryTap, activeCatDef, noteKey,
  } = useMapScreen();

  // ── Web + Expo Go: scrollable category list that opens the maps app ────────
  if (useExternalMaps) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: c.bg }}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            paddingTop: insets.top + 14,
            paddingHorizontal: 18,
            paddingBottom: 10,
          }}
        >
          <Text
            style={{ fontSize: 19, fontFamily: "Inter_700Bold", color: c.text }}
          >
            {t("map.title")}
          </Text>
          <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>
            {t("map.sub")}
          </Text>
        </View>

        {status === "denied" && (
          <View
            style={[
              styles.notice,
              {
                backgroundColor: withAlpha(c.warning, 0.1),
                borderColor: withAlpha(c.warning, 0.25),
              },
            ]}
          >
            <Icon name="info" size={14} color={c.warning} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11.5, color: c.text, lineHeight: 17 }}>
                {t("map.locationOff")}
              </Text>
              <Pressable
                onPress={refresh}
                style={[styles.refreshBtn, { borderColor: c.border }]}
              >
                <Text
                  style={{
                    color: c.primary,
                    fontSize: 11,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {t("map.enableLocation")}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <View
          style={[
            styles.notice,
            {
              backgroundColor: withAlpha(c.primary, 0.08),
              borderColor: withAlpha(c.primary, 0.2),
            },
          ]}
        >
          <Icon name="search" size={14} color={c.primary} />
          <Text
            style={{ flex: 1, fontSize: 11.5, color: c.text, lineHeight: 17 }}
          >
            {t(noteKey)}
          </Text>
        </View>

        <View style={styles.grid}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              onPress={() => searchNearby(cat.query, coords)}
              style={({ pressed }) => [
                styles.catCard,
                {
                  backgroundColor: c.card,
                  borderColor: c.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.catIcon,
                  { backgroundColor: withAlpha(cat.color(c), 0.12) },
                ]}
              >
                <Icon name={cat.icon} size={20} color={cat.color(c)} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 13.5,
                  fontFamily: "Inter_700Bold",
                  color: c.text,
                }}
              >
                {t(cat.labelKey)}
              </Text>
              <Icon name="navigation" size={16} color={c.textFaint} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ── Native: Google Maps SDK with live GPS + place markers ───────────────────
  // Memoized so NativeMap's markers prop keeps a stable array/object identity
  // across renders that don't actually change the place list (e.g. the ~5s
  // GPS-driven camera updates inside NativeMap itself, or any other
  // unrelated re-render of this screen) — without this, every Marker was
  // rebuilt with brand-new object/closure identities on every render.
  const markers = useMemo(
    () =>
      places.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        name: p.name,
        address: p.address,
        pinColor: activeCatDef ? activeCatDef.color(c) : c.primary,
        onNavigate: () => {
          void navigateTo(p.lat, p.lng, p.name);
        },
      })),
    [places, activeCatDef, c],
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <NativeMap
        lat={point?.lat}
        lng={point?.lng}
        markers={markers}
        isDark={isDark}
      />

      {/* Header overlay */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text
          style={{
            fontSize: 17,
            fontFamily: "Inter_700Bold",
            color: "#fff",
            textShadowColor: "rgba(0,0,0,0.4)",
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
          }}
        >
          {t("map.title")}
        </Text>
      </View>

      {/* Bottom panel */}
      <View
        style={[
          styles.bottomPanel,
          { backgroundColor: c.card, paddingBottom: insets.bottom + 12 },
        ]}
      >
        {status === "denied" && (
          <View
            style={[
              styles.inlineNotice,
              {
                backgroundColor: withAlpha(c.warning, 0.1),
                borderColor: withAlpha(c.warning, 0.25),
              },
            ]}
          >
            <Icon name="info" size={13} color={c.warning} />
            <Text style={{ flex: 1, fontSize: 11, color: c.text }}>
              {t("map.locationOff")}
            </Text>
          </View>
        )}

        {noResults && (
          <View
            style={[
              styles.inlineNotice,
              {
                backgroundColor: withAlpha(c.textMuted, 0.08),
                borderColor: c.border,
              },
            ]}
          >
            <Icon name="search" size={13} color={c.textMuted} />
            <Text style={{ flex: 1, fontSize: 11, color: c.textMuted }}>
              {t("map.noResults")}
            </Text>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: 10,
            paddingHorizontal: 2,
            paddingBottom: 2,
          }}
        >
          {CATEGORIES.map((cat) => {
            const color = cat.color(c);
            const isLoading = loadingCategory === cat.key;
            const isActive = activeCategory === cat.key && places.length > 0;
            return (
              <Pressable
                key={cat.key}
                onPress={() => {
                  void handleCategoryTap(cat);
                }}
                style={[
                  styles.chipCard,
                  {
                    backgroundColor: isActive
                      ? withAlpha(color, 0.15)
                      : c.cardAlt,
                    borderColor: isActive ? color : c.border,
                    borderWidth: isActive ? 1.5 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.chipIcon,
                    { backgroundColor: withAlpha(color, 0.12) },
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={color} />
                  ) : (
                    <Icon name={cat.icon} size={18} color={color} />
                  )}
                </View>
                <Text
                  style={{
                    fontSize: 12.5,
                    fontFamily: "Inter_600SemiBold",
                    color: c.text,
                  }}
                >
                  {t(cat.labelKey)}
                </Text>
                <Icon name="navigation" size={13} color={c.textFaint} />
              </Pressable>
            );
          })}
        </ScrollView>

        <Text
          style={{
            fontSize: 10,
            color: c.textFaint,
            marginTop: 8,
            textAlign: "center",
          }}
        >
          {t(noteKey)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
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
  inlineNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
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
  catIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtn: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
