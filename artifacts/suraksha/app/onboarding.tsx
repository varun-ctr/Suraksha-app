import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import type { IconName } from "@/constants/data";
import { LANGUAGE_LABELS, type Language } from "@/constants/i18n";
import { useApp } from "@/context/AppContext";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

const SLIDES: { icon: IconName; titleKey: string; bodyKey: string }[] = [
  { icon: "heart", titleKey: "onb.title1", bodyKey: "onb.body1" },
  { icon: "mapPin", titleKey: "onb.title2", bodyKey: "onb.body2" },
  { icon: "book", titleKey: "onb.title3", bodyKey: "onb.body3" },
];

export default function Onboarding() {
  const { c } = useTheme();
  const { t, lang, setLang } = useI18n();
  const { completeOnboarding } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // step 0 = language picker, steps 1..3 = feature slides
  const [step, setStep] = useState(0);

  const finish = () => {
    completeOnboarding();
    router.replace("/(tabs)");
  };

  return (
    <LinearGradient
      colors={[c.primary, c.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20, paddingHorizontal: 26 }}
    >
      <View style={{ flexDirection: "row", justifyContent: "flex-end", height: 28 }}>
        {step > 0 && step < SLIDES.length && (
          <Pressable onPress={finish} hitSlop={10}>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: "Inter_600SemiBold" }}>
              {t("onb.skip")}
            </Text>
          </Pressable>
        )}
      </View>

      {step === 0 ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <View style={styles.logoCircle}>
            <Icon name="shield" size={42} color="#fff" />
          </View>
          <Text style={styles.brand}>Suraksha</Text>
          <Text style={styles.brandSub}>सुरक्षा</Text>
          <Text style={[styles.title, { marginTop: 32 }]}>{t("onb.chooseLanguage")}</Text>
          <Text style={styles.body}>{t("onb.langSub")}</Text>
          <View style={{ gap: 12, marginTop: 24 }}>
            {(["en", "hi"] as Language[]).map((l) => {
              const active = lang === l;
              return (
                <Pressable
                  key={l}
                  onPress={() => setLang(l)}
                  style={[
                    styles.langOption,
                    {
                      backgroundColor: active ? "#fff" : "rgba(255,255,255,0.12)",
                      borderColor: active ? "#fff" : "rgba(255,255,255,0.25)",
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: "Inter_700Bold",
                      color: active ? c.primary : "#fff",
                    }}
                  >
                    {LANGUAGE_LABELS[l]}
                  </Text>
                  {active && <Icon name="check" size={18} color={c.primary} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <View style={styles.slideIcon}>
            <Icon name={SLIDES[step - 1].icon} size={52} color="#fff" />
          </View>
          <Text style={[styles.title, { textAlign: "center", marginTop: 36 }]}>
            {t(SLIDES[step - 1].titleKey)}
          </Text>
          <Text style={[styles.body, { textAlign: "center", marginTop: 12 }]}>
            {t(SLIDES[step - 1].bodyKey)}
          </Text>
        </View>
      )}

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 22 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              width: step === i ? 22 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: step === i ? "#fff" : "rgba(255,255,255,0.4)",
            }}
          />
        ))}
      </View>

      <Pressable
        onPress={() => (step < SLIDES.length ? setStep((s) => s + 1) : finish())}
        style={styles.cta}
      >
        <Text style={{ color: c.primary, fontSize: 15.5, fontFamily: "Inter_700Bold" }}>
          {step === 0 ? t("onb.next") : step < SLIDES.length ? t("onb.next") : t("onb.getStarted")}
        </Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  logoCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  brand: { color: "#fff", fontSize: 30, fontFamily: "Inter_700Bold", textAlign: "center", marginTop: 16 },
  brandSub: { color: "rgba(255,255,255,0.85)", fontSize: 18, textAlign: "center", marginTop: 2 },
  slideIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 23, fontFamily: "Inter_700Bold" },
  body: { color: "rgba(255,255,255,0.85)", fontSize: 14.5, lineHeight: 22, marginTop: 6 },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  cta: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
});
