import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { withAlpha } from "@/constants/colors";
import type { IconName } from "@/constants/data";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { getCurrentLocation, reverseGeocode } from "@/lib/location";
import { firebaseAuth } from "@/lib/firebase";
import { db, supabase } from "@/lib/supabaseClient";
import type { CommunityReportType } from "../types/database";

const MAX_DESC = 280;

interface TypeOption {
  key: CommunityReportType;
  labelKey: string;
  icon: IconName;
  colorFn: (c: ReturnType<typeof useTheme>["c"]) => string;
}

const REPORT_TYPES: TypeOption[] = [
  { key: "unsafe_area",         labelKey: "community.unsafeArea",        icon: "mapPin", colorFn: (c) => c.danger  },
  { key: "harassment",          labelKey: "community.harassment",         icon: "alert",  colorFn: (c) => c.warning },
  { key: "stalking",            labelKey: "community.stalking",           icon: "user",   colorFn: (c) => c.police  },
  { key: "suspicious_activity", labelKey: "community.suspiciousActivity", icon: "flag",   colorFn: (c) => c.accent  },
];

export default function CommunityReportScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [reportType, setReportType] = useState<CommunityReportType>("unsafe_area");
  const [description, setDescription] = useState("");
  const [locationPoint, setLocationPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  useEffect(() => {
    const user = firebaseAuth.currentUser;
    setAuthed(!!user);
    setUserId(user?.uid ?? null);
  }, []);

  useEffect(() => {
    fetchLocation();
  }, []);

  const fetchLocation = async () => {
    setLoadingLocation(true);
    setAddress(null);
    try {
      const point = await getCurrentLocation();
      if (point) {
        setLocationPoint({ lat: point.lat, lng: point.lng });
        const addr = await reverseGeocode(point.lat, point.lng);
        setAddress(addr);
      }
    } finally {
      setLoadingLocation(false);
    }
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!userId || !locationPoint) return;
    setSubmitting(true);
    try {
      let photoUrl: string | undefined;

      if (photoUri) {
        try {
          const ext = (photoUri.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z]/g, "j");
          const path = `${userId}/${Date.now()}.${ext}`;
          const response = await fetch(photoUri);
          const blob = await response.blob();
          const { error: uploadErr } = await supabase.storage
            .from("community-reports")
            .upload(path, blob, { upsert: false, contentType: `image/${ext}` });
          if (!uploadErr) {
            photoUrl = supabase.storage.from("community-reports").getPublicUrl(path).data.publicUrl;
          }
        } catch {
          // photo upload non-critical — continue without it
        }
      }

      const { error } = await db.communityReports.insert(userId, {
        type: reportType,
        lat: locationPoint.lat,
        lng: locationPoint.lng,
        address: address ?? undefined,
        description: description.trim() || undefined,
        photo_url: photoUrl,
      });
      if (error) throw error;

      showToast(t("community.submitted"));
      router.back();
    } catch {
      setSubmitError(true);
      showToast(t("community.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = REPORT_TYPES.find((r) => r.key === reportType)!;

  // ── Auth loading ────────────────────────────────────────────────────────────
  if (authed === null) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  // ── Not signed in ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <LinearGradient
          colors={[c.primary, c.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 28 }}
        >
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginBottom: 14 }}>
            <Icon name="arrowLeft" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>{t("community.title")}</Text>
          <Text style={styles.headerSub}>{t("community.sub")}</Text>
        </LinearGradient>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View style={[styles.stateIcon, { backgroundColor: withAlpha(c.primary, 0.1) }]}>
            <Icon name="lock" size={36} color={c.primary} />
          </View>
          <Text style={[styles.stateTitle, { color: c.text }]}>{t("community.loginRequired")}</Text>
          <Pressable
            onPress={() => router.push("/login" as never)}
            style={[styles.submitBtn, { backgroundColor: c.primary, paddingHorizontal: 40, marginTop: 0 }]}
          >
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>
              {t("community.loginBtn")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }


  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LinearGradient
        colors={[c.primary, c.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 28 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginBottom: 14 }}>
          <Icon name="arrowLeft" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{t("community.title")}</Text>
        <Text style={styles.headerSub}>{t("community.sub")}</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Type selector ── */}
        <Text style={[styles.sectionLabel, { color: c.text }]}>{t("community.typeLabel")}</Text>
        <View style={styles.typeGrid}>
          {REPORT_TYPES.map((opt) => {
            const active = reportType === opt.key;
            const color = opt.colorFn(c);
            return (
              <Pressable
                key={opt.key}
                onPress={() => setReportType(opt.key)}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: active ? withAlpha(color, 0.12) : c.card,
                    borderColor: active ? color : c.border,
                    borderWidth: active ? 1.5 : 1,
                  },
                ]}
              >
                <View style={[styles.typeIcon, { backgroundColor: withAlpha(color, active ? 0.2 : 0.1) }]}>
                  <Icon name={opt.icon} size={20} color={color} />
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Inter_600SemiBold",
                    color: active ? color : c.text,
                    textAlign: "center",
                  }}
                  numberOfLines={2}
                >
                  {t(opt.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Description ── */}
        <Text style={[styles.sectionLabel, { color: c.text, marginTop: 20 }]}>
          {t("community.descLabel")}
        </Text>
        <TextInput
          value={description}
          onChangeText={(v) => setDescription(v.slice(0, MAX_DESC))}
          placeholder={t("community.descPlaceholder")}
          placeholderTextColor={c.textFaint}
          multiline
          numberOfLines={4}
          style={[
            styles.textArea,
            { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border },
          ]}
        />
        <Text style={{ fontSize: 11, color: c.textFaint, textAlign: "right", marginTop: 4 }}>
          {description.length} / {MAX_DESC}
        </Text>

        {/* ── Location ── */}
        <Text style={[styles.sectionLabel, { color: c.text, marginTop: 20 }]}>
          {t("community.locationLabel")}
        </Text>
        <Pressable
          onPress={fetchLocation}
          style={[
            styles.locationChip,
            {
              backgroundColor: locationPoint ? withAlpha(c.success, 0.07) : withAlpha(c.warning, 0.07),
              borderColor: locationPoint ? withAlpha(c.success, 0.3) : withAlpha(c.warning, 0.3),
            },
          ]}
        >
          {loadingLocation ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : (
            <Icon name="mapPin" size={16} color={locationPoint ? c.success : c.warning} />
          )}
          <Text style={{ flex: 1, fontSize: 12.5, color: c.text, lineHeight: 18 }} numberOfLines={2}>
            {loadingLocation
              ? t("home.locating")
              : address ??
                (locationPoint
                  ? `${locationPoint.lat.toFixed(5)}, ${locationPoint.lng.toFixed(5)}`
                  : t("community.noLocation"))}
          </Text>
          <Icon name="navigation" size={13} color={c.textFaint} />
        </Pressable>

        {/* ── Photo ── */}
        <Text style={[styles.sectionLabel, { color: c.text, marginTop: 20 }]}>
          {t("community.photoLabel")}
        </Text>
        {photoUri ? (
          <View style={styles.photoPreviewWrap}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            <Pressable
              onPress={() => setPhotoUri(null)}
              style={[styles.removePhotoBadge, { backgroundColor: c.danger }]}
            >
              <Icon name="x" size={14} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={pickPhoto}
            style={[
              styles.photoPickerBtn,
              { backgroundColor: c.cardAlt, borderColor: c.border },
            ]}
          >
            <Icon name="camera" size={20} color={c.textMuted} />
            <Text style={{ fontSize: 13, color: c.textMuted, fontFamily: "Inter_600SemiBold" }}>
              {t("community.photoPick")}
            </Text>
          </Pressable>
        )}

        {/* ── Review note ── */}
        <View
          style={[
            styles.noteBox,
            { backgroundColor: withAlpha(c.primary, 0.06), borderColor: withAlpha(c.primary, 0.15) },
          ]}
        >
          <Icon name="info" size={13} color={c.primary} />
          <Text style={{ flex: 1, fontSize: 11, color: c.textMuted, lineHeight: 17 }}>
            {t("community.note")}
          </Text>
        </View>

        {/* ── Error / retry banner ── */}
        {submitError && (
          <View
            style={[
              styles.noteBox,
              { backgroundColor: withAlpha(c.danger, 0.07), borderColor: withAlpha(c.danger, 0.25), marginTop: 16 },
            ]}
          >
            <Icon name="alert" size={14} color={c.danger} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: c.danger, fontFamily: "Inter_600SemiBold" }}>
                {t("community.error")}
              </Text>
              <Pressable onPress={handleSubmit} style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 12, color: c.danger, fontFamily: "Inter_700Bold", textDecorationLine: "underline" }}>
                  {t("common.retry")}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Submit ── */}
        <Pressable
          onPress={() => { setSubmitError(false); handleSubmit(); }}
          disabled={submitting || !locationPoint}
          style={[
            styles.submitBtn,
            { backgroundColor: !locationPoint ? c.border : selectedType.colorFn(c) },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon name="send" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>
                {submitError ? t("common.retry") : t("community.submit")}
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub:  { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 4, fontFamily: "Inter_500Medium" },
  sectionLabel: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 10 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: {
    width: "47%",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    gap: 8,
  },
  typeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  textArea: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  photoPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 22,
  },
  photoPreviewWrap: { position: "relative", alignSelf: "flex-start" },
  photoPreview: { width: 120, height: 120, borderRadius: 12 },
  removePhotoBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  noteBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 20,
    marginBottom: 4,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 20,
  },
  stateIcon: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  stateTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 10 },
});
