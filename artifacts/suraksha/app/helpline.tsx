import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BackHeader } from "@/shared/components/Headers";
import { Icon } from "@/shared/components/Icon";
import { withAlpha } from "@/shared/theme/colors";
import { HELPLINES } from "@/shared/utils/data";
import { useI18n } from "@/features/settings/context/LanguageContext";
import { useTheme } from "@/shared/theme/ThemeContext";
import { useToast } from "@/features/settings/context/ToastContext";
import { callNumber } from "@/shared/utils/native";

export default function HelplineScreen() {
  const { c } = useTheme();
  const { t, pick } = useI18n();
  const { showToast } = useToast();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title={t("helpline.title")} subtitle={t("helpline.sub")} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {HELPLINES.map((h) => {
          const color = h.color(c);
          return (
            <Pressable
              key={h.number}
              onPress={() => {
                showToast(`${t("common.calling")} ${h.number}…`);
                callNumber(h.number);
              }}
              style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}
            >
              <View style={[styles.badge, { backgroundColor: withAlpha(color, 0.12) }]}>
                <Icon name="phone" size={20} color={color} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14.5, fontFamily: "Inter_700Bold", color: c.text }}>
                  {pick({ en: h.name, hi: h.hi })}
                </Text>
                <Text style={{ fontSize: 11.5, color: c.textMuted, marginTop: 1 }} numberOfLines={2}>
                  {pick({ en: h.desc, hi: h.descHi })}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color }}>{h.number}</Text>
                <View style={[styles.callPill, { backgroundColor: color }]}>
                  <Icon name="phoneCall" size={11} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 10.5, fontFamily: "Inter_700Bold" }}>
                    {t("map.callNow")}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  badge: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  callPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 4,
  },
});
