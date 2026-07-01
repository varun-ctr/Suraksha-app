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
import { useAuth } from "@/context/AuthContext";

const BLUE      = "#2563EB";
const BLUE_DARK = "#1D4ED8";
const BLUE_SOFT = "#EFF6FF";
const SUCCESS   = "#22C55E";

type Mode = "signin" | "signup" | "forgot" | "verify" | "success";

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
    <Animated.View style={[{ alignItems: "center", paddingVertical: 8 }, { opacity }]}>
      <Animated.View style={[{ marginBottom: 20 }, { transform: [{ scale }] }]}>
        <LinearGradient colors={[SUCCESS, "#16A34A"]} style={suc.icon}>
          <Text style={{ fontSize: 34 }}>🛡️</Text>
        </LinearGradient>
      </Animated.View>
      <Text style={suc.title}>Account Saved!</Text>
      <Text style={suc.sub}>
        Your safety data is backed up to{"\n"}
        <Text style={[suc.sub, { color: BLUE, fontFamily: "Inter_700Bold" }]}>{email}</Text>
        {"\n\n"}Sign in from any device using this email.
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
  icon:    { width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center", shadowColor: SUCCESS, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  title:   { fontSize: 24, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 10, textAlign: "center" },
  sub:     { fontSize: 13.5, color: "#6B7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  btn:     { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 20, paddingVertical: 15, paddingHorizontal: 36, shadowColor: SUCCESS, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  btnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});

function VerifyEmailView({
  email,
  onResend,
  onDone,
  onReload,
}: {
  email: string;
  onResend: () => Promise<void>;
  onDone: () => void;
  onReload: () => Promise<void>;
}) {
  const [resending, setResending] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [msg, setMsg]             = useState<string | null>(null);

  const handleResend = async () => {
    setResending(true);
    await onResend();
    setMsg("Email sent! Check your inbox.");
    setResending(false);
  };

  const handleDone = async () => {
    setReloading(true);
    await onReload();
    setReloading(false);
    onDone();
  };

  return (
    <View style={{ alignItems: "center", paddingVertical: 8 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "#FEF9C3", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Text style={{ fontSize: 30 }}>📬</Text>
      </View>
      <Text style={styles.cardTitle}>Verify your email</Text>
      <Text style={[styles.cardSub, { textAlign: "center", marginBottom: 20 }]}>
        We sent a verification link to{"\n"}
        <Text style={{ color: BLUE, fontFamily: "Inter_700Bold" }}>{email}</Text>
        {"\n\n"}Click the link in your email, then tap the button below.
      </Text>
      {msg && (
        <View style={{ backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#86EFAC", borderRadius: 10, padding: 10, marginBottom: 14, width: "100%" }}>
          <Text style={{ color: "#16A34A", fontSize: 12.5, textAlign: "center" }}>{msg}</Text>
        </View>
      )}
      <Pressable
        onPress={handleDone}
        disabled={reloading}
        style={({ pressed }) => ({ opacity: pressed || reloading ? 0.85 : 1, width: "100%", marginBottom: 12 })}
      >
        <LinearGradient colors={[BLUE, BLUE_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
          {reloading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Icon name="check" size={17} color="#fff" />
              <Text style={styles.primaryBtnText}>I've verified — Continue</Text>
            </>
          )}
        </LinearGradient>
      </Pressable>
      <Pressable onPress={handleResend} disabled={resending} style={styles.ghostBtn}>
        <Text style={styles.ghostBtnText}>{resending ? "Sending…" : "Resend verification email"}</Text>
      </Pressable>
    </View>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, signUp, resetPassword, resendVerification, reloadUser, user } = useAuth();

  const [mode,    setMode]    = useState<Mode>("signin");
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [pass2,   setPass2]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPass,  setShowPass]  = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusPass,  setFocusPass]  = useState(false);
  const [focusPass2, setFocusPass2] = useState(false);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardSlide   = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(cardSlide,   { toValue: 0, duration: 400, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
    ]).start();
  }, [cardOpacity, cardSlide]);

  const animateMode = (next: Mode) => {
    Animated.timing(cardOpacity, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => {
      setMode(next);
      setError(null);
      setSuccess(null);
      Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const handleSkip = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const handleSignIn = useCallback(async () => {
    const e = email.trim().toLowerCase();
    const p = pass;
    if (!e || !p) { setError("Please enter your email and password."); return; }
    setError(null);
    setLoading(true);
    const result = await signIn(e, p);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    animateMode("success");
  }, [email, pass, signIn]);

  const handleSignUp = useCallback(async () => {
    const e = email.trim().toLowerCase();
    const p = pass;
    if (!e) { setError("Please enter your email address."); return; }
    if (p.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (p !== pass2) { setError("Passwords do not match."); return; }
    setError(null);
    setLoading(true);
    const result = await signUp(e, p);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    animateMode("verify");
  }, [email, pass, pass2, signUp]);

  const handleForgot = useCallback(async () => {
    const e = email.trim().toLowerCase();
    if (!e.includes("@")) { setError("Enter a valid email address."); return; }
    setError(null);
    setLoading(true);
    const result = await resetPassword(e);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setSuccess("Password reset email sent! Check your inbox.");
  }, [email, resetPassword]);

  const isVerified = !!(user && !user.isAnonymous && user.emailVerified);

  return (
    <LinearGradient
      colors={["#1E3A8A", "#1D4ED8", "#2563EB"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <View style={deco.circle1} />
      <View style={deco.circle2} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.skipRow}>
            <Pressable onPress={handleSkip} hitSlop={12} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>

          <View style={styles.heroSection}>
            <View style={styles.logoWrap}>
              <Text style={{ fontSize: 32 }}>🛡️</Text>
            </View>
            <Text style={styles.heroTitle}>Save Your Data</Text>
            <Text style={styles.heroSub}>
              Link an email so your contacts{"\n"}and settings stay safe across devices.
            </Text>
          </View>

          {mode !== "verify" && mode !== "success" && (
            <View style={styles.tabRow}>
              {(["signin", "signup"] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => { setError(null); setSuccess(null); setMode(m); }}
                  style={[styles.tab, mode === m && styles.tabActive]}
                >
                  <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                    {m === "signin" ? "Sign In" : "Create Account"}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Animated.View
            style={[styles.card, { opacity: cardOpacity, transform: [{ translateY: cardSlide }] }]}
          >
            {mode === "success" && (
              <SuccessView email={email.trim().toLowerCase()} onDone={handleSkip} />
            )}

            {mode === "verify" && (
              <VerifyEmailView
                email={email.trim().toLowerCase()}
                onResend={async () => { await resendVerification(); }}
                onDone={() => {
                  if (isVerified) animateMode("success");
                  else handleSkip();
                }}
                onReload={reloadUser}
              />
            )}

            {(mode === "signin" || mode === "signup" || mode === "forgot") && (
              <>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconWrap, { backgroundColor: BLUE_SOFT }]}>
                    <Icon name={mode === "forgot" ? "lock" : "send"} size={20} color={BLUE} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
                    </Text>
                    <Text style={styles.cardSub}>
                      {mode === "signin" ? "Sign in to sync your safety data." : mode === "signup" ? "Set up a password to protect your account." : "Enter your email to receive a reset link."}
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Email address</Text>
                <View style={[styles.inputWrap, focusEmail && styles.inputWrapFocused]}>
                  <View style={styles.inputIcon}>
                    <Icon name="send" size={15} color={focusEmail ? BLUE : "#9CA3AF"} />
                  </View>
                  <TextInput
                    value={email}
                    onChangeText={(v) => { setEmail(v); setError(null); }}
                    onFocus={() => setFocusEmail(true)}
                    onBlur={() => setFocusEmail(false)}
                    placeholder="you@example.com"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.fieldInput}
                    returnKeyType={mode === "forgot" ? "done" : "next"}
                    onSubmitEditing={mode === "forgot" ? handleForgot : undefined}
                  />
                  {email.includes("@") && email.includes(".") && (
                    <View style={{ paddingRight: 12 }}>
                      <Icon name="check" size={14} color={SUCCESS} />
                    </View>
                  )}
                </View>

                {mode !== "forgot" && (
                  <>
                    <Text style={styles.fieldLabel}>Password</Text>
                    <View style={[styles.inputWrap, focusPass && styles.inputWrapFocused]}>
                      <View style={styles.inputIcon}>
                        <Icon name="lock" size={15} color={focusPass ? BLUE : "#9CA3AF"} />
                      </View>
                      <TextInput
                        value={pass}
                        onChangeText={(v) => { setPass(v); setError(null); }}
                        onFocus={() => setFocusPass(true)}
                        onBlur={() => setFocusPass(false)}
                        placeholder="6+ characters"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={!showPass}
                        style={styles.fieldInput}
                        returnKeyType={mode === "signin" ? "done" : "next"}
                        onSubmitEditing={mode === "signin" ? handleSignIn : undefined}
                      />
                      <Pressable onPress={() => setShowPass((p) => !p)} style={{ paddingRight: 12 }}>
                        <Icon name={showPass ? "wifiOff" : "wifi"} size={16} color="#9CA3AF" />
                      </Pressable>
                    </View>
                  </>
                )}

                {mode === "signup" && (
                  <>
                    <Text style={styles.fieldLabel}>Confirm Password</Text>
                    <View style={[styles.inputWrap, focusPass2 && styles.inputWrapFocused]}>
                      <View style={styles.inputIcon}>
                        <Icon name="lock" size={15} color={focusPass2 ? BLUE : "#9CA3AF"} />
                      </View>
                      <TextInput
                        value={pass2}
                        onChangeText={(v) => { setPass2(v); setError(null); }}
                        onFocus={() => setFocusPass2(true)}
                        onBlur={() => setFocusPass2(false)}
                        placeholder="Re-enter password"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={!showPass2}
                        style={styles.fieldInput}
                        returnKeyType="done"
                        onSubmitEditing={handleSignUp}
                      />
                      <Pressable onPress={() => setShowPass2((p) => !p)} style={{ paddingRight: 12 }}>
                        <Icon name={showPass2 ? "wifiOff" : "wifi"} size={16} color="#9CA3AF" />
                      </Pressable>
                    </View>
                  </>
                )}

                {error && (
                  <View style={styles.errorRow}>
                    <Icon name="info" size={13} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {success && (
                  <View style={styles.successRow}>
                    <Icon name="check" size={13} color="#16A34A" />
                    <Text style={styles.successText}>{success}</Text>
                  </View>
                )}

                <Pressable
                  onPress={mode === "signin" ? handleSignIn : mode === "signup" ? handleSignUp : handleForgot}
                  disabled={loading}
                  style={({ pressed }) => ({ opacity: pressed || loading ? 0.85 : 1 })}
                >
                  <LinearGradient colors={[BLUE, BLUE_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : (
                        <>
                          <Icon name="shield" size={17} color="#fff" />
                          <Text style={styles.primaryBtnText}>
                            {mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
                          </Text>
                        </>
                      )}
                  </LinearGradient>
                </Pressable>

                {mode === "signin" && (
                  <Pressable onPress={() => animateMode("forgot")} style={styles.ghostBtn}>
                    <Text style={styles.ghostBtnText}>Forgot password?</Text>
                  </Pressable>
                )}
                {mode === "forgot" && (
                  <Pressable onPress={() => animateMode("signin")} style={styles.ghostBtn}>
                    <Text style={styles.ghostBtnText}>Back to sign in</Text>
                  </Pressable>
                )}
                {mode !== "forgot" && (
                  <Pressable onPress={handleSkip} style={[styles.ghostBtn, { marginTop: 4 }]}>
                    <Text style={[styles.ghostBtnText, { fontSize: 12.5 }]}>Maybe later — continue without saving</Text>
                  </Pressable>
                )}

                <View style={styles.trustCard}>
                  <Text style={{ fontSize: 18 }}>🛡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trustTitle}>Your privacy comes first</Text>
                    <Text style={styles.trustSub}>Your data is encrypted and never shared without your permission.</Text>
                  </View>
                </View>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const deco = StyleSheet.create({
  circle1: { position: "absolute", width: 320, height: 320, borderRadius: 160, backgroundColor: "rgba(255,255,255,0.05)", top: -80, right: -80 },
  circle2: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.04)", bottom: 120, left: -60 },
});

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },

  skipRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
  skipBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)" },
  skipText: { fontSize: 13.5, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.9)" },

  heroSection: { alignItems: "center", paddingVertical: 24 },
  logoWrap: { width: 72, height: 72, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  heroTitle: { color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 8, textAlign: "center" },
  heroSub:   { color: "rgba(255,255,255,0.78)", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },

  tabRow: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14, padding: 4, marginBottom: 12, gap: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 11 },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontSize: 13.5, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.8)" },
  tabTextActive: { color: BLUE },

  card: { backgroundColor: "#fff", borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 10 },

  cardHeader:   { flexDirection: "row", gap: 14, alignItems: "flex-start", marginBottom: 18 },
  cardIconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitle:    { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 3 },
  cardSub:      { fontSize: 13, color: "#6B7280", lineHeight: 19 },

  fieldLabel:       { fontSize: 11.5, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrap:        { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 14, backgroundColor: "#F9FAFB", marginBottom: 14, overflow: "hidden" },
  inputWrapFocused: { borderColor: BLUE, backgroundColor: BLUE_SOFT },
  inputIcon:        { width: 42, alignItems: "center", justifyContent: "center", alignSelf: "stretch", borderRightWidth: 1, borderRightColor: "#E5E7EB" },
  fieldInput:       { flex: 1, paddingHorizontal: 12, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular", color: "#111827" },

  errorRow:   { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 10, padding: 10, marginBottom: 12 },
  errorText:  { color: "#EF4444", fontSize: 12.5, fontFamily: "Inter_500Medium", flex: 1 },
  successRow: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#86EFAC", borderRadius: 10, padding: 10, marginBottom: 12 },
  successText:{ color: "#16A34A", fontSize: 12.5, fontFamily: "Inter_500Medium", flex: 1 },

  primaryBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 20, paddingVertical: 15, marginBottom: 12, shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  primaryBtnText: { color: "#fff", fontSize: 15.5, fontFamily: "Inter_700Bold" },
  ghostBtn:       { alignItems: "center", paddingVertical: 8 },
  ghostBtnText:   { fontSize: 13.5, color: "#6B7280", fontFamily: "Inter_500Medium" },
  trustCard:      { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 14, padding: 12, marginTop: 14 },
  trustTitle:     { fontSize: 12.5, fontFamily: "Inter_700Bold", color: "#374151", marginBottom: 2 },
  trustSub:       { fontSize: 11.5, color: "#6B7280", lineHeight: 16 },
});
