/**
 * RevenueCat in-app purchases wrapper.
 *
 * react-native-purchases supports Expo Go (Preview API Mode) and web (Browser
 * Mode) via the test store key, so `isPurchasesAvailable()` returns true in
 * those environments when EXPO_PUBLIC_REVENUECAT_TEST_API_KEY is set.
 *
 * The RevenueCat `app_user_id` is set to the Firebase uid (via `logIn`) so it
 * matches `profiles.id` — the key the backend webhook
 * (`api-server/src/routes/revenuecat.ts`) uses to flip `is_premium`.
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

/** The entitlement identifier configured in the RevenueCat dashboard. */
const ENTITLEMENT_ID = "premium";

const testKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY?.trim();
const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim();

function platformKey(): string | undefined {
  // Dev build, Expo Go, or web all use the test store key
  if (IS_DEV || IS_EXPO_GO || Platform.OS === "web") return testKey;
  if (Platform.OS === "ios") return iosKey;
  if (Platform.OS === "android") return androidKey;
  return testKey;
}

/** True when a valid API key exists for the current platform/environment. */
export function isPurchasesAvailable(): boolean {
  return !!platformKey();
}

let configured = false;

/**
 * Configure the SDK (once) and associate the current Firebase uid. Safe to call
 * on every sign-in — subsequent calls just re-`logIn` the (possibly new) uid.
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

/** The current default offering, or null when unavailable / not configured. */
export async function getPremiumOffering(): Promise<PurchasesOffering | null> {
  if (!isPurchasesAvailable()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

export function hasPremiumEntitlement(info: CustomerInfo | null | undefined): boolean {
  return !!info?.entitlements.active[ENTITLEMENT_ID];
}

/** Reads the current premium entitlement from RevenueCat. False when unavailable. */
export async function getPremiumStatus(): Promise<boolean> {
  if (!isPurchasesAvailable()) return false;
  try {
    return hasPremiumEntitlement(await Purchases.getCustomerInfo());
  } catch {
    return false;
  }
}

export type PurchaseOutcome =
  | { ok: true; premium: boolean }
  | { ok: false; cancelled: boolean; error?: string };

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  if (!isPurchasesAvailable()) return { ok: false, cancelled: false, error: "unavailable" };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ok: true, premium: hasPremiumEntitlement(customerInfo) };
  } catch (e: unknown) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, cancelled: false, error: err?.message ?? "purchase_failed" };
  }
}

export async function restorePurchases(): Promise<PurchaseOutcome> {
  if (!isPurchasesAvailable()) return { ok: false, cancelled: false, error: "unavailable" };
  try {
    const info = await Purchases.restorePurchases();
    return { ok: true, premium: hasPremiumEntitlement(info) };
  } catch (e: unknown) {
    const err = e as { message?: string };
    return { ok: false, cancelled: false, error: err?.message ?? "restore_failed" };
  }
}

export type { PurchasesPackage, PurchasesOffering, CustomerInfo } from "react-native-purchases";
