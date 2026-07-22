/**
 * Firebase-backed auth helpers.
 * Supabase is used ONLY for data (contacts, reports, journeys, etc.) — NOT authentication.
 *
 * These thin wrappers let legacy call-sites continue importing from "@/features/authentication/services/authService"
 * while all implementation now delegates to the AuthRepository (repositories/firebase/authRepository.ts).
 */

import { deleteUser } from "firebase/auth";
import { firebaseAuth } from "@/repositories/firebase/firebaseClient";
import { getCurrentFirebaseUser } from "@/repositories/firebase/firebaseAuth";
import { authRepository } from "@/repositories/firebase/authRepository";
import { deregisterPushToken } from "@/core/permissions/notifications";
import { apiFetch } from "@/core/network/apiClient";
import { logger } from "@/core/logger/logger";
import type { User } from "firebase/auth";

export type { User };

// ── Sign out ──────────────────────────────────────────────────────────────────

/**
 * The single sign-out orchestration used by every "Sign out" entry point
 * (Profile, active-sessions screen). Deregisters this device's push token
 * first (so a former user's device stops receiving pushes meant for their
 * account), then signs out of Firebase, then re-establishes anonymous auth
 * — this app always has a Firebase user, signed-in or anonymous, so
 * background-signed-out code paths (e.g. AppContext's sync effect) don't
 * need to separately handle a truly-unauthenticated state.
 */
export async function signOut(): Promise<void> {
  await deregisterPushToken();
  const result = await authRepository.signOut();
  if (!result.ok) logger.warn("[authService] sign-out failed", result.error);
  const anonResult = await authRepository.signInAnonymously();
  if (!anonResult.ok) logger.warn("[authService] re-establishing anonymous auth after sign-out failed", anonResult.error);
}

// ── Current user ──────────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<User | null> {
  return getCurrentFirebaseUser();
}

// ── Account deletion ──────────────────────────────────────────────────────────

export async function deleteAccount(): Promise<{ error: string | null }> {
  try {
    const user = firebaseAuth.currentUser;
    if (!user) return { error: "Not signed in." };

    // Best-effort: notify backend so it can clean up server-side data.
    // Failures are logged but non-fatal — Firebase account deletion below
    // is authoritative and must proceed regardless, so a stuck backend
    // never blocks a user's ability to delete their account. This does
    // mean a failure here can leave orphaned Supabase rows with no
    // automatic retry (there's no way to re-authenticate as a deleted
    // user) — see docs/adr/0004-error-handling-strategy.md and the
    // architecture audit's risk assessment for the recommended follow-up
    // (a Firebase Auth user-deleted trigger for server-side reconciliation).
    const { response } = await apiFetch("/auth/account", { method: "DELETE", timeoutMs: 8_000 });
    if (!response || !response.ok) {
      logger.warn("[authService] backend account-data cleanup failed; proceeding with Firebase deletion anyway", {
        status: response?.status ?? null,
      });
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
