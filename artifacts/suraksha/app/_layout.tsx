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

  // ── Cold-start (killed-state) notification tap handling ──────────
  // addNotificationResponseReceivedListener only fires when the app is already
  // running. For taps that launch the app from a terminated state, Expo stores
  // the last response; we read it once on mount and route accordingly.
  useEffect(() => {
    void (async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (response) {
        const route = (response.notification.request.content.data as Record<string, unknown>)?.route;
        if (typeof route === "string" && route) {
          router.push(route as never);
        }
      }
    })();
    // Run once on mount — router intentionally excluded to avoid re-routing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Push token refresh: upsert new token to Supabase ─────────────
  useEffect(() => {
    const sub = Notifications.addPushTokenListener(async ({ data: token }) => {
      if (!token) return;
      await registerForPushNotifications();
    });
    return () => sub.remove();
  }, []);

  // ── Foreground notification handler: show in-app toast ────────────
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const title = notification.request.content.title ?? "";
      const body = notification.request.content.body ?? "";
      const msg = [title, body].filter(Boolean).join(" — ");
      if (msg) showToast(msg);
    });
    return () => sub.remove();
  }, [showToast]);

  // ── Tap handler: deep-link to data.route if provided ─────────────
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = (response.notification.request.content.data as Record<string, unknown>)?.route;
      if (typeof route === "string" && route) {
        router.push(route as never);
      }
    });
    return () => sub.remove();
  }, [router]);

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
