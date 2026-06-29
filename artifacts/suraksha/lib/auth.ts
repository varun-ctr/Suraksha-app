import { supabase } from "./supabaseClient";
import { secureGet, secureSet } from "./secureStore";
import { getBackendUrl } from "./env";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// Redirect URL for magic-link emails (web only)
// ---------------------------------------------------------------------------
function getRedirectTo(): string | undefined {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Phone OTP rate limiting — max 5 sends per rolling hour (client-side)
// ---------------------------------------------------------------------------
const OTP_RATE_LIMIT_KEY = "suraksha.otp.ratelimit";
const MAX_OTP_PER_HOUR = 5;
const ONE_HOUR_MS = 60 * 60 * 1000;

interface RateLimitState {
  count: number;
  windowStart: number;
}

async function checkAndIncrementRateLimit(): Promise<{
  allowed: boolean;
  resetInMinutes?: number;
}> {
  try {
    const raw = await secureGet(OTP_RATE_LIMIT_KEY);
    const now = Date.now();
    let state: RateLimitState = raw
      ? (JSON.parse(raw) as RateLimitState)
      : { count: 0, windowStart: now };

    if (now - state.windowStart > ONE_HOUR_MS) {
      state = { count: 0, windowStart: now };
    }

    if (state.count >= MAX_OTP_PER_HOUR) {
      const resetAt = state.windowStart + ONE_HOUR_MS;
      const resetInMinutes = Math.max(1, Math.ceil((resetAt - now) / 60_000));
      return { allowed: false, resetInMinutes };
    }

    state.count += 1;
    await secureSet(OTP_RATE_LIMIT_KEY, JSON.stringify(state));
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

// ---------------------------------------------------------------------------
// Email auth (magic link + OTP)
// ---------------------------------------------------------------------------
export async function sendOtp(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: getRedirectTo(),
    },
  });
  return { error: error?.message ?? null };
}

export async function verifyOtp(
  email: string,
  token: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// Phone auth (SMS OTP)
// ---------------------------------------------------------------------------
export async function sendPhoneOtp(
  phone: string,
): Promise<{ error: string | null; rateLimitMinutes?: number }> {
  const rateCheck = await checkAndIncrementRateLimit();
  if (!rateCheck.allowed) {
    return { error: "rate_limited", rateLimitMinutes: rateCheck.resetInMinutes };
  }
  const { error } = await supabase.auth.signInWithOtp({ phone });
  return { error: error?.message ?? null };
}

export async function verifyPhoneOtp(
  phone: string,
  token: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });
  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function signOutGlobal(): Promise<void> {
  await supabase.auth.signOut({ scope: "global" });
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): { unsubscribe: () => void } {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return { unsubscribe: () => data.subscription.unsubscribe() };
}

// ---------------------------------------------------------------------------
// Anonymous auth — signs in silently; user gets a real user_id with no friction
// ---------------------------------------------------------------------------
export async function signInAnonymously(): Promise<{
  user: User | null;
  error: string | null;
}> {
  const { data, error } = await supabase.auth.signInAnonymously();
  return { user: data.user ?? null, error: error?.message ?? null };
}

// Returns true when the currently authenticated user is an anonymous account
// (has no linked email / phone — provider is "anonymous").
export function isAnonymous(user: User | null): boolean {
  if (!user) return false;
  const provider = user.app_metadata?.provider as string | undefined;
  return provider === "anonymous";
}

// ---------------------------------------------------------------------------
// Account deletion — calls the api-server DELETE /api/auth/account endpoint
// ---------------------------------------------------------------------------
export async function deleteAccount(): Promise<{ error: string | null }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { error: "Not signed in" };

    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/api/auth/account`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      return { error: body.message ?? "Failed to delete account" };
    }
    return { error: null };
  } catch {
    return { error: "Network error — check your connection" };
  }
}
