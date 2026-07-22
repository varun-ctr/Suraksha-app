/**
 * Premium / Suraksha Pro paywall screen.
 *
 * On native (iOS/Android): uses RevenueCat's native Paywall UI via
 * react-native-purchases-ui, which renders the offering configured in the
 * RevenueCat dashboard. A Customer Center button lets users manage their
 * subscription without leaving the app.
 *
 * On web / Expo Go: falls back to a custom inline paywall that lists all
 * packages from the current offering and handles purchase + restore.
 */
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackHeader } from "@/shared/components/Headers";
import { Icon } from "@/shared/components/Icon";
import { withAlpha } from "@/shared/theme/colors";
import { useI18n } from "@/features/settings/context/LanguageContext";
import { useTheme } from "@/shared/theme/ThemeContext";
import { usePremiumScreen } from "@/features/premium/hooks/usePremiumScreen";
import type { PurchasesPackage } from "@/features/premium/hooks/usePremiumScreen";

// Features included in Suraksha Pro today (honest, no planned features)
const INCLUDED: { en: string; hi: string }[] = [
  { en: "Custom color themes", hi: "कस्टम रंग थीम" },
];

// Duration labels for package keys
const DURATION_LABEL: Record<string, { en: string; hi: string }> = {
  "$rc_monthly": { en: "/ month", hi: "/ महीना" },
  "$rc_annual": { en: "/ year", hi: "/ साल" },
  "$rc_lifetime": { en: "one-time", hi: "एक बार" },
  "$rc_weekly": { en: "/ week", hi: "/ सप्ताह" },
};

