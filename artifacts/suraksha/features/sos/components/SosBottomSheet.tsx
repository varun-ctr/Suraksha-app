import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
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

import { Icon } from "@/shared/components/Icon";
import { withAlpha } from "@/shared/theme/colors";
import { useApp } from "@/features/profile/context/AppContext";
import { useI18n } from "@/features/settings/context/LanguageContext";
import type { SosState } from "@/features/sos/types";
import { useTheme } from "@/shared/theme/ThemeContext";
import { fmtClock } from "@/shared/utils/format";
import { formatCoords } from "@/core/permissions/location";
import { callNumber, locationLink, openWhatsApp, sendSms, shareLiveLocation } from "@/shared/utils/native";
import { buildEmergencyMessage } from "@/features/sos/utils/emergencyMessage";
import type { AlertStatus } from "@/features/sos/services/sosAlertService";

interface Props {
  sos: SosState;
  cancelSOS: () => void;
  /** Owned by SafetyContext — see its "Alert dispatch" section for why. */
  alertStatuses: AlertStatus[];
  alertSending: boolean;
}

// ── Status badge helpers ──────────────────────────────────────────────────────

function SmsBadge({ state }: { state: AlertStatus["sms"] }) {
  const { c } = useTheme();
  if (state === "sending")  return <Badge label="Sending…"  color={c.warning} />;
  if (state === "sent")     return <Badge label="✓ SMS Sent"   color={c.success} />;
  if (state === "opening")  return <Badge label="⟳ SMS Opened" color={c.police} />;
  if (state === "failed")   return <Badge label="SMS Failed" color={c.danger} />;
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

export function SosBottomSheet({ sos, cancelSOS, alertStatuses, alertSending }: Props) {
  const { c } = useTheme();
  const { t } = useI18n();
  const { contacts, profile } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const slideAnim  = useRef(new Animated.Value(600)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim  = useRef(new Animated.Value(0)).current;

  // Respect the OS "Reduce Motion" accessibility setting for the decorative,
  // indefinitely-looping pulse ring — the slide-in and countdown bounce are
  // one-shot and stay, since Reduce Motion targets continuous/parallax
  // motion, not a single transition.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReduceMotion(enabled); });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; sub.remove(); };
  }, []);

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }).start();
  }, [slideAnim]);

  useEffect(() => {
    if (sos.phase !== "countdown") return;
    bounceAnim.setValue(1.5);
    Animated.spring(bounceAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
  }, [sos.countdown, sos.phase, bounceAnim]);

  useEffect(() => {
    if (sos.phase !== "active" || reduceMotion) { pulseAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.timing(pulseAnim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [sos.phase, pulseAnim, reduceMotion]);

  const link        = sos.shareUrl ?? (sos.coords ? locationLink(sos.coords.lat, sos.coords.lng) : null);
  const messageBody = buildEmergencyMessage(t, profile.name, sos.coords, sos.shareUrl);

  const goAddContacts = () => { cancelSOS(); router.push("/contacts"); };

  const pulseScale   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)" }]} />

      <Animated.View
        style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 12 }, { transform: [{ translateY: slideAnim }] }]}
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

              <View style={styles.cdStatusBlock}>
                <View style={styles.cdStatusRow}>
                  <Icon name={sos.loading ? "mapPin" : "check"} size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.cdStatusText}>
                    {sos.loading ? t("sos.gettingLocation") : t("sos.locationFound")}
                  </Text>
                </View>
                <View style={styles.cdStatusRow}>
                  <Icon name={contacts.length > 0 ? "check" : "alertCircle"} size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.cdStatusText}>
                    {contacts.length > 0
                      ? t("sos.contactsReady").replace("{n}", String(contacts.length))
                      : t("sos.contactsMissing")}
                  </Text>
                </View>
                <View style={styles.cdStatusRow}>
                  {sos.shareUrl ? (
                    <View style={[styles.cdLiveDot, { backgroundColor: c.success }]} />
                  ) : (
                    <Icon name="activity" size={13} color="rgba(255,255,255,0.85)" />
                  )}
                  <Text style={styles.cdStatusText}>
                    {sos.shareUrl ? t("sos.liveTrackingActive") : t("sos.startingLiveTracking")}
                  </Text>
                </View>
                {sos.address && (
                  <View style={styles.cdStatusRow}>
                    <Icon name="mapPin" size={13} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.cdStatusText} numberOfLines={1}>{sos.address}</Text>
                  </View>
                )}
              </View>

              <Pressable
                onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); cancelSOS(); }}
                style={styles.cancelBtn}
                accessibilityRole="button"
                accessibilityLabel={t("sos.cancelCountdown")}
                accessibilityHint={t("sos.countdownSub")}
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
                <Animated.View style={[styles.pulseRing, { backgroundColor: c.danger, transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
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
                  {alertSending ? t("sos.alertingContacts") : t("sos.helpComing")}
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
              {/* Before this, there was no visibility into whether the SOS record had
                  actually reached the backend — a silent gap on the one screen where a
                  user under stress most needs reassurance that help is really on record. */}
              <View style={styles.panelRow}>
                {sos.eventId ? (
                  <View style={[styles.cdLiveDot, { backgroundColor: c.success }]} />
                ) : (
                  <Icon name="activity" size={13} color={c.warning} />
                )}
                <Text style={[styles.panelBody, { color: sos.eventId ? c.textMuted : c.warning }]}>
                  {sos.eventId ? t("sos.recordSaved") : t("sos.savingRecord")}
                </Text>
              </View>
            </View>

            {/* Contacts panel */}
            <View style={[styles.panel, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.panelTitle, { color: c.text, marginBottom: 10 }]}>
                {t("sos.alertedContacts")}
              </Text>

              {!alertSending && alertStatuses.some((a) => a.sms === "opening") && (
                <View style={[styles.notConfiguredBanner, { backgroundColor: withAlpha(c.warning, 0.12) }]}>
                  <Icon name="alertCircle" size={13} color={c.warning} />
                  <Text style={[styles.notConfiguredText, { color: c.warning }]}>
                    {t("sos.notConfigured")}
                  </Text>
                </View>
              )}

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
                          <Badge label="Sending…" color={c.warning} />
                        )}
                        {status && <SmsBadge state={status.sms} />}
                      </View>

                      {/* Manual action buttons — always available as backup */}
                      <View style={styles.contactActions}>
                        <Pressable
                          style={[styles.miniBtn, { backgroundColor: c.successSoft }]}
                          onPress={() => callNumber(contact.phone)}
                          accessibilityRole="button"
                          accessibilityLabel={`${t("sos.call")} ${contact.name}`}
                        >
                          <Icon name="phone" size={13} color={c.success} />
                          <Text style={[styles.miniText, { color: c.success }]}>{t("sos.call")}</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.miniBtn, { backgroundColor: c.cardAlt }]}
                          onPress={() => { void sendSms(contact.phone, messageBody).catch(() => {}); }}
                          accessibilityRole="button"
                          accessibilityLabel={`${t("sos.sms")} ${contact.name}`}
                        >
                          <Icon name="message" size={13} color={c.text} />
                          <Text style={[styles.miniText, { color: c.text }]}>{t("sos.sms")}</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.miniBtn, { backgroundColor: "#E7F7EE" }]}
                          onPress={() => openWhatsApp(contact.phone, messageBody)}
                          accessibilityRole="button"
                          accessibilityLabel={`${t("sos.whatsapp")} ${contact.name}`}
                        >
                          {/* #0E7A3D (not WhatsApp's usual #25D366) against this button's light
                              mint background clears WCAG AA 4.5:1 for normal-size text; #25D366
                              on #E7F7EE was ~1.79:1. */}
                          <Icon name="send" size={13} color="#0E7A3D" />
                          <Text style={[styles.miniText, { color: "#0E7A3D" }]}>{t("sos.whatsapp")}</Text>
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
              accessibilityRole="button"
              accessibilityLabel={t("sos.imSafe")}
              accessibilityHint={t("sos.helpComing")}
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
  cdStatusBlock: { alignSelf: "stretch", gap: 8, marginBottom: 18 },
  cdStatusRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  cdStatusText: { color: "rgba(255,255,255,0.85)", fontSize: 12.5, fontFamily: "Inter_500Medium", maxWidth: 260 },
  cdLiveDot: { width: 8, height: 8, borderRadius: 4 },
  cancelBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", marginTop: 4 },
  cancelText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },

  activeHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  pulseWrap: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pulseRing: { position: "absolute", width: 44, height: 44, borderRadius: 22 },
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

  notConfiguredBanner: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 10, padding: 10, marginBottom: 10 },
  notConfiguredText: { fontSize: 11.5, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 16 },

  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 14, borderWidth: 1 },
  actionText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
