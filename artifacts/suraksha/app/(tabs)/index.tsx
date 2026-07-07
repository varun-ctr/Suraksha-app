import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { LanguagePicker } from "@/components/LanguagePicker";
import { Avatar, Card } from "@/components/ui";
import { withAlpha } from "@/constants/colors";
import { QUICK_ACTIONS } from "@/constants/data";
import { LANG_BY_CODE } from "@/constants/languages";
import type { LangCode } from "@/constants/languages";
import { useApp } from "@/context/AppContext";
import { useI18n } from "@/context/LanguageContext";
import { useSafety } from "@/context/SafetyContext";
import type { SafetyStatus } from "@/context/SafetyContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { useLocation } from "@/hooks/useLocation";
import { fmtClock } from "@/lib/format";
import { formatCoords } from "@/lib/location";
import { callNumber, shareLiveLocation } from "@/lib/native";
import { sendJourneyAlerts } from "@/lib/sosAlert";
import type { WeatherData } from "@/lib/weather";
import { fetchWeather } from "@/lib/weather";

// ── Safety Score helpers ──────────────────────────────────────────────────────

function computeSafetyScore(
  status: SafetyStatus,
  weather: WeatherData | null,
  hasContacts: boolean,
  locationReady: boolean,
): number {
  let s = 20;
  const h = new Date().getHours();
  if (h >= 6 && h < 21) s += 20;
  if (hasContacts) s += 20;
  if (locationReady) s += 15;
  if (weather) {
    s += weather.code < 50 ? 25 : weather.code < 80 ? 12 : 0;
  } else {
    s += 25;
  }
  if (status === "emergency") s = Math.min(s, 30);
  else if (status === "caution") s = Math.min(s, 65);
  return Math.min(100, Math.max(10, s));
}

function scoreColor(score: number, c: ReturnType<typeof useTheme>["c"]): string {
  return score >= 70 ? c.success : score >= 40 ? c.warning : c.danger;
}

function scoreLabelKey(score: number): string {
  return score >= 70 ? "home.statusProtected" : score >= 40 ? "home.statusModerateRisk" : "home.statusHighRisk";
}

function getSafetySuggestions(weather: WeatherData | null): string[] {
  const out: string[] = [];
  const h = new Date().getHours();
  if (weather?.code !== undefined) {
    if (weather.code >= 95) out.push("⛈ Storm warning — stay indoors if possible");
    else if (weather.code >= 61) out.push("🌧 Carry an umbrella today");
    else if (weather.code >= 45) out.push("🌫 Low visibility — drive carefully");
    else if (weather.code < 3) out.push("☀️ Clear skies — great travel conditions");
  }
  if (h >= 21 || h < 5) out.push("🌙 Avoid poorly lit streets tonight");
  else if (h >= 6 && h < 10) out.push("🚦 Morning rush — plan your commute");
  else if (h >= 17 && h < 20) out.push("🚦 Evening rush hour ahead");
  out.push("📍 Share your live location with trusted contacts");
  return out.slice(0, 3);
}

// ── Safety Score Card ─────────────────────────────────────────────────────────

