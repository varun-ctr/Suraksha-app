import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { withAlpha } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { useI18n } from "@/context/LanguageContext";
import type { SosState } from "@/context/SafetyContext";
import { useTheme } from "@/context/ThemeContext";
import { fmtClock } from "@/lib/format";
import { formatCoords } from "@/lib/location";
import { callNumber, locationLink, openWhatsApp, sendSms, shareLiveLocation } from "@/lib/native";
import { buildEmergencyMessage } from "@/lib/emergencyMessage";
import type { AlertStatus } from "@/lib/sosAlert";
import { sendSosAlerts } from "@/lib/sosAlert";

interface Props {
  sos: SosState;
  cancelSOS: () => void;
}

// ── Status badge helpers ──────────────────────────────────────────────────────

function SmsBadge({ state }: { state: AlertStatus["sms"] }) {
  if (state === "sending")  return <Badge label="Sending…"  color="#F59E0B" />;
  if (state === "sent")     return <Badge label="✓ SMS Sent"   color="#22C55E" />;
  if (state === "opening")  return <Badge label="⟳ SMS Opened" color="#3B82F6" />;
  if (state === "failed")   return <Badge label="SMS Failed" color="#EF4444" />;
  return null;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[badge.wrap, { backgroundColor: color + "20" }]}>
      <Text style={[badge.text, { color }]}>{label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  text: { fontSize: 10.5, fontFamily: "Inter_600SemiBold" },
});

// ── Main component ────────────────────────────────────────────────────────────

