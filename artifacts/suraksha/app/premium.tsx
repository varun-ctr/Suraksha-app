import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackHeader } from "@/components/Headers";
import { Icon } from "@/components/Icon";
import { withAlpha } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import {
  getPremiumOffering,
  getPremiumStatus,
  isPurchasesAvailable,
  purchasePackage,
  restorePurchases,
  type PurchasesPackage,
} from "@/lib/purchases";

// Only what Premium actually delivers today. Planned features are described
// honestly below as "coming" — never listed as if already included, which is
// both a store-review requirement and fair to paying users.
const INCLUDED: { en: string; hi: string }[] = [
  { en: "Custom color themes", hi: "कस्टम रंग थीम" },
];

export default function PremiumScreen() {
  const { c } = useTheme();
  const { t, pick } = useI18n();
  const { profile, setProfile } = useApp();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const available = isPurchasesAvailable();
  const [loading, setLoading] = useState(available);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "buy" | "restore">(null);

  useEffect(() => {
    let cancelled = false;
    if (!available) return;
    (async () => {
      // Reflect any already-active entitlement, then load the store offering.
      const isPremium = await getPremiumStatus();
      if (!cancelled && isPremium) setProfile({ premium: true });
      const offering = await getPremiumOffering();
      if (cancelled) return;
      const pkgs = offering?.availablePackages ?? [];
      setPackages(pkgs);
      setSelectedId(pkgs[0]?.identifier ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [available, setProfile]);

  const onSubscribe = async () => {
    const pkg = packages.find((p) => p.identifier === selectedId) ?? packages[0];
    if (!pkg || busy) return;
    setBusy("buy");
    const res = await purchasePackage(pkg);
    setBusy(null);
    if (res.ok) {
      if (res.premium) {
        setProfile({ premium: true });
        showToast(t("premium.purchaseSuccess"));
        router.back();
      }
    } else if (!res.cancelled) {
      showToast(t("premium.purchaseFailed"));
    }
  };

  const onRestore = async () => {
    if (busy) return;
    setBusy("restore");
    const res = await restorePurchases();
    setBusy(null);
    if (res.ok) {
      setProfile({ premium: res.premium });
      showToast(res.premium ? t("premium.restored") : t("premium.noPurchases"));
      if (res.premium) router.back();
    } else {
      showToast(t("premium.purchaseFailed"));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title={t("premium.title")} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[c.accent, c.accentDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 24, alignItems: "center" }}
        >
          <View style={styles.crown}>
            <Icon name="crown" size={32} color="#fff" />
          </View>
          <Text style={{ color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 12 }}>
            {t("premium.title")}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, textAlign: "center", marginTop: 6 }}>
            {t("premium.sub")}
          </Text>
          {profile.premium && (
            <View style={styles.activeBadge}>
              <Icon name="check" size={13} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" }}>
                {t("premium.currentPlan")}
              </Text>
            </View>
          )}
        </LinearGradient>

        <View style={{ padding: 18 }}>
          {/* What Premium unlocks today */}
          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text, marginBottom: 12 }}>
            {t("premium.included")}
          </Text>
          <View style={[styles.featureCard, { backgroundColor: c.card, borderColor: c.border }]}>
            {INCLUDED.map((f, i) => (
              <View
                key={f.en}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: c.border,
                }}
              >
                <View style={[styles.featureIcon, { backgroundColor: c.successSoft }]}>
                  <Icon name="check" size={15} color={c.success} />
                </View>
                <Text style={{ flex: 1, fontSize: 13, color: c.text, fontFamily: "Inter_500Medium" }}>{pick(f)}</Text>
              </View>
            ))}
          </View>
          <View
            style={[
              styles.comingSoon,
              { backgroundColor: withAlpha(c.accent, 0.1), borderColor: withAlpha(c.accent, 0.25) },
            ]}
          >
            <Icon name="info" size={15} color={c.accent} />
            <Text style={{ flex: 1, fontSize: 11.5, color: c.text, lineHeight: 17 }}>{t("premium.comingSoon")}</Text>
          </View>

          {/* Purchase area */}
          {profile.premium ? (
            <Pressable onPress={onRestore} disabled={busy != null} style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 13, color: c.accent, textAlign: "center", fontFamily: "Inter_600SemiBold" }}>
                {busy === "restore" ? t("premium.restoring") : t("premium.restore")}
              </Text>
            </Pressable>
          ) : available && loading ? (
            <View style={{ paddingVertical: 28, alignItems: "center" }}>
              <ActivityIndicator color={c.accent} />
              <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 10 }}>{t("premium.loading")}</Text>
            </View>
          ) : available && packages.length > 0 ? (
            <>
              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text, marginTop: 22, marginBottom: 12 }}>
                {t("premium.choosePlan")}
              </Text>

              {packages.map((p) => {
                const active = selectedId === p.identifier;
                return (
                  <Pressable
                    key={p.identifier}
                    onPress={() => setSelectedId(p.identifier)}
                    style={[
                      styles.plan,
                      { backgroundColor: c.card, borderColor: active ? c.accent : c.border, borderWidth: active ? 2 : 1 },
                    ]}
                  >
                    <View style={[styles.radio, { borderColor: active ? c.accent : c.border }]}>
                      {active && <View style={[styles.radioDot, { backgroundColor: c.accent }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: c.text }}>{p.product.title}</Text>
                      {!!p.product.description && (
                        <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>{p.product.description}</Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: c.accent }}>
                      {p.product.priceString}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable onPress={onSubscribe} disabled={busy != null} style={{ marginTop: 18, opacity: busy ? 0.7 : 1 }}>
                <LinearGradient
                  colors={[c.accent, c.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.subscribeBtn}
                >
                  {busy === "buy" ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Icon name="crown" size={16} color="#fff" />
                      <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>
                        {t("premium.subscribe")}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable onPress={onRestore} disabled={busy != null} style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 13, color: c.accent, textAlign: "center", fontFamily: "Inter_600SemiBold" }}>
                  {busy === "restore" ? t("premium.restoring") : t("premium.restore")}
                </Text>
              </Pressable>

              <Text style={{ fontSize: 11, color: c.textFaint, textAlign: "center", marginTop: 12 }}>
                {t("premium.note")}
              </Text>
            </>
          ) : (
            // Not a native build (Expo Go / web), or the offering failed to load.
            <View style={[styles.featureCard, { backgroundColor: c.card, borderColor: c.border, marginTop: 16 }]}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: c.text, marginBottom: 6 }}>
                {available ? t("premium.loadError") : t("premium.unavailableTitle")}
              </Text>
              {!available && (
                <Text style={{ fontSize: 12.5, color: c.textMuted, lineHeight: 18 }}>
                  {t("premium.unavailableBody")}
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  crown: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 12,
  },
  comingSoon: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  featureCard: { borderWidth: 1, borderRadius: 16, padding: 14 },
  featureIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 11, height: 11, borderRadius: 5.5 },
  subscribeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
});
