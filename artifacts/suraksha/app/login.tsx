import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

import { FontAwesome } from "@expo/vector-icons";

import { Icon } from "@/shared/components/Icon";
import { useTheme } from "@/shared/theme/ThemeContext";
import { withAlpha } from "@/shared/theme/colors";
import { useLoginScreen } from "@/features/authentication/hooks/useLoginScreen";

function SocialDivider({ color }: { color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 16, gap: 10 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color, fontFamily: "Inter_500Medium", letterSpacing: 0.6 }}>OR CONTINUE WITH</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: color }} />
    </View>
  );
}

function SocialButton({
  label,
  faIcon,
  iconColor,
  onPress,
  loading,
  bg,
  textColor,
  borderColor,
}: {
  label: string;
  faIcon: React.ComponentProps<typeof FontAwesome>["name"];
  iconColor: string;
  onPress: () => void;
  loading: boolean;
  bg: string;
  textColor: string;
  borderColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        backgroundColor: bg,
        borderWidth: 1.5,
        borderColor,
        borderRadius: 14,
        paddingVertical: 13,
        marginBottom: 10,
        opacity: pressed || loading ? 0.8 : 1,
      })}
    >
      {loading
        ? <ActivityIndicator size="small" color={textColor} />
        : (
          <>
            <FontAwesome name={faIcon} size={19} color={iconColor} />
            <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: textColor }}>{label}</Text>
          </>
        )}
    </Pressable>
  );
}

