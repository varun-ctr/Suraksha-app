import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackHeader } from "@/components/Headers";
import { Icon } from "@/components/Icon";
import { withAlpha } from "@/constants/colors";
import type { IconName } from "@/constants/data";
import { useApp } from "@/context/AppContext";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";

const PLANS = [
  { key: "monthly", en: "Monthly", hi: "मासिक", price: "₹99", per: { en: "/month", hi: "/माह" } },
  { key: "yearly", en: "Yearly", hi: "वार्षिक", price: "₹799", per: { en: "/year", hi: "/वर्ष" }, badge: { en: "Save 33%", hi: "33% बचत" } },
  { key: "family", en: "Family", hi: "परिवार", price: "₹1299", per: { en: "/year · 5 members", hi: "/वर्ष · 5 सदस्य" } },
];

const FEATURES: { icon: IconName; en: string; hi: string }[] = [
  { icon: "navigation", en: "Unlimited journey timers", hi: "असीमित यात्रा टाइमर" },
  { icon: "users", en: "Up to 10 trusted contacts", hi: "10 तक विश्वसनीय संपर्क" },
  { icon: "bell", en: "Priority SOS alerts", hi: "प्राथमिकता SOS अलर्ट" },
  { icon: "message", en: "Unlimited Sakhi conversations", hi: "असीमित सखी बातचीत" },
  { icon: "shield", en: "Safety check-in reminders", hi: "सुरक्षा चेक-इन रिमाइंडर" },
];

export default function PremiumScreen() {
  const { c } = useTheme();
  const { t, pick } = useI18n();
  const { profile } = useApp();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [selected, setSelected] = useState("yearly");

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title={t("premium.title")} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[c.accent, c.accentDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 24, alignItems: "center" }}
        >
          <View style={styles.crown}>
            <Icon name="crown" size={32} color="#fff" />
          </View>
          <Text style={{ color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 12 }}>
            {t("premium.title")}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, textAlign: "center", marginTop: 6 }}>
            {t("premium.sub")}
          </Text>
          {profile.premium && (
            <View style={styles.activeBadge}>
              <Icon name="check" size={13} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" }}>
                {t("premium.currentPlan")}
              </Text>
            </View>
          )}
        </LinearGradient>

        <View style={{ padding: 18 }}>
          <View
            style={[
              styles.comingSoon,
              { backgroundColor: withAlpha(c.accent, 0.1), borderColor: withAlpha(c.accent, 0.25) },
            ]}
          >
            <Icon name="info" size={15} color={c.accent} />
            <Text style={{ flex: 1, fontSize: 11.5, color: c.text, lineHeight: 17 }}>{t("premium.comingSoon")}</Text>
          </View>
          <View style={[styles.featureCard, { backgroundColor: c.card, borderColor: c.border }]}>
            {FEATURES.map((f, i) => (
              <View
                key={f.en}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: c.border,
                }}
              >
                <View style={[styles.featureIcon, { backgroundColor: c.successSoft }]}>
                  <Icon name={f.icon} size={15} color={c.success} />
                </View>
                <Text style={{ flex: 1, fontSize: 13, color: c.text, fontFamily: "Inter_500Medium" }}>{pick(f)}</Text>
                <Icon name="check" size={16} color={c.success} />
              </View>
            ))}
          </View>

          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text, marginTop: 22, marginBottom: 12 }}>
            {t("premium.choosePlan")}
          </Text>

          {PLANS.map((p) => {
            const active = selected === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => setSelected(p.key)}
                style={[
                  styles.plan,
                  {
                    backgroundColor: c.card,
                    borderColor: active ? c.accent : c.border,
                    borderWidth: active ? 2 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.radio,
                    { borderColor: active ? c.accent : c.border },
                  ]}
                >
                  {active && <View style={[styles.radioDot, { backgroundColor: c.accent }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.text }}>{pick(p)}</Text>
                    {p.badge && (
                      <View style={[styles.saveBadge, { backgroundColor: c.successSoft }]}>
                        <Text style={{ fontSize: 10.5, fontFamily: "Inter_700Bold", color: c.success }}>
                          {pick(p.badge)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: c.accent }}>{p.price}</Text>
                  <Text style={{ fontSize: 10.5, color: c.textMuted }}>{pick(p.per)}</Text>
                </View>
              </Pressable>
            );
          })}

          <Pressable onPress={() => showToast(t("premium.comingSoon"))} style={{ marginTop: 18 }}>
            <LinearGradient
              colors={[c.accent, c.accentDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.subscribeBtn}
            >
              <Icon name="crown" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>{t("premium.subscribe")}</Text>
            </LinearGradient>
          </Pressable>
          <Text style={{ fontSize: 11, color: c.textFaint, textAlign: "center", marginTop: 12 }}>
            {t("premium.note")}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  crown: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 12,
  },
  comingSoon: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  featureCard: { borderWidth: 1, borderRadius: 16, padding: 14 },
  featureIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 11, height: 11, borderRadius: 5.5 },
  saveBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  subscribeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
});
