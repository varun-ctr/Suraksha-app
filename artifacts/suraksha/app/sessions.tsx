import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BackHeader } from "@/components/Headers";
import { Icon } from "@/components/Icon";
import { withAlpha } from "@/constants/colors";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getCurrentUser, signOut } from "@/lib/auth";
import { apiFetch } from "@/lib/apiClient";
import type { User } from "firebase/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SessionInfo {
  id: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  userAgent: string | null;
  ip: string | null;
  isCurrentSession: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function timeAgoShort(isoDate: string | undefined | null): string {
  if (!isoDate) return "—";
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function absoluteDate(isoDate: string | undefined | null): string {
  if (!isoDate) return "—";
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function parseDeviceName(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Macintosh|Mac OS/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown device";
}

function parseDeviceIcon(ua: string | null): "phone" | "globe" | "user" {
  if (!ua) return "globe";
  if (/iPhone|iPad|Android/i.test(ua)) return "phone";
  return "globe";
}

// ---------------------------------------------------------------------------
// SessionCard
// ---------------------------------------------------------------------------
function SessionCard({ session, c }: { session: SessionInfo; c: ReturnType<typeof import("@/context/ThemeContext").useTheme>["c"] }) {
  const device = parseDeviceName(session.userAgent);
  const icon = parseDeviceIcon(session.userAgent);
  return (
    <View style={[styles.sessionCard, { borderColor: c.border, backgroundColor: c.card }]}>
      <View style={[styles.sessionIcon, { backgroundColor: withAlpha(c.primary, 0.1) }]}>
        <Icon name={icon} size={18} color={c.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text }} numberOfLines={1}>
            {device}
          </Text>
          {session.isCurrentSession && (
            <View style={[styles.thisBadge, { backgroundColor: withAlpha(c.success, 0.12) }]}>
              <View style={[styles.thisDot, { backgroundColor: c.success }]} />
              <Text style={{ fontSize: 10.5, fontFamily: "Inter_700Bold", color: c.success }}>
                This device
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 11.5, color: c.textMuted, marginTop: 3 }}>
          Signed in {absoluteDate(session.createdAt)}
        </Text>
        <Text style={{ fontSize: 11.5, color: c.textFaint, marginTop: 2 }}>
          Last active {timeAgoShort(session.updatedAt)}
          {session.ip ? ` · ${session.ip}` : ""}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function SessionsScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoadingSessions(true);
    const [u, sessionList] = await Promise.all([
      getCurrentUser(),
      fetchSessions(),
    ]);
    setUser(u);
    setSessions(sessionList);
    setLoadingSessions(false);
  };

  const fetchSessions = async (): Promise<SessionInfo[]> => {
    const { response } = await apiFetch("/auth/sessions", { timeoutMs: 8_000 });
    if (!response || !response.ok) return [];
    try {
      const body = (await response.json()) as { sessions?: SessionInfo[] };
      return body.sessions ?? [];
    } catch {
      return [];
    }
  };

  // Firebase has no server-side "revoke every device" call available here —
  // this ends the session on this device only, same as Profile's Sign Out.
  // The copy below says exactly that; it used to (incorrectly) claim it
  // signed the user out everywhere.
  const handleSignOut = () => {
    Alert.alert(
      t("account.signOutConfirm"),
      t("account.signOutBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("account.signOut"),
          style: "destructive",
          onPress: async () => {
            setSigningOut(true);
            await signOut();
            setSigningOut(false);
            router.replace("/login" as never);
          },
        },
      ],
    );
  };

  const identifier = user?.email ?? user?.phoneNumber ?? "—";

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title={t("account.sessions")} subtitle={t("account.sessionsSub")} />

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* ── Active Sessions List ─────────────────────────────────────── */}
        <Text style={[styles.section, { color: c.textMuted }]}>
          {t("account.signedInAs")} {identifier}
        </Text>

        {loadingSessions ? (
          <View style={{ alignItems: "center", paddingVertical: 28 }}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : sessions.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Icon name="lock" size={20} color={c.textFaint} />
            <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 8, textAlign: "center" }}>
              Session info unavailable
            </Text>
          </View>
        ) : (
          sessions.map((s, i) => <SessionCard key={s.id ?? i} session={s} c={c} />)
        )}

        {/* ── Sign out ─────────────────────────────────────────────────── */}
        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          style={[
            styles.actionBtn,
            { backgroundColor: c.card, borderColor: c.border, opacity: signingOut ? 0.7 : 1, marginTop: 14 },
          ]}
        >
          {signingOut ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : (
            <Icon name="logOut" size={18} color={c.primary} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text }}>
              {t("account.signOut")}
            </Text>
            <Text style={{ fontSize: 11.5, color: c.textMuted, marginTop: 1 }}>
              {t("account.signOutSub")}
            </Text>
          </View>
          <Icon name="chevronRight" size={16} color={c.textFaint} />
        </Pressable>

        {/* ── Danger zone — delete-account flow lives in Profile only,     */}
        {/*    so this and Profile can never drift out of sync again.     */}
        <Text style={[styles.dangerLabel, { color: c.danger, marginTop: 22 }]}>Danger zone</Text>
        <Pressable
          onPress={() => router.push("/(tabs)/profile" as never)}
          style={[
            styles.actionBtn,
            {
              backgroundColor: withAlpha(c.danger, 0.06),
              borderColor: withAlpha(c.danger, 0.3),
            },
          ]}
        >
          <Icon name="trash" size={18} color={c.danger} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.danger }}>
              {t("account.deleteAccount")}
            </Text>
            <Text style={{ fontSize: 11.5, color: c.textMuted, marginTop: 1 }}>
              {t("account.deleteAccountFromProfile")}
            </Text>
          </View>
          <Icon name="chevronRight" size={16} color={c.textFaint} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 10, letterSpacing: 0.3 },
  dangerLabel: { fontSize: 12, fontFamily: "Inter_700Bold", marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" },
  sessionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  sessionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  thisBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  thisDot: { width: 6, height: 6, borderRadius: 3 },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 28,
    marginBottom: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
});
