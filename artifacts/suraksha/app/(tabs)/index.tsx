import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { Avatar, Card, IconBadge } from "@/components/ui";
import { withAlpha } from "@/constants/colors";
import { QUICK_ACTIONS } from "@/constants/data";
import { useApp } from "@/context/AppContext";
import { useI18n } from "@/context/LanguageContext";
import { useSafety } from "@/context/SafetyContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { useLocation } from "@/hooks/useLocation";
import { fmtClock } from "@/lib/format";
import { formatCoords } from "@/lib/location";
import { callNumber, shareLiveLocation } from "@/lib/native";

function SosButton({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.7] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={{ width: 168, height: 168, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: 140,
          height: 140,
          borderRadius: 70,
          backgroundColor: c.accent,
          transform: [{ scale }],
          opacity,
        }}
      />
      <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}>
        <LinearGradient
          colors={[c.accent, c.accentDark]}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.sosCircle}
        >
          <Icon name="bell" size={38} color="#fff" />
          <Text style={styles.sosText}>SOS</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const { c } = useTheme();
  const { t, pick, lang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { contacts, profile } = useApp();
  const { triggerSOS, journey, setJourneyDuration, startJourney, endJourney } = useSafety();
  const { showToast } = useToast();
  const { point, address, status } = useLocation();

  const displayName = profile.name.trim() || t("home.guest");
  const locLabel =
    status === "loading"
      ? t("home.locating")
      : status === "denied"
        ? t("home.locationOff")
        : address ?? (point ? formatCoords(point) : t("home.locating"));
  const overdue = journey.active && journey.seconds >= journey.duration * 60;

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
        style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 54 }}
      >
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={styles.headerAvatar}>
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 17 }}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.greeting}>{t("home.greeting")}</Text>
              <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            </View>
          </View>
          <Pressable style={styles.bellBtn} onPress={() => router.push("/helpline")}>
            <Icon name="bell" size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.locPill}>
          <Icon name="mapPin" size={13} color="#fff" />
          <Text style={styles.locText} numberOfLines={1}>{locLabel}</Text>
        </View>
      </LinearGradient>

      <View style={{ alignItems: "center", marginTop: -48, marginBottom: 6 }}>
        <SosButton onPress={triggerSOS} />
        <Text style={{ fontSize: 12.5, color: c.textMuted, fontFamily: "Inter_500Medium", marginTop: 2 }}>
          {t("home.tapForHelp")}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 18, marginTop: 18 }}>
        <View style={styles.grid}>
          {QUICK_ACTIONS.map((qa) => (
            <Pressable
              key={qa.key}
              onPress={() => router.push(qa.route as never)}
              style={[styles.qaCard, { backgroundColor: c.card, borderColor: c.border }]}
            >
              <IconBadge name={qa.icon} color={qa.color(c)} box={36} size={18} />
              <Text style={[styles.qaLabel, { color: c.text }]}>{pick(qa)}</Text>
              <Text style={[styles.qaSub, { color: c.textMuted }]}>{lang === "en" ? qa.hi : qa.en}</Text>
            </Pressable>
          ))}
        </View>

        <Card style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <Icon name="navigation" size={16} color={c.primary} />
            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text }}>
              {t("home.journey")}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: c.textMuted, marginBottom: 12 }}>{t("home.journeySub")}</Text>

          {!journey.active ? (
            <>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {[15, 30, 60].map((d) => {
                  const active = journey.duration === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setJourneyDuration(d)}
                      style={{
                        flex: 1,
                        alignItems: "center",
                        paddingVertical: 9,
                        borderRadius: 10,
                        backgroundColor: active ? c.primary : c.cardAlt,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: "Inter_700Bold",
                          color: active ? "#fff" : c.primary,
                        }}
                      >
                        {d} {t("home.minutes")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={() => {
                  startJourney();
                  showToast(t("home.sharingLive"));
                }}
                style={{ backgroundColor: c.primary, borderRadius: 10, paddingVertical: 11, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13.5 }}>
                  {t("home.startSharing")}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={[styles.liveRow, { backgroundColor: overdue ? c.dangerSoft : c.successSoft }]}>
                <View style={[styles.dot, { backgroundColor: overdue ? c.danger : c.success }]} />
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: overdue ? c.danger : c.success }}>
                  {fmtClock(journey.seconds)}
                </Text>
                <Text style={{ fontSize: 11, color: c.textMuted, marginLeft: "auto" }}>
                  / {journey.duration} {t("home.minutes")}
                </Text>
              </View>
              {overdue && (
                <Text style={{ fontSize: 11.5, color: c.danger, fontFamily: "Inter_600SemiBold", marginBottom: 12 }}>
                  {t("home.overdue")}
                </Text>
              )}
              <Pressable
                onPress={() => shareLiveLocation(point ? { lat: point.lat, lng: point.lng } : null)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  borderWidth: 1.5,
                  borderColor: c.primary,
                  borderRadius: 10,
                  paddingVertical: 10,
                  marginBottom: 10,
                }}
              >
                <Icon name="share" size={14} color={c.primary} />
                <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                  {t("home.shareLocation")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  endJourney();
                  showToast(t("home.arrivedSafely"));
                }}
                style={{ backgroundColor: c.success, borderRadius: 10, paddingVertical: 11, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13.5 }}>
                  {t("home.arrivedSafely")}
                </Text>
              </Pressable>
            </>
          )}
        </Card>

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text }}>
            {t("home.trustedContacts")}
          </Text>
          <Pressable style={{ marginLeft: "auto" }} onPress={() => router.push("/contacts")}>
            <Text style={{ fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: c.primary }}>
              {t("home.manage")}
            </Text>
          </Pressable>
        </View>

        {contacts.slice(0, 4).map((contact) => (
          <View key={contact.id} style={[styles.contactRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <Avatar label={contact.name} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.text }} numberOfLines={1}>
                {contact.name}
              </Text>
              <Text style={{ fontSize: 11.5, color: c.textMuted }}>{contact.phone}</Text>
            </View>
            <Pressable
              onPress={() => {
                showToast(`${t("common.calling")} ${contact.name}…`);
                callNumber(contact.phone);
              }}
              style={[styles.callBtn, { backgroundColor: c.successSoft }]}
            >
              <Icon name="phone" size={15} color={c.success} />
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  name: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  locPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  locText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold", maxWidth: 260 },
  sosCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: "#fff",
  },
  sosText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 17, marginTop: 4, letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  qaCard: {
    width: "47.5%",
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  qaLabel: { fontSize: 13.5, fontFamily: "Inter_700Bold", marginTop: 10 },
  qaSub: { fontSize: 11.5, marginTop: 2 },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  callBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});
