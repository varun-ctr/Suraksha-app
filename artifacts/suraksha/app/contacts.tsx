import * as Contacts from "expo-contacts";
import React, { useState } from "react";
import {
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
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { callNumber } from "@/lib/native";

export default function ContactsScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { contacts, addContact, addContacts, deleteContact } = useApp();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [importing, setImporting] = useState(false);

  const onAdd = () => {
    if (!name.trim() || !phone.trim()) return;
    addContact(name, phone);
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
      const added = addContacts([{ name: picked.name ?? "Contact", phone: phoneNumber }]);
      showToast(added > 0 ? t("contacts.added") : t("contacts.import"));
    } catch {
      showToast(t("contacts.import"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title={t("contacts.title")} subtitle={t("contacts.sub")} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.infoBox, { backgroundColor: withAlpha(c.primary, 0.08), borderColor: withAlpha(c.primary, 0.2) }]}>
          <Icon name="info" size={15} color={c.primary} />
          <Text style={{ flex: 1, fontSize: 11.5, color: c.text, lineHeight: 17 }}>{t("contacts.info")}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.text, marginBottom: 12 }}>
            {t("contacts.addNew")}
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
            style={[styles.input, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border, marginTop: 10 }]}
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
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13.5 }}>{t("contacts.add")}</Text>
          </Pressable>
          <Pressable
            onPress={onImport}
            disabled={importing}
            style={[styles.importBtn, { borderColor: c.primary }]}
          >
            <Icon name="users" size={15} color={c.primary} />
            <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>{t("contacts.import")}</Text>
          </Pressable>
        </View>

        {contacts.length === 0 ? (
          <Text style={{ textAlign: "center", color: c.textMuted, fontSize: 13, marginTop: 26 }}>
            {t("contacts.empty")}
          </Text>
        ) : (
          contacts.map((contact) => (
            <View key={contact.id} style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}>
              <Avatar label={contact.name} size={42} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text }} numberOfLines={1}>
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
                onPress={() => {
                  deleteContact(contact.id);
                  showToast(t("contacts.removed"));
                }}
                style={[styles.iconBtn, { backgroundColor: c.dangerSoft }]}
              >
                <Icon name="trash" size={16} color={c.danger} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
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
});
