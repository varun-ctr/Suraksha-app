/**
 * RevenueCat in-app purchases wrapper.
 *
 * Works across all environments:
 * - Native iOS/Android build → platform-specific public key
 * - Expo Go / web / __DEV__ → test store key (Browser Mode / Preview API Mode)
 *
 * The RevenueCat app_user_id is set to the Firebase uid so it matches
 * `profiles.id`, which the backend webhook uses to flip `is_premium`.
 *
 * Paywalls and Customer Center are presented via react-native-purchases-ui
 * on native; a custom inline UI is used as fallback on web/Expo Go.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

const IS_EXPO_GO = Constants.executionEnvironment === "storeClient";
const IS_DEV = typeof __DEV__ !== "undefined" && __DEV__;

/**
 * Entitlement lookup_key as returned by RevenueCat's listEntitlements API.
 * The entitlement display_name is also "Suraksha Pro".
 * Falls back to "pro" for any entitlements created with the short key.
 */
export const ENTITLEMENT_ID = "Suraksha Pro";
const ENTITLEMENT_ID_ALT = "pro";

const testKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY?.trim();
const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim();

function platformKey(): string | undefined {
  if (IS_DEV || IS_EXPO_GO || Platform.OS === "web") return testKey;
  if (Platform.OS === "ios") return iosKey;
  if (Platform.OS === "android") return androidKey;
  return testKey;
}

/** True when a valid API key exists for the current platform/environment. */
export function isPurchasesAvailable(): boolean {
  return !!platformKey();
}

/**
 * True when RevenueCat's native Paywall UI is expected to work.
 * On web, RevenueCatUI components are not available; the custom fallback UI is used instead.
 */
export function isPaywallUIAvailable(): boolean {
  return isPurchasesAvailable() && Platform.OS !== "web";
}

let configured = false;

/**
 * Configure the SDK once and associate the Firebase uid.
 * Safe to call on every sign-in; subsequent calls just re-logIn the uid.
 */
export async function initPurchases(appUserId: string): Promise<void> {
  const apiKey = platformKey();
  if (!apiKey) return;
  try {
    if (!configured) {
      Purchases.setLogLevel(IS_DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
      Purchases.configure({ apiKey, appUserID: appUserId });
      configured = true;
    } else {
      await Purchases.logIn(appUserId);
    }
  } catch {
    // Best-effort — a purchases init failure must never block the app.
  }
}

/** The current default offering, or null when unavailable/unconfigured. */
export async function getPremiumOffering(): Promise<PurchasesOffering | null> {
  if (!isPurchasesAvailable()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

/** All available offerings (for paywall display). */
export async function getAllOfferings(): Promise<PurchasesOffering[]> {
  if (!isPurchasesAvailable()) return [];
  try {
    const { all } = await Purchases.getOfferings();
    return Object.values(all);
  } catch {
    return [];
  }
}

export function hasPremiumEntitlement(info: CustomerInfo | null | undefined): boolean {
  // Check primary key ("Suraksha Pro") and short-key fallback ("pro")
  return !!(info?.entitlements.active[ENTITLEMENT_ID] || info?.entitlements.active[ENTITLEMENT_ID_ALT]);
}

/** Returns customer info, or null on error/unavailable. */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isPurchasesAvailable()) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

/** Reads the current premium entitlement from RevenueCat. */
export async function getPremiumStatus(): Promise<boolean> {
  return hasPremiumEntitlement(await getCustomerInfo());
}

export type PurchaseOutcome =
  | { ok: true; premium: boolean; customerInfo: CustomerInfo }
  | { ok: false; cancelled: boolean; error?: string };

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  if (!isPurchasesAvailable()) return { ok: false, cancelled: false, error: "unavailable" };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ok: true, premium: hasPremiumEntitlement(customerInfo), customerInfo };
  } catch (e: unknown) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, cancelled: false, error: err?.message ?? "purchase_failed" };
  }
}

export async function restorePurchases(): Promise<PurchaseOutcome> {
  if (!isPurchasesAvailable()) return { ok: false, cancelled: false, error: "unavailable" };
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { ok: true, premium: hasPremiumEntitlement(customerInfo), customerInfo };
  } catch (e: unknown) {
    const err = e as { message?: string };
    return { ok: false, cancelled: false, error: err?.message ?? "restore_failed" };
  }
}

/**
 * Present the RevenueCat Paywall modal.
 * Returns true if a purchase was made, false if dismissed/failed.
 * Falls back gracefully on web (returns false immediately).
 */
export async function presentPaywall(offering?: PurchasesOffering): Promise<boolean> {
  if (!isPaywallUIAvailable()) return false;
  try {
    const RevenueCatUI = await import("react-native-purchases-ui");
    const result = await RevenueCatUI.default.presentPaywall({ offering });
    // PURCHASED or RESTORED = success
    return result === "PURCHASED" || result === "RESTORED";
  } catch {
    return false;
  }
}

/**
 * Present the RevenueCat Customer Center.
 * No-op on web.
 */
export async function presentCustomerCenter(): Promise<void> {
  if (!isPaywallUIAvailable()) return;
  try {
    const RevenueCatUI = await import("react-native-purchases-ui");
    await RevenueCatUI.default.presentCustomerCenter();
  } catch {
    // Ignore — Customer Center is best-effort
  }
}

export type { PurchasesPackage, PurchasesOffering, CustomerInfo } from "react-native-purchases";
