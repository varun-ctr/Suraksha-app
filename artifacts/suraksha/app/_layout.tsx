import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import * as Notifications from "expo-notifications";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp } from "@/context/AppContext";
import { BookmarksProvider } from "@/context/BookmarksContext";
import { LanguageProvider, useI18n } from "@/context/LanguageContext";
import { SafetyProvider } from "@/context/SafetyContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { ToastProvider, useToast } from "@/context/ToastContext";
import { registerForPushNotifications } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="contacts" />
      <Stack.Screen name="helpline" />
      <Stack.Screen name="fakecall" />
      <Stack.Screen name="report" />
      <Stack.Screen name="community-report" />
      <Stack.Screen name="my-reports" />
      <Stack.Screen name="premium" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="data" />
      <Stack.Screen name="sessions" />
      <Stack.Screen name="right-detail" />
    </Stack>
  );
}

function Gate() {
  const { ready: appReady, onboarded } = useApp();
  const { ready: themeReady } = useTheme();
  const { ready: langReady } = useI18n();
  const { showToast } = useToast();
  const router = useRouter();
  const segments = useSegments();

  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setAuthed(!!session);
        if (event === "SIGNED_IN") {
          void registerForPushNotifications();
        }
      },
    );
    return () => subscription.unsubscribe();
  }, []);

  // ── Notification listeners — native only (not available on web) ──
  useEffect(() => {
    if (Platform.OS === "web") return;

    // Cold-start: read last tapped notification so killed-state deep-links work
    void (async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (response) {
        const route = (response.notification.request.content.data as Record<string, unknown>)?.route;
        if (typeof route === "string" && route) router.push(route as never);
      }
    })();

    // Token refresh → re-upsert to Supabase
    const tokenSub = Notifications.addPushTokenListener(async ({ data: token }) => {
      if (!token) return;
      await registerForPushNotifications();
    });

    // Foreground: show in-app toast
    const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
      const title = notification.request.content.title ?? "";
      const body = notification.request.content.body ?? "";
      const msg = [title, body].filter(Boolean).join(" — ");
      if (msg) showToast(msg);
    });

    // Tap: deep-link to data.route
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = (response.notification.request.content.data as Record<string, unknown>)?.route;
      if (typeof route === "string" && route) router.push(route as never);
    });

    return () => {
      tokenSub.remove();
      foregroundSub.remove();
      tapSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  const allReady = appReady && themeReady && langReady && authChecked;

  useEffect(() => {
    if (allReady) SplashScreen.hideAsync();
  }, [allReady]);

  useEffect(() => {
    if (!allReady) return;
    const seg0 = segments[0] as string;
    const inOnboarding = seg0 === "onboarding";
    const inLogin      = seg0 === "login";

    if (!onboarded && !inOnboarding && !inLogin) {
      router.replace("/onboarding");
    } else if (onboarded && inOnboarding) {
      router.replace(authed ? "/(tabs)" : "/login" as never);
    }
  }, [allReady, onboarded, authed, segments, router]);

  if (!allReady) return null;

  return <RootLayoutNav />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <ThemeProvider>
              <LanguageProvider>
                <AppProvider>
                  <SafetyProvider>
                    <BookmarksProvider>
                      <ToastProvider>
                        <Gate />
                      </ToastProvider>
                    </BookmarksProvider>
                  </SafetyProvider>
                </AppProvider>
              </LanguageProvider>
            </ThemeProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
