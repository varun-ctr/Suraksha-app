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
import React, { useEffect, useRef, useState } from "react";
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
import { AuthProvider, useAuth } from "@/features/authentication/context/AuthContext";
import { useAppLock } from "@/features/security/hooks/useAppLock";
import { AppLockScreen } from "@/features/security/components/AppLockScreen";
import { initFirebase } from "@/repositories/firebase/firebaseClient";
import { registerForPushNotifications } from "@/core/permissions/notifications";
// Importing ACTIVE_SHARE_ID_KEY below still triggers this module's
// side-effect-registered TaskManager task at load time (module-level code
// always runs on first import, regardless of which export is named) — see
// core/permissions/backgroundLocation.ts. Must be imported somewhere that
// always loads on app start, not lazily from a component, so the task
// survives a background app relaunch.
import { ACTIVE_SHARE_ID_KEY } from "@/core/permissions/backgroundLocation";
import { initSupabase } from "@/repositories/supabase/supabaseClient";
import { validateConfig } from "@/core/config/config";
import { migrateLegacyPlaintextKeys } from "@/core/storage/secureStorageMigration";
import { PENDING_ACTIVATION_KEY } from "@/features/sos/services/sosOfflineQueue";
import { ACTIVE_JOURNEY_KEY } from "@/features/journey/services/journeyPersistence";
import { initCrashReporting, reportError } from "@/core/analytics/crashReporting";
import {
  installCrashBeforeRenderHandler,
  markRenderConfirmed,
  trackStartupEvent,
  getElapsedSinceStart,
} from "@/core/analytics/startupTelemetry";

installCrashBeforeRenderHandler();
trackStartupEvent("app_launch");

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
} else {
  trackStartupEvent("startup_failure", { reason: "missing_config", durationMs: getElapsedSinceStart() });
}

// One-time, best-effort encryption of any safety-sensitive records still
// sitting in plaintext from before this pass — see
// core/storage/secureStorageMigration.ts. Fire-and-forget: never blocks
// startup, and each key's own lazy migration (encrypt-on-next-write) is
// still a safety net if this hasn't finished before that key is read/written.
void migrateLegacyPlaintextKeys([PENDING_ACTIVATION_KEY, ACTIVE_JOURNEY_KEY, ACTIVE_SHARE_ID_KEY]);

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
  const { ready: appReady, onboarded, settings } = useApp();
  const { ready: themeReady } = useTheme();
  const { ready: langReady } = useI18n();
  const { showToast } = useToast();
  const router = useRouter();
  const segments = useSegments();

  // Derived from the single canonical auth-state subscription in
  // AuthContext (which now also owns the "never fired" safety timeout that
  // used to be duplicated here) rather than a second, redundant
  // onFirebaseAuthStateChanged listener — see docs/adr/0001, performance notes.
  const { user, loading: authLoading } = useAuth();
  const authChecked = !authLoading;

  // Opt-in app lock (default off — see AppContext's Settings.appLockEnabled),
  // wiring the existing core/permissions/biometrics.ts capability into a
  // real cold-start/resume gate. Called unconditionally (hook rules) even
  // before `allReady`; it has no observable effect until settings finish
  // loading and `appLockEnabled` is true — see features/security/hooks/useAppLock.ts.
  const { locked, biometricsAvailable, biometricType, unlock } = useAppLock(settings.appLockEnabled, appReady);

  useEffect(() => {
    if (user && !user.isAnonymous) {
      void registerForPushNotifications();
    }
  }, [user]);

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

  // Guards each event below to fire exactly once per app launch, no matter
  // how many times Gate re-renders while readiness flags settle.
  const splashHiddenRef = useRef(false);
  const navigationReadyRef = useRef(false);

  useEffect(() => {
    if (allReady && !splashHiddenRef.current) {
      splashHiddenRef.current = true;
      trackStartupEvent("startup_complete", { durationMs: getElapsedSinceStart() });
      markRenderConfirmed();
      SplashScreen.hideAsync();
    }
  }, [allReady]);

  useEffect(() => {
    if (!allReady) return;
    if (!navigationReadyRef.current) {
      navigationReadyRef.current = true;
      trackStartupEvent("navigation_ready", { durationMs: getElapsedSinceStart() });
    }
    const seg0 = segments[0] as string;
    const inOnboarding = seg0 === "onboarding";

    if (!onboarded && !inOnboarding) {
      router.replace("/onboarding");
    } else if (onboarded && inOnboarding) {
      router.replace("/(tabs)");
    }
  }, [allReady, onboarded, segments, router]);

  if (!allReady) return null;

  if (locked) {
    return <AppLockScreen biometricType={biometricType} biometricsAvailable={biometricsAvailable} onUnlock={unlock} />;
  }

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
    const t = setTimeout(() => {
      trackStartupEvent("startup_failure", { reason: "fonts_timed_out", durationMs: getElapsedSinceStart() });
      setFontsTimedOut(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError]);

  // Gate never mounts on this path (it's the only place that otherwise calls
  // SplashScreen.hideAsync()), so without this the native splash would stay
  // on top of ConfigErrorScreen forever on a misconfigured build — found
  // during the startup audit, see docs/startup-audit/technical-debt-report.md.
  useEffect(() => {
    if (!APP_CONFIG.ok) SplashScreen.hideAsync();
  }, []);

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
