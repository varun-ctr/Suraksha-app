import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "@/context/LanguageContext";
import { sendOtp, verifyOtp } from "@/lib/auth";

const PRIMARY = "#7C3AED";
const loginBg = require("@/assets/images/login-bg.png");

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setError(t("login.invalidEmail"));
      return;
    }
    setError(null);
    setLoading(true);
    const { error: err } = await sendOtp(trimmed);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setStep("otp");
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.trim();
    if (code.length !== 6) {
      setError(t("login.invalidCode"));
      return;
    }
    setError(null);
    setLoading(true);
    const { error: err } = await verifyOtp(email.trim().toLowerCase(), code);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <ImageBackground source={loginBg} style={styles.bg} resizeMode="cover">
      <View style={[styles.scrim, StyleSheet.absoluteFill]} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.flex, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.topSection}>
            <Text style={styles.appName}>Suraksha</Text>
            <Text style={styles.tagline}>{t("login.tagline")}</Text>
          </View>

          <BlurView intensity={60} tint="light" style={styles.card}>
            {step === "email" ? (
              <>
                <Text style={styles.cardTitle}>{t("login.signIn")}</Text>
                <Text style={styles.cardSub}>{t("login.signInSub")}</Text>

                <Text style={styles.label}>{t("login.emailLabel")}</Text>
                <TextInput
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(null); }}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(80,60,120,0.45)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  returnKeyType="done"
                  onSubmitEditing={handleSendOtp}
                />

                {error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                  onPress={handleSendOtp}
                  disabled={loading}
                  style={[styles.btn, { opacity: loading ? 0.7 : 1 }]}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>{t("login.sendCode")}</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>{t("login.enterCode")}</Text>
                <Text style={styles.cardSub}>
                  {t("login.enterCode")} —{" "}
                  <Text style={{ fontWeight: "700" }}>{email}</Text>
                </Text>

                <Text style={styles.label}>{t("login.otpLabel")}</Text>
                <TextInput
                  value={otp}
                  onChangeText={(v) => { setOtp(v.replace(/\D/g, "").slice(0, 6)); setError(null); }}
                  placeholder="123456"
                  placeholderTextColor="rgba(80,60,120,0.45)"
                  keyboardType="number-pad"
                  style={[styles.input, styles.otpInput]}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyOtp}
                  maxLength={6}
                />

                {error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                  onPress={handleVerifyOtp}
                  disabled={loading}
                  style={[styles.btn, { opacity: loading ? 0.7 : 1 }]}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>{t("login.verify")}</Text>}
                </Pressable>

                <Pressable
                  onPress={() => { setStep("email"); setOtp(""); setError(null); }}
                  style={styles.backBtn}
                >
                  <Text style={styles.backBtnText}>{t("login.useDifferentEmail")}</Text>
                </Pressable>
              </>
            )}
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bg: { flex: 1, backgroundColor: "#1A0A2E" },
  scrim: { backgroundColor: "rgba(20,10,30,0.55)", zIndex: 0 },
  topSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 1,
  },
  appName: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -1,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  tagline: {
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
    marginTop: 6,
    fontFamily: "Inter_400Regular",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  card: {
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 24,
    overflow: "hidden",
    zIndex: 1,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#1A0A2E",
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 13,
    color: "rgba(40,20,70,0.7)",
    marginBottom: 20,
    lineHeight: 18,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(40,20,70,0.6)",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1A0A2E",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.2)",
  },
  otpInput: {
    fontSize: 24,
    letterSpacing: 8,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  error: {
    fontSize: 12,
    color: "#C0392B",
    marginBottom: 10,
    fontFamily: "Inter_500Medium",
  },
  btn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  backBtn: { alignItems: "center", marginTop: 14 },
  backBtnText: { fontSize: 13, color: "rgba(40,20,70,0.6)", fontFamily: "Inter_500Medium" },
});
