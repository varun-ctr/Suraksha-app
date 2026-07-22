import { useCallback, useEffect, useState } from "react";

import {
  type GeoPoint,
  type LocationStatus,
  getCurrentLocation,
  reverseGeocode,
} from "@/core/permissions/location";

export interface LocationState {
  point: GeoPoint | null;
  address: string | null;
  status: LocationStatus;
  refresh: () => Promise<void>;
}

/**
 * React hook that fetches the device's real location (and a reverse-geocoded
 * address where supported). Returns an honest status the UI can reflect instead
 * of pretending a position is known.
 */
export function useLocation(auto = true): LocationState {
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");

  const refresh = useCallback(async () => {
    setStatus("loading");
    const p = await getCurrentLocation();
    if (!p) {
      setPoint(null);
      setAddress(null);
      setStatus("denied");
      return;
    }
    setPoint(p);
    setStatus("ready");
    const addr = await reverseGeocode(p.lat, p.lng);
    setAddress(addr);
  }, []);

  useEffect(() => {
    if (auto) void refresh();
  }, [auto, refresh]);

  return { point, address, status, refresh };
}
