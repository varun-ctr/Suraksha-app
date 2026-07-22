import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { GradientHeader } from "@/shared/components/Headers";
import { Icon } from "@/shared/components/Icon";
import { Card, Chip, IconBadge } from "@/shared/components/ui";
import { withAlpha } from "@/shared/theme/colors";
import { RIGHTS_CATEGORIES } from "@/shared/utils/data";
import { useI18n } from "@/features/settings/context/LanguageContext";
import { useTheme } from "@/features/settings/context/ThemeContext";
import { useToast } from "@/features/settings/context/ToastContext";
import { callNumber } from "@/shared/utils/native";
import { useRightsScreen } from "@/features/community/hooks/useRightsScreen";
import type { RightsTab } from "@/features/community/hooks/useRightsScreen";

const QUICK_NUMBERS = [
  { label: { en: "Police", hi: "पुलिस" }, num: "100" },
  { label: { en: "Women Helpline", hi: "महिला हेल्पलाइन" }, num: "1091" },
  { label: { en: "Childline", hi: "चाइल्डलाइन" }, num: "1098" },
];

export default function RightsScreen() {
  const { c } = useTheme();
  const { t, pick } = useI18n();
  const { showToast } = useToast();

  const {
    tab, selectTab, search, setSearch, activeCat, setActiveCat,
    visible, onCardPress, isBookmarked, toggle,
  } = useRightsScreen();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <GradientHeader
        title={t("rights.title")}
        subtitle={t("rights.sub")}
        colors={[c.police, "#173A8C"]}
      />

      <View style={{ paddingHorizontal: 18, marginTop: 16 }}>
        {/* ── Quick dial numbers ── */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
          {QUICK_NUMBERS.map((n) => (
            <Pressable
              key={n.num}
              onPress={() => {
                showToast(`${t("common.calling")} ${n.num}…`);
                callNumber(n.num);
              }}
              style={[styles.numCard, { backgroundColor: c.card, borderColor: c.border }]}
            >
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.accent }}>{n.num}</Text>
              <Text style={{ fontSize: 10.5, fontFamily: "Inter_600SemiBold", color: c.text, marginTop: 2, textAlign: "center" }}>
                {pick(n.label)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Tab bar ── */}
        <View style={[styles.tabBar, { backgroundColor: c.cardAlt, borderColor: c.border }]}>
          {(["all", "bookmarks"] as RightsTab[]).map((key) => {
            const active = tab === key;
            const label = key === "all" ? t("rights.allTab") : t("rights.bookmarksTab");
            const icon: "book" | "bookmark" = key === "all" ? "book" : "bookmark";
            return (
              <Pressable
                key={key}
                onPress={() => selectTab(key)}
                style={[
                  styles.tabBtn,
                  active && { backgroundColor: c.card, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
                ]}
              >
                <Icon name={icon} size={14} color={active ? c.police : c.textMuted} />
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
                    color: active ? c.police : c.textMuted,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Search (All tab only) ── */}
        {tab === "all" && (
          <>
            <View
              style={[
                styles.searchBar,
                { backgroundColor: c.card, borderColor: c.border },
              ]}
            >
              <Icon name="search" size={16} color={c.textFaint} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t("rights.searchPlaceholder")}
                placeholderTextColor={c.textFaint}
                style={{ flex: 1, fontSize: 14, color: c.text, paddingVertical: 0 }}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")} hitSlop={8}>
                  <Icon name="x" size={15} color={c.textFaint} />
                </Pressable>
              )}
            </View>

            {/* ── Category chips ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
              style={{ marginBottom: 14 }}
            >
              <Chip
                label={t("rights.allCat")}
                active={activeCat === "all"}
                onPress={() => setActiveCat("all")}
                color={c.police}
              />
              {RIGHTS_CATEGORIES.map((cat) => (
                <Chip
                  key={cat.key}
                  label={pick(cat)}
                  active={activeCat === cat.key}
                  onPress={() => setActiveCat(cat.key)}
                  color={c.police}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Empty states ── */}
        {visible.length === 0 && tab === "bookmarks" && (
          <View style={[styles.empty, { backgroundColor: withAlpha(c.police, 0.06), borderColor: withAlpha(c.police, 0.15) }]}>
            <Icon name="bookmark" size={28} color={c.police} />
            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text, marginTop: 10, textAlign: "center" }}>
              {t("rights.bookmarksTab")}
            </Text>
            <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 6, textAlign: "center", lineHeight: 20 }}>
              {t("rights.noBookmarks")}
            </Text>
          </View>
        )}
        {visible.length === 0 && tab === "all" && (
          <View style={[styles.empty, { backgroundColor: withAlpha(c.police, 0.06), borderColor: withAlpha(c.police, 0.15) }]}>
            <Icon name="search" size={28} color={c.police} />
            <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 10, textAlign: "center" }}>
              {t("rights.noResults")}
            </Text>
          </View>
        )}

        {/* ── Rights cards ── */}
        {visible.map((r) => {
          const color = r.color(c);
          const bookmarked = isBookmarked(r.id);
          const catMeta = RIGHTS_CATEGORIES.find((cat) => cat.key === r.category);
          return (
            <Card key={r.id} style={{ marginBottom: 10, padding: 14 }}>
              <Pressable
                onPress={() => onCardPress(r.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <IconBadge name={r.icon} color={color} size={18} box={38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.text }}>{r.title}</Text>
                  <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 1 }} numberOfLines={1}>{r.subtitle}</Text>
                  {catMeta && (
                    <View style={[styles.catPill, { backgroundColor: withAlpha(color, 0.08) }]}>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color }}>{pick(catMeta)}</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={(e) => { e.stopPropagation?.(); toggle(r.id); }}
                  hitSlop={10}
                  style={[
                    styles.bkmBtn,
                    { backgroundColor: bookmarked ? withAlpha(color, 0.1) : withAlpha(c.primary, 0.06) },
                  ]}
                >
                  <Icon
                    name={bookmarked ? "bookmarkFilled" : "bookmark"}
                    size={16}
                    color={bookmarked ? color : c.textFaint}
                  />
                </Pressable>
                <Icon name="chevronRight" size={16} color={c.textFaint} />
              </Pressable>
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  numCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
  },
  catPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 5,
  },
  bkmBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    marginBottom: 16,
  },
});
