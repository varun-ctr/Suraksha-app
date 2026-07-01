import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "firebase/auth";

import {
  signInWithEmail,
  signUpWithEmail,
  signInAnonymouslyFB,
  signOutFB,
  sendPasswordReset,
  resendVerificationEmail,
  reloadCurrentUser,
  onFirebaseAuthStateChanged,
  getCurrentFirebaseUser,
} from "@/lib/firebaseAuth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAnon: boolean;
  signIn:   (email: string, password: string) => Promise<{ error: string | null }>;
  signUp:   (email: string, password: string) => Promise<{ error: string | null }>;
  signOut:  () => Promise<void>;
  resetPassword:      (email: string) => Promise<{ error: string | null }>;
  resendVerification: () => Promise<{ error: string | null }>;
  reloadUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(getCurrentFirebaseUser());
  const [loading, setLoading] = useState(true);

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

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await signInWithEmail(email, password);
    return { error: r.error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const r = await signUpWithEmail(email, password);
    return { error: r.error };
  }, []);

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
      signOut,
      resetPassword,
      resendVerification,
      reloadUser,
      getIdToken,
    }),
    [user, loading, isAnon, signIn, signUp, signOut, resetPassword, resendVerification, reloadUser, getIdToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
