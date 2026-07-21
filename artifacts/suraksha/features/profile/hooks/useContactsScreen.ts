import * as Contacts from "expo-contacts";
import * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS, Alert, Platform } from "react-native";
import { useState } from "react";

import { useApp } from "@/features/profile/context/AppContext";
import type { Contact } from "@/features/profile/context/AppContext";
import { useI18n } from "@/features/settings/context/LanguageContext";
import { useToast } from "@/features/settings/context/ToastContext";
import { firebaseAuth } from "@/repositories/firebase/firebaseClient";
import { supabase } from "@/repositories/supabase/supabaseClient";

/** All state and handlers for the trusted-contacts screen: add/import/edit/delete, and photo upload. */
export function useContactsScreen() {
  const { t } = useI18n();
  const { contacts, addContact, editContact, deleteContact, maxContacts } = useApp();
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

  return {
    contacts, maxContacts, atLimit,
    name, setName, phone, setPhone, importing,
    editTarget, draftName, setDraftName, draftPhone, setDraftPhone, uploadingPhoto,
    onAdd, onImport, openEdit, closeEdit, saveEdit, handleDelete, pickPhoto,
  };
}
