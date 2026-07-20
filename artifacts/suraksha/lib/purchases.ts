/**
 * RevenueCat in-app purchases wrapper.
 *
 * react-native-purchases' native module is NOT present in Expo Go or on web,
 * so every function here is guarded by `isPurchasesAvailable()` and degrades to
 * a no-op / "unavailable" result rather than throwing — mirroring the Expo-Go
 * guard in `app/(tabs)/map.tsx` and the graceful-failure style of
 * `lib/notifications.ts`. Importing the SDK is safe even in Expo Go: it only
 * constructs its NativeEventEmitter when the native module actually exists.
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

/** The entitlement identifier configured in the RevenueCat dashboard. */
const ENTITLEMENT_ID = "premium";

const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim();
const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim();

function platformKey(): string | undefined {
  return Platform.OS === "ios" ? iosKey : Platform.OS === "android" ? androidKey : undefined;
}

/** True only on a native build (not Expo Go, not web) with an SDK key configured. */
export function isPurchasesAvailable(): boolean {
  if (Platform.OS === "web" || IS_EXPO_GO) return false;
  return !!platformKey();
}

let configured = false;

/**
 * Configure the SDK (once) and associate the current Firebase uid. Safe to call
 * on every sign-in — subsequent calls just re-`logIn` the (possibly new) uid.
 */
export async function initPurchases(appUserId: string): Promise<void> {
  if (!isPurchasesAvailable()) return;
  const apiKey = platformKey();
  if (!apiKey) return;
  try {
    if (!configured) {
      Purchases.setLogLevel(LOG_LEVEL.ERROR);
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
