import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useI18n } from "@/context/LanguageContext";
import { supabase } from "@/lib/supabaseClient";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BLUE      = "#2563EB";
const BLUE_DARK = "#1D4ED8";
const BLUE_SOFT = "#EFF6FF";
const SUCCESS   = "#22C55E";

type Step = "email" | "sent" | "code" | "linked";

// ── OTP box row ───────────────────────────────────────────────────────────────
function OtpBoxes({
  value,
  onChange,
  onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: () => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const boxes = Array.from({ length: 6 });

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 6);
    onChange(digits);
    if (digits.length === 6) onComplete();
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={otp.wrap}>
      {boxes.map((_, i) => {
        const char   = value[i] ?? "";
        const active = value.length === i;
        return (
          <View key={i} style={[otp.box, char && otp.boxFilled, active && otp.boxActive]}>
            <Text style={otp.digit}>{char || ""}</Text>
            {active && <View style={otp.cursor} />}
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={6}
        style={otp.hiddenInput}
        caretHidden
      />
    </Pressable>
  );
}

const otp = StyleSheet.create({
  wrap:        { flexDirection: "row", gap: 8, justifyContent: "center", marginVertical: 16, position: "relative" },
  box:         { width: 44, height: 54, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center" },
  boxActive:   { borderColor: BLUE, backgroundColor: BLUE_SOFT },
  boxFilled:   { borderColor: "#93C5FD", backgroundColor: "#EFF6FF" },
  digit:       { fontSize: 22, fontFamily: "Inter_700Bold", color: "#111827" },
  cursor:      { position: "absolute", bottom: 10, width: 2, height: 20, backgroundColor: BLUE, borderRadius: 1 },
  hiddenInput: { position: "absolute", opacity: 0, width: 1, height: 1 },
});

// ── Countdown ring ─────────────────────────────────────────────────────────────
function CountdownRing({ seconds }: { seconds: number }) {
  const progress = useRef(new Animated.Value(60)).current;
  useEffect(() => {
    progress.setValue(seconds);
    Animated.timing(progress, { toValue: 0, duration: seconds * 1000, useNativeDriver: false }).start();
  }, [seconds, progress]);

  const pct = progress.interpolate({ inputRange: [0, 60], outputRange: ["0%", "100%"] });
  return (
    <View style={ring.wrap}>
      <Animated.View style={[ring.fill, { width: pct }]} />
      <AnimatedCountdown seconds={seconds} />
    </View>
  );
}

function AnimatedCountdown({ seconds }: { seconds: number }) {
  const [s, setS] = useState(seconds);
  useEffect(() => {
    setS(seconds);
    const iv = setInterval(() => setS((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(iv);
  }, [seconds]);
  return <Text style={ring.text}>{s > 0 ? `Resend in ${s}s` : ""}</Text>;
}

const ring = StyleSheet.create({
  wrap: { height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, marginBottom: 14, overflow: "hidden" },
  fill: { height: 4, backgroundColor: BLUE, borderRadius: 2 },
  text: { fontSize: 12, color: "#6B7280", fontFamily: "Inter_500Medium", textAlign: "center", marginBottom: 10 },
});

// ── Success animation ─────────────────────────────────────────────────────────
function SuccessView({ email, onDone }: { email: string; onDone: () => void }) {
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Animated.View style={[suc.wrap, { opacity }]}>
      <Animated.View style={[suc.iconWrap, { transform: [{ scale }] }]}>
        <LinearGradient colors={[SUCCESS, "#16A34A"]} style={suc.icon}>
          <Text style={{ fontSize: 34 }}>🛡️</Text>
        </LinearGradient>
      </Animated.View>
      <Text style={suc.title}>Account Linked!</Text>
      <Text style={suc.sub}>
        Your safety data is now backed up to{"\n"}
        <Text style={[suc.sub, { color: BLUE, fontFamily: "Inter_700Bold" }]}>{email}</Text>
        {"\n\n"}You can sign in from any device using this email.
      </Text>
      <Pressable onPress={onDone} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
        <LinearGradient colors={[SUCCESS, "#16A34A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={suc.btn}>
          <Icon name="check" size={18} color="#fff" />
          <Text style={suc.btnText}>Done</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const suc = StyleSheet.create({
  wrap:     { alignItems: "center", paddingVertical: 8 },
  iconWrap: { marginBottom: 20 },
  icon:     { width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center", shadowColor: SUCCESS, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  title:    { fontSize: 24, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 10, textAlign: "center" },
  sub:      { fontSize: 13.5, color: "#6B7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  btn:      { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 20, paddingVertical: 15, paddingHorizontal: 36, shadowColor: SUCCESS, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  btnText:  { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function LinkAccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t }  = useI18n();

  const [step,    setStep]    = useState<Step>("email");
  const [email,   setEmail]   = useState("");
  const [code,    setCode]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const cardSlide   = useRef(new Animated.Value(60)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(cardSlide,   { toValue: 0, duration: 400, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
    ]).start();
  }, [cardSlide, cardOpacity]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "USER_UPDATED") setStep("linked");
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Step 1: initiate email link ───────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) { setError("Enter a valid email address."); return; }
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ email: trimmed });
    setLoading(false);
    if (err) { setError(err.message); } else { setStep("sent"); }
  }, [email]);

  // ── Step 2: verify OTP code ───────────────────────────────────────────────
  const handleVerifyCode = useCallback(async () => {
    const trimmed = code.trim();
    if (trimmed.length !== 6) { setError("Enter the 6-digit code from your email."); return; }
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: trimmed,
      type: "email",
    });
    setLoading(false);
    if (err) { setError(err.message); } else { setStep("linked"); }
  }, [email, code]);

  const handleSkip = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const animateStep = (next: Step) => {
    Animated.timing(cardOpacity, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setStep(next);
      setError(null);
      Animated.timing(cardOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  return (
    <LinearGradient
      colors={["#1E3A8A", "#1D4ED8", "#2563EB"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      {/* Decorative background circles */}
      <View style={deco.circle1} />
      <View style={deco.circle2} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Skip button */}
          <View style={styles.skipRow}>
            <Pressable onPress={handleSkip} hitSlop={12} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>

          {/* Hero section */}
          <View style={styles.heroSection}>
            <View style={styles.logoWrap}>
              <Text style={{ fontSize: 32 }}>🛡️</Text>
            </View>
            <Text style={styles.heroTitle}>Save Your Data</Text>
            <Text style={styles.heroSub}>
              Link an email to keep your contacts{"\n"}and settings safe across devices.
            </Text>
          </View>

          {/* ── Card ─────────────────────────────────────────── */}
          <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ translateY: cardSlide }] }]}>

            {/* EMAIL step */}
            {step === "email" && (
              <>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconWrap, { backgroundColor: BLUE_SOFT }]}>
                    <Icon name="send" size={20} color={BLUE} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Link an email</Text>
                    <Text style={styles.cardSub}>We'll send a one-time confirmation link.</Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Email address</Text>
                <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
                  <View style={styles.inputIcon}>
                    <Icon name="send" size={15} color={focused ? BLUE : "#9CA3AF"} />
                  </View>
                  <TextInput
                    value={email}
                    onChangeText={(v) => { setEmail(v); setError(null); }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="you@example.com"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.fieldInput}
                    returnKeyType="done"
                    onSubmitEditing={handleSend}
                  />
                  {email.includes("@") && email.includes(".") && (
                    <View style={{ paddingRight: 12 }}>
                      <Icon name="check" size={14} color={SUCCESS} />
                    </View>
                  )}
                </View>

                {error && (
                  <View style={styles.errorRow}>
                    <Icon name="info" size={13} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <Pressable onPress={handleSend} disabled={loading} style={({ pressed }) => ({ opacity: pressed || loading ? 0.85 : 1 })}>
                  <LinearGradient colors={[BLUE, BLUE_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : (
                        <>
                          <Icon name="shield" size={17} color="#fff" />
                          <Text style={styles.primaryBtnText}>Continue Securely</Text>
                        </>
                      )}
                  </LinearGradient>
                </Pressable>

                <Pressable onPress={handleSkip} style={styles.ghostBtn}>
                  <Text style={styles.ghostBtnText}>Maybe later</Text>
                </Pressable>

                {/* Privacy trust card */}
                <View style={styles.trustCard}>
                  <Text style={{ fontSize: 18 }}>🛡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trustTitle}>Your privacy comes first</Text>
                    <Text style={styles.trustSub}>Your data is encrypted and never shared without your permission.</Text>
                  </View>
                </View>
              </>
            )}

            {/* SENT step */}
            {step === "sent" && (
              <>
                <View style={[styles.cardIconWrap, { backgroundColor: "#FEF9C3", alignSelf: "center", width: 64, height: 64, borderRadius: 20, marginBottom: 14 }]}>
                  <Text style={{ fontSize: 30 }}>📬</Text>
                </View>
                <Text style={[styles.cardTitle, { textAlign: "center" }]}>Check your email</Text>
                <Text style={[styles.cardSub, { textAlign: "center" }]}>
                  We sent a link to{"\n"}
                  <Text style={{ color: BLUE, fontFamily: "Inter_700Bold" }}>{email.trim().toLowerCase()}</Text>
                  {"\n\n"}Tap the link, or enter the 6-digit code.
                </Text>

                <Pressable onPress={() => animateStep("code")} style={[styles.primaryBtn, { backgroundColor: BLUE, borderRadius: 20 }]}>
                  <Icon name="lock" size={17} color="#fff" />
                  <Text style={styles.primaryBtnText}>Enter code instead</Text>
                </Pressable>

                <Pressable onPress={() => animateStep("email")} style={styles.ghostBtn}>
                  <Text style={styles.ghostBtnText}>Use a different email</Text>
                </Pressable>
              </>
            )}

            {/* CODE step */}
            {step === "code" && (
              <>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconWrap, { backgroundColor: BLUE_SOFT }]}>
                    <Icon name="lock" size={20} color={BLUE} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Enter the code</Text>
                    <Text style={styles.cardSub}>
                      From the email sent to{" "}
                      <Text style={{ color: BLUE, fontFamily: "Inter_600SemiBold" }}>{email.trim().toLowerCase()}</Text>
                    </Text>
                  </View>
                </View>

                <OtpBoxes value={code} onChange={(v) => { setCode(v); setError(null); }} onComplete={handleVerifyCode} />
                <CountdownRing seconds={60} />

                {error && (
                  <View style={styles.errorRow}>
                    <Icon name="info" size={13} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <Pressable
                  onPress={handleVerifyCode}
                  disabled={loading || code.length !== 6}
                  style={({ pressed }) => ({ opacity: pressed || loading || code.length !== 6 ? 0.6 : 1 })}
                >
                  <LinearGradient colors={[BLUE, BLUE_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : (
                        <>
                          <Icon name="check" size={17} color="#fff" />
                          <Text style={styles.primaryBtnText}>Verify & Link Account</Text>
                        </>
                      )}
                  </LinearGradient>
                </Pressable>

                <Pressable onPress={() => { animateStep("sent"); setCode(""); }} style={styles.ghostBtn}>
                  <Text style={styles.ghostBtnText}>Back</Text>
                </Pressable>
              </>
            )}

            {/* LINKED step */}
            {step === "linked" && (
              <SuccessView email={email.trim().toLowerCase()} onDone={handleSkip} />
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const deco = StyleSheet.create({
  circle1: { position: "absolute", width: 320, height: 320, borderRadius: 160, backgroundColor: "rgba(255,255,255,0.05)", top: -80, right: -80 },
  circle2: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.04)", bottom: 120, left: -60 },
});

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },

  skipRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
  skipBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)" },
  skipText: { fontSize: 13.5, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.9)" },

  heroSection: { alignItems: "center", paddingVertical: 28 },
  logoWrap: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  heroTitle: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 8, textAlign: "center" },
  heroSub:   { color: "rgba(255,255,255,0.78)", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },

  cardHeader: { flexDirection: "row", gap: 14, alignItems: "flex-start", marginBottom: 18 },
  cardIconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 3 },
  cardSub:   { fontSize: 13, color: "#6B7280", lineHeight: 19 },

  fieldLabel:   { fontSize: 11.5, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrap:    { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 14, backgroundColor: "#F9FAFB", marginBottom: 14, overflow: "hidden" },
  inputWrapFocused: { borderColor: BLUE, backgroundColor: BLUE_SOFT },
  inputIcon:    { width: 42, alignItems: "center", justifyContent: "center", alignSelf: "stretch", borderRightWidth: 1, borderRightColor: "#E5E7EB" },
  fieldInput:   { flex: 1, paddingHorizontal: 12, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular", color: "#111827" },

  errorRow:  { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 10, padding: 10, marginBottom: 12 },
  errorText: { color: "#EF4444", fontSize: 12.5, fontFamily: "Inter_500Medium", flex: 1 },

  primaryBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 20, paddingVertical: 15, marginBottom: 12, shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  primaryBtnText: { color: "#fff", fontSize: 15.5, fontFamily: "Inter_700Bold" },

  ghostBtn:     { alignItems: "center", paddingVertical: 10 },
  ghostBtnText: { fontSize: 13.5, color: "#6B7280", fontFamily: "Inter_500Medium" },

  trustCard:  { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 14, padding: 12, marginTop: 14 },
  trustTitle: { fontSize: 12.5, fontFamily: "Inter_700Bold", color: "#374151", marginBottom: 2 },
  trustSub:   { fontSize: 11.5, color: "#6B7280", lineHeight: 16 },
});
