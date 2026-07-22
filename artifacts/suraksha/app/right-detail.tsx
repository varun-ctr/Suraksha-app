import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/shared/components/Icon";
import { withAlpha } from "@/shared/theme/colors";
import { RIGHTS, RIGHTS_CATEGORIES } from "@/shared/utils/data";
import { useBookmarks } from "@/features/community/hooks/useBookmarks";
import { useI18n } from "@/features/settings/context/LanguageContext";
import { useTheme } from "@/shared/theme/ThemeContext";

export default function RightDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const { t, pick } = useI18n();
  const { isBookmarked, toggle } = useBookmarks();
  const insets = useSafeAreaInsets();

  const right = RIGHTS.find((r) => r.id === Number(id));
  if (!right) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: c.textMuted }}>{t("notFound.body")}</Text>
      </View>
    );
  }

  const color = right.color(c);
  const bookmarked = isBookmarked(right.id);
  const catMeta = RIGHTS_CATEGORIES.find((cat) => cat.key === right.category);

  const onShare = async () => {
    try {
      await Share.share({
        title: right.title,
        message: `${right.title}\n${right.subtitle}\n\n${right.en}\n\nSteps:\n${right.steps.map((s, i) => `${i + 1}. ${s.en}`).join("\n")}`,
      });
    } catch {
      // ignore
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: c.card, borderBottomColor: c.border, paddingTop: insets.top + 10 },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Icon name="arrowLeft" size={22} color={c.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={1}>
          {right.title}
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <Pressable onPress={onShare} hitSlop={10} style={[styles.iconBtn, { backgroundColor: withAlpha(c.primary, 0.08) }]}>
            <Icon name="share" size={18} color={c.primary} />
          </Pressable>
          <Pressable
            onPress={() => toggle(right.id)}
            hitSlop={10}
            style={[
              styles.iconBtn,
              { backgroundColor: bookmarked ? withAlpha(color, 0.12) : withAlpha(c.primary, 0.08) },
            ]}
          >
            <Icon name={bookmarked ? "bookmarkFilled" : "bookmark"} size={18} color={bookmarked ? color : c.primary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon + category */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: withAlpha(color, 0.12),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name={right.icon} size={26} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: c.text, lineHeight: 24 }}>
              {right.title}
            </Text>
            <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 2 }}>{right.subtitle}</Text>
          </View>
        </View>

        {catMeta && (
          <View
            style={[
              styles.catChip,
              { backgroundColor: withAlpha(color, 0.1), borderColor: withAlpha(color, 0.25) },
            ]}
          >
            <Text style={{ fontSize: 11.5, fontFamily: "Inter_700Bold", color }}>
              {pick(catMeta)}
            </Text>
          </View>
        )}

        {/* Body */}
        <Text style={[styles.bodyText, { color: c.text }]}>{pick(right)}</Text>

        {/* Steps */}
        <View
          style={[
            styles.stepsCard,
            { backgroundColor: withAlpha(color, 0.05), borderColor: withAlpha(color, 0.15) },
          ]}
        >
          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color, marginBottom: 14 }}>
            {t("rights.stepsToTake")}
          </Text>
          {right.steps.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View
                style={[
                  styles.stepNum,
                  { backgroundColor: withAlpha(color, 0.15) },
                ]}
              >
                <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color }}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: c.text }]}>{pick(s)}</Text>
            </View>
          ))}
        </View>

        {/* Share / bookmark footer */}
        <View style={styles.footer}>
          <Pressable
            onPress={onShare}
            style={[styles.footerBtn, { backgroundColor: withAlpha(c.primary, 0.08), borderColor: withAlpha(c.primary, 0.2) }]}
          >
            <Icon name="share" size={16} color={c.primary} />
            <Text style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.primary }}>
              {t("rights.share")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => toggle(right.id)}
            style={[
              styles.footerBtn,
              {
                backgroundColor: bookmarked ? withAlpha(color, 0.1) : withAlpha(c.primary, 0.08),
                borderColor: bookmarked ? withAlpha(color, 0.3) : withAlpha(c.primary, 0.2),
              },
            ]}
          >
            <Icon name={bookmarked ? "bookmarkFilled" : "bookmark"} size={16} color={bookmarked ? color : c.primary} />
            <Text style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: bookmarked ? color : c.primary }}>
              {bookmarked ? t("rights.bookmarked") : t("rights.bookmark")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  catChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  bodyText: {
    fontSize: 15.5,
    lineHeight: 26,
    marginBottom: 24,
  },
  stepsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  stepRow: { flexDirection: "row", gap: 10, marginBottom: 12, alignItems: "flex-start" },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  stepText: { flex: 1, fontSize: 13.5, lineHeight: 21 },
  footer: { flexDirection: "row", gap: 10 },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
});
