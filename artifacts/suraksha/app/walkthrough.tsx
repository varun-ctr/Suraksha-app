import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/shared/components/Icon";
import { withAlpha } from "@/shared/theme/colors";
import type { IconName } from "@/shared/utils/data";
import { useTheme } from "@/shared/theme/ThemeContext";
import { useWalkthroughScreen } from "@/features/profile/hooks/useWalkthroughScreen";

interface Slide {
  icon: IconName;
  title: string;
  desc: string;
}

const SLIDES: Slide[] = [
  {
    icon: "shield",
    title: "Your SOS button is always ready",
    desc: "One tap starts a short countdown, then alerts your emergency contacts with your live location. Cancel anytime before it sends.",
  },
  {
    icon: "map",
    title: "Find help nearby",
    desc: "The Map tab shows nearby police stations, hospitals, pharmacies, and shelters — wherever you are.",
  },
  {
    icon: "message",
    title: "Meet Sakhi, your safety companion",
    desc: "Ask Sakhi anything — safety tips, legal rights, first aid — any time, day or night.",
  },
  {
    icon: "book",
    title: "Know your rights",
    desc: "Quick, plain-language answers about the Indian laws that protect you, plus emergency helpline numbers.",
  },
  {
    icon: "user",
    title: "Manage your circle",
    desc: "Add emergency contacts, start a Journey Timer for solo trips, and adjust your safety settings from Profile.",
  },
];

function StepDots({ step }: { step: number }) {
  const { c } = useTheme();
  return (
    <View style={styles.dotsRow}>
      {SLIDES.map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: withAlpha(c.primary, 0.25) },
            i === step && { backgroundColor: c.primary, width: 22 },
          ]}
        />
      ))}
    </View>
  );
}

export default function Walkthrough() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  const { step, opacity, slideY, finish, handleNext } = useWalkthroughScreen(SLIDES.length);

  const slide = SLIDES[step]!;
  const isLast = step === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LinearGradient
        colors={[c.primary, c.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 20 }]}
      >
        <Pressable onPress={() => void finish()} hitSlop={12} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

        <View style={styles.heroBody}>
          <Animated.View style={{ opacity, transform: [{ translateY: slideY }] }}>
            <View style={styles.iconWrap}>
              <Icon name={slide.icon} size={40} color="#fff" />
            </View>
          </Animated.View>
        </View>
      </LinearGradient>

      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <StepDots step={step} />

        <Animated.View style={{ opacity, transform: [{ translateY: slideY }] }}>
          <Text style={[styles.title, { color: c.text }]}>{slide.title}</Text>
          <Text style={[styles.desc, { color: c.textMuted }]}>{slide.desc}</Text>
        </Animated.View>

        <Pressable onPress={handleNext} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
          <LinearGradient
            colors={[c.primary, c.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.primaryBtn, { shadowColor: c.primary }]}
          >
            <Text style={styles.primaryBtnText}>{isLast ? "Get Started" : "Next"}</Text>
            <Icon name={isLast ? "check" : "chevronRight"} size={18} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 260,
    paddingHorizontal: 20,
  },
  skipBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  skipText: { fontSize: 13.5, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.9)" },
  heroBody: { flex: 1, alignItems: "center", justifyContent: "center" },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 24,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },

  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 12,
  },
  desc: {
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 32,
  },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 20,
    paddingVertical: 16,
    marginTop: "auto",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});
