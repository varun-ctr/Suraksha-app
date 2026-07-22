import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "firebase/auth";
import type { OAuthCredential } from "@/repositories/firebase/firebaseAuth";
import { onFirebaseAuthStateChanged, getCurrentFirebaseUser } from "@/repositories/firebase/firebaseAuth";
import { useAuthRepository } from "@/core/di/hooks";
import { signOut as performSignOut } from "@/features/authentication/services/authService";
import { initPurchases } from "@/features/premium/services/purchasesService";
import { toAuthUser } from "@/repositories/firebase/mappers/authUserMapper";
import type { AuthUser } from "@/domain/entities/AuthUser";
import { logger } from "@/core/logger/logger";

/**
 * If Firebase's auth-state listener never fires (cold-start network delay,
 * a broken persistence read, etc.) this forces `loading` false anyway so
 * the app doesn't stay on the splash screen forever — see app/_layout.tsx's
 * `Gate`, the sole consumer of `loading`, which previously implemented this
 * same timeout itself against its own now-removed duplicate listener.
 */
const AUTH_STATE_TIMEOUT_MS = 6000;

interface AuthContextValue {
  user: User | null;
  /** Domain-safe projection of `user` — prefer this over `user` in new code that doesn't need the live Firebase SDK object (e.g. for `.getIdToken()`). */
  authUser: AuthUser | null;
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
  const authRepository = useAuthRepository();
  const [user, setUser]               = useState<User | null>(getCurrentFirebaseUser());
  const [loading, setLoading]         = useState(true);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // This is the single Firebase onAuthStateChanged subscription for the
  // whole app — AppContext, LanguageContext, and app/_layout.tsx's Gate
  // all previously registered their own redundant listeners for the same
  // underlying event; they now derive from this context instead (see
  // docs/adr/0001-feature-first-architecture.md's performance notes).
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), AUTH_STATE_TIMEOUT_MS);
    const unsub = onFirebaseAuthStateChanged((u) => {
      clearTimeout(timeout);
      setUser(u);
      setLoading(false);
    });
    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      authRepository.signInAnonymously().then((r) => {
        if (!r.ok) logger.warn("[AuthContext] anonymous fallback sign-in failed", r.error);
      });
    }
  }, [loading, user, authRepository]);

  // Associate RevenueCat's app_user_id with the Firebase uid on every sign-in
  // so purchases/entitlements track the user and match the backend webhook's
  // app_user_id (= profiles.id). No-op in Expo Go / web / without an SDK key.
  useEffect(() => {
    if (user) void initPurchases(user.uid);
  }, [user]);

  useEffect(() => {
    authRepository.isAppleSignInAvailable().then(setAppleAvailable);
  }, [authRepository]);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await authRepository.signInWithEmail(email, password);
    return { error: r.ok ? null : r.error.message };
  }, [authRepository]);

  const signUp = useCallback(async (email: string, password: string) => {
    const r = await authRepository.signUpWithEmail(email, password);
    return { error: r.ok ? null : r.error.message };
  }, [authRepository]);

  const signInWithCustomToken = useCallback(async (token: string) => {
    const r = await authRepository.signInWithCustomToken(token);
    return { error: r.ok ? null : r.error.message };
  }, [authRepository]);

  const signInWithGoogle = useCallback(async () => {
    const r = await authRepository.signInWithGoogle();
    if (!r.ok) return { error: r.error.message };
    if (r.value.kind === "cancelled") return { error: null, cancelled: true };
    if (r.value.kind === "needsLink") {
      return {
        error: null,
        needsLink: { email: r.value.email, pendingCredential: r.value.pendingCredential as OAuthCredential },
      };
    }
    return { error: null };
  }, [authRepository]);

  const signInWithApple = useCallback(async () => {
    const r = await authRepository.signInWithApple();
    if (!r.ok) return { error: r.error.message };
    if (r.value.kind === "cancelled") return { error: null, cancelled: true };
    if (r.value.kind === "needsLink") {
      return {
        error: null,
        needsLink: { email: r.value.email, pendingCredential: r.value.pendingCredential as OAuthCredential },
      };
    }
    return { error: null };
  }, [authRepository]);

  const linkPendingCredential = useCallback(
    async (email: string, password: string, pendingCredential: OAuthCredential) => {
      const r = await authRepository.linkPendingCredential(email, password, pendingCredential);
      return { error: r.ok ? null : r.error.message };
    },
    [authRepository],
  );

  const signOut = useCallback(async () => {
    await performSignOut();
  }, []);

  const resetPassword = useCallback(
    async (email: string) => {
      const r = await authRepository.sendPasswordReset(email);
      return { error: r.ok ? null : r.error.message };
    },
    [authRepository],
  );

  const resendVerification = useCallback(async () => {
    const r = await authRepository.resendVerificationEmail();
    return { error: r.ok ? null : r.error.message };
  }, [authRepository]);

  const reloadUser = useCallback(async () => {
    await authRepository.reloadCurrentUser();
    setUser(getCurrentFirebaseUser());
  }, [authRepository]);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try { return await user.getIdToken(); } catch { return null; }
  }, [user]);

  const isAnon = user?.isAnonymous ?? true;
  const authUser = useMemo<AuthUser | null>(() => (user ? toAuthUser(user) : null), [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      authUser,
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
    [user, authUser, loading, isAnon, signIn, signUp, signInWithCustomToken, signInWithGoogle, signInWithApple, linkPendingCredential, appleAvailable, signOut, resetPassword, resendVerification, reloadUser, getIdToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
