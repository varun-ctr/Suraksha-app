import * as Linking from "expo-linking";
import { Platform, Share } from "react-native";

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

export async function navigateTo(
  lat: number,
  lng: number,
  label?: string,
): Promise<void> {
  try {
    await Linking.openURL(mapsUrl(lat, lng, label));
  } catch {
    // ignore
  }
}

export async function shareLiveLocation(
  coords: { lat: number; lng: number } | null,
): Promise<void> {
  const link = coords
    ? mapsUrl(coords.lat, coords.lng)
    : "https://maps.google.com";
  const message = coords
    ? `I need help. This is my live location: ${link}`
    : `I need help. Please call me.`;
  try {
    await Share.share({ message });
  } catch {
    // ignore
  }
}
