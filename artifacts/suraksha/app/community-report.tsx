import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

export default function CommunityReportScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[c.primary, c.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 28 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginBottom: 14 }}>
          <Icon name="arrowLeft" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.title}>{t("community.title")}</Text>
        <Text style={styles.sub}>{t("community.sub")}</Text>
      </LinearGradient>

      <View style={{ paddingHorizontal: 18, paddingTop: 32, alignItems: "center" }}>
        <View style={[styles.iconBox, { backgroundColor: c.cardAlt }]}>
          <Icon name="flag" size={40} color={c.primary} />
        </View>
        <Text style={[styles.comingSoon, { color: c.text }]}>{t("community.comingSoon")}</Text>
        <Text style={[styles.comingSoonSub, { color: c.textMuted }]}>
          {t("community.comingSoonSub")}
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: c.primary }]}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>
            {t("common.goBack")}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  sub: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 4, fontFamily: "Inter_500Medium" },
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  comingSoon: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 10, textAlign: "center" },
  comingSoonSub: {
    fontSize: 13.5,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: 32,
  },
  backBtn: { paddingVertical: 13, paddingHorizontal: 40, borderRadius: 14 },
});
