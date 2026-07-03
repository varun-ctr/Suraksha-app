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

import { ConfigErrorScreen } from "@/components/ConfigErrorScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp } from "@/context/AppContext";
import { BookmarksProvider } from "@/context/BookmarksContext";
import { LanguageProvider, useI18n } from "@/context/LanguageContext";
import { SafetyProvider } from "@/context/SafetyContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { ToastProvider, useToast } from "@/context/ToastContext";
import { AuthProvider } from "@/context/AuthContext";
import { initFirebase } from "@/lib/firebase";
import { onFirebaseAuthStateChanged } from "@/lib/firebaseAuth";
import { registerForPushNotifications } from "@/lib/notifications";
import { initSupabase } from "@/lib/supabaseClient";
import { validateConfig } from "@/lib/config";

const APP_CONFIG = validateConfig();

if (APP_CONFIG.ok) {
  initFirebase({
    apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
    authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
    measurementId:     process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  });
  initSupabase(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

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
    const unsub = onFirebaseAuthStateChanged((user) => {
      setAuthed(!!user);
      setAuthChecked(true);
      if (user && !user.isAnonymous) {
        void registerForPushNotifications();
      }
    });
    return unsub;
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

    // /login is now the optional "Save Your Data" link-account screen —
    // never auto-navigate there. Only gate on onboarding completion.
    if (!onboarded && !inOnboarding) {
      router.replace("/onboarding");
    } else if (onboarded && inOnboarding) {
      router.replace("/(tabs)");
    }
  }, [allReady, onboarded, segments, router]);

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

  if (!APP_CONFIG.ok) {
    return (
      <SafeAreaProvider>
        <ConfigErrorScreen missing={APP_CONFIG.missing} />
      </SafeAreaProvider>
    );
  }

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <ThemeProvider>
              <AuthProvider>
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
              </AuthProvider>
            </ThemeProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
