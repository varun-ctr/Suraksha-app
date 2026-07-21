import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { useApp } from "@/features/profile/context/AppContext";
import { useI18n } from "@/features/settings/context/LanguageContext";
import { useToast } from "@/features/settings/context/ToastContext";
import {
  getAllOfferings,
  getCustomerInfo,
  hasPremiumEntitlement,
  isPaywallUIAvailable,
  isPurchasesAvailable,
  presentCustomerCenter,
  presentPaywall,
  purchasePackage,
  restorePurchases,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "@/features/premium/services/purchasesService";

export type PremiumBusyState = null | "paywall" | "buy" | "restore" | "center";

function usePremiumState() {
  const { setProfile } = useApp();
  const [loading, setLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesOffering[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    if (!isPurchasesAvailable()) { setLoading(false); return; }
    setLoading(true);
    const [info, offs] = await Promise.all([getCustomerInfo(), getAllOfferings()]);
    if (!mounted.current) return;
    setCustomerInfo(info);
    setOfferings(offs);
    if (hasPremiumEntitlement(info)) setProfile({ premium: true });
    setLoading(false);
  }, [setProfile]);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => { mounted.current = false; };
  }, [reload]);

  return { loading, offerings, customerInfo, reload };
}

/** All state and purchase-flow handlers for the premium/paywall screen. */
export function usePremiumScreen() {
  const { t } = useI18n();
  const { profile, setProfile } = useApp();
  const { showToast } = useToast();
  const router = useRouter();

  const available = isPurchasesAvailable();
  const nativePaywall = isPaywallUIAvailable();

  const { loading, offerings, customerInfo, reload } = usePremiumState();

  // Current offering — prefer "default", else first
  const currentOffering =
    offerings.find((o) => o.identifier === "default") ?? offerings[0] ?? null;
  const packages = currentOffering?.availablePackages ?? [];

  const isPro = hasPremiumEntitlement(customerInfo) || profile.premium;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && packages.length > 0) {
      // Pre-select annual if available (best value), else first
      const annual = packages.find((p) => p.packageType === "ANNUAL" || p.identifier === "$rc_annual");
      setSelectedId(annual?.identifier ?? packages[0]?.identifier ?? null);
    }
  }, [packages, selectedId]);

  const [busy, setBusy] = useState<PremiumBusyState>(null);

  // ── Native paywall (iOS / Android) ──────────────────────────
  const onShowNativePaywall = async () => {
    if (busy) return;
    setBusy("paywall");
    const purchased = await presentPaywall(currentOffering ?? undefined);
    setBusy(null);
    if (purchased) {
      await reload();
      showToast(t("premium.purchaseSuccess"));
      router.back();
    }
  };

  // ── Inline purchase (web / Expo Go) ─────────────────────────
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

  const onCustomerCenter = async () => {
    if (busy) return;
    setBusy("center");
    await presentCustomerCenter();
    await reload(); // refresh after returning
    setBusy(null);
  };

  return {
    available, nativePaywall, loading, isPro,
    packages, selectedId, setSelectedId, busy,
    onShowNativePaywall, onSubscribe, onRestore, onCustomerCenter,
  };
}

export type { PurchasesPackage };
