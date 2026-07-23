import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { deleteAccountAndResetLocalData, signOut } from "@/features/authentication/services/authService";
import {
  disableNotificationHandler,
  enableNotificationHandler,
  getNotificationPermissionGranted,
  registerForPushNotifications,
  deregisterPushToken,
  NOTIF_TOKEN_STORAGE_KEY,
} from "@/core/permissions/notifications";
import { useApp } from "@/features/profile/context/AppContext";
import { useAuth } from "@/features/authentication/context/AuthContext";
import { useSafety } from "@/features/sos/context/SafetyContext";
import { useI18n } from "@/features/settings/context/LanguageContext";
import { useToast } from "@/features/settings/context/ToastContext";
import { firebaseAuth } from "@/repositories/firebase/firebaseClient";
import { db, supabase } from "@/repositories/supabase/supabaseClient";

/** All state and handlers for the profile screen: edit, avatar upload, notification toggle, account deletion. */
export function useProfileScreen() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { profile, settings, setProfile, setSettings, resetAllData } = useApp();
  const { showToast } = useToast();
  const { user: authUser, isAnon } = useAuth();
  const { sos, cancelSOS, journey, endJourney } = useSafety();

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const [draftPhone, setDraftPhone] = useState(profile.phone);
  const [draftEmail, setDraftEmail] = useState(profile.email);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [langModalVisible, setLangModalVisible] = useState(false);

  // Account link status
  const [userAnonymous, setUserAnonymous] = useState<boolean | null>(null);
  const [linkedEmail, setLinkedEmail] = useState<string | null>(null);

  useEffect(() => {
    setUserAnonymous(isAnon);
    setLinkedEmail(authUser?.email ?? null);
  }, [authUser, isAnon]);

  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const openEditProfile = () => {
    setDraftName(profile.name);
    setDraftPhone(profile.phone);
    setDraftEmail(profile.email);
    setEditing(true);
  };

  const saveProfile = () => {
    setProfile({
      name: draftName.trim() || profile.name,
      phone: draftPhone.trim() || profile.phone,
      email: draftEmail.trim(),
    });
    setEditing(false);
    showToast(t("common.done"));
  };

  const uploadAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setUploadingPhoto(true);

      // Try Supabase Storage upload if signed in
      const user = firebaseAuth.currentUser;
      if (user) {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${user.uid}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, blob, { upsert: true, contentType: asset.mimeType ?? "image/jpeg" });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
          setProfile({ avatarUrl: publicUrl });
          try { await db.profiles.update(user.uid, { avatar_url: publicUrl }); } catch { /* non-critical */ }
          showToast(t("common.done"));
          return;
        }
      }
      // Fallback: save local URI (offline or not signed in)
      setProfile({ avatarUrl: asset.uri });
      showToast(t("common.done"));
    } catch {
      showToast(lang === "hi" ? "फ़ोटो अपलोड नहीं हो सकी" : "Could not update photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Sync toggle with real OS permission on mount ─────────────────
  useEffect(() => {
    void (async () => {
      const granted = await getNotificationPermissionGranted();
      if (!granted && settings.notifications) {
        setSettings({ notifications: false });
      }
    })();
    // Run once on mount — settings.notifications intentionally excluded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNotificationsToggle = async (v: boolean) => {
    if (v) {
      enableNotificationHandler();
      const result = await registerForPushNotifications();
      if (!result.ok && result.denied) {
        showToast(t("profile.notificationDenied"));
        return;
      }
      if (result.ok) {
        await AsyncStorage.setItem(NOTIF_TOKEN_STORAGE_KEY, result.token).catch(() => {});
      }
    } else {
      disableNotificationHandler();
      await deregisterPushToken();
    }
    setSettings({ notifications: v });
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login" as never);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      // Tear down any active safety session before deleting the account —
      // its backend rows (sos_events, live_sessions) are about to be wiped
      // by deleteAccountAndResetLocalData below, so the in-memory tracking
      // state (location watch, live-session share) must not keep running
      // against data that no longer exists. Deliberately explicit here
      // rather than tied to auth-state changes in general: SafetyContext's
      // tracking must never stop on its own just because of an unrelated
      // sign-out/session hiccup (a dangerous behavior for a safety app) —
      // this is scoped to the one case where the user has explicitly chosen
      // to delete their account.
      if (sos.phase !== "idle") cancelSOS();
      if (journey.active) endJourney();

      const { error } = await deleteAccountAndResetLocalData(resetAllData);
      if (error) {
        showToast(error);
        return;
      }
      setDeleteStep(0);
      router.replace("/onboarding" as never);
    } catch {
      showToast(lang === "hi" ? "खाता नहीं हटा सका — पुनः प्रयास करें" : "Could not delete account — try again");
    } finally {
      setDeleting(false);
    }
  };

  return {
    editing, setEditing, draftName, setDraftName, draftPhone, setDraftPhone, draftEmail, setDraftEmail, uploadingPhoto,
    langModalVisible, setLangModalVisible,
    userAnonymous, linkedEmail,
    deleteStep, setDeleteStep, deleteText, setDeleteText, deleting,
    openEditProfile, saveProfile, uploadAvatar, handleNotificationsToggle, handleSignOut, handleDeleteAccount,
  };
}
