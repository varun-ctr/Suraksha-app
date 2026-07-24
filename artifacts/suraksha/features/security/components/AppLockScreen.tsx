import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/shared/components/Icon";
import { useTheme } from "@/shared/theme/ThemeContext";
import { useI18n } from "@/features/settings/context/LanguageContext";
import type { BiometricType } from "@/core/permissions/biometrics";

interface Props {
  biometricType: BiometricType;
  biometricsAvailable: boolean;
  onUnlock: (promptMessage?: string) => Promise<{ success: boolean } | { success: false; error: string }>;
}

function labelForBiometricType(type: BiometricType, t: (key: string) => string): string {
  if (type === "faceId") return t("appLock.unlockWithFaceId");
  if (type === "touchId") return t("appLock.unlockWithTouchId");
  if (type === "iris") return t("appLock.unlockWithIris");
  return t("appLock.unlockButton");
}

/**
 * Full-screen overlay shown in place of the app's normal navigation stack
 * when useAppLock() reports `locked: true` — see app/_layout.tsx's Gate.
 * Not a new navigation route (no new Stack.Screen was added); this renders
 * conditionally the exact same way ConfigErrorScreen and the splash-hold
 * `null` already do at this same spot in the render tree.
 */
export function AppLockScreen({ biometricType, biometricsAvailable, onUnlock }: Props) {
  const { c } = useTheme();
  const { t } = useI18n();
  const [attempting, setAttempting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUnlock = useCallback(async () => {
    setAttempting(true);
    setErrorMessage(null);
    const result = await onUnlock(t("appLock.osPromptMessage"));
    setAttempting(false);
    if (!result.success && "error" in result && result.error !== "unavailable") {
      // "unavailable" is handled by the hook itself as a fail-open unlock —
      // this branch is only reached for a real failure (cancel, mismatch,
      // lockout), so it's safe and correct to surface a retry message here.
      setErrorMessage(t("appLock.tryAgain"));
    }
  }, [onUnlock, t]);

  // Prompt automatically once when the lock screen first appears — most
  // users expect the Face ID/Touch ID sheet to appear immediately rather
  // than needing an extra tap, while the visible "Unlock" button below
  // remains the graceful fallback for anyone who dismisses it, denies the
  // OS permission dialog, or is on a device without biometrics enrolled.
  useEffect(() => {
    void handleUnlock();
    // Intentionally mount-only — re-prompting on every re-render would
    // interrupt a user who's mid-retry.
  }, []);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.bg }}
      accessibilityViewIsModal
      accessibilityLabel={t("appLock.screenTitle")}
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: c.card,
            borderWidth: 2,
            borderColor: c.primary,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <Icon name="lock" size={36} color={c.primary} />
        </View>

        <Text
          style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: c.text, marginBottom: 8, textAlign: "center" }}
        >
          {t("appLock.screenTitle")}
        </Text>
        <Text
          style={{ fontSize: 14, color: c.textMuted, textAlign: "center", marginBottom: 32, lineHeight: 20 }}
        >
          {biometricsAvailable ? t("appLock.screenSubtitle") : t("appLock.notAvailableSubtitle")}
        </Text>

        {errorMessage && (
          <Text
            style={{ fontSize: 13, color: c.danger, textAlign: "center", marginBottom: 16 }}
            accessibilityLiveRegion="polite"
          >
            {errorMessage}
          </Text>
        )}

        <Pressable
          onPress={handleUnlock}
          disabled={attempting}
          accessible
          accessibilityRole="button"
          accessibilityLabel={labelForBiometricType(biometricType, t)}
          style={({ pressed }) => ({
            backgroundColor: c.primary,
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 28,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            opacity: pressed || attempting ? 0.85 : 1,
            minWidth: 200,
            justifyContent: "center",
          })}
        >
          {attempting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Icon name="lock" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14.5 }}>
                {labelForBiometricType(biometricType, t)}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
