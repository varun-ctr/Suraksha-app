import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { BackHeader } from "@/components/Headers";
import { Icon } from "@/components/Icon";
import { withAlpha } from "@/constants/colors";
import { REPORT_CATEGORIES } from "@/constants/data";
import { useApp } from "@/context/AppContext";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { timeAgo } from "@/lib/format";

export default function ReportScreen() {
  const { c } = useTheme();
  const { t, pick, lang } = useI18n();
  const { reports, addReport, deleteReport } = useApp();
  const { showToast } = useToast();

  const [category, setCategory] = useState(REPORT_CATEGORIES[0].key);
  const [description, setDescription] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [attachLocation, setAttachLocation] = useState(true);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showToast(t("report.addPhoto"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const submit = () => {
    if (!description.trim()) return;
    addReport({
      category,
      description: description.trim(),
      photoUri,
      location: attachLocation ? "Koramangala, Bengaluru" : undefined,
    });
    setDescription("");
    setPhotoUri(undefined);
    setCategory(REPORT_CATEGORIES[0].key);
    showToast(t("report.submitted"));
  };

  const catLabel = (key: string) => {
    const found = REPORT_CATEGORIES.find((r) => r.key === key);
    return found ? pick(found) : key;
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title={t("report.title")} subtitle={t("report.sub")} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text, marginBottom: 12 }}>
            {t("report.newReport")}
          </Text>

          <Text style={[styles.label, { color: c.textMuted }]}>{t("report.category")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {REPORT_CATEGORIES.map((cat) => {
              const active = category === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => setCategory(cat.key)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: active ? c.primary : c.cardAlt,
                  }}
                >
                  <Icon name={cat.icon} size={13} color={active ? "#fff" : c.primary} />
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: active ? "#fff" : c.text }}>
                    {pick(cat)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: c.textMuted }]}>{t("report.description")}</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t("report.description")}
            placeholderTextColor={c.textFaint}
            multiline
            style={[styles.textarea, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border }]}
          />

          {photoUri ? (
            <View style={{ marginTop: 12 }}>
              <Image source={{ uri: photoUri }} style={styles.preview} contentFit="cover" />
              <Pressable onPress={() => setPhotoUri(undefined)} style={[styles.removePhoto, { backgroundColor: c.danger }]}>
                <Icon name="x" size={14} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={pickPhoto} style={[styles.photoBtn, { borderColor: c.border }]}>
              <Icon name="camera" size={16} color={c.primary} />
              <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{t("report.addPhoto")}</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => setAttachLocation((v) => !v)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: attachLocation ? c.primary : c.border, backgroundColor: attachLocation ? c.primary : "transparent" },
              ]}
            >
              {attachLocation && <Icon name="check" size={12} color="#fff" />}
            </View>
            <Icon name="mapPin" size={14} color={c.textMuted} />
            <Text style={{ fontSize: 12.5, color: c.text }}>{t("report.attachLocation")}</Text>
          </Pressable>

          <Pressable
            onPress={submit}
            disabled={!description.trim()}
            style={[styles.submitBtn, { backgroundColor: description.trim() ? c.primary : c.border }]}
          >
            <Icon name="check" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13.5 }}>{t("report.submit")}</Text>
          </Pressable>

          <Text style={{ fontSize: 11, color: c.textFaint, textAlign: "center", marginTop: 12 }}>
            {t("report.anonymous")}
          </Text>
        </View>

        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text, marginBottom: 10 }}>
          {t("report.recent")}
        </Text>
        {reports.length === 0 ? (
          <Text style={{ textAlign: "center", color: c.textMuted, fontSize: 13, marginTop: 10 }}>
            {t("report.empty")}
          </Text>
        ) : (
          reports.map((r) => (
            <View key={r.id} style={[styles.reportRow, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={[styles.reportBadge, { backgroundColor: withAlpha(c.accent, 0.12) }]}>
                <Icon name="fileText" size={16} color={c.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: c.text }}>{catLabel(r.category)}</Text>
                <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }} numberOfLines={2}>
                  {r.description}
                </Text>
                <Text style={{ fontSize: 10.5, color: c.textFaint, marginTop: 4 }}>
                  {timeAgo(r.createdAt, lang)}
                  {r.location ? ` · ${r.location}` : ""}
                </Text>
              </View>
              <Pressable onPress={() => deleteReport(r.id)} hitSlop={8}>
                <Icon name="trash" size={16} color={c.textFaint} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 18 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  textarea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    minHeight: 84,
    textAlignVertical: "top",
  },
  preview: { width: "100%", height: 160, borderRadius: 12 },
  removePhoto: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
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
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 18,
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  reportBadge: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
