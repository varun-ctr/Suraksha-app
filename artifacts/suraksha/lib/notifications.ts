import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { db, supabase } from "@/lib/supabaseClient";

/**
 * Suppress the system banner in the foreground — the root _layout.tsx shows
 * an in-app Toast instead via addNotificationReceivedListener.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
});

export type RegisterResult =
  | { ok: true; token: string }
  | { ok: false; denied: boolean; error?: string };

/**
 * Request notification permission, obtain the Expo Push Token, and upsert it
 * into the Supabase `notification_tokens` table for the signed-in user.
 * Safe to call in simulator / dev builds — token fetch failure is non-fatal.
 */
export async function registerForPushNotifications(): Promise<RegisterResult> {
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
    // Return partial ok so callers can still enable the toggle.
    return { ok: false, denied: false, error: "Token unavailable (dev build)" };
  }

  // Upsert to Supabase if signed in — non-critical, failures are swallowed.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const platform: "ios" | "android" | "web" =
        Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
      await db.notificationTokens.upsert(user.id, { token, platform });
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
