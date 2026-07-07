import { firebaseAuth } from "./firebase";
import { getBackendUrl } from "./env";

const BACKEND_URL = getBackendUrl();

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
    const headers: Record<string, string> = {};
    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } catch { /* no token — request will 401 and surface as no results */ }

    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as { places?: NearbyPlace[] };
    return data.places ?? [];
  } catch {
    return [];
  }
}
