import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BackHeader } from "@/shared/components/Headers";
import { Icon } from "@/shared/components/Icon";
import { withAlpha } from "@/shared/theme/colors";
import { PRIVACY_SECTIONS } from "@/shared/utils/legal";
import { useApp } from "@/features/profile/context/AppContext";
import { useI18n } from "@/features/settings/context/LanguageContext";
import { useTheme } from "@/shared/theme/ThemeContext";
import { useToast } from "@/features/settings/context/ToastContext";

export default function DataScreen() {
  const { c } = useTheme();
  const { t, pick } = useI18n();
  const { resetAllData } = useApp();
  const { showToast } = useToast();
  const router = useRouter();

  const [confirming, setConfirming] = useState(false);

  const onDelete = async () => {
    await resetAllData();
    showToast(t("data.deleted"));
    router.replace("/onboarding");
  };

  const storage = PRIVACY_SECTIONS[0];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title={t("data.title")} subtitle={t("data.sub")} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text, marginBottom: 6 }}>
            {pick(storage.heading)}
          </Text>
          <Text style={{ fontSize: 13, color: c.textMuted, lineHeight: 20 }}>{pick(storage.body)}</Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: withAlpha(c.danger, 0.06), borderColor: withAlpha(c.danger, 0.3) },
          ]}
        >
          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.danger, marginBottom: 6 }}>
            {t("data.deleteHeading")}
          </Text>
          <Text style={{ fontSize: 13, color: c.textMuted, lineHeight: 20, marginBottom: 14 }}>
            {t("data.deleteBody")}
          </Text>

          {!confirming ? (
            <Pressable onPress={() => setConfirming(true)} style={[styles.deleteBtn, { backgroundColor: c.danger }]}>
              <Icon name="trash" size={15} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13.5 }}>{t("data.deleteBtn")}</Text>
            </Pressable>
          ) : (
            <View style={[styles.confirmBox, { borderColor: withAlpha(c.danger, 0.3) }]}>
              <Text style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.text, marginBottom: 6 }}>
                {t("data.confirmTitle")}
              </Text>
              <Text style={{ fontSize: 12.5, color: c.textMuted, lineHeight: 18, marginBottom: 14 }}>
                {t("data.confirmBody")}
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => setConfirming(false)}
                  style={[styles.confirmBtn, { backgroundColor: c.cardAlt }]}
                >
                  <Text style={{ color: c.text, fontFamily: "Inter_700Bold", fontSize: 13 }}>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable onPress={onDelete} style={[styles.confirmBtn, { backgroundColor: c.danger }]}>
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 }}>{t("data.confirmBtn")}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
  },
  confirmBox: { borderWidth: 1, borderRadius: 12, padding: 14 },
  confirmBtn: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 10 },
});
