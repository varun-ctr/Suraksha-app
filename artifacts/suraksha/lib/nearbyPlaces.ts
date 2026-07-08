import { apiFetch } from "./apiClient";

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
  const { response } = await apiFetch(`/nearby-places?lat=${lat}&lng=${lng}&type=${category}`);
  if (!response || !response.ok) return [];
  try {
    const data = (await response.json()) as { places?: NearbyPlace[] };
    return data.places ?? [];
  } catch {
    return [];
  }
}
