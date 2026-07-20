import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteAccountAndResetLocalData, signOut } from "@/lib/auth";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { LanguagePicker } from "@/components/LanguagePicker";
import {
  disableNotificationHandler,
  enableNotificationHandler,
  getNotificationPermissionGranted,
  registerForPushNotifications,
} from "@/lib/notifications";
import { Card, SectionTitle } from "@/components/ui";
import {
  ACCENTS,
  isPremiumTheme,
  THEME_LABELS,
  THEME_ORDER,
  type ThemeKey,
  withAlpha,
} from "@/constants/colors";
import type { IconName } from "@/constants/data";
import { LANG_BY_CODE } from "@/constants/languages";
import type { LangCode } from "@/constants/languages";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { firebaseAuth } from "@/lib/firebase";
import { db, supabase } from "@/lib/supabaseClient";

function Row({
  icon,
  color,
  label,
  right,
  onPress,
}: {
  icon: IconName;
  color: string;
  label: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: withAlpha(color, 0.12),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={16} color={color} />
      </View>
      <Text style={{ flex: 1, fontSize: 13.5, fontFamily: "Inter_600SemiBold", color: c.text }}>
        {label}
      </Text>
      {right ?? <Icon name="chevronRight" size={16} color={c.textFaint} />}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { c, themeKey, setThemeKey, isDark, setMode } = useTheme();
  const { t, lang, setLang, pick } = useI18n();
  const { profile, settings, setSettings, setProfile, resetAllData } = useApp();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { user: authUser, isAnon } = useAuth();
  const displayName = profile.name.trim() || t("profile.guest");

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

  const currentLangMeta = LANG_BY_CODE[lang];

  const NOTIF_TOKEN_KEY = "suraksha.notif.token";

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
        await AsyncStorage.setItem(NOTIF_TOKEN_KEY, result.token).catch(() => {});
      }
    } else {
      disableNotificationHandler();
      await AsyncStorage.removeItem(NOTIF_TOKEN_KEY).catch(() => {});
      try {
        const user = firebaseAuth.currentUser;
        if (user) await db.notificationTokens.deleteForUser(user.uid);
      } catch {
        // Non-critical
      }
    }
    setSettings({ notifications: v });
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[c.primary, c.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 18, paddingHorizontal: 18, paddingBottom: 26 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          {/* Avatar — tap to change photo */}
          <Pressable onPress={uploadAvatar} disabled={uploadingPhoto} style={styles.bigAvatarWrap}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.bigAvatarImg} />
            ) : (
              <Text style={{ color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold" }}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            )}
            {/* Camera overlay badge */}
            <View style={styles.cameraBadge}>
              <Icon name="camera" size={11} color="#fff" />
            </View>
          </Pressable>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" }} numberOfLines={1}>
              {displayName}
            </Text>
            {profile.phone ? (
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12.5, marginTop: 1 }}>
                {profile.phone}
              </Text>
            ) : null}
            {profile.email ? (
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 1 }}>
                {profile.email}
              </Text>
            ) : null}
            {profile.premium && (
              <View style={styles.premiumBadge}>
                <Icon name="crown" size={12} color="#FFD66B" />
                <Text style={{ color: "#FFD66B", fontSize: 11, fontFamily: "Inter_700Bold" }}>
                  {t("profile.premiumMember")}
                </Text>
              </View>
            )}
          </View>
          <Pressable
            onPress={() => {
              setDraftName(profile.name);
              setDraftPhone(profile.phone);
              setDraftEmail(profile.email);
              setEditing(true);
            }}
            hitSlop={10}
            style={styles.editBtn}
          >
            <Icon name="edit" size={16} color="#fff" />
          </Pressable>
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 18, marginTop: 16 }}>

        {/* ── Account link card ── */}
        {userAnonymous === true && (
          <Pressable
            onPress={() => router.push("/login" as never)}
            style={[styles.accountCard, { backgroundColor: withAlpha(c.accent, 0.08), borderColor: withAlpha(c.accent, 0.22) }]}
          >
            <View style={[styles.accountIcon, { backgroundColor: withAlpha(c.accent, 0.14) }]}>
              <Icon name="shield" size={18} color={c.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.text }}>
                Back up your data
              </Text>
              <Text style={{ fontSize: 11.5, color: c.textMuted, marginTop: 1 }}>
                Link an email to save your contacts & settings
              </Text>
            </View>
            <Icon name="chevronRight" size={16} color={c.textFaint} />
          </Pressable>
        )}

        {userAnonymous === false && linkedEmail && (
          <View
            style={[styles.accountCard, { backgroundColor: withAlpha(c.success, 0.08), borderColor: withAlpha(c.success, 0.22) }]}
          >
            <View style={[styles.accountIcon, { backgroundColor: withAlpha(c.success, 0.14) }]}>
              <Icon name="check" size={18} color={c.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.text }}>
                Account linked ✓
              </Text>
              <Text style={{ fontSize: 11.5, color: c.textMuted, marginTop: 1 }} numberOfLines={1}>
                {linkedEmail}
              </Text>
            </View>
          </View>
        )}

        {/* ── Language ── */}
        <SectionTitle>{t("profile.language")}</SectionTitle>
        <Card style={{ marginBottom: 16, paddingVertical: 6 }}>
          <Pressable
            onPress={() => setLangModalVisible(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: withAlpha(c.police, 0.12), alignItems: "center", justifyContent: "center" }}>
              <Icon name="globe" size={16} color={c.police} />
            </View>
            <Text style={{ flex: 1, fontSize: 13.5, fontFamily: "Inter_600SemiBold", color: c.text }}>
              {t("profile.language")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 18 }}>{currentLangMeta?.flag ?? "🌐"}</Text>
              <Text style={{ fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: c.textMuted }}>
                {currentLangMeta?.nativeName ?? lang}
              </Text>
              <Icon name="chevronRight" size={14} color={c.textFaint} />
            </View>
          </Pressable>
        </Card>

        {/* ── Notifications ── */}
        <SectionTitle top={4}>{t("profile.notifications")}</SectionTitle>
        <Card style={{ marginBottom: 16, paddingVertical: 6 }}>
          <Row
            icon="bell"
            color={c.accent}
            label={t("profile.notifications")}
            right={
              <Switch
                value={settings.notifications}
                onValueChange={handleNotificationsToggle}
                trackColor={{ true: c.primary, false: c.border }}
                thumbColor="#fff"
              />
            }
          />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Row
            icon="mapPin"
            color={c.success}
            label={t("profile.bgLocation")}
            right={
              <Switch
                value={settings.bgLocation}
                onValueChange={(v) => setSettings({ bgLocation: v })}
                trackColor={{ true: c.primary, false: c.border }}
                thumbColor="#fff"
              />
            }
          />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Row
            icon="zap"
            color={c.danger}
            label={t("profile.shakeToSos")}
            right={
              <Switch
                value={settings.shakeToSos}
                onValueChange={(v) => setSettings({ shakeToSos: v })}
                trackColor={{ true: c.primary, false: c.border }}
                thumbColor="#fff"
              />
            }
          />
        </Card>

        {/* ── Appearance ── */}
        <SectionTitle top={4}>{t("profile.appearance")}</SectionTitle>
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: c.textMuted, marginBottom: 12 }}>
            {t("profile.colorTheme")}
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 6 }}>
            {THEME_ORDER.map((k: ThemeKey) => {
              const active = themeKey === k;
              // Premium colour themes are locked for free users — tapping one
              // opens the paywall instead of applying it. Purely cosmetic gating.
              const locked = isPremiumTheme(k) && !profile.premium;
              return (
                <Pressable
                  key={k}
                  onPress={() => (locked ? router.push("/premium") : setThemeKey(k))}
                  style={{ alignItems: "center", gap: 6 }}
                >
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      backgroundColor: ACCENTS[k].primary,
                      borderWidth: active ? 3 : 0,
                      borderColor: c.text,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: locked ? 0.55 : 1,
                    }}
                  >
                    {active && <Icon name="check" size={18} color="#fff" />}
                    {locked && !active && <Icon name="crown" size={16} color="#fff" />}
                  </View>
                  <Text style={{ fontSize: 11, color: c.textMuted, fontFamily: "Inter_500Medium" }}>
                    {pick(THEME_LABELS[k])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Row
            icon={isDark ? "moon" : "sun"}
            color={c.primary}
            label={t("profile.darkMode")}
            right={
              <Switch
                value={isDark}
                onValueChange={(v) => setMode(v ? "dark" : "light")}
                trackColor={{ true: c.primary, false: c.border }}
                thumbColor="#fff"
              />
            }
          />
        </Card>

        {/* ── Privacy ── */}
        <SectionTitle top={4}>{t("profile.privacy")}</SectionTitle>
        <Card style={{ marginBottom: 16, paddingVertical: 6 }}>
          <Row icon="lock"     color={c.police}  label={t("profile.privacy")} onPress={() => router.push("/privacy")} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Row icon="fileText" color={c.accent}  label={t("profile.terms")}   onPress={() => router.push("/terms")} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Row icon="shield"   color={c.success} label={t("profile.data")}    onPress={() => router.push("/data")} />
        </Card>

        {/* ── Security ── */}
        <SectionTitle top={4}>{t("profile.security")}</SectionTitle>
        <Card style={{ marginBottom: 16, paddingVertical: 6 }}>
          <Row icon="user" color={c.police} label={t("account.sessions")} onPress={() => router.push("/sessions" as never)} />
        </Card>

        {/* ── Subscription ── */}
        <SectionTitle top={4}>{t("profile.subscription")}</SectionTitle>
        <Pressable onPress={() => router.push("/premium")}>
          <LinearGradient
            colors={[c.accent, c.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumCard}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Icon name="crown" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>
                  {t("profile.premium")}
                </Text>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11.5, marginTop: 3 }}>
                {t("premium.sub")}
              </Text>
            </View>
            <Icon name="chevronRight" size={18} color="#fff" />
          </LinearGradient>
        </Pressable>

        {/* ── Support ── */}
        <SectionTitle top={16}>{t("profile.support")}</SectionTitle>
        <Card style={{ marginBottom: 16, paddingVertical: 6 }}>
          <Row icon="helpCircle" color={c.success} label={t("profile.support")}   onPress={() => Linking.openURL("mailto:support@suraksha.in")} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Row icon="flag"       color={c.accent}  label={t("profile.myReports")} onPress={() => router.push({ pathname: "/(tabs)/incident", params: { tab: "mine" } } as never)} />
        </Card>

        {/* ── About ── */}
        <SectionTitle top={4}>{t("profile.about")}</SectionTitle>
        <Card style={{ marginBottom: 16, paddingVertical: 6 }}>
          <Row
            icon="info"
            color={c.primary}
            label={t("profile.about")}
            right={<Text style={{ fontSize: 12, color: c.textMuted, fontFamily: "Inter_500Medium" }}>v1.0</Text>}
            onPress={() => Linking.openURL("https://suraksha.in")}
          />
        </Card>

        {/* ── Logout ── */}
        <Card style={{ marginBottom: 4, paddingVertical: 6 }}>
          <Row
            icon="logOut"
            color={c.danger}
            label={lang === "hi" ? "साइन आउट" : "Sign out"}
            onPress={async () => {
              await signOut();
              router.replace("/login" as never);
            }}
          />
        </Card>

        {/* ── Delete Account danger card ── */}
        <Pressable
          onPress={() => { setDeleteText(""); setDeleteStep(1); }}
          style={[styles.dangerCard, { backgroundColor: withAlpha(c.danger, 0.06), borderColor: withAlpha(c.danger, 0.2) }]}
        >
          <View style={[styles.dangerIcon, { backgroundColor: withAlpha(c.danger, 0.1) }]}>
            <Icon name="trash" size={18} color={c.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.danger }}>
              {t("profile.deleteAccount")}
            </Text>
            <Text style={{ fontSize: 11.5, color: withAlpha(c.danger, 0.7), marginTop: 1 }}>
              {t("profile.deleteAccountSub")}
            </Text>
          </View>
          <Icon name="chevronRight" size={16} color={withAlpha(c.danger, 0.4)} />
        </Pressable>
      </View>

      {/* ── Edit profile modal ── */}
      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <Pressable style={[styles.modalBg, { backgroundColor: c.overlay }]} onPress={() => setEditing(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: c.card }]} onPress={() => {}}>
            <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.text, marginBottom: 14 }}>
              {t("profile.editName")}
            </Text>
            <Text style={[styles.label, { color: c.textMuted }]}>{t("common.name")}</Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              style={[styles.input, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border }]}
              placeholderTextColor={c.textFaint}
            />
            <Text style={[styles.label, { color: c.textMuted, marginTop: 10 }]}>{t("contacts.phone")}</Text>
            <TextInput
              value={draftPhone}
              onChangeText={setDraftPhone}
              keyboardType="phone-pad"
              style={[styles.input, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border }]}
              placeholderTextColor={c.textFaint}
            />
            <Text style={[styles.label, { color: c.textMuted, marginTop: 10 }]}>Email</Text>
            <TextInput
              value={draftEmail}
              onChangeText={setDraftEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.input, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border }]}
              placeholderTextColor={c.textFaint}
              placeholder="you@example.com"
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <Pressable onPress={() => setEditing(false)} style={[styles.modalBtn, { backgroundColor: c.cardAlt }]}>
                <Text style={{ color: c.text, fontFamily: "Inter_700Bold", fontSize: 13.5 }}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable onPress={saveProfile} style={[styles.modalBtn, { backgroundColor: c.primary }]}>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13.5 }}>{t("common.save")}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Delete Account 2-step modal ── */}
      <Modal
        visible={deleteStep > 0}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!deleting) setDeleteStep(0); }}
      >
        <Pressable
          style={[styles.modalBg, { backgroundColor: c.overlay }]}
          onPress={() => { if (!deleting) setDeleteStep(0); }}
        >
          <Pressable style={[styles.modalCard, { backgroundColor: c.card }]} onPress={() => {}}>
            {deleteStep === 1 ? (
              <>
                <View style={[styles.dangerIcon, { backgroundColor: withAlpha(c.danger, 0.1), alignSelf: "center", marginBottom: 14, width: 52, height: 52, borderRadius: 26 }]}>
                  <Icon name="trash" size={24} color={c.danger} />
                </View>
                <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: c.danger, textAlign: "center", marginBottom: 10 }}>
                  {t("profile.deleteAccount")}
                </Text>
                <Text style={{ fontSize: 13, color: c.textMuted, lineHeight: 20, textAlign: "center", marginBottom: 20 }}>
                  {t("account.deleteWarning")}
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable onPress={() => setDeleteStep(0)} style={[styles.modalBtn, { backgroundColor: c.cardAlt }]}>
                    <Text style={{ color: c.text, fontFamily: "Inter_700Bold", fontSize: 13.5 }}>{t("common.cancel")}</Text>
                  </Pressable>
                  <Pressable onPress={() => setDeleteStep(2)} style={[styles.modalBtn, { backgroundColor: c.danger }]}>
                    <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13.5 }}>Continue</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.text, marginBottom: 6 }}>
                  {t("account.deleteTypePrompt")}
                </Text>
                <Text style={{ fontSize: 12.5, color: c.textMuted, marginBottom: 14 }}>
                  {t("account.deleteAccountSub")}
                </Text>
                <TextInput
                  value={deleteText}
                  onChangeText={setDeleteText}
                  placeholder="DELETE"
                  placeholderTextColor={c.textFaint}
                  autoCapitalize="characters"
                  style={[styles.input, { backgroundColor: c.cardAlt, color: c.danger, borderColor: withAlpha(c.danger, 0.3), fontFamily: "Inter_700Bold", fontSize: 15, letterSpacing: 2 }]}
                />
                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  <Pressable onPress={() => setDeleteStep(1)} disabled={deleting} style={[styles.modalBtn, { backgroundColor: c.cardAlt }]}>
                    <Text style={{ color: c.text, fontFamily: "Inter_700Bold", fontSize: 13.5 }}>{t("common.cancel")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDeleteAccount}
                    disabled={deleteText !== "DELETE" || deleting}
                    style={[styles.modalBtn, { backgroundColor: deleteText === "DELETE" ? c.danger : withAlpha(c.danger, 0.3) }]}
                  >
                    {deleting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13.5 }}>{t("account.deleteConfirmBtn")}</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Language picker modal ── */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <Pressable
          style={[styles.langModalBg, { backgroundColor: c.overlay }]}
          onPress={() => setLangModalVisible(false)}
        >
          <Pressable
            style={[styles.langModalSheet, { backgroundColor: c.card }]}
            onPress={() => {}}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", color: c.text }}>
                {t("profile.language")}
              </Text>
              <Pressable onPress={() => setLangModalVisible(false)} hitSlop={10}>
                <Icon name="x" size={20} color={c.textMuted} />
              </Pressable>
            </View>
            <LanguagePicker
              selected={lang}
              onSelect={(code: LangCode) => {
                setLang(code);
                setLangModalVisible(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bigAvatarWrap: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bigAvatarImg: { width: 66, height: 66, borderRadius: 33 },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 6,
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  section: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 8, color: "#8A7FA6" },
  dangerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  dangerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  premiumCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
  },
  modalBg: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  modalCard: { width: "100%", borderRadius: 18, padding: 20 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  modalBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12 },
  langModalBg: { flex: 1, justifyContent: "flex-end" },
  langModalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 36,
    maxHeight: "85%",
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    minHeight: 44,
  },
  accountIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
