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

import { CountryCodePicker } from "@/components/CountryCodePicker";
import { DEFAULT_COUNTRY, type CountryOption } from "@/constants/countries";
import { useI18n } from "@/context/LanguageContext";
import {
  onAuthStateChange,
  sendOtp,
  sendPhoneOtp,
  verifyOtp,
  verifyPhoneOtp,
} from "@/lib/auth";

const PRIMARY = "#7C3AED";
const loginBg = require("@/assets/images/login-bg.png");

type LoginTab = "phone" | "email";
type PhoneStep = "phone" | "otp";
type EmailStep = "email" | "waiting" | "code";

// ---------------------------------------------------------------------------
// 6-box OTP display
// ---------------------------------------------------------------------------
function OtpBoxes({
  value,
  onPress,
}: {
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.otpRow} accessibilityLabel="OTP input">
      {Array.from({ length: 6 }).map((_, i) => {
        const char = value[i];
        const isActive = i === value.length && value.length < 6;
        return (
          <View
            key={i}
            style={[
              styles.otpBox,
              char ? styles.otpBoxFilled : styles.otpBoxEmpty,
              isActive && styles.otpBoxActive,
            ]}
          >
            <Text style={styles.otpBoxChar}>{char ?? ""}</Text>
          </View>
        );
      })}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();

  const [tab, setTab] = useState<LoginTab>("phone");

  // Phone flow
  const [country, setCountry] = useState<CountryOption>(DEFAULT_COUNTRY);
  const [localPhone, setLocalPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("phone");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const otpInputRef = useRef<TextInput>(null);

  // Email flow
  const [emailStep, setEmailStep] = useState<EmailStep>("email");
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");

  // Shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-navigate when Supabase fires SIGNED_IN (magic link or OTP success)
  useEffect(() => {
    const { unsubscribe } = onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        router.replace("/(tabs)" as never);
      }
    });
    return unsubscribe;
  }, [router]);

  // Countdown for phone OTP resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Auto-focus OTP input when entering otp step
  useEffect(() => {
    if (phoneStep === "otp") {
      const t = setTimeout(() => otpInputRef.current?.focus(), 180);
      return () => clearTimeout(t);
    }
  }, [phoneStep]);

  const switchTab = (t: LoginTab) => {
    setTab(t);
    setError(null);
  };

  // ── Phone: send OTP ──────────────────────────────────────────────────────
  const handleSendPhoneOtp = useCallback(async () => {
    const digits = localPhone.trim().replace(/\D/g, "");
    if (digits.length < 4) {
      setError(t("login.invalidPhone"));
      return;
    }
    setError(null);
    setLoading(true);
    const fullPhone = `${country.dial}${digits}`;
    const result = await sendPhoneOtp(fullPhone);
    setLoading(false);
    if (result.error === "rate_limited") {
      setError(t("login.rateLimited").replace("{n}", String(result.rateLimitMinutes ?? 60)));
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    setPhoneOtp("");
    setPhoneStep("otp");
    setCountdown(30);
  }, [localPhone, country, t]);

  // ── Phone: verify OTP ────────────────────────────────────────────────────
  const handleVerifyPhoneOtp = useCallback(
    async (codeOverride?: string) => {
      const code = codeOverride ?? phoneOtp;
      if (code.length !== 6) {
        setError(t("login.invalidCode"));
        return;
      }
      setError(null);
      setLoading(true);
      const fullPhone = `${country.dial}${localPhone.trim().replace(/\D/g, "")}`;
      const { error: err } = await verifyPhoneOtp(fullPhone, code);
      setLoading(false);
      if (err) {
        setError(err);
      } else {
        router.replace("/(tabs)" as never);
      }
    },
    [phoneOtp, country, localPhone, router, t],
  );

  // ── Phone: resend OTP ─────────────────────────────────────────────────────
  const handleResendPhoneOtp = useCallback(async () => {
    setPhoneOtp("");
    setError(null);
    setLoading(true);
    const fullPhone = `${country.dial}${localPhone.trim().replace(/\D/g, "")}`;
    const result = await sendPhoneOtp(fullPhone);
    setLoading(false);
    if (result.error === "rate_limited") {
      setError(t("login.rateLimited").replace("{n}", String(result.rateLimitMinutes ?? 60)));
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    setCountdown(30);
  }, [country, localPhone, t]);

  // ── Phone: handle OTP input change (auto-submit at 6 digits) ─────────────
  const handlePhoneOtpChange = useCallback(
    (v: string) => {
      const digits = v.replace(/\D/g, "").slice(0, 6);
      setPhoneOtp(digits);
      setError(null);
      if (digits.length === 6) {
        void handleVerifyPhoneOtp(digits);
      }
    },
    [handleVerifyPhoneOtp],
  );

  // ── Email: send OTP ───────────────────────────────────────────────────────
  const handleSendEmailOtp = useCallback(async () => {
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
      setEmailStep("waiting");
    }
  }, [email, t]);

  // ── Email: verify OTP ──────────────────────────────────────────────────────
  const handleVerifyEmailOtp = useCallback(async () => {
    const code = emailOtp.trim();
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
      router.replace("/(tabs)" as never);
    }
  }, [email, emailOtp, router, t]);

  const resetEmailFlow = () => {
    setEmailStep("email");
    setEmailOtp("");
    setError(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const sentTo = `${country.flag} ${country.dial} ${localPhone.trim()}`;

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
            {/* ── Tab selector ── */}
            <View style={styles.tabRow}>
              {(["phone", "email"] as LoginTab[]).map((tk) => (
                <Pressable
                  key={tk}
                  onPress={() => switchTab(tk)}
                  style={[styles.tabBtn, tab === tk && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabText, tab === tk && styles.tabTextActive]}>
                    {tk === "phone" ? t("login.tabMobile") : t("login.tabEmail")}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/*  PHONE TAB                                                    */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {tab === "phone" && phoneStep === "phone" && (
              <>
                <Text style={styles.cardTitle}>{t("login.signIn")}</Text>
                <Text style={styles.cardSub}>{t("login.phoneSub")}</Text>

                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                  <CountryCodePicker value={country} onChange={(c) => { setCountry(c); setError(null); }} />
                  <TextInput
                    value={localPhone}
                    onChangeText={(v) => { setLocalPhone(v.replace(/\D/g, "")); setError(null); }}
                    placeholder={t("login.phonePlaceholder")}
                    placeholderTextColor="rgba(80,60,120,0.45)"
                    keyboardType="number-pad"
                    maxLength={15}
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    returnKeyType="done"
                    onSubmitEditing={handleSendPhoneOtp}
                  />
                </View>

                {error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                  onPress={handleSendPhoneOtp}
                  disabled={loading}
                  style={[styles.btn, { opacity: loading ? 0.7 : 1 }]}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>{t("login.sendOtp")}</Text>}
                </Pressable>
              </>
            )}

            {tab === "phone" && phoneStep === "otp" && (
              <>
                <Text style={styles.cardTitle}>{t("login.enterCode")}</Text>
                <Text style={styles.cardSub}>
                  {t("login.otpSentTo").replace("{phone}", sentTo)}
                </Text>

                {/* 6-box OTP display */}
                <OtpBoxes value={phoneOtp} onPress={() => otpInputRef.current?.focus()} />

                {/* Hidden input that captures actual typing */}
                <TextInput
                  ref={otpInputRef}
                  value={phoneOtp}
                  onChangeText={handlePhoneOtpChange}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  caretHidden
                  maxLength={6}
                  style={{ height: 1, opacity: 0, marginBottom: 0 }}
                />

                {error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                  onPress={() => handleVerifyPhoneOtp()}
                  disabled={loading || phoneOtp.length !== 6}
                  style={[styles.btn, { opacity: loading || phoneOtp.length !== 6 ? 0.6 : 1, marginTop: 4 }]}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>{t("login.verify")}</Text>}
                </Pressable>

                {/* Resend / countdown row */}
                <View style={styles.resendRow}>
                  {countdown > 0 ? (
                    <Text style={styles.countdownText}>
                      {t("login.resendIn").replace("{n}", String(countdown))}
                    </Text>
                  ) : (
                    <Pressable onPress={handleResendPhoneOtp} disabled={loading} style={styles.linkBtn}>
                      <Text style={styles.linkBtnText}>{t("login.resend")}</Text>
                    </Pressable>
                  )}
                </View>

                <Pressable
                  onPress={() => { setPhoneStep("phone"); setPhoneOtp(""); setError(null); }}
                  style={styles.backBtn}
                >
                  <Text style={styles.backBtnText}>{t("login.backToPhone")}</Text>
                </Pressable>
              </>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/*  EMAIL TAB                                                    */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {tab === "email" && emailStep === "email" && (
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
                  onSubmitEditing={handleSendEmailOtp}
                />

                {error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                  onPress={handleSendEmailOtp}
                  disabled={loading}
                  style={[styles.btn, { opacity: loading ? 0.7 : 1 }]}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>{t("login.sendCode")}</Text>}
                </Pressable>
              </>
            )}

            {tab === "email" && emailStep === "waiting" && (
              <>
                <Text style={styles.cardTitle}>{t("login.checkEmail")}</Text>
                <Text style={styles.cardSub}>
                  {t("login.checkEmailSub").replace("{email}", email)}
                </Text>

                <View style={styles.waitingRow}>
                  <ActivityIndicator color={PRIMARY} />
                  <Text style={styles.waitingText}>{t("login.waitingForLink")}</Text>
                </View>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerLabel}>{t("login.or")}</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Pressable onPress={() => setEmailStep("code")} style={styles.linkBtn}>
                  <Text style={styles.linkBtnText}>{t("login.enterCodeInstead")}</Text>
                </Pressable>

                <Pressable onPress={resetEmailFlow} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>{t("login.useDifferentEmail")}</Text>
                </Pressable>
              </>
            )}

            {tab === "email" && emailStep === "code" && (
              <>
                <Text style={styles.cardTitle}>{t("login.enterCode")}</Text>
                <Text style={styles.cardSub}>{t("login.enterCodeSub")}</Text>

                <Text style={styles.label}>{t("login.otpLabel")}</Text>
                <TextInput
                  value={emailOtp}
                  onChangeText={(v) => { setEmailOtp(v.replace(/\D/g, "").slice(0, 6)); setError(null); }}
                  placeholder="123456"
                  placeholderTextColor="rgba(80,60,120,0.45)"
                  keyboardType="number-pad"
                  style={[styles.input, styles.otpTextInput]}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyEmailOtp}
                  maxLength={6}
                />

                {error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                  onPress={handleVerifyEmailOtp}
                  disabled={loading}
                  style={[styles.btn, { opacity: loading ? 0.7 : 1 }]}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>{t("login.verify")}</Text>}
                </Pressable>

                <Pressable onPress={resetEmailFlow} style={styles.backBtn}>
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
  tabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(40,20,70,0.1)",
    borderRadius: 12,
    padding: 3,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: PRIMARY },
  tabText: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(40,20,70,0.55)",
  },
  tabTextActive: { color: "#fff" },
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
  otpTextInput: {
    fontSize: 24,
    letterSpacing: 8,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  // 6-box OTP
  otpRow: {
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    marginBottom: 4,
    marginTop: 4,
  },
  otpBox: {
    width: 42,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  otpBoxEmpty: {
    backgroundColor: "rgba(255,255,255,0.5)",
    borderColor: "rgba(124,58,237,0.25)",
  },
  otpBoxFilled: {
    backgroundColor: "rgba(124,58,237,0.1)",
    borderColor: PRIMARY,
  },
  otpBoxActive: {
    borderColor: PRIMARY,
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.65)",
  },
  otpBoxChar: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#1A0A2E",
  },
  resendRow: {
    alignItems: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  countdownText: {
    fontSize: 12.5,
    color: "rgba(40,20,70,0.55)",
    fontFamily: "Inter_500Medium",
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
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  backBtn: { alignItems: "center", marginTop: 14 },
  backBtnText: { fontSize: 13, color: "rgba(40,20,70,0.6)", fontFamily: "Inter_500Medium" },
  linkBtn: {
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.3)",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  linkBtnText: { fontSize: 13, color: PRIMARY, fontFamily: "Inter_600SemiBold" },
  waitingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(124,58,237,0.08)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  waitingText: { flex: 1, fontSize: 13, color: "rgba(40,20,70,0.75)", lineHeight: 18 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(40,20,70,0.15)" },
  dividerLabel: { fontSize: 11, color: "rgba(40,20,70,0.45)", fontFamily: "Inter_500Medium" },
});
