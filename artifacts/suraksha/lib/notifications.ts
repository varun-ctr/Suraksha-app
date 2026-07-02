import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { firebaseAuth } from "@/lib/firebase";
import { db, supabase } from "@/lib/supabaseClient";

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
