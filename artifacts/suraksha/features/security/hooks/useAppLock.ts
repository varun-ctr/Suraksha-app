import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import {
  authenticateWithBiometrics,
  getBiometricType,
  isBiometricUnlockAvailable,
  type BiometricAuthResult,
  type BiometricType,
} from "@/core/permissions/biometrics";
import { shouldRequireUnlock, DEFAULT_APP_LOCK_GRACE_MS } from "@/domain/policies/appLockPolicy";

export interface UseAppLockResult {
  /** True when the app-lock screen should be shown instead of normal content. */
  locked: boolean;
  /** Whether the device currently has biometric hardware AND an enrolled credential. */
  biometricsAvailable: boolean;
  biometricType: BiometricType;
  /** Prompts biometric auth; unlocks on success OR when biometrics are unavailable (fail-open — see module doc). */
  unlock: (promptMessage?: string) => Promise<BiometricAuthResult>;
}

/**
 * Wires the existing core/permissions/biometrics.ts capability into a
 * working, opt-in app-lock: requires a fresh biometric unlock on cold start
 * (once settings have loaded) and again after the app has been backgrounded
 * past a short grace window (domain/policies/appLockPolicy.ts) — a quick
 * app switch doesn't force a re-prompt, only a real return-to-the-app does.
 *
 * `enabled` mirrors the caller's persisted setting (default OFF — see
 * features/profile/context/AppContext.tsx's `settings.appLockEnabled`) so
 * this hook has literally no effect, and the login/launch flow is
 * byte-for-byte unchanged, unless the user has explicitly turned the
 * feature on.
 *
 * Fail-open by design: if biometrics are ever unavailable (no hardware, no
 * enrolled credential, a future OS/permission change) `unlock()` treats
 * that the same as success rather than trapping the user out of a safety
 * app — this is a life-safety application, and a broken/missing Face ID
 * sensor must never be the reason someone can't reach the app to trigger
 * SOS or contact a trusted contact.
 */
export function useAppLock(enabled: boolean, settingsReady: boolean): UseAppLockResult {
  const [locked, setLocked] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>("none");

  const backgroundedAtRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  // Check hardware/enrollment whenever the feature is (re)enabled —
  // enrollment can change between sessions (e.g. Face ID re-enrolled after
  // the setting was already toggled on).
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const [available, type] = await Promise.all([isBiometricUnlockAvailable(), getBiometricType()]);
      if (cancelled) return;
      setBiometricsAvailable(available);
      setBiometricType(type);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Cold-start lock state, decided exactly once — the moment settings
  // finish loading from disk. Before that, `enabled` is still the
  // not-yet-loaded default and would otherwise incorrectly report "not
  // locked" for a user who actually has the feature on.
  useEffect(() => {
    if (!settingsReady || initializedRef.current) return;
    initializedRef.current = true;
    setLocked(enabled);
  }, [settingsReady, enabled]);

  // Background/foreground transitions.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        backgroundedAtRef.current = Date.now();
        return;
      }
      if (next === "active") {
        const backgroundedAtMs = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (shouldRequireUnlock(backgroundedAtMs, Date.now(), DEFAULT_APP_LOCK_GRACE_MS)) {
          setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const unlock = useCallback(async (promptMessage = "Unlock Suraksha"): Promise<BiometricAuthResult> => {
    const result = await authenticateWithBiometrics(promptMessage);
    if (result.success || result.error === "unavailable") {
      setLocked(false);
    }
    return result;
  }, []);

  return { locked: enabled && locked, biometricsAvailable, biometricType, unlock };
}
