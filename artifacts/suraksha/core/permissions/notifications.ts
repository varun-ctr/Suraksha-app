import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Needs direct client access to read the current user and persist the
// device's push token; not a composition-root concern, but there's no
// domain-level indirection for this device-registration side effect yet.
// eslint-disable-next-line import/no-restricted-paths
import { firebaseAuth } from "@/repositories/firebase/firebaseClient";
// eslint-disable-next-line import/no-restricted-paths
import { db, supabase } from "@/repositories/supabase/supabaseClient";

/** Local record of this device's push token, mirrored so it can be cleared without an extra permissions round-trip. */
export const NOTIF_TOKEN_STORAGE_KEY = "suraksha.notif.token";

/**
 * Suppress the system banner in the foreground — the root _layout.tsx shows
 * an in-app Toast instead via addNotificationReceivedListener.
 * No-op on web (push tokens and native notification handler unavailable).
 */
export function enableNotificationHandler(): void {
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: true,
    }),
  });
}

/**
 * Remove the handler so no foreground handling occurs while notifications
 * are disabled by the user. No-op on web.
 */
export function disableNotificationHandler(): void {
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler(null);
}

// Install the handler at module-load time so it's active before any
// notification arrives during cold start.
enableNotificationHandler();

export type RegisterResult =
  | { ok: true; token: string }
  | { ok: false; denied: boolean; error?: string };

/**
 * Returns whether the OS has granted notification permission.
 * Does NOT prompt the user — safe to call silently on mount.
 * Always returns false on web (native push not available).
 */
export async function getNotificationPermissionGranted(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const status = (await Notifications.getPermissionsAsync()) as unknown as {
      granted: boolean;
    };
    return status.granted;
  } catch {
    return false;
  }
}

/**
 * Request notification permission, obtain the Expo Push Token, and sync it
 * to the Supabase `notification_tokens` table for the signed-in user.
 *
 * On token refresh the stale row for the same platform is deleted first so
 * exactly one token per device exists in the table.
 *
 * Safe to call in simulator / dev builds — token fetch failure is non-fatal.
 */
export async function registerForPushNotifications(): Promise<RegisterResult> {
  if (Platform.OS === "web") {
    return { ok: false, denied: false, error: "Push notifications not supported on web" };
  }

  let granted = false;
  try {
    const result = (await Notifications.requestPermissionsAsync()) as unknown as {
      granted: boolean;
    };
    granted = result.granted;
  } catch {
    return { ok: false, denied: false, error: "Permission request failed" };
  }

  if (!granted) {
    return { ok: false, denied: true };
  }

  let token: string;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    token = tokenData.data;
  } catch {
    // Token fetch fails in simulator / physical device without FCM config.
    // Return a non-denied error so callers can still enable the toggle.
    return { ok: false, denied: false, error: "Token unavailable (dev build)" };
  }

  // Sync to Supabase if signed in — non-critical, failures are swallowed.
  try {
    const user = firebaseAuth.currentUser;
    if (user) {
      const platform: "ios" | "android" | "web" =
        Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";

      // Delete any stale token rows for this user+platform first so token
      // rotation (reinstall / FCM refresh) always leaves one row, not many.
      await supabase
        .from("notification_tokens")
        .delete()
        .eq("user_id", user.uid)
        .eq("platform", platform);

      await db.notificationTokens.upsert(user.uid, { token, platform });
    }
  } catch {
    // Non-critical — the app works without remote push.
  }

  return { ok: true, token };
}

/**
 * Deregisters this device's push-notification token: removes the local
 * record and the Supabase row(s) for the current user, so a former user's
 * device stops being a valid delivery target for their pushes. Called on
 * sign-out (authService.signOut) and when the user disables the
 * notifications toggle — both flows previously only handled one of these
 * (toggle-off did the Supabase+local cleanup; sign-out did neither),
 * which is why this is now the single shared implementation.
 */
export async function deregisterPushToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(NOTIF_TOKEN_STORAGE_KEY);
  } catch {
    // Non-critical
  }
  try {
    const user = firebaseAuth.currentUser;
    if (user) await db.notificationTokens.deleteForUser(user.uid);
  } catch {
    // Non-critical
  }
}

/**
 * Schedule a one-shot local notification `seconds` from now.
 * Returns the notification identifier, or null if scheduling fails.
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  seconds: number,
): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        repeats: false,
      },
    });
    return id;
  } catch {
    return null;
  }
}

/**
 * Cancel every scheduled local notification (e.g. on journey end).
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Ignore
  }
}
