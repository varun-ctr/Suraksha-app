import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { GradientHeader } from "@/components/Headers";
import { Icon } from "@/components/Icon";
import { Card, IconBadge } from "@/components/ui";
import { withAlpha } from "@/constants/colors";
import { RIGHTS } from "@/constants/data";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { callNumber } from "@/lib/native";

const QUICK_NUMBERS = [
  { label: { en: "Police", hi: "पुलिस" }, num: "100" },
  { label: { en: "Women Helpline", hi: "महिला हेल्पलाइन" }, num: "1091" },
  { label: { en: "Childline", hi: "चाइल्डलाइन" }, num: "1098" },
];

export default function RightsScreen() {
  const { c } = useTheme();
  const { t, pick, lang } = useI18n();
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <GradientHeader
        title={t("rights.title")}
        subtitle={t("rights.sub")}
        colors={[c.police, "#173A8C"]}
      />

      <View style={{ paddingHorizontal: 18, marginTop: 16 }}>
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

        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text, marginBottom: 10 }}>
          {t("rights.legalProtections")}
        </Text>

        {RIGHTS.map((r) => {
          const isOpen = expanded === r.id;
          const color = r.color(c);
          return (
            <Card key={r.id} style={{ marginBottom: 10, padding: 14 }}>
              <Pressable
                onPress={() => setExpanded(isOpen ? null : r.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <IconBadge name={r.icon} color={color} size={18} box={38} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.text }}>{r.title}</Text>
                  <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 1 }}>{r.subtitle}</Text>
                </View>
                <View style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}>
                  <Icon name="chevronDown" size={16} color={c.textFaint} />
                </View>
              </Pressable>

              {isOpen && (
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border }}>
                  <Text style={{ fontSize: 12.5, color: c.text, lineHeight: 20, marginBottom: 12 }}>
                    {pick(r)}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color, marginBottom: 8 }}>
                    {t("rights.stepsToTake")}
                  </Text>
                  {r.steps.map((s, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 7 }}>
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: withAlpha(color, 0.12),
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: 1,
                        }}
                      >
                        <Text style={{ fontSize: 10.5, fontFamily: "Inter_700Bold", color }}>{i + 1}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 12, color: c.textMuted, lineHeight: 18 }}>{pick(s)}</Text>
                    </View>
                  ))}
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
  numCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
});