export default function PremiumScreen() {
  const { c } = useTheme();
  const { t, pick } = useI18n();
  const insets = useSafeAreaInsets();

  const {
    available, nativePaywall, loading, isPro,
    packages, selectedId, setSelectedId, busy,
    onShowNativePaywall, onSubscribe, onRestore, onCustomerCenter,
  } = usePremiumScreen();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title={t("premium.title")} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero gradient */}
        <LinearGradient
          colors={[c.accent, c.accentDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 24, alignItems: "center" }}
        >
          <View style={styles.crown}>
            <Icon name="crown" size={32} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>{t("premium.title")}</Text>
          <Text style={styles.heroSub}>{t("premium.sub")}</Text>
          {isPro && (
            <View style={styles.activeBadge}>
              <Icon name="check" size={13} color="#fff" />
              <Text style={styles.activeBadgeText}>{t("premium.currentPlan")}</Text>
            </View>
          )}
        </LinearGradient>

        <View style={{ padding: 18 }}>

          {/* What's included */}
          <Text style={[styles.sectionLabel, { color: c.text }]}>{t("premium.included")}</Text>
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            {INCLUDED.map((f, i) => (
              <View
                key={f.en}
                style={[
                  styles.featureRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                ]}
              >
                <View style={[styles.featureIcon, { backgroundColor: c.successSoft }]}>
                  <Icon name="check" size={15} color={c.success} />
                </View>
                <Text style={[styles.featureText, { color: c.text }]}>{pick(f)}</Text>
              </View>
            ))}
          </View>

          {/* Coming soon */}
          <View style={[styles.comingSoon, { backgroundColor: withAlpha(c.accent, 0.1), borderColor: withAlpha(c.accent, 0.25) }]}>
            <Icon name="info" size={15} color={c.accent} />
            <Text style={[styles.comingSoonText, { color: c.text }]}>{t("premium.comingSoon")}</Text>
          </View>

          {/* Purchase area */}
          {!available ? (
            // No API key configured at all
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, marginTop: 16 }]}>
              <Text style={[styles.unavailableTitle, { color: c.text }]}>{t("premium.unavailableTitle")}</Text>
              <Text style={[styles.unavailableBody, { color: c.textMuted }]}>{t("premium.unavailableBody")}</Text>
            </View>

          ) : loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={c.accent} />
              <Text style={[styles.loadingText, { color: c.textMuted }]}>{t("premium.loading")}</Text>
            </View>

          ) : isPro ? (
            // Already subscribed — show manage options
            <View style={{ marginTop: 20, gap: 12 }}>
              <View style={[styles.card, { backgroundColor: withAlpha(c.success, 0.08), borderColor: withAlpha(c.success, 0.3) }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Icon name="check" size={18} color={c.success} />
                  <Text style={[styles.sectionLabel, { color: c.success, marginBottom: 0 }]}>
                    {t("premium.currentPlan")}
                  </Text>
                </View>
                <Text style={[styles.unavailableBody, { color: c.textMuted, marginTop: 4 }]}>
                  {t("premium.activeBody")}
                </Text>
              </View>

              {nativePaywall && (
                <Pressable
                  onPress={onCustomerCenter}
                  disabled={busy != null}
                  style={[styles.secondaryBtn, { borderColor: c.accent }]}
                >
                  {busy === "center" ? (
                    <ActivityIndicator color={c.accent} size="small" />
                  ) : (
                    <Text style={[styles.secondaryBtnText, { color: c.accent }]}>{t("premium.manageSubscription")}</Text>
                  )}
                </Pressable>
              )}

              <Pressable onPress={onRestore} disabled={busy != null}>
                <Text style={[styles.linkText, { color: c.textMuted }]}>
                  {busy === "restore" ? t("premium.restoring") : t("premium.restore")}
                </Text>
              </Pressable>
            </View>

          ) : nativePaywall ? (
            // Native: show feature list + single "Get Suraksha Pro" button that opens RevenueCat paywall
            <View style={{ marginTop: 20, gap: 12 }}>
              <Pressable
                onPress={onShowNativePaywall}
                disabled={busy != null}
                style={{ opacity: busy ? 0.7 : 1 }}
              >
                <LinearGradient
                  colors={[c.accent, c.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtn}
                >
                  {busy === "paywall" ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Icon name="crown" size={16} color="#fff" />
                      <Text style={styles.primaryBtnText}>{t("premium.subscribe")}</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable onPress={onRestore} disabled={busy != null}>
                <Text style={[styles.linkText, { color: c.accent }]}>
                  {busy === "restore" ? t("premium.restoring") : t("premium.restore")}
                </Text>
              </Pressable>
              <Text style={[styles.noteText, { color: c.textFaint }]}>{t("premium.note")}</Text>
            </View>

          ) : packages.length > 0 ? (
            // Web / Expo Go: inline package picker
            <>
              <Text style={[styles.sectionLabel, { color: c.text, marginTop: 22 }]}>{t("premium.choosePlan")}</Text>

              {packages.map((p: PurchasesPackage) => {
                const active = selectedId === p.identifier;
                const durLabel = DURATION_LABEL[p.identifier] ?? { en: "", hi: "" };
                const isAnnual = p.identifier === "$rc_annual";
                return (
                  <Pressable
                    key={p.identifier}
                    onPress={() => setSelectedId(p.identifier)}
                    style={[
                      styles.planRow,
                      {
                        backgroundColor: c.card,
                        borderColor: active ? c.accent : c.border,
                        borderWidth: active ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.radio, { borderColor: active ? c.accent : c.border }]}>
                      {active && <View style={[styles.radioDot, { backgroundColor: c.accent }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={[styles.planTitle, { color: c.text }]}>{p.product.title}</Text>
                        {isAnnual && (
                          <View style={[styles.saveBadge, { backgroundColor: c.successSoft }]}>
                            <Text style={[styles.saveBadgeText, { color: c.success }]}>
                              {t("premium.bestValue")}
                            </Text>
                          </View>
                        )}
                      </View>
                      {!!p.product.description && (
                        <Text style={[styles.planDesc, { color: c.textMuted }]}>{p.product.description}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.planPrice, { color: c.accent }]}>{p.product.priceString}</Text>
                      <Text style={[styles.planDuration, { color: c.textMuted }]}>{pick(durLabel)}</Text>
                    </View>
                  </Pressable>
                );
              })}

              <Pressable
                onPress={onSubscribe}
                disabled={busy != null}
                style={{ marginTop: 18, opacity: busy ? 0.7 : 1 }}
              >
                <LinearGradient
                  colors={[c.accent, c.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtn}
                >
                  {busy === "buy" ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Icon name="crown" size={16} color="#fff" />
                      <Text style={styles.primaryBtnText}>{t("premium.subscribe")}</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable onPress={onRestore} disabled={busy != null} style={{ marginTop: 14 }}>
                <Text style={[styles.linkText, { color: c.accent }]}>
                  {busy === "restore" ? t("premium.restoring") : t("premium.restore")}
                </Text>
              </Pressable>
              <Text style={[styles.noteText, { color: c.textFaint }]}>{t("premium.note")}</Text>
            </>

          ) : (
            // Offering failed to load
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, marginTop: 16 }]}>
              <Text style={[styles.unavailableTitle, { color: c.text }]}>{t("premium.loadError")}</Text>
            </View>
          )}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 12 },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: 13, textAlign: "center", marginTop: 6 },
  crown: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  activeBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, marginTop: 12,
  },
  activeBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  sectionLabel: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  featureIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  comingSoon: {
    flexDirection: "row", alignItems: "flex-start", gap: 9,
    borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 14,
  },
  comingSoonText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
  loadingRow: { paddingVertical: 28, alignItems: "center" },
  loadingText: { fontSize: 12, marginTop: 10 },
  unavailableTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 6 },
  unavailableBody: { fontSize: 12.5, lineHeight: 18 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 14, paddingVertical: 15,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  secondaryBtn: {
    borderWidth: 1.5, borderRadius: 14, paddingVertical: 13,
    alignItems: "center", justifyContent: "center",
  },
  secondaryBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  linkText: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  noteText: { fontSize: 11, textAlign: "center", marginTop: 4 },
  planRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, padding: 16, marginBottom: 10,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 11, height: 11, borderRadius: 5.5 },
  planTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  planDesc: { fontSize: 11, marginTop: 2 },
  planPrice: { fontSize: 17, fontFamily: "Inter_700Bold" },
  planDuration: { fontSize: 10, marginTop: 1 },
  saveBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  saveBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
});
