/**
 * Shared, real location helpers built on `expo-location`.
 *
 * Every screen that needs the user's position goes through here so the app
 * never falls back to a hardcoded/fake place. Reverse geocoding uses the
 * operating system's geocoder on native; on web it falls back to the free
 * OpenStreetMap Nominatim API (no API key required).
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

/** Best-effort reverse geocode to a short human address. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  // Native: use OS geocoder (fast, works offline)
  if (Platform.OS !== "web") {
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

  // Web: use Nominatim (OpenStreetMap free geocoding — no API key needed)
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en", "User-Agent": "Suraksha-App/1.0" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: {
        neighbourhood?: string;
        suburb?: string;
        city_district?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
      };
      display_name?: string;
    };
    const a = data.address;
    if (!a) return null;
    const area = a.neighbourhood ?? a.suburb ?? a.city_district ?? "";
    const city = a.city ?? a.town ?? a.village ?? a.state ?? "";
    const parts = [area, city].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);
    return parts.join(", ") || data.display_name?.split(",").slice(0, 2).join(", ") || null;
  } catch {
    return null;
  }
}

export function formatCoords(p: GeoPoint): string {
  const acc = p.accuracy ? ` · ±${Math.round(p.accuracy)}m` : "";
  return `Lat ${p.lat.toFixed(5)}, Lng ${p.lng.toFixed(5)}${acc}`;
}
