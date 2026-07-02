import * as Contacts from "expo-contacts";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BackHeader } from "@/components/Headers";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/ui";
import { withAlpha } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { Contact } from "@/context/AppContext";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { callNumber } from "@/lib/native";
import { firebaseAuth } from "@/lib/firebase";
import { supabase } from "@/lib/supabaseClient";

export default function ContactsScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { contacts, addContact, addContacts, editContact, deleteContact, maxContacts } = useApp();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [importing, setImporting] = useState(false);

  // Edit sheet state
  const [editTarget, setEditTarget] = useState<Contact | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const atLimit = contacts.length >= maxContacts;

  const onAdd = () => {
    if (!name.trim() || !phone.trim()) return;
    const res = addContact(name.trim(), phone.trim());
    if (!res.ok) {
      if (res.error === "limit") {
        showToast(t("contacts.limitReached"));
      } else if (res.error === "duplicate") {
        showToast(t("contacts.duplicate"));
      } else {
        showToast(t("contacts.invalid"));
      }
      return;
    }
    setName("");
    setPhone("");
    showToast(t("contacts.added"));
  };

  const onImport = async () => {
    setImporting(true);
    try {
      const picked = await Contacts.presentContactPickerAsync();
      if (!picked) return;
      const phoneNumber = picked.phoneNumbers?.[0]?.number;
      if (!phoneNumber) {
        showToast(t("contacts.import"));
        return;
      }
      // Pre-fill the add form so the user can review/edit before confirming
      setName(picked.name ?? "");
      setPhone(phoneNumber.replace(/\s/g, ""));
    } catch {
      showToast(t("contacts.import"));
    } finally {
      setImporting(false);
    }
  };

  const openEdit = (contact: Contact) => {
    setEditTarget(contact);
    setDraftName(contact.name);
    setDraftPhone(contact.phone);
  };

  const closeEdit = () => {
    setEditTarget(null);
    setDraftName("");
    setDraftPhone("");
  };

  const saveEdit = () => {
    if (!editTarget) return;
    const res = editContact(editTarget.id, { name: draftName, phone: draftPhone });
    if (!res.ok) {
      showToast(res.error === "duplicate" ? t("contacts.duplicate") : t("contacts.invalid"));
      return;
    }
    showToast(t("contacts.saved"));
    closeEdit();
  };

  const handleDelete = (id: string) => {
    deleteContact(id);
    showToast(t("contacts.removed"));
    closeEdit();
  };

  const pickPhoto = (contactId: string) => {
    const launch = async (mode: "camera" | "library") => {
      setUploadingPhoto(true);
      try {
        const result =
          mode === "camera"
            ? await ImagePicker.launchCameraAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.75,
              })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.75,
              });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!asset.uri) return;

        let finalUri = asset.uri;

        // Upload to Supabase Storage if signed in; fall back to local URI
        try {
          const user = firebaseAuth.currentUser;
          if (user) {
            const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z]/g, "j");
            const path = `${user.uid}/${contactId}.${ext}`;
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const { error: uploadError } = await supabase.storage
              .from("contact-avatars")
              .upload(path, blob, { upsert: true, contentType: `image/${ext}` });
            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from("contact-avatars")
                .getPublicUrl(path);
              finalUri = urlData.publicUrl;
            }
          }
        } catch {
          // non-critical — keep local URI
        }

        editContact(contactId, { avatarUrl: finalUri });
        showToast(t("contacts.saved"));
      } catch {
        // ignore
      } finally {
        setUploadingPhoto(false);
      }
    };

    // iOS: native action sheet; Android: Alert dialog
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Library"],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) void launch("camera");
          else if (idx === 2) void launch("library");
        },
      );
    } else {
      Alert.alert("Contact Photo", "Choose a source", [
        { text: "Cancel", style: "cancel" },
        { text: "Take Photo", onPress: () => void launch("camera") },
        { text: "Choose from Library", onPress: () => void launch("library") },
      ]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title={t("contacts.title")} subtitle={t("contacts.sub")} />
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.infoBox,
            { backgroundColor: withAlpha(c.primary, 0.08), borderColor: withAlpha(c.primary, 0.2) },
          ]}
        >
          <Icon name="info" size={15} color={c.primary} />
          <Text style={{ flex: 1, fontSize: 11.5, color: c.text, lineHeight: 17 }}>
            {t("contacts.info")}
          </Text>
        </View>

        {/* ── 10-cap banner ── */}
        {atLimit && (
          <View
            style={[
              styles.infoBox,
              { backgroundColor: withAlpha(c.warning, 0.09), borderColor: withAlpha(c.warning, 0.25), marginBottom: 10 },
            ]}
          >
            <Icon name="users" size={15} color={c.warning} />
            <Text style={{ flex: 1, fontSize: 11.5, color: c.text, lineHeight: 17 }}>
              {t("contacts.limitReached")}
            </Text>
          </View>
        )}

        {/* ── Add form (hidden when at limit) ── */}
        {!atLimit && (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.text, marginBottom: 12 }}>
              {t("contacts.addNew")}
            </Text>
            <Text style={{ fontSize: 10.5, color: c.textMuted, marginBottom: 8 }}>
              {`${contacts.length} / ${maxContacts} ${t("contacts.limit")}`}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("contacts.fullName")}
              placeholderTextColor={c.textFaint}
              style={[styles.input, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border }]}
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={t("contacts.phone")}
              placeholderTextColor={c.textFaint}
              keyboardType="phone-pad"
              style={[
                styles.input,
                { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border, marginTop: 10 },
              ]}
            />
            <Pressable
              onPress={onAdd}
              disabled={!name.trim() || !phone.trim()}
              style={[
                styles.addBtn,
                { backgroundColor: name.trim() && phone.trim() ? c.primary : c.border },
              ]}
            >
              <Icon name="plus" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13.5 }}>
                {t("contacts.add")}
              </Text>
            </Pressable>
            <Pressable
              onPress={onImport}
              disabled={importing}
              style={[styles.importBtn, { borderColor: c.primary }]}
            >
              {importing ? (
                <ActivityIndicator size="small" color={c.primary} />
              ) : (
                <Icon name="users" size={15} color={c.primary} />
              )}
              <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                {t("contacts.import")}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Contact list ── */}
        {contacts.length === 0 ? (
          <Text style={{ textAlign: "center", color: c.textMuted, fontSize: 13, marginTop: 26 }}>
            {t("contacts.empty")}
          </Text>
        ) : (
          contacts.map((contact) => (
            <Pressable
              key={contact.id}
              onLongPress={() => openEdit(contact)}
              delayLongPress={300}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              {/* Avatar with photo-picker overlay */}
              <Pressable onPress={() => pickPhoto(contact.id)} style={styles.avatarWrap}>
                {uploadingPhoto ? (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: withAlpha(c.primary, 0.15) }]}>
                    <ActivityIndicator size="small" color={c.primary} />
                  </View>
                ) : (
                  <Avatar label={contact.name} uri={contact.avatarUrl} size={44} />
                )}
                <View style={styles.cameraBadge}>
                  <Icon name="camera" size={10} color="#fff" />
                </View>
              </Pressable>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text }}
                  numberOfLines={1}
                >
                  {contact.name}
                </Text>
                <Text style={{ fontSize: 12, color: c.textMuted }}>{contact.phone}</Text>
              </View>

              <Pressable
                onPress={() => {
                  showToast(`${t("common.calling")} ${contact.name}…`);
                  callNumber(contact.phone);
                }}
                style={[styles.iconBtn, { backgroundColor: c.successSoft }]}
              >
                <Icon name="phone" size={16} color={c.success} />
              </Pressable>
              <Pressable
                onPress={() => openEdit(contact)}
                style={[styles.iconBtn, { backgroundColor: withAlpha(c.primary, 0.1) }]}
              >
                <Icon name="edit" size={16} color={c.primary} />
              </Pressable>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* ── Edit contact sheet ── */}
      <Modal
        visible={editTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={closeEdit}
      >
        <Pressable style={[styles.sheetBg, { backgroundColor: c.overlay }]} onPress={closeEdit}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card }]} onPress={() => {}}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 18 }}>
              <Text style={{ flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", color: c.text }}>
                {t("contacts.editContact")}
              </Text>
              <Pressable onPress={closeEdit} hitSlop={12}>
                <Icon name="x" size={20} color={c.textMuted} />
              </Pressable>
            </View>

            {/* Avatar in sheet */}
            {editTarget && (
              <View style={{ alignItems: "center", marginBottom: 16 }}>
                <Pressable onPress={() => pickPhoto(editTarget.id)} style={styles.avatarWrap}>
                  {uploadingPhoto ? (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: withAlpha(c.primary, 0.15) }]}>
                      <ActivityIndicator size="small" color={c.primary} />
                    </View>
                  ) : (
                    <Avatar label={editTarget.name} uri={editTarget.avatarUrl} size={62} />
                  )}
                  <View style={styles.cameraBadge}>
                    <Icon name="camera" size={12} color="#fff" />
                  </View>
                </Pressable>
                <Text style={{ fontSize: 11.5, color: c.primary, marginTop: 6 }}>
                  {t("contacts.changePhoto")}
                </Text>
              </View>
            )}

            <Text style={[styles.label, { color: c.textMuted }]}>{t("contacts.fullName")}</Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              style={[styles.input, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border }]}
              placeholderTextColor={c.textFaint}
            />
            <Text style={[styles.label, { color: c.textMuted, marginTop: 12 }]}>
              {t("contacts.phone")}
            </Text>
            <TextInput
              value={draftPhone}
              onChangeText={setDraftPhone}
              keyboardType="phone-pad"
              style={[styles.input, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border }]}
              placeholderTextColor={c.textFaint}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <Pressable
                onPress={() => editTarget && handleDelete(editTarget.id)}
                style={[styles.actionBtn, { backgroundColor: c.dangerSoft, flex: 1 }]}
              >
                <Icon name="trash" size={14} color={c.danger} />
                <Text style={{ color: c.danger, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                  {t("common.remove")}
                </Text>
              </Pressable>
              <Pressable
                onPress={saveEdit}
                style={[styles.actionBtn, { backgroundColor: c.primary, flex: 2 }]}
              >
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 }}>
                  {t("common.save")}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 18 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 11,
    marginTop: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarWrap: { position: "relative" },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBg: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 36,
  },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
});
