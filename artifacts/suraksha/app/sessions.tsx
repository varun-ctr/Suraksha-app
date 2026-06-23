import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BackHeader } from "@/components/Headers";
import { Icon } from "@/components/Icon";
import { withAlpha } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { deleteAccount, getCurrentUser, signOut, signOutGlobal } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";

function timeAgoShort(isoDate: string | undefined): string {
  if (!isoDate) return "—";
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function SessionsScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { resetAllData } = useApp();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Delete-account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"warn" | "confirm">("warn");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const handleSignOutAll = () => {
    Alert.alert(
      t("account.signOutAllConfirm"),
      t("account.signOutAllBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("account.signOutAll"),
          style: "destructive",
          onPress: async () => {
            setSigningOut(true);
            await signOutGlobal();
            setSigningOut(false);
            router.replace("/login" as never);
          },
        },
      ],
    );
  };

  const openDeleteModal = () => {
    setDeleteStep("warn");
    setConfirmText("");
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    const { error } = await deleteAccount();
    if (error) {
      setDeleting(false);
      showToast(error);
      return;
    }
    await signOut();
    await resetAllData();
    setDeleting(false);
    setShowDeleteModal(false);
    router.replace("/login" as never);
  };

  const identifier = user?.email ?? user?.phone ?? "—";
  const method = user?.email ? "email" : user?.phone ? "phone" : "—";

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title={t("account.sessions")} subtitle={t("account.sessionsSub")} />

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Current session info */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <View style={[styles.iconWrap, { backgroundColor: withAlpha(c.primary, 0.12) }]}>
              <Icon name="user" size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: c.textMuted }}>{t("account.signedInAs")}</Text>
              <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.text }} numberOfLines={1}>
                {identifier}
              </Text>
            </View>
          </View>

          <View style={[styles.row, { borderTopColor: c.border }]}>
            <Icon name="lock" size={14} color={c.textMuted} />
            <Text style={{ fontSize: 12.5, color: c.textMuted }}>
              Signed in via {method}
            </Text>
          </View>
          <View style={[styles.row, { borderTopColor: c.border }]}>
            <Icon name="clock" size={14} color={c.textMuted} />
            <Text style={{ fontSize: 12.5, color: c.textMuted }}>
              {t("account.lastSignIn")}: {timeAgoShort(user?.last_sign_in_at)}
            </Text>
          </View>
        </View>

        {/* Sign out all devices */}
        <Pressable
          onPress={handleSignOutAll}
          disabled={signingOut}
          style={[
            styles.actionBtn,
            { backgroundColor: c.card, borderColor: c.border, opacity: signingOut ? 0.7 : 1 },
          ]}
        >
          {signingOut ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : (
            <Icon name="logOut" size={18} color={c.primary} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text }}>
              {t("account.signOutAll")}
            </Text>
            <Text style={{ fontSize: 11.5, color: c.textMuted, marginTop: 1 }}>
              You'll be signed out on all your devices.
            </Text>
          </View>
          <Icon name="chevronRight" size={16} color={c.textFaint} />
        </Pressable>

        {/* Danger zone */}
        <Text style={[styles.section, { color: c.danger, marginTop: 22 }]}>Danger zone</Text>
        <Pressable
          onPress={openDeleteModal}
          style={[
            styles.actionBtn,
            {
              backgroundColor: withAlpha(c.danger, 0.06),
              borderColor: withAlpha(c.danger, 0.3),
            },
          ]}
        >
          <Icon name="trash" size={18} color={c.danger} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.danger }}>
              {t("account.deleteAccount")}
            </Text>
            <Text style={{ fontSize: 11.5, color: c.textMuted, marginTop: 1 }}>
              {t("account.deleteAccountSub")}
            </Text>
          </View>
          <Icon name="chevronRight" size={16} color={c.textFaint} />
        </Pressable>
      </ScrollView>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }]}
          onPress={() => !deleting && setShowDeleteModal(false)}
        >
          <Pressable
            style={[styles.modalSheet, { backgroundColor: c.card }]}
            onPress={() => {}}
          >
            {deleteStep === "warn" ? (
              <>
                <View style={[styles.dangerIcon, { backgroundColor: withAlpha(c.danger, 0.12) }]}>
                  <Icon name="alert" size={26} color={c.danger} />
                </View>
                <Text style={[styles.modalTitle, { color: c.text }]}>
                  {t("account.deleteAccount")}
                </Text>
                <Text style={[styles.modalBody, { color: c.textMuted }]}>
                  {t("account.deleteWarning")}
                </Text>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                  <Pressable
                    onPress={() => setShowDeleteModal(false)}
                    style={[styles.modalBtn, { backgroundColor: c.cardAlt }]}
                  >
                    <Text style={{ color: c.text, fontFamily: "Inter_700Bold", fontSize: 13.5 }}>
                      {t("common.cancel")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDeleteStep("confirm")}
                    style={[styles.modalBtn, { backgroundColor: c.danger }]}
                  >
                    <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13.5 }}>
                      Continue
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.modalTitle, { color: c.text }]}>
                  {t("account.deleteAccount")}
                </Text>
                <Text style={[styles.modalBody, { color: c.textMuted }]}>
                  {t("account.deleteTypePrompt")}
                </Text>
                <TextInput
                  value={confirmText}
                  onChangeText={setConfirmText}
                  placeholder="DELETE"
                  placeholderTextColor={c.textFaint}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={[
                    styles.confirmInput,
                    {
                      backgroundColor: c.cardAlt,
                      color: c.text,
                      borderColor: confirmText === "DELETE" ? c.danger : c.border,
                    },
                  ]}
                />
                <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                  <Pressable
                    onPress={() => { setDeleteStep("warn"); setConfirmText(""); }}
                    disabled={deleting}
                    style={[styles.modalBtn, { backgroundColor: c.cardAlt }]}
                  >
                    <Text style={{ color: c.text, fontFamily: "Inter_700Bold", fontSize: 13.5 }}>
                      {t("common.cancel")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleConfirmDelete}
                    disabled={confirmText !== "DELETE" || deleting}
                    style={[
                      styles.modalBtn,
                      {
                        backgroundColor: c.danger,
                        opacity: confirmText === "DELETE" && !deleting ? 1 : 0.45,
                      },
                    ]}
                  >
                    {deleting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13.5 }}>
                        {t("account.deleteConfirmBtn")}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  section: { fontSize: 12, fontFamily: "Inter_700Bold", marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    alignItems: "center",
  },
  dangerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 8, textAlign: "center" },
  modalBody: { fontSize: 13, lineHeight: 19, textAlign: "center", marginBottom: 4 },
  modalBtn: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 12 },
  confirmInput: {
    width: "100%",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 2,
    marginTop: 10,
  },
});
