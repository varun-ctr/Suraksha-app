import * as Linking from "expo-linking";
import { Platform, Share } from "react-native";

import { coordLink } from "@/features/sos/utils/emergencyMessage";
import { toWhatsAppNumber } from "@/shared/utils/validate";

/** Sanitises a phone number for use in a `tel:` URL. */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export async function callNumber(phone: string): Promise<void> {
  const url = `tel:${sanitizePhone(phone)}`;
  try {
    await Linking.openURL(url);
  } catch {
    // No dialer available (e.g. web preview) — silently ignore.
  }
}

export function mapsUrl(lat: number, lng: number, label?: string): string {
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`;
  if (Platform.OS === "ios") {
    return `https://maps.apple.com/?q=${q}&ll=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** A plain shareable link to a coordinate that opens in any maps app. */
export const locationLink = coordLink;

/** Opens the best maps URL. On web, opens in a new browser tab. */
async function openMapsUrl(url: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      // window.open ensures it opens in a new tab, not inside the Expo web app
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // fallback if window.open is blocked
      await Linking.openURL(url);
    }
    return;
  }
  try {
    await Linking.openURL(url);
  } catch {
    // ignore
  }
}

export async function navigateTo(
  lat: number,
  lng: number,
  label?: string,
): Promise<void> {
  await openMapsUrl(mapsUrl(lat, lng, label));
}

/**
 * True on native iOS, and also on web when the browser itself is running on
 * an iPhone/iPad — `Platform.OS` alone reports "web" in that case, which
 * would otherwise pick the wrong sms: URI separator below.
 */
function isIOS(): boolean {
  if (Platform.OS === "ios") return true;
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }
  return false;
}

/**
 * Opens the device SMS composer pre-filled with a recipient and message body.
 * Failures propagate to the caller — sendSosAlerts / SosBottomSheet already
 * catch and mark the per-contact status as "failed", so this must not
 * swallow the error itself or that status would never be reachable.
 */
export async function sendSms(phone: string, body: string): Promise<void> {
  const sep = isIOS() ? "&" : "?";
  const url = `sms:${sanitizePhone(phone)}${sep}body=${encodeURIComponent(body)}`;
  await Linking.openURL(url);
}

/** Opens WhatsApp (via wa.me) pre-filled with a message to the contact. */
export async function openWhatsApp(phone: string, body: string): Promise<void> {
  const intl = toWhatsAppNumber(phone);
  const url = intl
    ? `https://wa.me/${intl}?text=${encodeURIComponent(body)}`
    : `https://wa.me/?text=${encodeURIComponent(body)}`;
  await openMapsUrl(url);
}

/**
 * Opens the device maps app with a category search near the given coordinates.
 * On web, opens Google Maps in a new browser tab.
 */
export async function searchNearby(
  query: string,
  coords: { lat: number; lng: number } | null,
): Promise<void> {
  let url: string;
  if (Platform.OS === "ios") {
    url = coords
      ? `https://maps.apple.com/?q=${encodeURIComponent(query)}&sll=${coords.lat},${coords.lng}`
      : `https://maps.apple.com/?q=${encodeURIComponent(query)}`;
  } else {
    // web + android: Google Maps
    url = coords
      ? `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${coords.lat},${coords.lng},15z`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  await openMapsUrl(url);
}

export async function shareLiveLocation(
  coords: { lat: number; lng: number } | null,
): Promise<void> {
  const message = coords
    ? `I need help. This is my current location: ${locationLink(coords.lat, coords.lng)}`
    : `I need help. Please call me.`;
  try {
    await Share.share({ message });
  } catch {
    // ignore
  }
}
