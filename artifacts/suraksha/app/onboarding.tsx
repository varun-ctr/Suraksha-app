import * as ExpoLocation from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
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

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const ROSE       = "#D4537E";
const ROSE_DARK  = "#993556";
const ROSE_SOFT  = "#F4C0D1";
const ROSE_LIGHT = "#FBEAF0";
const GREY_TEXT  = "#9CA3AF";
const CARD_BG    = "#FFFFFF";
const TOTAL      = 3;

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------
function StepIndicator({ step }: { step: number }) {
  return (
    <View style={styles.stepRow}>
      {Array.from({ length: TOTAL }).map((_, i) => {
        const done   = i < step;
        const active = i === step;
        return (
          <React.Fragment key={i}>
            <View
              style={[
                styles.stepCircle,
                done   && styles.stepDone,
                active && styles.stepActive,
                !done && !active && styles.stepFuture,
              ]}
            >
              {done ? (
                <Text style={styles.stepCheck}>✓</Text>
              ) : (
                <Text style={[styles.stepNum, active && { color: "#fff" }]}>
                  {i + 1}
                </Text>
              )}
            </View>
            {i < TOTAL - 1 && (
              <View
                style={[
                  styles.stepLine,
                  done && { backgroundColor: ROSE },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Constant hero card
// ---------------------------------------------------------------------------
function Hero({ t }: { t: (k: string) => string }) {
  return (
    <LinearGradient
      colors={[ROSE, ROSE_DARK]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <Text style={styles.heroEmoji}>🌸</Text>
      <Text style={styles.heroName}>Suraksha</Text>
      <Text style={styles.heroTagline}>{t("onb.tagline")}</Text>
    </LinearGradient>
  );
}

// ---------------------------------------------------------------------------
// Labelled rose input
// ---------------------------------------------------------------------------
function RoseInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad" | "email-address";
  autoCapitalize?: "none" | "words" | "sentences";
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={GREY_TEXT}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "words"}
        style={styles.fieldInput}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 0 — Name
// ---------------------------------------------------------------------------
function NameStep({
  name,
  setName,
  t,
}: {
  name: string;
  setName: (v: string) => void;
  t: (k: string) => string;
}) {
  return (
    <View style={styles.formCard}>
      <Text style={styles.formHeading}>{t("onb.nameHeading")}</Text>
      <Text style={styles.formSub}>{t("onb.nameSub")}</Text>
      <RoseInput
        label={t("onb.nameLabel")}
        value={name}
        onChangeText={setName}
        placeholder={t("onb.namePlaceholder")}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Trusted contacts
// ---------------------------------------------------------------------------
function ContactsStep({
  contactName,
  setContactName,
  contactPhone,
  setContactPhone,
  t,
}: {
  contactName: string;
  setContactName: (v: string) => void;
  contactPhone: string;
  setContactPhone: (v: string) => void;
  t: (k: string) => string;
}) {
  return (
    <View style={styles.formCard}>
      <Text style={styles.formHeading}>{t("onb.contactHeading")}</Text>
      <Text style={styles.formSub}>{t("onb.contactSub")}</Text>
      <RoseInput
        label={t("onb.contactNameLabel")}
        value={contactName}
        onChangeText={setContactName}
        placeholder={t("onb.contactNamePlaceholder")}
      />
      <RoseInput
        label={t("onb.contactPhoneLabel")}
        value={contactPhone}
        onChangeText={setContactPhone}
        placeholder={t("onb.contactPhonePlaceholder")}
        keyboardType="phone-pad"
        autoCapitalize="none"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Location
// ---------------------------------------------------------------------------
function LocationStep({
  granted,
  onAllow,
  t,
}: {
  granted: boolean;
  onAllow: () => void;
  t: (k: string) => string;
}) {
  return (
    <View style={styles.formCard}>
      <View style={styles.locationIconWrap}>
        <Icon name="mapPin" size={28} color={ROSE} />
      </View>
      <Text style={styles.formHeading}>{t("onb.locationHeading")}</Text>
      <Text style={styles.formSub}>{t("onb.locationSub")}</Text>
      {granted ? (
        <View style={styles.grantedBadge}>
          <Icon name="check" size={16} color="#fff" />
          <Text style={styles.grantedText}>{t("onb.locationGranted")}</Text>
        </View>
      ) : (
        <Pressable onPress={onAllow} style={styles.allowBtn}>
          <Icon name="mapPin" size={16} color={ROSE} />
          <Text style={styles.allowBtnText}>{t("onb.locationAllow")}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function Onboarding() {
  const { t }                  = useI18n();
  const { completeOnboarding, setProfile, addContact } = useApp();
  const router                 = useRouter();
  const insets                 = useSafeAreaInsets();

  const [step, setStep]               = useState(0);
  const [name, setName]               = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [locationGranted, setLocationGranted] = useState(false);
  const [error, setError]             = useState("");

  const fade = useRef(new Animated.Value(1)).current;

  const animateTo = (next: number) => {
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setStep(next);
    setError("");
  };

  const handleAllowLocation = async () => {
    if (Platform.OS === "web") {
      setLocationGranted(true);
      return;
    }
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    setLocationGranted(status === "granted");
  };

  const handleSkip = () => {
    setError("");
    if (step < TOTAL - 1) {
      animateTo(step + 1);
    } else {
      finish();
    }
  };

  const handleNext = () => {
    setError("");

    if (step === 0) {
      if (!name.trim()) {
        setError(t("onb.nameError"));
        return;
      }
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
          if (result.error === "invalid") {
            setError(t("onb.invalidPhone"));
            return;
          }
          if (result.error === "duplicate") {
            setError(t("onb.duplicatePhone"));
            return;
          }
        }
      }
      animateTo(2);
      return;
    }

    if (step === 2) {
      finish();
    }
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
    step === 0 ? "" // no skip on name step
    : step === 1 ? t("onb.skipForNow")
    : t("onb.skip");

  return (
    <LinearGradient
      colors={[ROSE_LIGHT, "#ffffff"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Step indicator */}
          <StepIndicator step={step} />

          {/* Hero */}
          <Hero t={t} />

          {/* Animated form content */}
          <Animated.View style={{ opacity: fade }}>
            {step === 0 && (
              <NameStep name={name} setName={setName} t={t} />
            )}
            {step === 1 && (
              <ContactsStep
                contactName={contactName}
                setContactName={setContactName}
                contactPhone={contactPhone}
                setContactPhone={setContactPhone}
                t={t}
              />
            )}
            {step === 2 && (
              <LocationStep
                granted={locationGranted}
                onAllow={handleAllowLocation}
                t={t}
              />
            )}

            {/* Error */}
            {!!error && <Text style={styles.errorText}>{error}</Text>}

            {/* Primary button */}
            <Pressable onPress={handleNext} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
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
    </LinearGradient>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },

  // Step indicator
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: ROSE_SOFT,
  },
  stepActive:  { backgroundColor: ROSE, borderColor: ROSE },
  stepDone:    { backgroundColor: ROSE, borderColor: ROSE },
  stepFuture:  { backgroundColor: "#fff", borderColor: ROSE_SOFT },
  stepCheck:   { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  stepNum:     { color: ROSE_SOFT, fontSize: 13, fontFamily: "Inter_700Bold" },
  stepLine:    { flex: 1, height: 2, backgroundColor: ROSE_SOFT, marginHorizontal: 6, maxWidth: 40 },

  // Hero
  hero: {
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  heroEmoji:   { fontSize: 36, marginBottom: 6 },
  heroName:    { color: "#fff", fontSize: 30, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  heroTagline: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    textAlign: "center",
  },

  // Form card
  formCard: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: ROSE_SOFT,
    padding: 20,
    marginBottom: 16,
  },
  formHeading: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: ROSE_DARK,
    marginBottom: 6,
  },
  formSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    lineHeight: 19,
    marginBottom: 18,
  },

  // Field
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ROSE,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldInput: {
    borderWidth: 1.5,
    borderColor: ROSE_SOFT,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#111827",
    backgroundColor: "#fff",
  },

  // Location step
  locationIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FDF2F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: ROSE_SOFT,
  },
  allowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: ROSE,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: "#FDF2F6",
  },
  allowBtnText: { color: ROSE, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  grantedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: ROSE,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  grantedText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Error
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 10,
    marginLeft: 2,
  },

  // Primary button
  primaryBtn: {
    backgroundColor: ROSE,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },

  // Skip
  skipWrap: { alignItems: "center", paddingVertical: 4 },
  skipText:  { color: GREY_TEXT, fontSize: 13, fontFamily: "Inter_500Medium" },
});
