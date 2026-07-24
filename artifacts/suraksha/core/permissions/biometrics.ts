/**
 * Face ID / Touch ID / Android biometrics capability.
 *
 * Wired into the opt-in App Lock feature (default off) — see
 * features/security/hooks/useAppLock.ts, features/security/components/
 * AppLockScreen.tsx, and AppContext's settings.appLockEnabled. This module
 * itself stays a thin, screen-agnostic wrapper around expo-local-authentication
 * so it can also back any future biometric-gated flow without a new
 * native-module integration.
 *
 * NSFaceIDUsageDescription is declared in app.config.ts's
 * expo-local-authentication plugin config, so calling authenticateAsync()
 * on iOS doesn't crash for a missing Info.plist key.
 *
 * Accessed via core/capabilities/nativeCapabilities.ts's getLocalAuthentication()
 * rather than a static top-level import — expo-task-manager's Expo Go crash
 * (see backgroundLocation.ts / docs/startup-audit/) showed that an
 * unconditionally-imported optional native module can throw at import time.
 * This module isn't in the eager startup import graph today, but guarding it
 * the same way means it stays safe the moment it IS wired into a screen.
 */
import { getLocalAuthentication } from "@/core/capabilities/nativeCapabilities";

export type BiometricType = "faceId" | "touchId" | "iris" | "none";

/** True if the device has biometric hardware AND the user has enrolled at least one credential. */
export async function isBiometricUnlockAvailable(): Promise<boolean> {
  const LocalAuthentication = getLocalAuthentication();
  if (!LocalAuthentication) return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

/** Best-effort description of which biometric method the device supports, for UI copy (e.g. "Unlock with Face ID"). */
export async function getBiometricType(): Promise<BiometricType> {
  const LocalAuthentication = getLocalAuthentication();
  if (!LocalAuthentication) return "none";
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "faceId";
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "touchId";
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return "iris";
    return "none";
  } catch {
    return "none";
  }
}

export type BiometricAuthResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Prompts the OS biometric UI. Never throws — a hardware/enrollment failure,
 * user cancellation, or a missing native module all resolve to
 * `{ success: false, error }` so a future call site can fall back to
 * password/PIN unlock uniformly.
 */
export async function authenticateWithBiometrics(promptMessage: string): Promise<BiometricAuthResult> {
  const LocalAuthentication = getLocalAuthentication();
  if (!LocalAuthentication) return { success: false, error: "unavailable" };
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: false,
    });
    if (result.success) return { success: true };
    return { success: false, error: result.error };
  } catch {
    return { success: false, error: "unknown" };
  }
}