export function SosBottomSheet({ sos, cancelSOS }: Props) {
  const { c } = useTheme();
  const { t } = useI18n();
  const { contacts, profile } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const slideAnim  = useRef(new Animated.Value(600)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim  = useRef(new Animated.Value(0)).current;

  // Auto-blast tracking
  const alertSentRef                    = useRef(false);
  const [alertStatuses, setAlertStatuses] = useState<AlertStatus[]>([]);
  const [alertSending, setAlertSending]   = useState(false);

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }).start();
  }, [slideAnim]);

  useEffect(() => {
    if (sos.phase !== "countdown") return;
    bounceAnim.setValue(1.5);
    Animated.spring(bounceAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
  }, [sos.countdown, sos.phase, bounceAnim]);

  useEffect(() => {
    if (sos.phase !== "active") { pulseAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.timing(pulseAnim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [sos.phase, pulseAnim]);

  // ── Auto-blast contacts when SOS becomes active ───────────────────
  useEffect(() => {
    if (sos.phase === "active" && !alertSentRef.current && contacts.length > 0) {
      alertSentRef.current = true;
      setAlertSending(true);
      sendSosAlerts(t, contacts, sos.coords, sos.shareUrl, profile.name)
        .then((statuses) => {
          setAlertStatuses(statuses);
          setAlertSending(false);
        })
        .catch(() => {
          setAlertSending(false);
        });
    }
    if (sos.phase === "idle") {
      alertSentRef.current = false;
      setAlertStatuses([]);
      setAlertSending(false);
    }
  }, [sos.phase, contacts, sos.coords, sos.shareUrl, profile.name, t]);

  const link        = sos.shareUrl ?? (sos.coords ? locationLink(sos.coords.lat, sos.coords.lng) : null);
  const messageBody = buildEmergencyMessage(t, profile.name, sos.coords, sos.shareUrl);

  const goAddContacts = () => { cancelSOS(); router.push("/contacts"); };

  const pulseScale   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)" }]} />

      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom + 12 }, { transform: [{ translateY: slideAnim }] }]}
      >
        <View style={styles.handle} />

        {sos.phase === "countdown" ? (
          /* ── Countdown Phase ── */
          <View style={styles.countdownWrap}>
            <LinearGradient
              colors={[c.accentDark, "#1A0820"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 24, paddingHorizontal: 24 }}>
              <Text style={styles.cdTitle}>{t("sos.countdownTitle")}</Text>
              <Text style={styles.cdSub}>{t("sos.countdownSub")}</Text>

              <View style={styles.cdCircleWrap}>
                <View style={[styles.cdRing, { borderColor: "rgba(255,255,255,0.25)" }]} />
                <Animated.Text style={[styles.cdNumber, { transform: [{ scale: bounceAnim }] }]}>
                  {sos.countdown > 0 ? sos.countdown : "!"}
                </Animated.Text>
              </View>

              {sos.loading && <Text style={styles.cdGps}>{t("sos.gettingLocation")}</Text>}

              <Pressable
                onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); cancelSOS(); }}
                style={styles.cancelBtn}
              >
                <Icon name="x" size={16} color="#fff" />
                <Text style={styles.cancelText}>{t("sos.cancelCountdown")}</Text>
              </Pressable>
            </View>
          </View>

        ) : (
          /* ── Active Phase ── */
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 8 }}
          >
            {/* Header */}
            <View style={styles.activeHeader}>
              <View style={styles.pulseWrap}>
                <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
                <View style={[styles.avatarCircle, { backgroundColor: withAlpha(c.accent, 0.12) }]}>
                  {profile.avatarUrl ? (
                    <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImg} />
                  ) : (
                    <Text style={[styles.avatarInitial, { color: c.accent }]}>
                      {(profile.name.trim() || "?").charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.activeTitle, { color: c.text }]}>{t("sos.sent")}</Text>
                <Text style={[styles.activeSub, { color: c.textMuted }]}>
                  {alertSending ? "Alerting contacts…" : t("sos.helpComing")}
                </Text>
              </View>
              <Text style={[styles.activeTimer, { color: c.accent }]}>{fmtClock(sos.seconds)}</Text>
            </View>

            {/* Location panel */}
            <View style={[styles.panel, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.panelRow}>
                <Icon name="mapPin" size={15} color={c.primary} />
                <Text style={[styles.panelTitle, { color: c.text }]}>{t("sos.liveLocation")}</Text>
                {sos.shareUrl && (
                  <View style={[styles.liveBadge, { backgroundColor: c.successSoft }]}>
                    <View style={[styles.liveDot, { backgroundColor: c.success }]} />
                    <Text style={[styles.liveBadgeText, { color: c.success }]}>{t("sos.liveTrackingOn")}</Text>
                  </View>
                )}
              </View>
              {sos.loading ? (
                <Text style={[styles.panelBody, { color: c.textMuted }]}>{t("sos.gettingLocation")}</Text>
              ) : sos.coords ? (
                <Text style={[styles.panelBody, { color: c.textMuted }]}>
                  {sos.address ? `${sos.address}\n` : ""}
                  {formatCoords(sos.coords)}
                </Text>
              ) : (
                <Text style={[styles.panelBody, { color: c.textMuted }]}>{t("sos.locationUnavailable")}</Text>
              )}
            </View>

            {/* Contacts panel */}
            <View style={[styles.panel, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.panelTitle, { color: c.text, marginBottom: 10 }]}>
                {t("sos.alertedContacts")}
              </Text>

              {contacts.length === 0 ? (
                <>
                  <Text style={[styles.panelBody, { color: c.textMuted, marginBottom: 12 }]}>
                    {t("sos.noContacts")}
                  </Text>
                  <Pressable style={[styles.addBtn, { backgroundColor: c.primary }]} onPress={goAddContacts}>
                    <Icon name="plus" size={15} color="#fff" />
                    <Text style={styles.addBtnText}>{t("sos.addContacts")}</Text>
                  </Pressable>
                </>
              ) : (
                contacts.map((contact, i) => {
                  const status = alertStatuses.find((a) => a.id === contact.id);
                  return (
                    <View
                      key={contact.id}
                      style={[
                        styles.contactBlock,
                        { borderBottomColor: c.border, borderBottomWidth: i < contacts.length - 1 ? StyleSheet.hairlineWidth : 0 },
                      ]}
                    >
                      <View style={styles.contactRow}>
                        <View style={[styles.contactAvatar, { backgroundColor: c.cardAlt }]}>
                          <Text style={[styles.contactAvatarText, { color: c.primary }]}>
                            {contact.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.contactName, { color: c.text }]} numberOfLines={1}>
                            {contact.name}
                          </Text>
                          <Text style={[styles.contactPhone, { color: c.textMuted }]} numberOfLines={1}>
                            {contact.phone}
                          </Text>
                        </View>
                        {/* Alert delivery status */}
                        {alertSending && !status && (
                          <Badge label="Sending…" color="#F59E0B" />
                        )}
                        {status && <SmsBadge state={status.sms} />}
                      </View>

                      {/* Manual action buttons — always available as backup */}
                      <View style={styles.contactActions}>
                        <Pressable
                          style={[styles.miniBtn, { backgroundColor: c.successSoft }]}
                          onPress={() => callNumber(contact.phone)}
                        >
                          <Icon name="phone" size={13} color={c.success} />
                          <Text style={[styles.miniText, { color: c.success }]}>{t("sos.call")}</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.miniBtn, { backgroundColor: c.cardAlt }]}
                          onPress={() => sendSms(contact.phone, messageBody)}
                        >
                          <Icon name="message" size={13} color={c.text} />
                          <Text style={[styles.miniText, { color: c.text }]}>{t("sos.sms")}</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.miniBtn, { backgroundColor: "#E7F7EE" }]}
                          onPress={() => openWhatsApp(contact.phone, messageBody)}
                        >
                          <Icon name="send" size={13} color="#25D366" />
                          <Text style={[styles.miniText, { color: "#25D366" }]}>{t("sos.whatsapp")}</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Action buttons */}
            <Pressable
              style={[styles.actionBtn, { backgroundColor: c.cardAlt, borderColor: c.border }]}
              onPress={() => callNumber("112")}
            >
              <Icon name="phone" size={16} color={c.danger} />
              <Text style={[styles.actionText, { color: c.danger }]}>{t("sos.call112")}</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: c.cardAlt, borderColor: c.border, marginTop: 8 }]}
              onPress={() => shareLiveLocation(sos.coords)}
            >
              <Icon name="share" size={16} color={c.primary} />
              <Text style={[styles.actionText, { color: c.primary }]}>{t("sos.shareLocation")}</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: c.success, borderColor: c.success, marginTop: 8, marginBottom: 4 }]}
              onPress={cancelSOS}
            >
              <Icon name="check" size={16} color="#fff" />
              <Text style={[styles.actionText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>
                {t("sos.imSafe")}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "90%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    elevation: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
    marginTop: 10,
    marginBottom: 4,
  },

  countdownWrap: { overflow: "hidden" },
  cdTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 12, textAlign: "center" },
  cdSub: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 4, textAlign: "center", marginBottom: 24 },
  cdCircleWrap: { width: 140, height: 140, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  cdRing: { position: "absolute", width: 130, height: 130, borderRadius: 65, borderWidth: 4 },
  cdNumber: { color: "#fff", fontSize: 72, fontFamily: "Inter_700Bold", lineHeight: 80 },
  cdGps: { color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 16 },
  cancelBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", marginTop: 4 },
  cancelText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },

  activeHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  pulseWrap: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pulseRing: { position: "absolute", width: 44, height: 44, borderRadius: 22, backgroundColor: "#FF3B30" },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarInitial: { fontSize: 18, fontFamily: "Inter_700Bold" },
  activeTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  activeSub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
  activeTimer: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: 1 },

  panel: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  panelRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 5, flexWrap: "wrap" },
  panelTitle: { fontSize: 12.5, fontFamily: "Inter_700Bold" },
  panelBody: { fontSize: 12, lineHeight: 18 },

  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveBadgeText: { fontSize: 10.5, fontFamily: "Inter_600SemiBold" },

  contactBlock: { paddingVertical: 10 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  contactAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  contactAvatarText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  contactName: { fontSize: 13, fontFamily: "Inter_700Bold" },
  contactPhone: { fontSize: 11, marginTop: 1 },
  contactActions: { flexDirection: "row", gap: 7 },
  miniBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 10 },
  miniText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 12 },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },

  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 14, borderWidth: 1 },
  actionText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
