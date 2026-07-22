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

import { ConfigErrorScreen } from "@/shared/components/ConfigErrorScreen";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { DependencyProvider } from "@/core/di/DependencyProvider";
import { AppProvider, useApp } from "@/features/profile/context/AppContext";
import { BookmarksProvider } from "@/features/community/context/BookmarksContext";
import { LanguageProvider, useI18n } from "@/features/settings/context/LanguageContext";
import { SafetyProvider } from "@/features/sos/context/SafetyContext";
import { ThemeProvider, useTheme } from "@/shared/theme/ThemeContext";
import { ToastProvider, useToast } from "@/features/settings/context/ToastContext";
import { AuthProvider } from "@/features/authentication/context/AuthContext";
import { initFirebase } from "@/repositories/firebase/firebaseClient";
import { onFirebaseAuthStateChanged } from "@/repositories/firebase/firebaseAuth";
import { registerForPushNotifications } from "@/core/permissions/notifications";
import { initSupabase } from "@/repositories/supabase/supabaseClient";
import { validateConfig } from "@/core/config/config";
import { initCrashReporting, reportError } from "@/core/analytics/crashReporting";

const APP_CONFIG = validateConfig();

initCrashReporting();

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
      <Stack.Screen name="walkthrough" />
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
    // Safety timeout: if Firebase auth state never fires within 6s
    // (e.g. cold-start network delay in Expo Go), proceed anyway so the
    // splash screen doesn't stay forever.
    const authTimeout = setTimeout(() => {
      setAuthChecked(true);
    }, 6000);

    const unsub = onFirebaseAuthStateChanged((user) => {
      clearTimeout(authTimeout);
      setAuthed(!!user);
      setAuthChecked(true);
      if (user && !user.isAnonymous) {
        void registerForPushNotifications();
      }
    });

    return () => {
      unsub();
      clearTimeout(authTimeout);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;

    void (async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (response) {
        const route = (response.notification.request.content.data as Record<string, unknown>)?.route;
        if (typeof route === "string" && route) router.push(route as never);
      }
    })();

    const tokenSub = Notifications.addPushTokenListener(async ({ data: token }) => {
      if (!token) return;
      await registerForPushNotifications();
    });

    const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
      const title = notification.request.content.title ?? "";
      const body = notification.request.content.body ?? "";
      const msg = [title, body].filter(Boolean).join(" — ");
      if (msg) showToast(msg);
    });

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

  // ── Font-loading safety net ────────────────────────────────────────────────
  // In Expo Go dev mode fonts are fetched over the local network. If the fetch
  // stalls (slow connection, proxy lag) `fontsLoaded` stays false and
  // `fontError` stays null — freezing the splash screen forever.
  // After 4 s we give up waiting and render with system fonts instead.
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const t = setTimeout(() => setFontsTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError]);

  if (!APP_CONFIG.ok) {
    return (
      <SafeAreaProvider>
        <ConfigErrorScreen missing={APP_CONFIG.missing} />
      </SafeAreaProvider>
    );
  }

  if (!fontsLoaded && !fontError && !fontsTimedOut) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary onError={reportError}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <DependencyProvider>
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
            </DependencyProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
