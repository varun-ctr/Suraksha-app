import { Router, type IRouter, type Request, type Response } from "express";
import { requiredEnv } from "./../lib/env";
import { getBearerToken, verifyFirebaseToken } from "../lib/firebaseAdmin";

const router: IRouter = Router();

const GOOGLE_PLACES_API_KEY = requiredEnv("GOOGLE_PLACES_API_KEY");

type Category = "police" | "hospital" | "pharmacy" | "shelter";

interface CacheEntry {
  data: NearbyPlace[];
  expiresAt: number;
}

export interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

// 5-minute in-memory cache keyed by category + lat/lng rounded to 3 decimal places
const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lng: number, category: string): string {
  return `${category}:${lat.toFixed(3)},${lng.toFixed(3)}`;
}

const CATEGORY_CONFIG: Record<
  Category,
  { includedTypes?: string[]; searchText?: string; maxResults: number }
> = {
  police: { includedTypes: ["police"], maxResults: 10 },
  hospital: { includedTypes: ["hospital", "emergency_room"], maxResults: 10 },
  pharmacy: { includedTypes: ["pharmacy", "drugstore"], maxResults: 10 },
  shelter: { searchText: "women shelter NGO", maxResults: 10 },
};

async function fetchFromGoogle(
  lat: number,
  lng: number,
  category: Category,
): Promise<NearbyPlace[]> {
  const config = CATEGORY_CONFIG[category];
  const fieldMask = "places.id,places.displayName,places.formattedAddress,places.location";

  let url: string;
  let body: object;

  if (config.searchText) {
    url = "https://places.googleapis.com/v1/places:searchText";
    body = {
      textQuery: config.searchText,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 10000,
        },
      },
      maxResultCount: config.maxResults,
    };
  } else {
    url = "https://places.googleapis.com/v1/places:searchNearby";
    body = {
      includedTypes: config.includedTypes,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 5000,
        },
      },
      maxResultCount: config.maxResults,
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Places API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    places?: {
      id: string;
      displayName?: { text: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
    }[];
  };

  return (data.places ?? [])
    .filter((p) => p.location)
    .map((p) => ({
      id: p.id,
      name: p.displayName?.text ?? "Unknown",
      address: p.formattedAddress ?? "",
      lat: p.location!.latitude,
      lng: p.location!.longitude,
    }));
}

router.get("/nearby-places", async (req: Request, res: Response) => {
  // Verify the caller's Firebase ID token — this proxies a paid Google
  // Places endpoint and must not be reachable by anyone who just knows the URL.
  const user = await verifyFirebaseToken(getBearerToken(req));
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { lat: latStr, lng: lngStr, type } = req.query as Record<string, string>;

  const lat = parseFloat(latStr ?? "");
  const lng = parseFloat(lngStr ?? "");
  const category = type as Category;

  if (isNaN(lat) || isNaN(lng) || !["police", "hospital", "pharmacy", "shelter"].includes(category)) {
    res.status(400).json({ error: "bad_request", message: "lat, lng, and type (police|hospital|pharmacy|shelter) are required." });
    return;
  }

  const key = cacheKey(lat, lng, category);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    res.json({ places: cached.data });
    return;
  }

  try {
    const places = await fetchFromGoogle(lat, lng, category);
    cache.set(key, { data: places, expiresAt: Date.now() + 5 * 60 * 1000 });
    res.json({ places });
  } catch (err) {
    req.log?.error?.({ err }, "Nearby places fetch failed");
    res.status(502).json({ error: "server", message: "Could not fetch nearby places." });
  }
});

export default router;
