import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { supabase } from "@/lib/supabaseClient";

const PRIMARY = "#7C3AED";
const loginBg = require("@/assets/images/login-bg.png");

type Step = "email" | "sent" | "code" | "linked";

export default function LinkAccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeRef = useRef<TextInput>(null);

  // Auto-focus code input when entering code step
  useEffect(() => {
    if (step === "code") {
      const t = setTimeout(() => codeRef.current?.focus(), 180);
      return () => clearTimeout(t);
    }
  }, [step]);

  // Listen for USER_UPDATED — fires when Supabase confirms the link
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "USER_UPDATED") {
        setStep("linked");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Step 1: initiate email link via updateUser ────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({
      email: trimmed,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setStep("sent");
    }
  }, [email]);

  // ── Step 2 (optional): verify 6-digit OTP if user prefers code entry ─────
  const handleVerifyCode = useCallback(async () => {
    const trimmed = code.trim();
    if (trimmed.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: trimmed,
      type: "email",
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setStep("linked");
    }
  }, [email, code]);

  const handleSkip = () => {
    if (router.canGoBack()) {
      router.back();
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

          {/* Skip button — top-right */}
          <View style={styles.skipRow}>
            <Pressable onPress={handleSkip} hitSlop={12} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>

          {/* Hero text */}
          <View style={styles.topSection}>
            <Text style={styles.appName}>Save Your Data</Text>
            <Text style={styles.tagline}>
              Link an email to keep your contacts{"\n"}and settings across devices.
            </Text>
          </View>

          {/* Card */}
          <BlurView intensity={60} tint="light" style={styles.card}>

            {/* ── Step: email input ── */}
            {step === "email" && (
              <>
                <Text style={styles.cardTitle}>Link an email</Text>
                <Text style={styles.cardSub}>
                  We'll send a confirmation link. Your data stays exactly as it is — we're just backing it up.
                </Text>

                <Text style={styles.label}>Email address</Text>
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
                  onSubmitEditing={handleSend}
                />

                {error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                  onPress={handleSend}
                  disabled={loading}
                  style={[styles.btn, { opacity: loading ? 0.7 : 1 }]}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>Send confirmation</Text>}
                </Pressable>

                <Pressable onPress={handleSkip} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>Maybe later</Text>
                </Pressable>
              </>
            )}

            {/* ── Step: email sent — waiting or enter code ── */}
            {step === "sent" && (
              <>
                <Text style={styles.cardTitle}>Check your email</Text>
                <Text style={styles.cardSub}>
                  We sent a confirmation link to{"\n"}
                  <Text style={{ fontFamily: "Inter_700Bold", color: PRIMARY }}>{email.trim().toLowerCase()}</Text>
                  {"\n\n"}Tap the link to confirm, or enter the 6-digit code below.{"\n"}
                  <Text style={{ color: "rgba(40,20,70,0.5)" }}>Check your spam folder if it doesn't arrive in a minute.</Text>
                </Text>

                <Pressable onPress={() => setStep("code")} style={styles.linkBtn}>
                  <Text style={styles.linkBtnText}>Enter code instead</Text>
                </Pressable>

                <Pressable onPress={() => { setStep("email"); setError(null); }} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>Use a different email</Text>
                </Pressable>
              </>
            )}

            {/* ── Step: manual code entry ── */}
            {step === "code" && (
              <>
                <Text style={styles.cardTitle}>Enter the code</Text>
                <Text style={styles.cardSub}>
                  Paste the 6-digit code from the email we sent to{" "}
                  <Text style={{ fontFamily: "Inter_700Bold" }}>{email.trim().toLowerCase()}</Text>.
                </Text>

                <Text style={styles.label}>6-digit code</Text>
                <TextInput
                  ref={codeRef}
                  value={code}
                  onChangeText={(v) => { setCode(v.replace(/\D/g, "").slice(0, 6)); setError(null); }}
                  placeholder="123456"
                  placeholderTextColor="rgba(80,60,120,0.45)"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  style={[styles.input, styles.codeInput]}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyCode}
                  maxLength={6}
                />

                {error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                  onPress={handleVerifyCode}
                  disabled={loading || code.length !== 6}
                  style={[styles.btn, { opacity: loading || code.length !== 6 ? 0.6 : 1 }]}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>Confirm</Text>}
                </Pressable>

                <Pressable onPress={() => { setStep("sent"); setCode(""); setError(null); }} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>Back</Text>
                </Pressable>
              </>
            )}

            {/* ── Step: linked successfully ── */}
            {step === "linked" && (
              <>
                <View style={styles.successIcon}>
                  <Text style={{ fontSize: 36 }}>✓</Text>
                </View>
                <Text style={styles.cardTitle}>Account linked!</Text>
                <Text style={styles.cardSub}>
                  Your data is now backed up to{"\n"}
                  <Text style={{ fontFamily: "Inter_700Bold", color: PRIMARY }}>{email.trim().toLowerCase()}</Text>.
                  {"\n\n"}You can sign in from any device using this email.
                </Text>

                <Pressable onPress={handleSkip} style={styles.btn}>
                  <Text style={styles.btnText}>Done</Text>
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
  skipRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 8,
    zIndex: 2,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  skipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.9)",
  },
  topSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 1,
  },
  appName: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    textAlign: "center",
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 8,
    fontFamily: "Inter_400Regular",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    textAlign: "center",
    lineHeight: 20,
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
    lineHeight: 19,
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
  codeInput: {
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
    minHeight: 44,
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  backBtn: { alignItems: "center", marginTop: 14 },
  backBtnText: { fontSize: 13, color: "rgba(40,20,70,0.6)", fontFamily: "Inter_500Medium" },
  linkBtn: {
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.3)",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  linkBtnText: { fontSize: 13, color: PRIMARY, fontFamily: "Inter_600SemiBold" },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(124,58,237,0.12)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
});
