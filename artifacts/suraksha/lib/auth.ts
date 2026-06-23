import { supabase } from "./supabaseClient";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { Platform } from "react-native";

/**
 * Returns the URL Supabase should redirect to after the user clicks the
 * magic-link email. On web this must point back to the login screen so the
 * Supabase JS client can pick up the session hash.
 */
function getRedirectTo(): string | undefined {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    // Return the current page URL so the magic link lands back here.
    return `${window.location.origin}${window.location.pathname}`;
  }
  return undefined;
}

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

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
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
