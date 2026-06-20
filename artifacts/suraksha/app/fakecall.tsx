import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackHeader } from "@/components/Headers";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { fmtClock } from "@/lib/format";

const DELAYS = [5, 10, 30];

export default function FakeCallScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("Mom");
  const [delay, setDelay] = useState(10);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [phase, setPhase] = useState<"form" | "ringing" | "connected">("form");
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

  const startRinging = () => {
    setPhase("ringing");
    ringTimer.current = setInterval(() => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }, 1500);
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

  if (phase === "ringing" || phase === "connected") {
    return (
      <LinearGradient
        colors={["#1A1430", "#0C0818"]}
        style={{ flex: 1, paddingTop: insets.top + 50, paddingBottom: insets.bottom + 40, alignItems: "center" }}
      >
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginBottom: 6 }}>
          {phase === "ringing" ? t("fake.incoming") : fmtClock(callSeconds)}
        </Text>
        <View style={styles.callAvatar}>
          <Text style={{ color: "#fff", fontSize: 44, fontFamily: "Inter_700Bold" }}>{name.charAt(0) || "?"}</Text>
        </View>
        <Text style={{ color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 24 }}>{name}</Text>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 4 }}>mobile</Text>

        <View style={{ flex: 1 }} />

        {phase === "ringing" ? (
          <View style={{ flexDirection: "row", gap: 70 }}>
            <View style={{ alignItems: "center", gap: 10 }}>
              <Pressable onPress={hangUp} style={[styles.callBtn, { backgroundColor: "#E5484D" }]}>
                <Icon name="phone" size={26} color="#fff" />
              </Pressable>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12.5 }}>{t("fake.decline")}</Text>
            </View>
            <View style={{ alignItems: "center", gap: 10 }}>
              <Pressable onPress={accept} style={[styles.callBtn, { backgroundColor: "#30A46C" }]}>
                <Icon name="phoneCall" size={26} color="#fff" />
              </Pressable>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12.5 }}>{t("fake.accept")}</Text>
            </View>
          </View>
        ) : (
          <View style={{ alignItems: "center", gap: 10 }}>
            <Pressable onPress={hangUp} style={[styles.callBtn, { backgroundColor: "#E5484D" }]}>
              <Icon name="phone" size={26} color="#fff" />
            </Pressable>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12.5 }}>{t("fake.decline")}</Text>
          </View>
        )}
      </LinearGradient>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title={t("fake.title")} subtitle={t("fake.sub")} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.illus, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={[styles.illusIcon, { backgroundColor: c.primary }]}>
            <Icon name="phoneCall" size={30} color="#fff" />
          </View>
          <Text style={{ fontSize: 13, color: c.textMuted, textAlign: "center", lineHeight: 19, marginTop: 12 }}>
            {t("fake.sub")}
          </Text>
        </View>

        {countdown !== null ? (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, alignItems: "center" }]}>
            <Text style={{ fontSize: 13, color: c.textMuted }}>{t("fake.ringIn")}</Text>
            <Text style={{ fontSize: 44, fontFamily: "Inter_700Bold", color: c.primary, marginVertical: 6 }}>
              {countdown}
            </Text>
            <Text style={{ fontSize: 13, color: c.textMuted, marginBottom: 16 }}>{t("fake.seconds")}</Text>
            <Pressable onPress={cancelSchedule} style={[styles.scheduleBtn, { backgroundColor: c.dangerSoft }]}>
              <Text style={{ color: c.danger, fontFamily: "Inter_700Bold", fontSize: 13.5 }}>{t("fake.cancel")}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.label, { color: c.textMuted }]}>{t("fake.callerName")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("fake.callerName")}
              placeholderTextColor={c.textFaint}
              style={[styles.input, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border }]}
            />
            <Text style={[styles.label, { color: c.textMuted, marginTop: 14 }]}>{t("fake.ringIn")}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {DELAYS.map((d) => {
                const active = delay === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDelay(d)}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      paddingVertical: 11,
                      borderRadius: 10,
                      backgroundColor: active ? c.primary : c.cardAlt,
                    }}
                  >
                    <Text style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: active ? "#fff" : c.primary }}>
                      {d}s
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={schedule} style={[styles.scheduleBtn, { backgroundColor: c.primary, marginTop: 18 }]}>
              <Icon name="phoneCall" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13.5 }}>{t("fake.schedule")}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  illus: { borderWidth: 1, borderRadius: 16, padding: 20, alignItems: "center", marginBottom: 16 },
  illusIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  scheduleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  callAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  callBtn: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
});