function SafetyScoreCard({
  score,
  weather,
  locLabel,
  hasContacts,
  locationReady,
  onViewDetails,
}: {
  score: number;
  weather: WeatherData | null;
  locLabel: string;
  hasContacts: boolean;
  locationReady: boolean;
  onViewDetails: () => void;
}) {
  const { c } = useTheme();
  const { t } = useI18n();
  const color = scoreColor(score, c);
  const label = t(scoreLabelKey(score));
  const emoji = score >= 70 ? "🛡️" : score >= 40 ? "⚠️" : "🆘";

  return (
    <Card style={styles.scoreCard}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.scoreHeading, { color: c.textMuted }]}>{t("home.safetyScore")}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
            <Text style={[styles.scoreNumber, { color }]}>{score}</Text>
            <Text style={[styles.scoreOf, { color: c.textFaint }]}>/100</Text>
          </View>
          <View style={[styles.scoreBadge, { backgroundColor: withAlpha(color, 0.12) }]}>
            <View style={[styles.scoreDot, { backgroundColor: color }]} />
            <Text style={[styles.scoreBadgeText, { color }]}>{label}</Text>
          </View>
        </View>

        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <View style={[styles.scoreEmoji, { borderColor: withAlpha(color, 0.25) }]}>
            <Text style={{ fontSize: 26 }}>{emoji}</Text>
          </View>
          {weather && (
            <View style={styles.infoRow}>
              <Text style={{ fontSize: 13 }}>{weather.icon}</Text>
              <Text style={[styles.infoText, { color: c.textMuted }]}>
                {weather.temp}°C · {weather.label}
              </Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Icon name="mapPin" size={11} color={c.textFaint} />
            <Text style={[styles.infoText, { color: c.textFaint }]} numberOfLines={1}>
              {locLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.readinessBlock, { borderTopColor: c.border }]}>
        <View style={styles.readinessRow}>
          <Icon
            name={locationReady ? "check" : "alertCircle"}
            size={14}
            color={locationReady ? c.success : c.warning}
          />
          <Text style={[styles.readinessText, { color: c.textMuted }]}>
            {locationReady ? t("home.readinessLocationActive") : t("home.locationOff")}
          </Text>
        </View>
        <View style={styles.readinessRow}>
          <Icon
            name={hasContacts ? "check" : "alertCircle"}
            size={14}
            color={hasContacts ? c.success : c.warning}
          />
          <Text style={[styles.readinessText, { color: c.textMuted }]}>
            {hasContacts ? t("home.readinessContactsReady") : t("home.readinessContactsMissing")}
          </Text>
        </View>

        <Pressable
          onPress={onViewDetails}
          style={styles.viewDetailsRow}
          accessibilityRole="button"
          accessibilityLabel={t("home.viewDetails")}
        >
          <Text style={[styles.viewDetailsText, { color: c.primary }]}>{t("home.viewDetails")}</Text>
          <Icon name="chevronRight" size={14} color={c.primary} />
        </Pressable>
      </View>
    </Card>
  );
}

// ── One-Tap SOS Button ────────────────────────────────────────────────────────

function HoldSOSButton({ onTrigger }: { onTrigger: () => void }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const pulse = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const handlePress = () => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 300, useNativeDriver: true }),
    ]).start();
    onTrigger();
  };

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.75] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.25, 0] });

  return (
    <View style={{ alignItems: "center", paddingVertical: 8 }}>
      <View style={styles.sosWrap}>
        <Animated.View
          style={[
            styles.sosRing,
            { backgroundColor: c.danger, transform: [{ scale: pulseScale }], opacity: pulseOpacity },
          ]}
        />
        <Pressable onPress={handlePress}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <LinearGradient
              colors={[c.danger, c.dangerDark]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={[styles.sosCircle, { shadowColor: c.danger }]}
            >
              <Text style={styles.sosHoldLine}>SOS</Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </View>
      <Text style={[styles.sosSub, { color: c.textMuted }]}>{t("sos.tapOnceToActivate")}</Text>
      <Text style={[styles.sosHint, { color: c.textFaint }]}>{t("sos.cancelWindowHint")}</Text>
    </View>
  );
}

