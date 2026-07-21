import { useEffect, useState } from "react";

import { fetchWeather } from "@/repositories/api/weatherRepository";
import type { WeatherData } from "@/repositories/api/weatherRepository";
import type { GeoPoint } from "@/core/permissions/location";

/** Fetches current weather for `point`, re-fetching whenever it changes. */
export function useWeather(point: GeoPoint | null): WeatherData | null {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (point) {
      fetchWeather(point.lat, point.lng)
        .then((w) => {
          if (w) setWeather(w);
        })
        .catch(() => {});
    }
  }, [point]);

  return weather;
}
