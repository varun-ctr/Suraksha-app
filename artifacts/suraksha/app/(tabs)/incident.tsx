import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { withAlpha } from "@/constants/colors";
import { INCIDENT_TYPES } from "@/constants/data";
import type { IncidentTypeKey } from "@/constants/data";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { useLocation } from "@/hooks/useLocation";
import { timeAgo } from "@/lib/format";
import { reverseGeocode } from "@/lib/location";
import { firebaseAuth } from "@/lib/firebase";
import { db } from "@/lib/supabaseClient";
import type { CommunityReportRow } from "@/types/database";
import { fetchWeather, type WeatherData } from "@/lib/weather";

// ── Tab switcher ──────────────────────────────────────────────────────────────

type ActiveTab = "new" | "mine";

// ── Moderation badge ──────────────────────────────────────────────────────────

function ModerationBadge({ status }: { status: string }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const color =
    status === "reviewed" ? c.success : status === "removed" ? c.danger : c.warning;
  const label =
    status === "reviewed"
      ? t("incident.reviewed")
      : status === "removed"
        ? t("incident.removed")
        : t("incident.pending");
  return (
    <View style={{ backgroundColor: withAlpha(color, 0.12), borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start" }}>
      <Text style={{ fontSize: 10.5, fontFamily: "Inter_600SemiBold", color }}>{label}</Text>
    </View>
  );
}

// ── Report card ───────────────────────────────────────────────────────────────

function ReportCard({ report, lang }: { report: CommunityReportRow; lang: string }) {
  const { c } = useTheme();
  const { pick } = useI18n();
  const incident = INCIDENT_TYPES.find((t) => t.key === report.type);
  const color = incident ? incident.color(c) : c.textMuted;
  return (
    <View style={[styles.reportCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={[styles.reportBadge, { backgroundColor: withAlpha(color, 0.12) }]}>
          <Icon name={incident?.icon ?? "flag"} size={16} color={color} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.text }}>
            {incident ? pick(incident) : report.type}
          </Text>
          {report.description ? (
            <Text style={{ fontSize: 12, color: c.textMuted, lineHeight: 17 }} numberOfLines={2}>
              {report.description}
            </Text>
          ) : null}
          {report.address ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
              <Icon name="mapPin" size={11} color={c.textFaint} />
              <Text style={{ fontSize: 11, color: c.textFaint }} numberOfLines={1}>
                {report.address}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Text style={{ fontSize: 10.5, color: c.textFaint }}>
              {timeAgo(new Date(report.created_at).getTime(), lang)}
            </Text>
            <ModerationBadge status={report.moderation_status} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function IncidentScreen() {
  const { c } = useTheme();
  const { t, pick, lang } = useI18n();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>("new");

  // Form state
  const [incidentType, setIncidentType] = useState<IncidentTypeKey>("harassment");
  const [description, setDescription] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Location & weather
  const { point, address: locationAddress, status: locStatus } = useLocation();
  const [address, setAddress] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // My reports
  const [myReports, setMyReports] = useState<CommunityReportRow[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Resolve address when GPS is ready
  useEffect(() => {
    if (point && !address) {
      reverseGeocode(point.lat, point.lng)
        .then((a) => { if (a) setAddress(a); })
        .catch(() => {});
    }
  }, [point, address]);

  // Fetch weather when GPS ready
  useEffect(() => {
    if (point) {
      fetchWeather(point.lat, point.lng)
        .then((w) => { if (w) setWeather(w); })
        .catch(() => {});
    }
  }, [point]);

  const loadMyReports = useCallback(async () => {
    const user = firebaseAuth.currentUser;
    if (!user) return;
    setLoadingReports(true);
    try {
      const { data } = await db.communityReports.listForUser(user.uid);
      if (data) setMyReports(data);
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    void loadMyReports();
  }, [loadMyReports]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMyReports();
    setRefreshing(false);
  }, [loadMyReports]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      showToast(t("incident.addPhoto"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const submit = async () => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      showToast(t("incident.loginRequired"));
      router.push("/login" as never);
      return;
    }
    if (!point) {
      showToast(t("incident.noLocation"));
      return;
    }

    setSubmitting(true);
    try {
      const descText = isAnonymous
        ? `[Anonymous] ${description.trim()}`
        : description.trim();

      const { error } = await db.communityReports.insert(user.uid, {
        type: incidentType as CommunityReportRow["type"],
        lat: point.lat,
        lng: point.lng,
        address: address ?? null,
        description: descText || null,
        photo_url: null,
      });

      if (error) throw error;

      showToast(t("incident.submitted"));
      setDescription("");
      setPhotoUri(undefined);
      setIncidentType("harassment");
      setIsAnonymous(false);
      setActiveTab("mine");
      void loadMyReports();
    } catch {
      showToast(t("incident.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = INCIDENT_TYPES.find((i) => i.key === incidentType)!;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* ── Gradient header ─────────────────────────────────── */}
      <LinearGradient
        colors={[c.primary, c.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 20 }}
      >
        <Text style={styles.headerTitle}>{t("incident.title")}</Text>
        <Text style={styles.headerSub}>{t("incident.sub")}</Text>
      </LinearGradient>

      {/* ── Tab bar ─────────────────────────────────────────── */}
      <View style={[styles.tabBar, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {(["new", "mine"] as ActiveTab[]).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === "new" ? t("incident.newReport") : t("incident.myReports");
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabItem, isActive && { borderBottomColor: c.primary, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabLabel, { color: isActive ? c.primary : c.textMuted }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === "new" ? (
        /* ── Report Form ───────────────────────────────────── */
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Weather strip */}
          {weather && (
            <View style={[styles.weatherRow, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={{ fontSize: 18 }}>{weather.icon}</Text>
              <Text style={{ fontSize: 13, color: c.textMuted, flex: 1 }}>
                {weather.temp}°C · {weather.label}
              </Text>
              <Icon name="mapPin" size={12} color={c.textFaint} />
              <Text style={{ fontSize: 11, color: c.textFaint }} numberOfLines={1}>
                {address ?? t("home.locating")}
              </Text>
            </View>
          )}

          {/* Type selector */}
          <Text style={[styles.label, { color: c.textMuted }]}>{t("incident.typeLabel")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            {INCIDENT_TYPES.map((itype) => {
              const active = incidentType === itype.key;
              const color = itype.color(c);
              return (
                <Pressable
                  key={itype.key}
                  onPress={() => setIncidentType(itype.key)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: active ? color : withAlpha(color, 0.08),
                      borderColor: active ? color : withAlpha(color, 0.2),
                    },
                  ]}
                >
                  <Icon name={itype.icon} size={13} color={active ? "#fff" : color} />
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: active ? "#fff" : color }}>
                    {pick(itype)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Description */}
          <Text style={[styles.label, { color: c.textMuted }]}>{t("incident.descLabel")}</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t("incident.descPlaceholder")}
            placeholderTextColor={c.textFaint}
            multiline
            style={[styles.textarea, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border }]}
          />

          {/* Photo */}
          {photoUri ? (
            <View style={{ marginTop: 12, position: "relative" }}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
              <Pressable
                onPress={() => setPhotoUri(undefined)}
                style={[styles.photoRemove, { backgroundColor: c.danger }]}
              >
                <Icon name="x" size={14} color="#fff" />
              </Pressable>
              <View style={[styles.photoBadge, { backgroundColor: c.success }]}>
                <Text style={{ fontSize: 10.5, color: "#fff", fontFamily: "Inter_600SemiBold" }}>
                  {t("incident.photoAdded")}
                </Text>
              </View>
            </View>
          ) : (
            <Pressable onPress={pickPhoto} style={[styles.photoBtn, { borderColor: c.border }]}>
              <Icon name="camera" size={16} color={c.primary} />
              <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                {t("incident.addPhoto")}
              </Text>
            </Pressable>
          )}

          {/* Location */}
          <View style={[styles.locationRow, { backgroundColor: c.cardAlt, borderColor: c.border }]}>
            <Icon name="mapPin" size={15} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: c.textMuted }}>
                {t("incident.location")}
              </Text>
              <Text style={{ fontSize: 12, color: c.text, marginTop: 2 }} numberOfLines={2}>
                {locStatus === "loading"
                  ? t("home.locating")
                  : locStatus === "denied"
                    ? t("incident.noLocation")
                    : address ?? (point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : t("home.locating"))}
              </Text>
            </View>
          </View>

          {/* Anonymous toggle */}
          <Pressable
            onPress={() => setIsAnonymous((v) => !v)}
            style={[styles.anonRow, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: isAnonymous ? c.primary : c.border,
                  backgroundColor: isAnonymous ? c.primary : "transparent",
                },
              ]}
            >
              {isAnonymous && <Icon name="check" size={12} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: c.text }}>
                {t("incident.anonymous")}
              </Text>
              <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 1 }}>
                {t("incident.anonymousSub")}
              </Text>
            </View>
          </Pressable>

          {/* Current incident summary */}
          <View style={[styles.summaryRow, { backgroundColor: withAlpha(selectedType.color(c), 0.08), borderColor: withAlpha(selectedType.color(c), 0.2) }]}>
            <Icon name={selectedType.icon} size={14} color={selectedType.color(c)} />
            <Text style={{ fontSize: 12, color: selectedType.color(c), fontFamily: "Inter_600SemiBold", flex: 1 }}>
              {pick(selectedType)}
              {weather ? ` · ${weather.temp}°C ${weather.icon}` : ""}
              {point ? ` · GPS ✓` : ""}
            </Text>
          </View>

          {/* Submit */}
          <Pressable
            onPress={submit}
            disabled={submitting || locStatus === "denied"}
            style={[
              styles.submitBtn,
              { backgroundColor: submitting || locStatus === "denied" ? c.border : c.primary },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Icon name="flag" size={16} color="#fff" />
            )}
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>
              {submitting ? t("incident.submitting") : t("incident.submit")}
            </Text>
          </Pressable>

          <Text style={{ fontSize: 11, color: c.textFaint, textAlign: "center", marginTop: 10, lineHeight: 16 }}>
            {t("incident.note")}
          </Text>
        </ScrollView>
      ) : (
        /* ── My Reports ─────────────────────────────────────── */
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.primary}
              colors={[c.primary]}
            />
          }
        >
          {loadingReports ? (
            <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 40 }} />
          ) : myReports.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>🚩</Text>
              <Text style={{ fontSize: 14, color: c.textMuted, textAlign: "center", lineHeight: 20 }}>
                {t("incident.empty")}
              </Text>
              <Pressable
                onPress={() => setActiveTab("new")}
                style={[styles.emptyBtn, { backgroundColor: c.primary }]}
              >
                <Icon name="plus" size={14} color="#fff" />
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 }}>
                  {t("incident.newReport")}
                </Text>
              </Pressable>
            </View>
          ) : (
            myReports.map((r) => (
              <ReportCard key={r.id} report={r} lang={lang} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  headerSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabLabel: {
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  weatherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: "top",
    marginBottom: 4,
  },
  photoPreview: {
    width: "100%",
    height: 160,
    borderRadius: 12,
  },
  photoRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  photoBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  anonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 4,
  },
  reportCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  reportBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 20,
  },
});
