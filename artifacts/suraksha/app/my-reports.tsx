import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { withAlpha } from "@/constants/colors";
import type { IconName } from "@/constants/data";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { db, supabase } from "@/lib/supabaseClient";
import type { CommunityReportRow, CommunityReportType, ModerationStatus } from "../types/database";

interface TypeMeta {
  labelKey: string;
  icon: IconName;
  colorFn: (c: ReturnType<typeof useTheme>["c"]) => string;
}

const TYPE_META: Record<CommunityReportType, TypeMeta> = {
  unsafe_area:         { labelKey: "community.unsafeArea",        icon: "mapPin", colorFn: (c) => c.danger  },
  harassment:          { labelKey: "community.harassment",         icon: "alert",  colorFn: (c) => c.warning },
  stalking:            { labelKey: "community.stalking",           icon: "user",   colorFn: (c) => c.police  },
  suspicious_activity: { labelKey: "community.suspiciousActivity", icon: "flag",   colorFn: (c) => c.accent  },
};

interface StatusBadgeProps {
  status: ModerationStatus;
}
function StatusBadge({ status }: StatusBadgeProps) {
  const { c } = useTheme();
  const { t } = useI18n();
  const color = status === "pending" ? c.warning : status === "reviewed" ? c.success : c.danger;
  const labelKey: string =
    status === "pending" ? "myReports.pending" :
    status === "reviewed" ? "myReports.reviewed" :
    "myReports.removed";
  return (
    <View style={[styles.badge, { backgroundColor: withAlpha(color, 0.14), borderColor: withAlpha(color, 0.3) }]}>
      <Text style={{ fontSize: 10.5, fontFamily: "Inter_700Bold", color }}>{t(labelKey)}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function MyReportsScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [userId, setUserId] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [reports, setReports] = useState<CommunityReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthed(!!user);
      setUserId(user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (userId) void fetchReports(false);
  }, [userId]);

  const fetchReports = async (pull: boolean) => {
    if (!userId) return;
    if (pull) setRefreshing(true); else setLoading(true);
    try {
      const { data } = await db.communityReports.listForUser(userId);
      setReports(data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
        <Text style={styles.headerTitle}>{t("myReports.title")}</Text>
        <Text style={styles.headerSub}>{t("myReports.sub")}</Text>
      </LinearGradient>

      {/* ── Auth loading ── */}
      {authed === null && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={c.primary} />
        </View>
      )}

      {/* ── Not signed in ── */}
      {authed === false && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View style={[styles.emptyIcon, { backgroundColor: withAlpha(c.primary, 0.1) }]}>
            <Icon name="lock" size={32} color={c.primary} />
          </View>
          <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.text, textAlign: "center", marginBottom: 8 }}>
            {t("community.loginRequired")}
          </Text>
          <Pressable
            onPress={() => router.push("/login" as never)}
            style={[styles.signInBtn, { backgroundColor: c.primary }]}
          >
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>
              {t("community.loginBtn")}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── Signed-in content ── */}
      {authed === true && (
        loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 18, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void fetchReports(true)} tintColor={c.primary} />
            }
          >
            {reports.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 48 }}>
                <View style={[styles.emptyIcon, { backgroundColor: withAlpha(c.primary, 0.08) }]}>
                  <Icon name="flag" size={32} color={c.primary} />
                </View>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.text, marginBottom: 8 }}>
                  {t("myReports.empty")}
                </Text>
                <Pressable
                  onPress={() => router.replace("/community-report" as never)}
                  style={[styles.signInBtn, { backgroundColor: c.primary }]}
                >
                  <Icon name="plus" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 }}>
                    {t("community.title")}
                  </Text>
                </Pressable>
              </View>
            ) : (
              reports.map((report) => {
                const meta = TYPE_META[report.type];
                const color = meta.colorFn(c);
                return (
                  <View
                    key={report.id}
                    style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                      <View style={[styles.typeIcon, { backgroundColor: withAlpha(color, 0.12) }]}>
                        <Icon name={meta.icon} size={20} color={color} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <Text style={{ fontSize: 13.5, fontFamily: "Inter_700Bold", color: c.text, flex: 1 }}>
                            {t(meta.labelKey)}
                          </Text>
                          <StatusBadge status={report.moderation_status} />
                        </View>
                        {!!report.address && (
                          <Text style={{ fontSize: 12, color: c.textMuted, marginBottom: 4 }} numberOfLines={2}>
                            {report.address}
                          </Text>
                        )}
                        {!!report.description && (
                          <Text style={{ fontSize: 12.5, color: c.text, lineHeight: 18, marginBottom: 4 }} numberOfLines={3}>
                            {report.description}
                          </Text>
                        )}
                        <Text style={{ fontSize: 11, color: c.textFaint }}>
                          {formatDate(report.created_at)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub:   { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 4, fontFamily: "Inter_500Medium" },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  typeIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  signInBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 4,
  },
});