function SuccessView({ email, onDone }: { email: string; onDone: () => void }) {
  const { c } = useTheme();
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
        <LinearGradient colors={[c.success, c.successDark]} style={[suc.icon, { shadowColor: c.success }]}>
          <Text style={{ fontSize: 34 }}>🛡️</Text>
        </LinearGradient>
      </Animated.View>
      <Text style={[suc.title, { color: c.text }]}>Account Saved!</Text>
      <Text style={[suc.sub, { color: c.textMuted }]}>
        Your safety data is backed up to{"\n"}
        <Text style={[suc.sub, { color: c.primary, fontFamily: "Inter_700Bold" }]}>{email}</Text>
        {"\n\n"}Sign in from any device using this email.
      </Text>
      <Pressable onPress={onDone} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
        <LinearGradient colors={[c.success, c.successDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[suc.btn, { shadowColor: c.success }]}>
          <Icon name="check" size={18} color={c.onColor} />
          <Text style={[suc.btnText, { color: c.onColor }]}>Done</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const suc = StyleSheet.create({
  icon:    { width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  title:   { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 10, textAlign: "center" },
  sub:     { fontSize: 13.5, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  btn:     { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 20, paddingVertical: 15, paddingHorizontal: 36, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  btnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
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
  const { c } = useTheme();
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
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: withAlpha(c.warning, 0.18), alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Text style={{ fontSize: 30 }}>📬</Text>
      </View>
      <Text style={[styles.cardTitle, { color: c.text }]}>Verify your email</Text>
      <Text style={[styles.cardSub, { color: c.textMuted, textAlign: "center", marginBottom: 20 }]}>
        We sent a verification link to{"\n"}
        <Text style={{ color: c.primary, fontFamily: "Inter_700Bold" }}>{email}</Text>
        {"\n\n"}Click the link in your email, then tap the button below.
      </Text>
      {msg && (
        <View style={{ backgroundColor: withAlpha(c.success, 0.12), borderWidth: 1, borderColor: withAlpha(c.success, 0.35), borderRadius: 10, padding: 10, marginBottom: 14, width: "100%" }}>
          <Text style={{ color: c.successDark, fontSize: 12.5, textAlign: "center" }}>{msg}</Text>
        </View>
      )}
      <Pressable
        onPress={handleDone}
        disabled={reloading}
        style={({ pressed }) => ({ opacity: pressed || reloading ? 0.85 : 1, width: "100%", marginBottom: 12 })}
      >
        <LinearGradient colors={[c.primary, c.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.primaryBtn, { shadowColor: c.primary }]}>
          {reloading ? <ActivityIndicator color={c.onColor} /> : (
            <>
              <Icon name="check" size={17} color={c.onColor} />
              <Text style={[styles.primaryBtnText, { color: c.onColor }]}>I've verified — Continue</Text>
            </>
          )}
        </LinearGradient>
      </Pressable>
      <Pressable onPress={handleResend} disabled={resending} style={styles.ghostBtn}>
        <Text style={[styles.ghostBtnText, { color: c.textMuted }]}>{resending ? "Sending…" : "Resend verification email"}</Text>
      </Pressable>
    </View>
  );
}

function OtpRequestView({
  email,
  setEmail,
  onSend,
  sending,
  error,
  onBack,
}: {
  email: string;
  setEmail: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  error: string | null;
  onBack: () => void;
}) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: withAlpha(c.primary, 0.1) }]}>
          <Icon name="send" size={20} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Sign in with a code</Text>
          <Text style={[styles.cardSub, { color: c.textMuted }]}>We'll email you a 6-digit code — no password needed.</Text>
        </View>
      </View>

      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Email address</Text>
      <View style={[styles.inputWrap, { borderColor: c.border, backgroundColor: c.inputBg }, focused && { borderColor: c.primary, backgroundColor: withAlpha(c.primary, 0.06) }]}>
        <View style={[styles.inputIcon, { borderRightColor: c.border }]}>
          <Icon name="send" size={15} color={focused ? c.primary : c.textFaint} />
        </View>
        <TextInput
          value={email}
          onChangeText={setEmail}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="you@example.com"
          placeholderTextColor={c.textFaint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.fieldInput, { color: c.text }]}
          returnKeyType="done"
          onSubmitEditing={onSend}
        />
      </View>

      {error && (
        <View style={[styles.errorRow, { backgroundColor: withAlpha(c.danger, 0.1), borderColor: withAlpha(c.danger, 0.3) }]}>
          <Icon name="info" size={13} color={c.danger} />
          <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
        </View>
      )}

      <Pressable onPress={onSend} disabled={sending} style={({ pressed }) => ({ opacity: pressed || sending ? 0.85 : 1 })}>
        <LinearGradient colors={[c.primary, c.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.primaryBtn, { shadowColor: c.primary }]}>
          {sending ? <ActivityIndicator color={c.onColor} /> : (
            <>
              <Icon name="send" size={17} color={c.onColor} />
              <Text style={[styles.primaryBtnText, { color: c.onColor }]}>Send code</Text>
            </>
          )}
        </LinearGradient>
      </Pressable>

      <Pressable onPress={onBack} style={styles.ghostBtn}>
        <Text style={[styles.ghostBtnText, { color: c.textMuted }]}>Back to sign in</Text>
      </Pressable>
    </View>
  );
}

