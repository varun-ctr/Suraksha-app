import Constants from "expo-constants";
import { Platform } from "react-native";
import { useState } from "react";

import type { IconName } from "@/shared/utils/data";
import { useTheme } from "@/shared/theme/ThemeContext";
import { useLocation } from "@/shared/hooks/useLocation";
import { searchNearby } from "@/shared/utils/native";
import {
  fetchNearbyPlaces,
  type NearbyPlace,
  type PlaceCategory,
} from "@/repositories/api/nearbyPlacesRepository";

// react-native-maps' native views are NOT bundled in Expo Go — rendering the
// native map there crashes. Detect Expo Go and fall back to the external-maps
// list (same as web). The embedded map works in a development/production build.
const IS_EXPO_GO = Constants.executionEnvironment === "storeClient";

export interface CategoryDef {
  key: PlaceCategory;
  labelKey: string;
  query: string;
  icon: IconName;
  color: (c: ReturnType<typeof useTheme>["c"]) => string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    key: "police",
    labelKey: "map.police",
    query: "police station",
    icon: "shield",
    color: (c) => c.police,
  },
  {
    key: "hospital",
    labelKey: "map.hospital",
    query: "hospital",
    icon: "hospital",
    color: (c) => c.hospital,
  },
  {
    key: "pharmacy",
    labelKey: "map.pharmacy",
    query: "pharmacy",
    icon: "store",
    color: (c) => c.shops,
  },
  {
    key: "shelter",
    labelKey: "map.shelter",
    query: "women shelter",
    icon: "home",
    color: (c) => c.shelter,
  },
];

/** All state and handlers for the nearby-places map screen. */
export function useMapScreen() {
  const { isDark } = useTheme();
  const { point, status, refresh } = useLocation();

  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [activeCategory, setActiveCategory] = useState<PlaceCategory | null>(null);
  const [loadingCategory, setLoadingCategory] = useState<PlaceCategory | null>(null);
  const [noResults, setNoResults] = useState(false);

  const coords = point ? { lat: point.lat, lng: point.lng } : null;
  // Web and Expo Go both use the external-maps fallback instead of the embedded map.
  const useExternalMaps = Platform.OS === "web" || IS_EXPO_GO;

  const handleCategoryTap = async (cat: CategoryDef) => {
    if (!coords) {
      if (useExternalMaps) {
        void searchNearby(cat.query, null);
        return;
      }

      setLoadingCategory(null);
      setActiveCategory(null);
      setNoResults(true);
      setPlaces([]);
      return;
    }

    setLoadingCategory(cat.key);
    setNoResults(false);
    const results = await fetchNearbyPlaces(coords.lat, coords.lng, cat.key);
    setLoadingCategory(null);
    setActiveCategory(cat.key);

    if (results.length === 0) {
      setNoResults(true);
      setPlaces([]);
    } else {
      setNoResults(false);
      setPlaces(results);
    }
  };

  const activeCatDef = CATEGORIES.find((cat) => cat.key === activeCategory);
  const noteKey = useExternalMaps ? "map.noteWeb" : "map.noteNative";

  return {
    isDark, point, status, refresh,
    coords, useExternalMaps,
    places, activeCategory, loadingCategory, noResults,
    handleCategoryTap, activeCatDef, noteKey,
  };
}
