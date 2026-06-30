import * as ExpoLocation from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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

import { Icon } from "@/components/Icon";
import { useApp } from "@/context/AppContext";
import { useI18n } from "@/context/LanguageContext";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BLUE       = "#2563EB";
const BLUE_DARK  = "#1D4ED8";
const BLUE_LIGHT = "#EFF6FF";
const BLUE_MUTED = "#BFDBFE";
const SUCCESS    = "#22C55E";
const GREY_TEXT  = "#9CA3AF";
const TOTAL      = 3;

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
      {/* Buildings */}
      <View style={[ill.building, { height: 54, width: 24, left: 18, bottom: 0 }]} />
      <View style={[ill.building, { height: 80, width: 20, left: 50, bottom: 0 }]} />
      <View style={[ill.building, { height: 40, width: 28, left: 78, bottom: 0 }]} />
      <View style={[ill.building, { height: 96, width: 22, left: 114, bottom: 0 }]} />
      <View style={[ill.building, { height: 60, width: 30, left: 144, bottom: 0 }]} />
      <View style={[ill.building, { height: 72, width: 18, left: 182, bottom: 0 }]} />
      <View style={[ill.building, { height: 44, width: 26, left: 208, bottom: 0 }]} />
      <View style={[ill.building, { height: 88, width: 22, left: 242, bottom: 0 }]} />

      {/* Location pins */}
      <View style={[ill.pin, { left: 60, bottom: 88 }]}>
        <Text style={{ fontSize: 20 }}>📍</Text>
      </View>
      <View style={[ill.pin, { left: 152, bottom: 104 }]}>
        <Text style={{ fontSize: 16 }}>📍</Text>
      </View>

      {/* Floating shield */}
      <Animated.View style={[ill.shieldWrap, { transform: [{ translateY: float }] }]}>
        <LinearGradient colors={["#fff", "#EFF6FF"]} style={ill.shield}>
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
  return (
    <View style={styles.stepRow}>
      {Array.from({ length: TOTAL }).map((_, i) => {
        const done   = i < step;
        const active = i === step;
        return (
          <React.Fragment key={i}>
            <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive, !done && !active && styles.stepDotFuture]}>
              {done ? (
                <Icon name="check" size={12} color="#fff" />
              ) : (
                <Text style={[styles.stepNum, active && { color: "#fff" }]}>{i + 1}</Text>
              )}
            </View>
            {i < TOTAL - 1 && (
              <View style={[styles.stepLine, done && { backgroundColor: BLUE }]} />
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
    outputRange: [BLUE_MUTED, BLUE],
  });

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Animated.View style={[styles.inputWrap, { borderColor }]}>
        <View style={[styles.inputIcon, focused && { backgroundColor: BLUE_LIGHT }]}>
          <Icon name={icon as never} size={15} color={focused ? BLUE : GREY_TEXT} />
        </View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={GREY_TEXT}
          keyboardType={keyboardType ?? "default"}
          autoCapitalize={autoCapitalize ?? "words"}
          style={styles.fieldInput}
        />
        {value.length > 0 && (
          <View style={styles.inputCheck}>
            <Icon name="check" size={13} color={SUCCESS} />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ── Name step ─────────────────────────────────────────────────────────────────
function NameStep({ name, setName, t }: { name: string; setName: (v: string) => void; t: (k: string) => string }) {
  return (
    <View style={styles.formCard}>
      <View style={styles.cardIconRow}>
        <View style={[styles.cardIcon, { backgroundColor: BLUE_LIGHT }]}>
          <Icon name="user" size={20} color={BLUE} />
        </View>
      </View>
      <Text style={styles.formHeading}>{t("onb.nameHeading")}</Text>
      <Text style={styles.formSub}>{t("onb.nameSub")}</Text>
      <PremiumInput
        label={t("onb.nameLabel")}
        value={name}
        onChangeText={setName}
        placeholder={t("onb.namePlaceholder")}
        icon="user"
      />
      <View style={styles.trustRow}>
        <Icon name="lock" size={12} color={GREY_TEXT} />
        <Text style={styles.trustText}>Your data stays private and encrypted</Text>
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
  return (
    <View style={styles.formCard}>
      <View style={styles.cardIconRow}>
        <View style={[styles.cardIcon, { backgroundColor: "#F0FDF4" }]}>
          <Icon name="users" size={20} color={SUCCESS} />
        </View>
      </View>
      <Text style={styles.formHeading}>{t("onb.contactHeading")}</Text>
      <Text style={styles.formSub}>{t("onb.contactSub")}</Text>
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
        <Icon name="bell" size={12} color={GREY_TEXT} />
        <Text style={styles.trustText}>They'll receive your SOS alerts instantly</Text>
      </View>
    </View>
  );
}

// ── Location step ─────────────────────────────────────────────────────────────
function LocationStep({ granted, onAllow, t }: { granted: boolean; onAllow: () => void; t: (k: string) => string }) {
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
    <View style={styles.formCard}>
      <View style={styles.cardIconRow}>
        <Animated.View style={[styles.cardIcon, { backgroundColor: BLUE_LIGHT, transform: [{ scale: pulse }] }]}>
          <Icon name="mapPin" size={20} color={BLUE} />
        </Animated.View>
      </View>
      <Text style={styles.formHeading}>{t("onb.locationHeading")}</Text>
      <Text style={styles.formSub}>{t("onb.locationSub")}</Text>

      {granted ? (
        <View style={styles.grantedRow}>
          <View style={[styles.grantedIcon, { backgroundColor: "#F0FDF4" }]}>
            <Icon name="check" size={16} color={SUCCESS} />
          </View>
          <Text style={[styles.grantedText, { color: SUCCESS }]}>{t("onb.locationGranted")}</Text>
        </View>
      ) : (
        <Pressable onPress={onAllow} style={({ pressed }) => [styles.allowBtn, { opacity: pressed ? 0.85 : 1 }]}>
          <Icon name="mapPin" size={16} color="#fff" />
          <Text style={styles.allowBtnText}>{t("onb.locationAllow")}</Text>
        </Pressable>
      )}

      <View style={[styles.trustRow, { marginTop: 14 }]}>
        <Icon name="lock" size={12} color={GREY_TEXT} />
        <Text style={styles.trustText}>Used only for SOS alerts — never tracked in background</Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function Onboarding() {
  const { t }              = useI18n();
  const { completeOnboarding, setProfile, addContact } = useApp();
  const router             = useRouter();
  const insets             = useSafeAreaInsets();

  const [step, setStep]                   = useState(0);
  const [name, setName]                   = useState("");
  const [contactName, setContactName]     = useState("");
  const [contactPhone, setContactPhone]   = useState("");
  const [locationGranted, setLocationGranted] = useState(false);
  const [error, setError]                 = useState("");

  const slideY  = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animateTo = (next: number) => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideY,  { toValue: 20, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      setError("");
      slideY.setValue(-20);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideY,  { toValue: 0, duration: 200, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      ]).start();
    });
  };

  const handleAllowLocation = async () => {
    if (Platform.OS === "web") { setLocationGranted(true); return; }
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    setLocationGranted(status === "granted");
  };

  const handleSkip = () => {
    setError("");
    if (step < TOTAL - 1) animateTo(step + 1);
    else finish();
  };

  const handleNext = () => {
    setError("");
    if (step === 0) {
      if (!name.trim()) { setError(t("onb.nameError")); return; }
      setProfile({ name: name.trim() });
      animateTo(1);
      return;
    }
    if (step === 1) {
      const hasName  = contactName.trim().length > 0;
      const hasPhone = contactPhone.trim().length > 0;
      if (hasName || hasPhone) {
        const result = addContact(contactName.trim(), contactPhone.trim());
        if (!result.ok) {
          if (result.error === "invalid")   { setError(t("onb.invalidPhone"));   return; }
          if (result.error === "duplicate") { setError(t("onb.duplicatePhone")); return; }
        }
      }
      animateTo(2);
      return;
    }
    if (step === 2) finish();
  };

  const finish = () => {
    completeOnboarding();
    router.replace("/(tabs)" as never);
  };

  const primaryLabel =
    step === 0 ? t("onb.continue")
    : step === 1 ? (contactName.trim() || contactPhone.trim() ? t("onb.contactAddContinue") : t("onb.continue"))
    : t("onb.getStarted");

  const skipLabel =
    step === 0 ? ""
    : step === 1 ? t("onb.skipForNow")
    : t("onb.skip");

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F8FAFC" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero header ─────────────────────────────────── */}
        <LinearGradient
          colors={[BLUE, BLUE_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Logo row */}
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Text style={{ fontSize: 22 }}>🛡️</Text>
            </View>
            <View>
              <Text style={styles.heroName}>Suraksha</Text>
              <Text style={styles.heroTagline}>Your Safety. Our Priority.</Text>
            </View>
          </View>

          {/* City illustration */}
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
            <View style={styles.errorRow}>
              <Icon name="info" size={13} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Primary button */}
          <Pressable onPress={handleNext} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
            <LinearGradient
              colors={[BLUE, BLUE_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtn}
            >
              <Icon name="shield" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
            </LinearGradient>
          </Pressable>

          {/* Skip */}
          {!!skipLabel && (
            <Pressable onPress={handleSkip} hitSlop={12} style={styles.skipWrap}>
              <Text style={styles.skipText}>{skipLabel}</Text>
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },

  // Hero
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

  // Step indicator
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
    borderColor: BLUE_MUTED,
  },
  stepDotActive:  { backgroundColor: BLUE, borderColor: BLUE },
  stepDotDone:    { backgroundColor: BLUE, borderColor: BLUE },
  stepDotFuture:  { backgroundColor: "#fff", borderColor: BLUE_MUTED },
  stepNum:        { color: BLUE_MUTED, fontSize: 13, fontFamily: "Inter_700Bold" },
  stepLine:       { flex: 1, height: 2, backgroundColor: BLUE_MUTED, marginHorizontal: 6, maxWidth: 48 },

  // Form card
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
    color: "#111827",
    marginBottom: 5,
  },
  formSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    lineHeight: 19,
    marginBottom: 18,
  },

  // Input
  fieldLabel: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: "#374151",
    marginBottom: 7,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
    overflow: "hidden",
  },
  inputIcon: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  fieldInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#111827",
  },
  inputCheck: {
    paddingRight: 12,
  },

  // Trust row
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  trustText: {
    fontSize: 11.5,
    color: GREY_TEXT,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },

  // Location step
  grantedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F0FDF4",
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
    backgroundColor: BLUE,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  allowBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Error
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },

  // Primary button
  primaryBtn: {
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },

  // Skip
  skipWrap: { alignItems: "center", paddingVertical: 6 },
  skipText:  { color: GREY_TEXT, fontSize: 13.5, fontFamily: "Inter_500Medium" },
});
