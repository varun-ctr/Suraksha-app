import * as ExpoLocation from "expo-location";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Animated, Easing, Platform } from "react-native";

import { useApp } from "@/features/profile/context/AppContext";
import { useI18n } from "@/features/settings/context/LanguageContext";

export const ONBOARDING_TOTAL_STEPS = 3;

/** All state, step-transition animation, and handlers for the onboarding wizard. */
export function useOnboardingScreen() {
  const { t } = useI18n();
  const { completeOnboarding, setProfile, addContact } = useApp();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [locationGranted, setLocationGranted] = useState(false);
  const [error, setError] = useState("");

  const slideY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animateTo = (next: number) => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 20, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      setError("");
      slideY.setValue(-20);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 0, duration: 200, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      ]).start();
    });
  };

  const handleAllowLocation = async () => {
    if (Platform.OS === "web") { setLocationGranted(true); return; }
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    setLocationGranted(status === "granted");
  };

  const finish = () => {
    completeOnboarding();
    router.replace("/(tabs)" as never);
  };

  const handleSkip = () => {
    setError("");
    if (step < ONBOARDING_TOTAL_STEPS - 1) animateTo(step + 1);
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
      const hasName = contactName.trim().length > 0;
      const hasPhone = contactPhone.trim().length > 0;
      if (hasName || hasPhone) {
        const result = addContact(contactName.trim(), contactPhone.trim());
        if (!result.ok) {
          if (result.error === "invalid") { setError(t("onb.invalidPhone")); return; }
          if (result.error === "duplicate") { setError(t("onb.duplicatePhone")); return; }
        }
      }
      animateTo(2);
      return;
    }
    if (step === 2) finish();
  };

  const primaryLabel =
    step === 0 ? t("onb.continue")
    : step === 1 ? (contactName.trim() || contactPhone.trim() ? t("onb.contactAddContinue") : t("onb.continue"))
    : t("onb.getStarted");

  const skipLabel =
    step === 0 ? ""
    : step === 1 ? t("onb.skipForNow")
    : t("onb.skip");

  return {
    step, name, setName, contactName, setContactName, contactPhone, setContactPhone,
    locationGranted, error, slideY, opacity,
    handleAllowLocation, handleSkip, handleNext,
    primaryLabel, skipLabel,
  };
}
