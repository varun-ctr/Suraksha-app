/**
 * Shared, real location helpers built on `expo-location`.
 *
 * Every screen that needs the user's position goes through here so the app
 * never falls back to a hardcoded/fake place. Reverse geocoding uses the
 * operating system's geocoder (which may use a network service); it is
 * unavailable on web, where we surface raw coordinates instead.
 */
import * as Location from "expo-location";
import { Platform } from "react-native";

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy: number | null;
}

export type LocationStatus = "idle" | "loading" | "ready" | "denied" | "error";

/** Requests foreground permission and returns the current position, or null. */
export async function getCurrentLocation(): Promise<GeoPoint | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
    };
  } catch {
    return null;
  }
}

/** Best-effort reverse geocode to a short human address. Null on web/failure. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const r = results[0];
    if (!r) return null;
    const parts = [r.name, r.district ?? r.subregion, r.city ?? r.region]
      .filter((v): v is string => Boolean(v))
      .filter((v, i, arr) => arr.indexOf(v) === i);
    return parts.join(", ") || null;
  } catch {
    return null;
  }
}

export function formatCoords(p: GeoPoint): string {
  const acc = p.accuracy ? ` · ±${Math.round(p.accuracy)}m` : "";
  return `Lat ${p.lat.toFixed(5)}, Lng ${p.lng.toFixed(5)}${acc}`;
}