// ── Home Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { c } = useTheme();
  const { t, pick, lang, setLang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { contacts, profile } = useApp();
  const { triggerSOS, journey, setJourneyDuration, startJourney, endJourney, checkInJourney, safetyStatus } =
    useSafety();
  const { showToast } = useToast();
  const { point, address, status } = useLocation();
  const { width: screenWidth } = useWindowDimensions();
  const [showLangPicker, setShowLangPicker] = React.useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  const displayName = profile.name.trim() || t("home.guest");
  const locLabel =
    status === "loading"
      ? t("home.locating")
      : status === "denied"
        ? t("home.locationOff")
        : address ?? (point ? formatCoords(point) : t("home.locating"));
  const overdue = journey.active && journey.seconds >= journey.duration * 60;
  const locationReady = status === "ready";

  const hour = new Date().getHours();
  const greetingKey =
    hour < 12
      ? "home.greetingMorning"
      : hour < 17
        ? "home.greetingAfternoon"
        : hour < 21
          ? "home.greetingEvening"
          : "home.greetingNight";

  const score = computeSafetyScore(safetyStatus, weather, contacts.length > 0, locationReady);

  const handleStartJourney = useCallback(() => {
    startJourney();
    showToast(t("home.sharingLive"));
    void sendJourneyAlerts(
      contacts,
      point ?? null,
      journey.duration,
      profile.name.trim() || t("home.guest"),
      address,
    );
  }, [startJourney, showToast, t, contacts, point, journey.duration, profile.name, address]);
  const suggestions = getSafetySuggestions(weather);

  useEffect(() => {
    if (point) {
      fetchWeather(point.lat, point.lng)
        .then((w) => {
          if (w) setWeather(w);
        })
        .catch(() => {});
    }
  }, [point]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Gradient header ─────────────────────────────────── */}
      <LinearGradient
        colors={[c.primary, c.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 46 }}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.greeting}>{t(greetingKey)}</Text>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              style={styles.iconBtn}
              onPress={() => setShowLangPicker(true)}
              hitSlop={8}
            >
              <Text style={{ fontSize: 16 }}>{LANG_BY_CODE[lang]?.flag ?? "🌐"}</Text>
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={() => router.push("/helpline")}>
              <Icon name="bell" size={18} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => router.push("/(tabs)/profile" as never)}
              style={styles.avatarBtn}
            >
              {profile.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 }}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <View style={styles.pill}>
            <Icon name="mapPin" size={12} color="rgba(255,255,255,0.9)" />
            <Text style={styles.pillText} numberOfLines={1}>{locLabel}</Text>
          </View>
          {weather && (
            <View style={styles.pill}>
              <Text style={{ fontSize: 13 }}>{weather.icon}</Text>
              <Text style={styles.pillText}>{weather.temp}°C</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* ── Language picker modal ───────────────────────────── */}
      <Modal
        visible={showLangPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLangPicker(false)}
      >
        <Pressable
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}
          onPress={() => setShowLangPicker(false)}
        >
          <Pressable
            style={{
              backgroundColor: c.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 22,
              paddingBottom: 36,
              maxHeight: "85%",
            }}
            onPress={() => {}}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", color: c.text }}>
                {t("home.selectLanguage")}
              </Text>
              <Pressable onPress={() => setShowLangPicker(false)} hitSlop={10}>
                <Icon name="x" size={20} color={c.textMuted} />
              </Pressable>
            </View>
            <LanguagePicker
              selected={lang}
              onSelect={(code: LangCode) => {
                setLang(code);
                setShowLangPicker(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Safety Score card (overlaps header) ────────────── */}
      <View style={{ paddingHorizontal: 16, marginTop: -29 }}>
        <SafetyScoreCard
          score={score}
          weather={weather}
          locLabel={locLabel}
          hasContacts={contacts.length > 0}
          locationReady={locationReady}
          onViewDetails={() => {}}
        />
      </View>

      {/* ── SOS Section ────────────────────────────────────── */}
      <View style={{ alignItems: "center", paddingTop: 24, paddingBottom: 4 }}>
        <HoldSOSButton onTrigger={triggerSOS} />
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        {/* ── Quick Actions — 2-column grid ───────────────── */}
        <Text style={[styles.sectionTitle, { color: c.text }]}>Quick Actions</Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 22,
          }}
        >
          {QUICK_ACTIONS.map((qa) => {
            const cardWidth = Math.floor((screenWidth - 32 - 10) / 2);
            return (
              <Pressable
                key={qa.key}
                onPress={() => {
                  if (qa.key === "journey") {
                    handleStartJourney();
                  } else if (qa.key === "weather") {
                    showToast(
                      weather
                        ? `${weather.label} · ${weather.temp}°C`
                        : lang === "hi" ? "मौसम डेटा उपलब्ध नहीं" : "No weather data yet",
                    );
                  } else {
                    router.push(qa.route as never);
                  }
                }}
                style={({ pressed }) => [
                  styles.qaCard,
                  {
                    width: cardWidth,
                    backgroundColor: c.card,
                    borderColor: c.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.qaIconWrap,
                    { backgroundColor: withAlpha(qa.color(c), 0.12) },
                  ]}
                >
                  <Icon name={qa.icon} size={20} color={qa.color(c)} />
                </View>
                <Text style={[styles.qaLabel, { color: c.text }]} numberOfLines={2}>
                  {pick(qa)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Today's Safety ─────────────────────────────── */}
        {suggestions.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Today's Safety</Text>
            <View style={[styles.surfaceCard, { backgroundColor: c.card, borderColor: c.border }]}>
              {weather && (
                <View style={[styles.weatherRow, { borderBottomColor: c.border }]}>
                  <Text style={{ fontSize: 24 }}>{weather.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text }}
                    >
                      {weather.label}
                    </Text>
                    <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 1 }}>
                      {weather.temp}°C · {locLabel}
                    </Text>
                  </View>
                </View>
              )}
              <View style={{ gap: 10, paddingTop: weather ? 14 : 0 }}>
                {suggestions.map((s, i) => (
                  <Text
                    key={i}
                    style={{
                      fontSize: 13.5,
                      fontFamily: "Inter_500Medium",
                      color: c.text,
                      lineHeight: 20,
                    }}
                  >
                    {s}
                  </Text>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ── Journey Timer ──────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: c.text }]}>{t("home.journey")}</Text>
        <View style={[styles.surfaceCard, { backgroundColor: c.card, borderColor: c.border, marginBottom: 22 }]}>
          <Text style={{ fontSize: 12.5, color: c.textMuted, marginBottom: 14 }}>
            {t("home.journeySub")}
          </Text>
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
                        paddingVertical: 10,
                        borderRadius: 12,
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
                onPress={handleStartJourney}
                style={{
                  backgroundColor: c.primary,
                  borderRadius: 14,
                  paddingVertical: 13,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>
                  {t("home.startSharing")}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <View
                style={[
                  styles.liveRow,
                  { backgroundColor: overdue ? c.dangerSoft : c.successSoft },
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: overdue ? c.danger : c.success },
                  ]}
                />
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Inter_700Bold",
                    color: overdue ? c.danger : c.success,
                  }}
                >
                  {fmtClock(journey.seconds)}
                </Text>
                <Text style={{ fontSize: 12, color: c.textMuted, marginLeft: "auto" }}>
                  / {journey.duration} {t("home.minutes")}
                </Text>
              </View>
              {/* ── Overdue "Are you safe?" banner ─── */}
              {journey.overdue && (
                <View
                  style={{
                    backgroundColor: c.dangerSoft,
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: withAlpha(c.danger, 0.3),
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Icon name="alert" size={16} color={c.danger} />
                    <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.danger }}>
                      Are you safe?
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12.5, color: c.textMuted, marginBottom: 12, lineHeight: 18 }}>
                    Your journey timer has ended.{" "}
                    {journey.overdueSeconds > 0 && (
                      `Auto-SOS in ${journey.overdueSeconds}s if no response.`
                    )}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => {
                        checkInJourney();
                        showToast(t("home.arrivedSafely"));
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: c.success,
                        borderRadius: 12,
                        paddingVertical: 11,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 }}>
                        I'm Safe
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={triggerSOS}
                      style={{
                        flex: 1,
                        backgroundColor: c.danger,
                        borderRadius: 12,
                        paddingVertical: 11,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 }}>
                        Send SOS
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              <Pressable
                onPress={() =>
                  shareLiveLocation(point ? { lat: point.lat, lng: point.lng } : null)
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  borderWidth: 1.5,
                  borderColor: c.primary,
                  borderRadius: 12,
                  paddingVertical: 11,
                  marginBottom: 10,
                }}
              >
                <Icon name="share" size={14} color={c.primary} />
                <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 13.5 }}>
                  {t("home.shareLocation")}
                </Text>
              </Pressable>
              {!journey.overdue && (
                <Pressable
                  onPress={() => {
                    endJourney();
                    showToast(t("home.arrivedSafely"));
                  }}
                  style={{
                    backgroundColor: c.success,
                    borderRadius: 14,
                    paddingVertical: 13,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>
                    {t("home.arrivedSafely")}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>

        {/* ── Trusted Contacts ───────────────────────────── */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.text }}>
            {t("home.trustedContacts")}
          </Text>
          <Pressable style={{ marginLeft: "auto" }} onPress={() => router.push("/contacts")}>
            <Text style={{ fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: c.primary }}>
              {t("home.manage")}
            </Text>
          </Pressable>
        </View>

        {contacts.length === 0 ? (
          <Pressable
            onPress={() => router.push("/contacts")}
            style={[
              styles.noContactsRow,
              { backgroundColor: c.cardAlt, borderColor: c.border },
            ]}
          >
            <Icon name="users" size={18} color={c.primary} />
            <Text style={{ fontSize: 13, color: c.textMuted, fontFamily: "Inter_500Medium" }}>
              {t("home.noContacts")}
            </Text>
          </Pressable>
        ) : (
          contacts.slice(0, 4).map((contact) => (
            <View
              key={contact.id}
              style={[styles.contactRow, { backgroundColor: c.card, borderColor: c.border }]}
            >
              <Avatar label={contact.name} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.text }}
                  numberOfLines={1}
                >
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
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  greeting: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  name: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    maxWidth: 200,
  },

  // Score card
  scoreCard: {
    borderRadius: 20,
    padding: 18,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
  },
  readinessBlock: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  readinessRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  readinessText: { fontSize: 12.5, fontFamily: "Inter_500Medium", flexShrink: 1 },
  viewDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    marginTop: 4,
    paddingVertical: 6,
  },
  viewDetailsText: { fontSize: 12.5, fontFamily: "Inter_700Bold" },
  scoreHeading: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  scoreNumber: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    lineHeight: 54,
  },
  scoreOf: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginTop: 7,
  },
  scoreDot: { width: 7, height: 7, borderRadius: 3.5 },
  scoreBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  scoreEmoji: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  infoText: { fontSize: 11.5, fontFamily: "Inter_500Medium", maxWidth: 112 },

  // SOS
  sosWrap: {
    width: 210,
    height: 210,
    alignItems: "center",
    justifyContent: "center",
  },
  sosRing: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  sosCircle: {
    width: 164,
    height: 164,
    borderRadius: 82,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: "rgba(255,255,255,0.3)",
    elevation: 10,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    gap: 1,
  },
  sosHoldLine: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: 3,
    lineHeight: 26,
  },
  sosCountdown: {
    color: "#fff",
    fontSize: 68,
    fontFamily: "Inter_700Bold",
    lineHeight: 76,
  },
  sosSub: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    marginTop: 6,
  },
  sosHint: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },

  // Sections
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
    marginTop: 2,
  },

  // Quick action
  qaCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  qaIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  qaLabel: {
    fontSize: 12.5,
    fontFamily: "Inter_700Bold",
    lineHeight: 17,
  },

  // Surface card (Today's Safety, Journey)
  surfaceCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 22,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  weatherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  // Journey
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
  },
  dot: { width: 9, height: 9, borderRadius: 4.5 },

  // Contacts
  noContactsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