function OtpVerifyView({
  email,
  code,
  setCode,
  onVerify,
  verifying,
  onResend,
  resending,
  onBack,
  error,
  msg,
}: {
  email: string;
  code: string;
  setCode: (v: string) => void;
  onVerify: () => void;
  verifying: boolean;
  onResend: () => void;
  resending: boolean;
  onBack: () => void;
  error: string | null;
  msg: string | null;
}) {
  const { c } = useTheme();
  return (
    <View>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: withAlpha(c.primary, 0.1) }]}>
          <Icon name="lock" size={20} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Enter your code</Text>
          <Text style={[styles.cardSub, { color: c.textMuted }]}>
            We sent a 6-digit code to{"\n"}
            <Text style={{ color: c.primary, fontFamily: "Inter_700Bold" }}>{email}</Text>
          </Text>
        </View>
      </View>

      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>6-digit code</Text>
      <View style={[styles.inputWrap, { borderColor: c.border, backgroundColor: c.inputBg }]}>
        <View style={[styles.inputIcon, { borderRightColor: c.border }]}>
          <Icon name="lock" size={15} color={c.textFaint} />
        </View>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          placeholderTextColor={c.textFaint}
          keyboardType="number-pad"
          style={[styles.fieldInput, { color: c.text, letterSpacing: 4 }]}
          returnKeyType="done"
          onSubmitEditing={onVerify}
          maxLength={6}
        />
      </View>

      {error && (
        <View style={[styles.errorRow, { backgroundColor: withAlpha(c.danger, 0.1), borderColor: withAlpha(c.danger, 0.3) }]}>
          <Icon name="info" size={13} color={c.danger} />
          <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
        </View>
      )}
      {msg && (
        <View style={[styles.successRow, { backgroundColor: withAlpha(c.success, 0.12), borderColor: withAlpha(c.success, 0.35) }]}>
          <Icon name="check" size={13} color={c.successDark} />
          <Text style={[styles.successText, { color: c.successDark }]}>{msg}</Text>
        </View>
      )}

      <Pressable
        onPress={onVerify}
        disabled={verifying || code.length !== 6}
        style={({ pressed }) => ({ opacity: pressed || verifying || code.length !== 6 ? 0.85 : 1 })}
      >
        <LinearGradient colors={[c.primary, c.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.primaryBtn, { shadowColor: c.primary }]}>
          {verifying ? <ActivityIndicator color={c.onColor} /> : (
            <>
              <Icon name="shield" size={17} color={c.onColor} />
              <Text style={[styles.primaryBtnText, { color: c.onColor }]}>Verify & Sign In</Text>
            </>
          )}
        </LinearGradient>
      </Pressable>

      <Pressable onPress={onResend} disabled={resending} style={styles.ghostBtn}>
        <Text style={[styles.ghostBtnText, { color: c.textMuted }]}>{resending ? "Sending…" : "Resend code"}</Text>
      </Pressable>
      <Pressable onPress={onBack} style={styles.ghostBtn}>
        <Text style={[styles.ghostBtnText, { color: c.textMuted, fontSize: 12.5 }]}>Use a different email</Text>
      </Pressable>
    </View>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const {
    mode, setMode, animateMode,
    email, setEmail, pass, setPass, pass2, setPass2,
    loading, googleLoading, appleLoading, linkLoading,
    linkEmail, linkPass, setLinkPass, linkProvider, linkCredential,
    error, setError, success, setSuccess,
    showPass, setShowPass, showPass2, setShowPass2,
    focusEmail, setFocusEmail, focusPass, setFocusPass, focusPass2, setFocusPass2,
    otpEmail, setOtpEmail, otpCode, setOtpCode,
    otpSending, otpVerifying, otpResending, otpError, setOtpError, otpMsg, setOtpMsg,
    cardOpacity, cardSlide,
    handleSkip, handleSignIn, handleSignUp, handleForgot,
    handleRequestOtp, handleResendOtp, handleGoogleSignIn, handleAppleSignIn,
    handleLinkAccounts, handleVerifyOtp, goPostLogin,
    isVerified, appleAvailable, resendVerification, reloadUser,
  } = useLoginScreen();

  return (
    <LinearGradient
      colors={[c.primaryDark, c.primaryDark, c.primary]}
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
                  style={[styles.tab, mode === m && { backgroundColor: c.card }]}
                >
                  <Text style={[styles.tabText, mode === m && { color: c.primary }]}>
                    {m === "signin" ? "Sign In" : "Create Account"}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Animated.View
            style={[styles.card, { backgroundColor: c.card, opacity: cardOpacity, transform: [{ translateY: cardSlide }] }]}
          >
            {mode === "success" && (
              <SuccessView email={email.trim().toLowerCase()} onDone={goPostLogin} />
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

            {mode === "otp-request" && (
              <OtpRequestView
                email={otpEmail}
                setEmail={(v) => { setOtpEmail(v); setOtpError(null); }}
                onSend={handleRequestOtp}
                sending={otpSending}
                error={otpError}
                onBack={() => { setOtpError(null); animateMode("signin"); }}
              />
            )}

            {mode === "link-accounts" && (
              <View>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconWrap, { backgroundColor: withAlpha(c.warning, 0.15) }]}>
                    <Icon name="lock" size={20} color={c.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: c.text }]}>Link your accounts</Text>
                    <Text style={[styles.cardSub, { color: c.textMuted }]}>
                      An account already exists for{"\n"}
                      <Text style={{ color: c.primary, fontFamily: "Inter_700Bold" }}>{linkEmail}</Text>
                      {"\n\n"}Enter your password to connect your{" "}
                      {linkProvider === "google" ? "Google" : "Apple"} account and sign in.
                    </Text>
                  </View>
                </View>

                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Password</Text>
                <View style={[styles.inputWrap, { borderColor: c.border, backgroundColor: c.inputBg }]}>
                  <View style={[styles.inputIcon, { borderRightColor: c.border }]}>
                    <Icon name="lock" size={15} color={c.textFaint} />
                  </View>
                  <TextInput
                    value={linkPass}
                    onChangeText={(v) => { setLinkPass(v); setError(null); }}
                    placeholder="Your existing password"
                    placeholderTextColor={c.textFaint}
                    secureTextEntry
                    style={[styles.fieldInput, { color: c.text }]}
                    returnKeyType="done"
                    onSubmitEditing={handleLinkAccounts}
                    autoFocus
                  />
                </View>

                {error && (
                  <View style={[styles.errorRow, { backgroundColor: withAlpha(c.danger, 0.1), borderColor: withAlpha(c.danger, 0.3) }]}>
                    <Icon name="info" size={13} color={c.danger} />
                    <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
                  </View>
                )}

                <Pressable
                  onPress={handleLinkAccounts}
                  disabled={linkLoading || linkPass.length < 6}
                  style={({ pressed }) => ({ opacity: pressed || linkLoading || linkPass.length < 6 ? 0.85 : 1 })}
                >
                  <LinearGradient colors={[c.primary, c.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.primaryBtn, { shadowColor: c.primary }]}>
                    {linkLoading ? <ActivityIndicator color={c.onColor} /> : (
                      <>
                        <FontAwesome name={linkProvider === "google" ? "google" : "apple"} size={16} color={c.onColor} />
                        <Text style={[styles.primaryBtnText, { color: c.onColor }]}>
                          Link {linkProvider === "google" ? "Google" : "Apple"} & Sign In
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                <Pressable onPress={() => { setError(null); animateMode("signin"); }} style={styles.ghostBtn}>
                  <Text style={[styles.ghostBtnText, { color: c.textMuted }]}>Use a different sign-in method</Text>
                </Pressable>
              </View>
            )}

            {mode === "otp-verify" && (
              <OtpVerifyView
                email={otpEmail.trim().toLowerCase()}
                code={otpCode}
                setCode={(v) => { setOtpCode(v); setOtpError(null); }}
                onVerify={handleVerifyOtp}
                verifying={otpVerifying}
                onResend={handleResendOtp}
                resending={otpResending}
                onBack={() => { setOtpError(null); setOtpMsg(null); animateMode("otp-request"); }}
                error={otpError}
                msg={otpMsg}
              />
            )}

            {(mode === "signin" || mode === "signup" || mode === "forgot") && (
              <>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconWrap, { backgroundColor: withAlpha(c.primary, 0.1) }]}>
                    <Icon name={mode === "forgot" ? "lock" : "send"} size={20} color={c.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: c.text }]}>
                      {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
                    </Text>
                    <Text style={[styles.cardSub, { color: c.textMuted }]}>
                      {mode === "signin" ? "Sign in to sync your safety data." : mode === "signup" ? "Set up a password to protect your account." : "Enter your email to receive a reset link."}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Email address</Text>
                <View style={[styles.inputWrap, { borderColor: c.border, backgroundColor: c.inputBg }, focusEmail && { borderColor: c.primary, backgroundColor: withAlpha(c.primary, 0.06) }]}>
                  <View style={[styles.inputIcon, { borderRightColor: c.border }]}>
                    <Icon name="send" size={15} color={focusEmail ? c.primary : c.textFaint} />
                  </View>
                  <TextInput
                    value={email}
                    onChangeText={(v) => { setEmail(v); setError(null); }}
                    onFocus={() => setFocusEmail(true)}
                    onBlur={() => setFocusEmail(false)}
                    placeholder="you@example.com"
                    placeholderTextColor={c.textFaint}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.fieldInput, { color: c.text }]}
                    returnKeyType={mode === "forgot" ? "done" : "next"}
                    onSubmitEditing={mode === "forgot" ? handleForgot : undefined}
                  />
                  {email.includes("@") && email.includes(".") && (
                    <View style={{ paddingRight: 12 }}>
                      <Icon name="check" size={14} color={c.success} />
                    </View>
                  )}
                </View>

                {mode !== "forgot" && (
                  <>
                    <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Password</Text>
                    <View style={[styles.inputWrap, { borderColor: c.border, backgroundColor: c.inputBg }, focusPass && { borderColor: c.primary, backgroundColor: withAlpha(c.primary, 0.06) }]}>
                      <View style={[styles.inputIcon, { borderRightColor: c.border }]}>
                        <Icon name="lock" size={15} color={focusPass ? c.primary : c.textFaint} />
                      </View>
                      <TextInput
                        value={pass}
                        onChangeText={(v) => { setPass(v); setError(null); }}
                        onFocus={() => setFocusPass(true)}
                        onBlur={() => setFocusPass(false)}
                        placeholder="6+ characters"
                        placeholderTextColor={c.textFaint}
                        secureTextEntry={!showPass}
                        style={[styles.fieldInput, { color: c.text }]}
                        returnKeyType={mode === "signin" ? "done" : "next"}
                        onSubmitEditing={mode === "signin" ? handleSignIn : undefined}
                      />
                      <Pressable onPress={() => setShowPass((p) => !p)} style={{ paddingRight: 12 }}>
                        <Icon name={showPass ? "eyeOff" : "eye"} size={16} color={c.textFaint} />
                      </Pressable>
                    </View>
                  </>
                )}

                {mode === "signup" && (
                  <>
                    <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Confirm Password</Text>
                    <View style={[styles.inputWrap, { borderColor: c.border, backgroundColor: c.inputBg }, focusPass2 && { borderColor: c.primary, backgroundColor: withAlpha(c.primary, 0.06) }]}>
                      <View style={[styles.inputIcon, { borderRightColor: c.border }]}>
                        <Icon name="lock" size={15} color={focusPass2 ? c.primary : c.textFaint} />
                      </View>
                      <TextInput
                        value={pass2}
                        onChangeText={(v) => { setPass2(v); setError(null); }}
                        onFocus={() => setFocusPass2(true)}
                        onBlur={() => setFocusPass2(false)}
                        placeholder="Re-enter password"
                        placeholderTextColor={c.textFaint}
                        secureTextEntry={!showPass2}
                        style={[styles.fieldInput, { color: c.text }]}
                        returnKeyType="done"
                        onSubmitEditing={handleSignUp}
                      />
                      <Pressable onPress={() => setShowPass2((p) => !p)} style={{ paddingRight: 12 }}>
                        <Icon name={showPass2 ? "eyeOff" : "eye"} size={16} color={c.textFaint} />
                      </Pressable>
                    </View>
                  </>
                )}

                {error && (
                  <View style={[styles.errorRow, { backgroundColor: withAlpha(c.danger, 0.1), borderColor: withAlpha(c.danger, 0.3) }]}>
                    <Icon name="info" size={13} color={c.danger} />
                    <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
                  </View>
                )}

                {success && (
                  <View style={[styles.successRow, { backgroundColor: withAlpha(c.success, 0.12), borderColor: withAlpha(c.success, 0.35) }]}>
                    <Icon name="check" size={13} color={c.successDark} />
                    <Text style={[styles.successText, { color: c.successDark }]}>{success}</Text>
                  </View>
                )}

                <Pressable
                  onPress={mode === "signin" ? handleSignIn : mode === "signup" ? handleSignUp : handleForgot}
                  disabled={loading}
                  style={({ pressed }) => ({ opacity: pressed || loading ? 0.85 : 1 })}
                >
                  <LinearGradient colors={[c.primary, c.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.primaryBtn, { shadowColor: c.primary }]}>
                    {loading
                      ? <ActivityIndicator color={c.onColor} />
                      : (
                        <>
                          <Icon name="shield" size={17} color={c.onColor} />
                          <Text style={[styles.primaryBtnText, { color: c.onColor }]}>
                            {mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
                          </Text>
                        </>
                      )}
                  </LinearGradient>
                </Pressable>

                {mode === "signin" && (
                  <Pressable onPress={() => animateMode("forgot")} style={styles.ghostBtn}>
                    <Text style={[styles.ghostBtnText, { color: c.textMuted }]}>Forgot password?</Text>
                  </Pressable>
                )}
                {(mode === "signin" || mode === "signup") && (
                  <Pressable
                    onPress={() => { setOtpEmail(email); setOtpError(null); animateMode("otp-request"); }}
                    style={styles.ghostBtn}
                  >
                    <Text style={[styles.ghostBtnText, { color: c.primary }]}>Sign in with a one-time code instead</Text>
                  </Pressable>
                )}
                {mode === "forgot" && (
                  <Pressable onPress={() => animateMode("signin")} style={styles.ghostBtn}>
                    <Text style={[styles.ghostBtnText, { color: c.textMuted }]}>Back to sign in</Text>
                  </Pressable>
                )}

                {(mode === "signin" || mode === "signup") && (
                  <>
                    <SocialDivider color={c.border} />
                    <SocialButton
                      label="Continue with Google"
                      faIcon="google"
                      iconColor="#4285F4"
                      onPress={handleGoogleSignIn}
                      loading={googleLoading}
                      bg={c.card}
                      textColor={c.text}
                      borderColor={c.border}
                    />
                    {appleAvailable && (
                      <SocialButton
                        label="Continue with Apple"
                        faIcon="apple"
                        iconColor="#fff"
                        onPress={handleAppleSignIn}
                        loading={appleLoading}
                        bg="#000"
                        textColor="#fff"
                        borderColor="#000"
                      />
                    )}
                  </>
                )}

                {mode !== "forgot" && (
                  <Pressable onPress={handleSkip} style={[styles.ghostBtn, { marginTop: 4 }]}>
                    <Text style={[styles.ghostBtnText, { color: c.textMuted, fontSize: 12.5 }]}>Maybe later — continue without saving</Text>
                  </Pressable>
                )}

                <View style={[styles.trustCard, { backgroundColor: c.cardAlt, borderColor: c.border }]}>
                  <Text style={{ fontSize: 18 }}>🛡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trustTitle, { color: c.text }]}>Your privacy comes first</Text>
                    <Text style={[styles.trustSub, { color: c.textMuted }]}>Your data is encrypted and never shared without your permission.</Text>
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
  tabText: { fontSize: 13.5, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.8)" },

  card: { borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 10 },

  cardHeader:   { flexDirection: "row", gap: 14, alignItems: "flex-start", marginBottom: 18 },
  cardIconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitle:    { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 3 },
  cardSub:      { fontSize: 13, lineHeight: 19 },

  fieldLabel:       { fontSize: 11.5, fontFamily: "Inter_600SemiBold", marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrap:        { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 14, marginBottom: 14, overflow: "hidden" },
  inputIcon:        { width: 42, alignItems: "center", justifyContent: "center", alignSelf: "stretch", borderRightWidth: 1 },
  fieldInput:       { flex: 1, paddingHorizontal: 12, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular" },

  errorRow:   { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 },
  errorText:  { fontSize: 12.5, fontFamily: "Inter_500Medium", flex: 1 },
  successRow: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 },
  successText:{ fontSize: 12.5, fontFamily: "Inter_500Medium", flex: 1 },

  primaryBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 20, paddingVertical: 15, marginBottom: 12, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  primaryBtnText: { fontSize: 15.5, fontFamily: "Inter_700Bold" },
  ghostBtn:       { alignItems: "center", paddingVertical: 8 },
  ghostBtnText:   { fontSize: 13.5, fontFamily: "Inter_500Medium" },
  trustCard:      { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 14 },
  trustTitle:     { fontSize: 12.5, fontFamily: "Inter_700Bold", marginBottom: 2 },
  trustSub:       { fontSize: 11.5, lineHeight: 16 },
});
