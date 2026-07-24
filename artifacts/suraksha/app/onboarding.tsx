import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/shared/components/Icon";
import { withAlpha } from "@/shared/theme/colors";
import { useI18n } from "@/features/settings/context/LanguageContext";
import { useTheme } from "@/shared/theme/ThemeContext";
import { ONBOARDING_TOTAL_STEPS, useOnboardingScreen } from "@/features/profile/hooks/useOnboardingScreen";

const TOTAL = ONBOARDING_TOTAL_STEPS;

// ── City illustration (pure RN primitives) ───────────────────────────────────
function CityIllustration() {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -8, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0,  duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, [float]);

  return (
    <View style={ill.wrap} pointerEvents="none">
      <View style={[ill.building, { height: 54, width: 24, left: 18, bottom: 0 }]} />
      <View style={[ill.building, { height: 80, width: 20, left: 50, bottom: 0 }]} />
      <View style={[ill.building, { height: 40, width: 28, left: 78, bottom: 0 }]} />
      <View style={[ill.building, { height: 96, width: 22, left: 114, bottom: 0 }]} />
      <View style={[ill.building, { height: 60, width: 30, left: 144, bottom: 0 }]} />
      <View style={[ill.building, { height: 72, width: 18, left: 182, bottom: 0 }]} />
      <View style={[ill.building, { height: 44, width: 26, left: 208, bottom: 0 }]} />
      <View style={[ill.building, { height: 88, width: 22, left: 242, bottom: 0 }]} />
      <View style={[ill.pin, { left: 60, bottom: 88 }]}>
        <Text style={{ fontSize: 20 }}>📍</Text>
      </View>
      <View style={[ill.pin, { left: 152, bottom: 104 }]}>
        <Text style={{ fontSize: 16 }}>📍</Text>
      </View>
      <Animated.View style={[ill.shieldWrap, { transform: [{ translateY: float }] }]}>
        <LinearGradient colors={["rgba(255,255,255,0.95)", "rgba(255,255,255,0.7)"]} style={ill.shield}>
          <Text style={{ fontSize: 28 }}>🛡️</Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const ill = StyleSheet.create({
  wrap: {
    height: 120,
    position: "relative",
    marginTop: 8,
    marginBottom: 0,
    overflow: "hidden",
    alignSelf: "stretch",
  },
  building: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderBottomWidth: 0,
  },
  pin: { position: "absolute" },
  shieldWrap: {
    position: "absolute",
    right: 30,
    bottom: 68,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  shield: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  const { c } = useTheme();
  return (
    <View style={styles.stepRow}>
      {Array.from({ length: TOTAL }).map((_, i) => {
        const done   = i < step;
        const active = i === step;
        return (
          <React.Fragment key={i}>
            <View style={[
              styles.stepDot,
              { borderColor: withAlpha(c.primary, 0.35) },
              (done || active) && { backgroundColor: c.primary, borderColor: c.primary },
              !done && !active && { backgroundColor: c.card },
            ]}>
              {done ? (
                <Icon name="check" size={12} color={c.onColor} />
              ) : (
                <Text style={[styles.stepNum, { color: withAlpha(c.primary, 0.5) }, active && { color: c.onColor }]}>
                  {i + 1}
                </Text>
              )}
            </View>
            {i < TOTAL - 1 && (
              <View style={[styles.stepLine, { backgroundColor: withAlpha(c.primary, 0.25) }, done && { backgroundColor: c.primary }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ── Premium input ─────────────────────────────────────────────────────────────
function PremiumInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  icon,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad" | "email-address";
  autoCapitalize?: "none" | "words" | "sentences";
  icon: string;
}) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const border = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(border, { toValue: 1, duration: 160, useNativeDriver: false }).start();
  };
  const handleBlur = () => {
    setFocused(false);
    Animated.timing(border, { toValue: 0, duration: 160, useNativeDriver: false }).start();
  };

  const borderColor = border.interpolate({
    inputRange: [0, 1],
    outputRange: [c.border, c.primary],
  });

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>{label}</Text>
      <Animated.View style={[styles.inputWrap, { borderColor, backgroundColor: c.inputBg }]}>
        <View style={[styles.inputIcon, { borderRightColor: c.border }, focused && { backgroundColor: withAlpha(c.primary, 0.08) }]}>
          <Icon name={icon as never} size={15} color={focused ? c.primary : c.textFaint} />
        </View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={c.textFaint}
          keyboardType={keyboardType ?? "default"}
          autoCapitalize={autoCapitalize ?? "words"}
          style={[styles.fieldInput, { color: c.text }]}
        />
        {value.length > 0 && (
          <View style={styles.inputCheck}>
            <Icon name="check" size={13} color={c.success} />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ── Name step ─────────────────────────────────────────────────────────────────
function NameStep({ name, setName, t }: { name: string; setName: (v: string) => void; t: (k: string) => string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.cardIconRow}>
        <View style={[styles.cardIcon, { backgroundColor: withAlpha(c.primary, 0.1) }]}>
          <Icon name="user" size={20} color={c.primary} />
        </View>
      </View>
      <Text style={[styles.formHeading, { color: c.text }]}>{t("onb.nameHeading")}</Text>
      <Text style={[styles.formSub, { color: c.textMuted }]}>{t("onb.nameSub")}</Text>
      <PremiumInput
        label={t("onb.nameLabel")}
        value={name}
        onChangeText={setName}
        placeholder={t("onb.namePlaceholder")}
        icon="user"
      />
      <View style={styles.trustRow}>
        <Icon name="lock" size={12} color={c.textMuted} />
        <Text style={[styles.trustText, { color: c.textMuted }]}>{t("onb.trustDataPrivate")}</Text>
      </View>
    </View>
  );
}

// ── Contacts step ─────────────────────────────────────────────────────────────
function ContactsStep({
  contactName, setContactName, contactPhone, setContactPhone, t,
}: {
  contactName: string; setContactName: (v: string) => void;
  contactPhone: string; setContactPhone: (v: string) => void;
  t: (k: string) => string;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.cardIconRow}>
        <View style={[styles.cardIcon, { backgroundColor: withAlpha(c.success, 0.1) }]}>
          <Icon name="users" size={20} color={c.success} />
        </View>
      </View>
      <Text style={[styles.formHeading, { color: c.text }]}>{t("onb.contactHeading")}</Text>
      <Text style={[styles.formSub, { color: c.textMuted }]}>{t("onb.contactSub")}</Text>
      <PremiumInput
        label={t("onb.contactNameLabel")}
        value={contactName}
        onChangeText={setContactName}
        placeholder={t("onb.contactNamePlaceholder")}
        icon="user"
      />
      <PremiumInput
        label={t("onb.contactPhoneLabel")}
        value={contactPhone}
        onChangeText={setContactPhone}
        placeholder={t("onb.contactPhonePlaceholder")}
        keyboardType="phone-pad"
        autoCapitalize="none"
        icon="phone"
      />
      <View style={styles.trustRow}>
        <Icon name="bell" size={12} color={c.textMuted} />
        <Text style={[styles.trustText, { color: c.textMuted }]}>{t("onb.trustContactsNotified")}</Text>
      </View>
    </View>
  );
}

// ── Location step ─────────────────────────────────────────────────────────────
function LocationStep({ granted, onAllow, t }: { granted: boolean; onAllow: () => void; t: (k: string) => string }) {
  const { c } = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!granted) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.12, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }
  }, [granted, pulse]);

  return (
    <View style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.cardIconRow}>
        <Animated.View style={[styles.cardIcon, { backgroundColor: withAlpha(c.primary, 0.1), transform: [{ scale: pulse }] }]}>
          <Icon name="mapPin" size={20} color={c.primary} />
        </Animated.View>
      </View>
      <Text style={[styles.formHeading, { color: c.text }]}>{t("onb.locationHeading")}</Text>
      <Text style={[styles.formSub, { color: c.textMuted }]}>{t("onb.locationSub")}</Text>

      {granted ? (
        <View style={[styles.grantedRow, { backgroundColor: withAlpha(c.success, 0.1) }]}>
          <View style={[styles.grantedIcon, { backgroundColor: withAlpha(c.success, 0.15) }]}>
            <Icon name="check" size={16} color={c.success} />
          </View>
          <Text style={[styles.grantedText, { color: c.success }]}>{t("onb.locationGranted")}</Text>
        </View>
      ) : (
        <Pressable onPress={onAllow} style={({ pressed }) => [styles.allowBtn, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}>
          <Icon name="mapPin" size={16} color={c.onColor} />
          <Text style={[styles.allowBtnText, { color: c.onColor }]}>{t("onb.locationAllow")}</Text>
        </Pressable>
      )}

      <View style={[styles.trustRow, { marginTop: 14 }]}>
        <Icon name="lock" size={12} color={c.textMuted} />
        <Text style={[styles.trustText, { color: c.textMuted }]}>{t("onb.trustLocationUse")}</Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function Onboarding() {
  const { t } = useI18n();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  const {
    step, name, setName, contactName, setContactName, contactPhone, setContactPhone,
    locationGranted, error, slideY, opacity,
    handleAllowLocation, handleSkip, handleNext,
    primaryLabel, skipLabel,
  } = useOnboardingScreen();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero header ─────────────────────────────────── */}
        <LinearGradient
          colors={[c.primary, c.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Text style={{ fontSize: 22 }}>🛡️</Text>
            </View>
            <View>
              <Text style={styles.heroName}>Suraksha</Text>
              <Text style={styles.heroTagline}>Your Safety. Our Priority.</Text>
            </View>
          </View>
          <CityIllustration />
        </LinearGradient>

        {/* ── Step indicator ───────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}>
          <StepIndicator step={step} />
        </View>

        {/* ── Animated form ────────────────────────────────── */}
        <Animated.View style={{ opacity, transform: [{ translateY: slideY }], paddingHorizontal: 20 }}>
          {step === 0 && <NameStep name={name} setName={setName} t={t} />}
          {step === 1 && (
            <ContactsStep
              contactName={contactName} setContactName={setContactName}
              contactPhone={contactPhone} setContactPhone={setContactPhone}
              t={t}
            />
          )}
          {step === 2 && <LocationStep granted={locationGranted} onAllow={handleAllowLocation} t={t} />}

          {/* Error */}
          {!!error && (
            <View style={[styles.errorRow, { backgroundColor: withAlpha(c.danger, 0.08), borderColor: withAlpha(c.danger, 0.25) }]}>
              <Icon name="info" size={13} color={c.danger} />
              <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
            </View>
          )}

          {/* Primary button */}
          <Pressable onPress={handleNext} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
            <LinearGradient
              colors={[c.primary, c.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.primaryBtn, { shadowColor: c.primary }]}
            >
              <Icon name="shield" size={18} color={c.onColor} />
              <Text style={[styles.primaryBtnText, { color: c.onColor }]}>{primaryLabel}</Text>
            </LinearGradient>
          </Pressable>

          {/* Skip */}
          {!!skipLabel && (
            <Pressable onPress={handleSkip} hitSlop={12} style={styles.skipWrap}>
              <Text style={[styles.skipText, { color: c.textFaint }]}>{skipLabel}</Text>
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles (layout & geometry only — colours injected inline) ─────────────────
const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },

  hero: {
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 0,
    overflow: "hidden",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  logoIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  heroName: {
    color: "#fff",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  heroTagline: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },

  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    marginBottom: 8,
  },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  stepNum: { fontSize: 13, fontFamily: "Inter_700Bold" },
  stepLine: { flex: 1, height: 2, marginHorizontal: 6, maxWidth: 48 },

  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  cardIconRow: { marginBottom: 12 },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  formHeading: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    marginBottom: 5,
  },
  formSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    marginBottom: 18,
  },

  fieldLabel: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 7,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    overflow: "hidden",
  },
  inputIcon: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    borderRightWidth: 1,
  },
  fieldInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  inputCheck: { paddingRight: 12 },

  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  trustText: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },

  grantedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  grantedIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  grantedText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  allowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  allowBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },

  primaryBtn: {
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },

  skipWrap: { alignItems: "center", paddingVertical: 6 },
  skipText:  { fontSize: 13.5, fontFamily: "Inter_500Medium" },
});
