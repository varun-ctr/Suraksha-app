import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "firebase/auth";
import type { OAuthCredential } from "@/lib/firebaseAuth";

import {
  signInWithEmail,
  signUpWithEmail,
  signInAnonymouslyFB,
  signInWithCustomTokenFB,
  signInWithGoogle as fbSignInWithGoogle,
  signInWithApple as fbSignInWithApple,
  isAppleSignInAvailable,
  linkPendingCredential as fbLinkPendingCredential,
  signOutFB,
  sendPasswordReset,
  resendVerificationEmail,
  reloadCurrentUser,
  onFirebaseAuthStateChanged,
  getCurrentFirebaseUser,
} from "@/lib/firebaseAuth";
import { initPurchases } from "@/lib/purchases";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAnon: boolean;
  signIn:   (email: string, password: string) => Promise<{ error: string | null }>;
  signUp:   (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithCustomToken: (token: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null; cancelled?: boolean; needsLink?: { email: string; pendingCredential: OAuthCredential } }>;
  signInWithApple: () => Promise<{ error: string | null; cancelled?: boolean; needsLink?: { email: string; pendingCredential: OAuthCredential } }>;
  linkPendingCredential: (email: string, password: string, pendingCredential: OAuthCredential) => Promise<{ error: string | null }>;
  appleAvailable: boolean;
  signOut:  () => Promise<void>;
  resetPassword:      (email: string) => Promise<{ error: string | null }>;
  resendVerification: () => Promise<{ error: string | null }>;
  reloadUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<User | null>(getCurrentFirebaseUser());
  const [loading, setLoading]         = useState(true);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    const unsub = onFirebaseAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      void signInAnonymouslyFB();
    }
  }, [loading, user]);

  // Associate RevenueCat's app_user_id with the Firebase uid on every sign-in
  // so purchases/entitlements track the user and match the backend webhook's
  // app_user_id (= profiles.id). No-op in Expo Go / web / without an SDK key.
  useEffect(() => {
    if (user) void initPurchases(user.uid);
  }, [user]);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await signInWithEmail(email, password);
    return { error: r.error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const r = await signUpWithEmail(email, password);
    return { error: r.error };
  }, []);

  const signInWithCustomToken = useCallback(async (token: string) => {
    const r = await signInWithCustomTokenFB(token);
    return { error: r.error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const r = await fbSignInWithGoogle();
    return { error: r.error, cancelled: r.cancelled, needsLink: r.needsLink };
  }, []);

  const signInWithApple = useCallback(async () => {
    const r = await fbSignInWithApple();
    return { error: r.error, cancelled: r.cancelled, needsLink: r.needsLink };
  }, []);

  const linkPendingCredential = useCallback(
    async (email: string, password: string, pendingCredential: OAuthCredential) => {
      const r = await fbLinkPendingCredential(email, password, pendingCredential);
      return { error: r.error };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await signOutFB();
    await signInAnonymouslyFB();
  }, []);

  const resetPassword = useCallback(
    (email: string) => sendPasswordReset(email),
    [],
  );

  const resendVerification = useCallback(
    () => resendVerificationEmail(),
    [],
  );

  const reloadUser = useCallback(async () => {
    await reloadCurrentUser();
    setUser(getCurrentFirebaseUser());
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try { return await user.getIdToken(); } catch { return null; }
  }, [user]);

  const isAnon = user?.isAnonymous ?? true;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAnon,
      signIn,
      signUp,
      signInWithCustomToken,
      signInWithGoogle,
      signInWithApple,
      linkPendingCredential,
      appleAvailable,
      signOut,
      resetPassword,
      resendVerification,
      reloadUser,
      getIdToken,
    }),
    [user, loading, isAnon, signIn, signUp, signInWithCustomToken, signInWithGoogle, signInWithApple, linkPendingCredential, appleAvailable, signOut, resetPassword, resendVerification, reloadUser, getIdToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
