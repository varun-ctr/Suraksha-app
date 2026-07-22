import { useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { useI18n } from "@/features/settings/context/LanguageContext";
import { useToast } from "@/features/settings/context/ToastContext";

export type FakeCallPhase = "form" | "ringing" | "connected";

/** All state and timers for the decoy fake-call screen: schedule, ring, and in-call countdown. */
export function useFakeCallScreen() {
  const { t } = useI18n();
  const { showToast } = useToast();

  const [name, setName] = useState("Mom");
  const [delay, setDelay] = useState(10);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [phase, setPhase] = useState<FakeCallPhase>("form");
  const [callSeconds, setCallSeconds] = useState(0);

  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    [countdownTimer, ringTimer, callTimer].forEach((ref) => {
      if (ref.current) {
        clearInterval(ref.current);
        ref.current = null;
      }
    });
  };

  useEffect(() => () => clearTimers(), []);

  const startRinging = () => {
    setPhase("ringing");
    ringTimer.current = setInterval(() => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }, 1500);
  };

  const schedule = () => {
    setCountdown(delay);
    showToast(t("fake.scheduled"));
    countdownTimer.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (countdownTimer.current) clearInterval(countdownTimer.current);
          countdownTimer.current = null;
          startRinging();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelSchedule = () => {
    clearTimers();
    setCountdown(null);
    showToast(t("common.cancel"));
  };

  const accept = () => {
    if (ringTimer.current) clearInterval(ringTimer.current);
    ringTimer.current = null;
    setPhase("connected");
    setCallSeconds(0);
    callTimer.current = setInterval(() => setCallSeconds((s) => s + 1), 1000);
  };

  const hangUp = () => {
    clearTimers();
    setPhase("form");
    setCountdown(null);
    setCallSeconds(0);
  };

  return {
    name, setName, delay, setDelay, countdown, phase, callSeconds,
    schedule, cancelSchedule, accept, hangUp,
  };
}
