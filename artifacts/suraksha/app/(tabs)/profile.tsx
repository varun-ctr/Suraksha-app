import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { signOut } from "@/lib/auth";
import {
  Image,
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
import { Card } from "@/components/ui";
import {
  ACCENTS,
  THEME_LABELS,
  THEME_ORDER,
  type ThemeKey,
  withAlpha,
} from "@/constants/colors";
import type { IconName } from "@/constants/data";
import { LANG_BY_CODE } from "@/constants/languages";
import type { LangCode } from "@/constants/languages";
import { useApp } from "@/context/AppContext";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
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
  const { profile, settings, setSettings, setProfile } = useApp();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const displayName = profile.name.trim() || t("profile.guest");

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const [draftPhone, setDraftPhone] = useState(profile.phone);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [langModalVisible, setLangModalVisible] = useState(false);

  const saveProfile = () => {
    setProfile({ name: draftName.trim() || profile.name, phone: draftPhone.trim() || profile.phone });
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
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${user.id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, blob, { upsert: true, contentType: asset.mimeType ?? "image/jpeg" });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
          setProfile({ avatarUrl: publicUrl });
          try { await db.profiles.update(user.id, { avatar_url: publicUrl }); } catch { /* non-critical */ }
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
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12.5, marginTop: 1 }}>
              {profile.phone}
            </Text>
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
        {/* ── Appearance ── */}
        <Text style={styles.section}>{t("profile.appearance")}</Text>
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: c.textMuted, marginBottom: 12 }}>
            {t("profile.colorTheme")}
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 6 }}>
            {THEME_ORDER.map((k: ThemeKey) => {
              const active = themeKey === k;
              return (
                <Pressable key={k} onPress={() => setThemeKey(k)} style={{ alignItems: "center", gap: 6 }}>
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
                    }}
                  >
                    {active && <Icon name="check" size={18} color="#fff" />}
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

        {/* ── Settings ── */}
        <Text style={styles.section}>{t("profile.settings")}</Text>
        <Card style={{ marginBottom: 16, paddingVertical: 6 }}>
          <Row
            icon="bell"
            color={c.accent}
            label={t("profile.notifications")}
            right={
              <Switch
                value={settings.notifications}
                onValueChange={(v) => setSettings({ notifications: v })}
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
          <Pressable
            onPress={() => setLangModalVisible(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: withAlpha(c.police, 0.12),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
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

        {/* ── Premium card ── */}
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

        {/* ── Account ── */}
        <Text style={[styles.section, { marginTop: 16 }]}>{t("profile.account")}</Text>
        <Card style={{ paddingVertical: 6 }}>
          <Row icon="flag"       color={c.accent}  label={t("profile.myReports")} onPress={() => router.push("/my-reports" as never)} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Row icon="lock"       color={c.police}  label={t("profile.privacy")} onPress={() => router.push("/privacy")} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Row icon="fileText"   color={c.accent}  label={t("profile.terms")}   onPress={() => router.push("/terms")} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Row icon="shield"     color={c.success} label={t("profile.data")}    onPress={() => router.push("/data")} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Row icon="info"       color={c.primary} label={t("profile.about")}   onPress={() => showToast("Suraksha v1.0")} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Row icon="helpCircle" color={c.success} label={t("profile.support")} onPress={() => router.push("/helpline")} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Row icon="user"       color={c.police}  label={t("account.sessions")} onPress={() => router.push("/sessions" as never)} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Row
            icon="logOut"
            color="#E53E3E"
            label={lang === "hi" ? "साइन आउट" : "Sign out"}
            onPress={async () => {
              await signOut();
              router.replace("/login" as never);
            }}
          />
        </Card>
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
});
