import React from "react";
import { ScrollView, Text, View } from "react-native";

import { BackHeader } from "@/components/Headers";
import { PRIVACY_SECTIONS } from "@/constants/legal";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

export default function PrivacyScreen() {
  const { c } = useTheme();
  const { t, pick } = useI18n();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title={t("legal.privacyTitle")} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 11.5, color: c.textFaint, marginBottom: 16 }}>{t("legal.updated")}</Text>
        {PRIVACY_SECTIONS.map((s, i) => (
          <View key={i} style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 14.5, fontFamily: "Inter_700Bold", color: c.text, marginBottom: 6 }}>
              {pick(s.heading)}
            </Text>
            <Text style={{ fontSize: 13, color: c.textMuted, lineHeight: 20 }}>{pick(s.body)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
