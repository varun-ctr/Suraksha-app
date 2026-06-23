import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { useApp } from "@/context/AppContext";
import { useI18n } from "@/context/LanguageContext";
import type { Coords } from "@/context/SafetyContext";
import { useTheme } from "@/context/ThemeContext";
import { fmtClock } from "@/lib/format";
import { formatCoords } from "@/lib/location";
import { callNumber, locationLink, openWhatsApp, sendSms, shareLiveLocation } from "@/lib/native";

interface SosModalProps {
  sos: {
    active: boolean;
    seconds: number;
    coords: Coords | null;
    address: string | null;
    loading: boolean;
    shareUrl?: string | null;
  };
  cancelSOS: () => void;
}

export function SosModal({ sos, cancelSOS }: SosModalProps) {
  const { c } = useTheme();
  const { t } = useI18n();
  const { contacts } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Prefer live tracking URL; fall back to static coordinate link
  const link = sos.shareUrl ?? (sos.coords ? locationLink(sos.coords.lat, sos.coords.lng) : null);
  const messageBody = link ? t("sos.smsBody").replace("{link}", link) : t("sos.smsNoLoc");

  const goAddContacts = () => {
    cancelSOS();
    router.push("/contacts");
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <LinearGradient colors={[c.accentDark, "#1A0820"]} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 28,
          paddingHorizontal: 22,
          paddingBottom: insets.bottom + 22,
          alignItems: "center",
          flexGrow: 1,
        }}
      >
        <View style={styles.iconWrap}>
          <Icon name="alert" size={36} color="#fff" />
        </View>
        <Text style={styles.heading}>{t("sos.sent")}</Text>
        <Text style={styles.sub}>{t("sos.helpComing")}</Text>
        <Text style={styles.clock}>{fmtClock(sos.seconds)}</Text>
        <Text style={styles.elapsed}>{t("sos.elapsed")}</Text>

        <View style={styles.notice}>
          <Icon name="info" size={14} color="#fff" />
          <Text style={styles.noticeText}>{t("sos.notConfigured")}</Text>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelRow}>
            <Icon name="mapPin" size={15} color="#fff" />
            <Text style={styles.panelTitle}>{t("sos.liveLocation")}</Text>
            {sos.shareUrl && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>{t("sos.liveTrackingOn")}</Text>
              </View>
            )}
          </View>
          {sos.loading ? (
            <Text style={styles.panelBody}>{t("sos.gettingLocation")}</Text>
          ) : sos.coords ? (
            <Text style={styles.panelBody}>
              {sos.address ? `${sos.address}\n` : ""}
              {formatCoords(sos.coords)}
            </Text>
          ) : (
            <Text style={styles.panelBody}>{t("sos.locationUnavailable")}</Text>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={[styles.panelTitle, { marginBottom: 10 }]}>{t("sos.alertedContacts")}</Text>
          {contacts.length === 0 ? (
            <>
              <Text style={[styles.panelBody, { marginBottom: 12 }]}>{t("sos.noContacts")}</Text>
              <Pressable style={styles.addContactsBtn} onPress={goAddContacts}>
                <Icon name="plus" size={15} color="#fff" />
                <Text style={styles.addContactsText}>{t("sos.addContacts")}</Text>
              </Pressable>
            </>
          ) : (
            contacts.map((contact, i) => (
              <View
                key={contact.id}
                style={[
                  styles.contactBlock,
                  { borderBottomWidth: i < contacts.length - 1 ? StyleSheet.hairlineWidth : 0 },
                ]}
              >
                <View style={styles.contactHeader}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>{contact.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.contactName} numberOfLines={1}>{contact.name}</Text>
                    <Text style={styles.contactPhone} numberOfLines={1}>{contact.phone}</Text>
                  </View>
                </View>
                <View style={styles.contactActions}>
                  <Pressable style={styles.miniBtn} onPress={() => callNumber(contact.phone)}>
                    <Icon name="phone" size={14} color="#fff" />
                    <Text style={styles.miniText}>{t("sos.call")}</Text>
                  </Pressable>
                  <Pressable style={styles.miniBtn} onPress={() => sendSms(contact.phone, messageBody)}>
                    <Icon name="message" size={14} color="#fff" />
                    <Text style={styles.miniText}>{t("sos.sms")}</Text>
                  </Pressable>
                  <Pressable style={styles.miniBtn} onPress={() => openWhatsApp(contact.phone, messageBody)}>
                    <Icon name="send" size={14} color="#fff" />
                    <Text style={styles.miniText}>{t("sos.whatsapp")}</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ width: "100%", gap: 10, marginTop: 4 }}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: "rgba(255,255,255,0.16)" }]}
            onPress={() => callNumber("112")}
          >
            <Icon name="phone" size={16} color="#fff" />
            <Text style={styles.actionText}>{t("sos.call112")}</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: "rgba(255,255,255,0.16)" }]}
            onPress={() => shareLiveLocation(sos.coords)}
          >
            <Icon name="share" size={16} color="#fff" />
            <Text style={styles.actionText}>{t("sos.shareLocation")}</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: c.success }]} onPress={cancelSOS}>
            <Icon name="check" size={16} color="#fff" />
            <Text style={[styles.actionText, { fontFamily: "Inter_700Bold" }]}>{t("sos.imSafe")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 1000, elevation: 1000 },
  iconWrap: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  heading: { color: "#fff", fontSize: 21, fontFamily: "Inter_700Bold" },
  sub: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 3, fontFamily: "Inter_500Medium" },
  clock: { color: "#fff", fontSize: 32, fontFamily: "Inter_700Bold", marginTop: 14, letterSpacing: 1 },
  elapsed: { color: "rgba(255,255,255,0.7)", fontSize: 11.5, marginBottom: 16 },
  notice: {
    width: "100%", flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 12, padding: 12, marginBottom: 14,
  },
  noticeText: { flex: 1, color: "rgba(255,255,255,0.92)", fontSize: 11.5, lineHeight: 17, fontFamily: "Inter_500Medium" },
  panel: {
    width: "100%", backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14, padding: 14, marginBottom: 14,
  },
  panelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  panelTitle: { color: "#fff", fontSize: 12.5, fontFamily: "Inter_700Bold" },
  panelBody: { color: "rgba(255,255,255,0.8)", fontSize: 11.5, lineHeight: 17 },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(110,231,168,0.2)", borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3, marginLeft: 4,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#6EE7A8" },
  liveBadgeText: { color: "#6EE7A8", fontSize: 10.5, fontFamily: "Inter_600SemiBold" },
  contactBlock: { paddingVertical: 10, borderBottomColor: "rgba(255,255,255,0.12)" },
  contactHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  contactAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  contactAvatarText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  contactName: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  contactPhone: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  contactActions: { flexDirection: "row", gap: 8 },
  miniBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.16)",
  },
  miniText: { color: "#fff", fontSize: 11.5, fontFamily: "Inter_700Bold" },
  addContactsBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, paddingVertical: 11, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.18)",
  },
  addContactsText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  actionBtn: {
    width: "100%", flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12,
  },
  actionText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
