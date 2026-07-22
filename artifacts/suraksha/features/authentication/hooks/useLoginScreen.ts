import { useRouter } from "expo-router";
import { Animated, Easing } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/features/authentication/context/AuthContext";
import { requestEmailOtp, verifyEmailOtp } from "@/repositories/api/emailOtpRepository";
import { db } from "@/repositories/supabase/supabaseClient";
import type { OAuthCredential } from "@/repositories/firebase/firebaseAuth";

export type LoginMode =
  | "signin"
  | "signup"
  | "forgot"
  | "verify"
  | "success"
  | "otp-request"
  | "otp-verify"
  | "link-accounts";

/**
 * All state, side effects, and the mode-transition animation for the login
 * screen. Kept as one hook (rather than split per auth method) because every
 * handler here shares the same `mode`/`error`/`success` state machine and the
 * same card enter/exit animation on transition.
 */
export function useLoginScreen() {
  const router = useRouter();
  const {
    signIn,
    signUp,
    resetPassword,
    resendVerification,
    reloadUser,
    user,
    signInWithCustomToken,
    signInWithGoogle,
    signInWithApple,
    linkPendingCredential,
    appleAvailable,
  } = useAuth();

  const [mode, setMode] = useState<LoginMode>("signin");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkPass, setLinkPass] = useState("");
  const [linkProvider, setLinkProvider] = useState<"google" | "apple">("google");
  const [linkCredential, setLinkCredential] = useState<OAuthCredential | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusPass, setFocusPass] = useState(false);
  const [focusPass2, setFocusPass2] = useState(false);

  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpResending, setOtpResending] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpMsg, setOtpMsg] = useState<string | null>(null);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(cardSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
    ]).start();
  }, [cardOpacity, cardSlide]);

  const animateMode = useCallback((next: LoginMode) => {
    Animated.timing(cardOpacity, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => {
      setMode(next);
      setError(null);
      setSuccess(null);
      Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }, [cardOpacity]);

  const handleSkip = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, [router]);

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
  }, [email, pass, signIn, animateMode]);

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
  }, [email, pass, pass2, signUp, animateMode]);

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

  const handleRequestOtp = useCallback(async () => {
    const e = otpEmail.trim().toLowerCase();
    if (!e.includes("@") || !e.includes(".")) { setOtpError("Enter a valid email address."); return; }
    setOtpError(null);
    setOtpMsg(null);
    setOtpSending(true);
    const result = await requestEmailOtp(e);
    setOtpSending(false);
    if (!result.ok) { setOtpError(result.error); return; }
    setOtpCode("");
    animateMode("otp-verify");
  }, [otpEmail, animateMode]);

  const handleResendOtp = useCallback(async () => {
    const e = otpEmail.trim().toLowerCase();
    setOtpResending(true);
    const result = await requestEmailOtp(e);
    setOtpResending(false);
    setOtpMsg(result.ok ? "Code sent! Check your inbox." : null);
    if (!result.ok) setOtpError(result.error);
  }, [otpEmail]);

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleLoading(true);
    setError(null);
    const result = await signInWithGoogle();
    setGoogleLoading(false);
    if (result.cancelled) return;
    if (result.needsLink) {
      setLinkEmail(result.needsLink.email);
      setLinkCredential(result.needsLink.pendingCredential);
      setLinkProvider("google");
      setLinkPass("");
      animateMode("link-accounts");
      return;
    }
    if (result.error) { setError(result.error); return; }
    animateMode("success");
  }, [signInWithGoogle, animateMode]);

  const handleAppleSignIn = useCallback(async () => {
    setAppleLoading(true);
    setError(null);
    const result = await signInWithApple();
    setAppleLoading(false);
    if (result.cancelled) return;
    if (result.needsLink) {
      setLinkEmail(result.needsLink.email);
      setLinkCredential(result.needsLink.pendingCredential);
      setLinkProvider("apple");
      setLinkPass("");
      animateMode("link-accounts");
      return;
    }
    if (result.error) { setError(result.error); return; }
    animateMode("success");
  }, [signInWithApple, animateMode]);

  const handleLinkAccounts = useCallback(async () => {
    if (!linkCredential) return;
    if (linkPass.length < 6) { setError("Enter your existing password (6+ characters)."); return; }
    setError(null);
    setLinkLoading(true);
    const result = await linkPendingCredential(linkEmail, linkPass, linkCredential);
    setLinkLoading(false);
    if (result.error) { setError(result.error); return; }
    setEmail(linkEmail);
    setLinkCredential(null);
    animateMode("success");
  }, [linkCredential, linkEmail, linkPass, linkPendingCredential, animateMode]);

  const handleVerifyOtp = useCallback(async () => {
    const e = otpEmail.trim().toLowerCase();
    setOtpError(null);
    setOtpVerifying(true);
    const result = await verifyEmailOtp(e, otpCode);
    if (!result.ok || !result.customToken) {
      setOtpVerifying(false);
      setOtpError(result.error);
      return;
    }
    const signInResult = await signInWithCustomToken(result.customToken);
    setOtpVerifying(false);
    if (signInResult.error) { setOtpError(signInResult.error); return; }
    setEmail(e);
    animateMode("success");
  }, [otpEmail, otpCode, signInWithCustomToken, animateMode]);

  /**
   * A first-time (non-anonymous) sign-in should land on the post-login
   * walkthrough instead of straight back to wherever the user came from —
   * `walkthrough_seen` is per-account (Supabase), not per-device, so a
   * returning user never sees it twice regardless of which device they're on.
   */
  const goPostLogin = useCallback(async () => {
    const uid = user?.uid;
    if (uid) {
      try {
        const { data } = await db.profiles.getById(uid);
        if (!data?.walkthrough_seen) {
          router.replace("/walkthrough" as never);
          return;
        }
      } catch {
        // profiles table may not be ready yet — fall through to normal navigation
      }
    }
    handleSkip();
  }, [user, router, handleSkip]);

  const isVerified = !!(user && !user.isAnonymous && user.emailVerified);

  return {
    mode, setMode, animateMode,
    email, setEmail, pass, setPass, pass2, setPass2,
    loading, googleLoading, appleLoading, linkLoading,
    linkEmail, setLinkEmail, linkPass, setLinkPass, linkProvider, linkCredential, setLinkCredential,
    error, setError, success, setSuccess,
    showPass, setShowPass, showPass2, setShowPass2,
    focusEmail, setFocusEmail, focusPass, setFocusPass, focusPass2, setFocusPass2,
    otpEmail, setOtpEmail, otpCode, setOtpCode,
    otpSending, otpVerifying, otpResending, otpError, setOtpError, otpMsg, setOtpMsg,
    cardOpacity, cardSlide,
    handleSkip, handleSignIn, handleSignUp, handleForgot,
    handleRequestOtp, handleResendOtp, handleGoogleSignIn, handleAppleSignIn,
    handleLinkAccounts, handleVerifyOtp, goPostLogin,
    isVerified, user, appleAvailable, resendVerification, reloadUser,
  };
}
