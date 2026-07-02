/**
 * Firebase-backed auth helpers.
 * Supabase is used ONLY for data (contacts, reports, journeys, etc.) — NOT authentication.
 *
 * These thin wrappers let legacy call-sites continue importing from "@/lib/auth"
 * while all implementation now delegates to Firebase via lib/firebaseAuth.ts.
 */

import { deleteUser } from "firebase/auth";
import { firebaseAuth } from "./firebase";
import {
  signOutFB,
  signInAnonymouslyFB,
  onFirebaseAuthStateChanged,
  getCurrentFirebaseUser,
} from "./firebaseAuth";
import { getBackendUrl } from "./env";
import type { User } from "firebase/auth";

export type { User };

// ── Sign out ──────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await signOutFB();
}

// ── Current user ──────────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<User | null> {
  return getCurrentFirebaseUser();
}

// ── Auth state listener ───────────────────────────────────────────────────────

export type AuthChangeEvent = "SIGNED_IN" | "SIGNED_OUT";

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, user: User | null) => void,
): { unsubscribe: () => void } {
  const unsub = onFirebaseAuthStateChanged((user) => {
    callback(user ? "SIGNED_IN" : "SIGNED_OUT", user);
  });
  return { unsubscribe: unsub };
}

// ── Anonymous auth ────────────────────────────────────────────────────────────

export async function signInAnonymously(): Promise<{
  user: User | null;
  error: string | null;
}> {
  return signInAnonymouslyFB();
}

export function isAnonymous(user: User | null): boolean {
  return user?.isAnonymous ?? true;
}

// ── Account deletion ──────────────────────────────────────────────────────────

export async function deleteAccount(): Promise<{ error: string | null }> {
  try {
    const user = firebaseAuth.currentUser;
    if (!user) return { error: "Not signed in." };

    const token = await user.getIdToken().catch(() => null);
    const backendUrl = getBackendUrl();

    // Best-effort: notify backend so it can clean up server-side data.
    // Failures are swallowed — Firebase account deletion is authoritative.
    if (token && backendUrl) {
      await fetch(`${backendUrl}/api/auth/account`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8_000),
      }).catch(() => {});
    }

    await deleteUser(user);
    return { error: null };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/requires-recent-login") {
      return { error: "Please sign in again before deleting your account." };
    }
    return { error: "Unable to delete account. Please try again." };
  }
}

/**
 * The single "delete my account" orchestration — deletes the account
 * (backend cleanup + Firebase user removal), wipes local app state via the
 * caller-supplied `resetAllData`, then clears any residual local auth
 * session. Both Profile and Sessions must call this same function rather
 * than each re-implementing the delete → reset → sign-out sequence, so the
 * two screens can't drift out of sync with each other again.
 */
export async function deleteAccountAndResetLocalData(
  resetAllData: () => Promise<void>,
): Promise<{ error: string | null }> {
  const { error } = await deleteAccount();
  if (error) return { error };
  await resetAllData();
  await signOut();
  return { error: null };
}
