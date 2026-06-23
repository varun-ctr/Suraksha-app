import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { LanguagePicker } from "@/components/LanguagePicker";
import type { IconName } from "@/constants/data";
import type { LangCode } from "@/constants/languages";
import { useApp } from "@/context/AppContext";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

// ---------------------------------------------------------------------------
// Slide data (screens 0–3)
// ---------------------------------------------------------------------------
interface SlideData {
  icon: IconName;
  bg: [string, string];
  titleKey: string;
  bodyKey: string;
}

const SLIDES: SlideData[] = [
  { icon: "alert",  bg: ["#7C3AED", "#5B21B6"], titleKey: "onb.title1", bodyKey: "onb.body1" },
  { icon: "mapPin", bg: ["#0EA5E9", "#0369A1"], titleKey: "onb.title2", bodyKey: "onb.body2" },
  { icon: "user",   bg: ["#10B981", "#059669"], titleKey: "onb.title3", bodyKey: "onb.body3" },
  { icon: "book",   bg: ["#F59E0B", "#B45309"], titleKey: "onb.title4", bodyKey: "onb.body4" },
];

const TOTAL_STEPS = 6; // 0-3 slides, 4 language, 5 login prompt
const LANG_STEP  = 4;
const LOGIN_STEP = 5;

// ---------------------------------------------------------------------------
// Page dots
// ---------------------------------------------------------------------------
function PageDots({ step }: { step: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              width: step === i ? 22 : 7,
              backgroundColor: step === i ? "#fff" : "rgba(255,255,255,0.35)",
            },
          ]}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-screens
// ---------------------------------------------------------------------------
function FeatureSlide({ slide, t }: { slide: SlideData; t: (k: string) => string }) {
  return (
    <View style={styles.slideContent}>
      <View style={styles.iconRingOuter}>
        <View style={styles.iconRingInner}>
          <Icon name={slide.icon} size={56} color="#fff" />
        </View>
      </View>
      <Text style={styles.slideTitle}>{t(slide.titleKey)}</Text>
      <Text style={styles.slideBody}>{t(slide.bodyKey)}</Text>
    </View>
  );
}

function LanguageScreen({
  selected,
  onSelect,
  t,
}: {
  selected: LangCode;
  onSelect: (l: LangCode) => void;
  t: (k: string) => string;
}) {
  return (
    <View style={styles.langWrap}>
      <View style={styles.langIconRing}>
        <Icon name="globe" size={36} color="#fff" />
      </View>
      <Text style={styles.langTitle}>{t("onb.langTitle")}</Text>
      <Text style={styles.langBody}>{t("onb.langBody")}</Text>
      <View style={styles.pickerBox}>
        <LanguagePicker selected={selected} onSelect={onSelect} />
      </View>
    </View>
  );
}

function LoginPromptScreen({
  t,
  primaryColor,
  onSignIn,
  onSkip,
}: {
  t: (k: string) => string;
  primaryColor: string;
  onSignIn: () => void;
  onSkip: () => void;
}) {
  return (
    <View style={styles.loginContent}>
      <View style={styles.iconRingOuter}>
        <View style={styles.iconRingInner}>
          <Icon name="shield" size={52} color="#fff" />
        </View>
      </View>
      <Text style={styles.loginAppName}>Suraksha</Text>
      <Text style={styles.loginAppNameHi}>सुरक्षा</Text>
      <Text style={styles.loginTitle}>{t("onb.loginTitle")}</Text>
      <Text style={styles.loginBody}>{t("onb.loginBody")}</Text>
      <Pressable onPress={onSignIn} style={styles.signInBtn}>
        <Text style={[styles.signInBtnText, { color: primaryColor }]}>
          {t("onb.loginCta")}
        </Text>
      </Pressable>
      <Pressable onPress={onSkip} hitSlop={12} style={{ marginTop: 14 }}>
        <Text style={styles.skipLoginText}>{t("onb.skipLogin")}</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function Onboarding() {
  const { c } = useTheme();
  const { t, lang, setLang } = useI18n();
  const { completeOnboarding } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  const goTo = (next: number) => {
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 190, useNativeDriver: true }),
    ]).start();
    setStep(next);
  };

  const handleNext  = () => { if (step < TOTAL_STEPS - 1) goTo(step + 1); };
  const handleSkip  = () => goTo(LOGIN_STEP);

  const handleSignIn = () => {
    completeOnboarding();
    router.replace("/login" as never);
  };

  const handleSkipLogin = () => {
    completeOnboarding();
    router.replace("/(tabs)" as never);
  };

  const slide        = step < SLIDES.length ? SLIDES[step] : null;
  const gradColors: [string, string] = slide
    ? slide.bg
    : step === LANG_STEP
    ? [c.primary, c.primaryDark]
    : ["#1E1B4B", "#312E81"];

  const isLangStep  = step === LANG_STEP;
  const isLoginStep = step === LOGIN_STEP;

  return (
    <LinearGradient
      colors={gradColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      {/* Skip button */}
      <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
        {!isLoginStep && (
          <Pressable onPress={handleSkip} hitSlop={12} style={{ marginLeft: "auto" }}>
            <Text style={styles.skipText}>{t("onb.skip")}</Text>
          </Pressable>
        )}
      </View>

      {/* Animated content area */}
      <Animated.View style={{ flex: 1, opacity: fade }}>
        {isLoginStep ? (
          <LoginPromptScreen
            t={t}
            primaryColor={c.primary}
            onSignIn={handleSignIn}
            onSkip={handleSkipLogin}
          />
        ) : isLangStep ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <LanguageScreen selected={lang} onSelect={setLang} t={t} />
          </ScrollView>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: 28 }}>
            <FeatureSlide slide={SLIDES[step]!} t={t} />
          </View>
        )}
      </Animated.View>

      {/* Dots + Next CTA (hidden on login prompt screen) */}
      {!isLoginStep && (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 22 }]}>
          <PageDots step={step} />
          <Pressable onPress={handleNext} style={styles.cta}>
            <Text style={[styles.ctaText, { color: gradColors[0] }]}>
              {isLangStep ? t("onb.getStarted") : t("onb.next")}
            </Text>
          </Pressable>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    height: 52,
  },
  skipText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },

  // Feature slide
  slideContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 16,
  },
  iconRingOuter: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconRingInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  slideTitle: {
    color: "#fff",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginTop: 34,
  },
  slideBody: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 14,
    paddingHorizontal: 10,
  },

  // Language screen
  langWrap: { flex: 1, paddingTop: 8, minHeight: 480 },
  langIconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  langTitle: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  langBody: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  pickerBox: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.97)",
    padding: 14,
    minHeight: 340,
  },

  // Login prompt
  loginContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  loginAppName: {
    color: "#fff",
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    marginTop: 22,
  },
  loginAppNameHi: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 20,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  loginTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginTop: 24,
  },
  loginBody: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 28,
  },
  signInBtn: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 40,
    alignItems: "center",
    width: "100%",
  },
  signInBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  skipLoginText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },

  // Bottom nav
  bottom: { paddingHorizontal: 22, gap: 14 },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
  },
  dot: { height: 7, borderRadius: 3.5 },
  cta: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  ctaText: { fontSize: 15.5, fontFamily: "Inter_700Bold" },
});
