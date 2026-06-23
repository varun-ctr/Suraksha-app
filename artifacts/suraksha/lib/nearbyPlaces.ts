const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";

export interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export type PlaceCategory = "police" | "hospital" | "pharmacy" | "shelter";

export async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  category: PlaceCategory,
): Promise<NearbyPlace[]> {
  try {
    const url = `${BACKEND_URL}/nearby-places?lat=${lat}&lng=${lng}&type=${category}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { places?: NearbyPlace[] };
    return data.places ?? [];
  } catch {
    return [];
  }
}
