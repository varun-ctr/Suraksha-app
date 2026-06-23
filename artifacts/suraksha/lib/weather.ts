export interface WeatherData {
  temp: number;
  code: number;
  label: string;
  icon: string;
}

const WMO: Record<number, { label: string; icon: string }> = {
  0:  { label: "Clear sky",              icon: "☀️" },
  1:  { label: "Mainly clear",           icon: "🌤️" },
  2:  { label: "Partly cloudy",          icon: "⛅" },
  3:  { label: "Overcast",               icon: "☁️" },
  45: { label: "Foggy",                  icon: "🌫️" },
  48: { label: "Icy fog",                icon: "🌫️" },
  51: { label: "Light drizzle",          icon: "🌦️" },
  53: { label: "Drizzle",                icon: "🌦️" },
  55: { label: "Heavy drizzle",          icon: "🌧️" },
  61: { label: "Light rain",             icon: "🌧️" },
  63: { label: "Rain",                   icon: "🌧️" },
  65: { label: "Heavy rain",             icon: "🌧️" },
  71: { label: "Light snow",             icon: "🌨️" },
  73: { label: "Snow",                   icon: "🌨️" },
  75: { label: "Heavy snow",             icon: "❄️" },
  77: { label: "Snow grains",            icon: "❄️" },
  80: { label: "Rain showers",           icon: "🌦️" },
  81: { label: "Showers",               icon: "🌧️" },
  82: { label: "Heavy showers",          icon: "⛈️" },
  85: { label: "Snow showers",           icon: "🌨️" },
  86: { label: "Heavy snow showers",     icon: "🌨️" },
  95: { label: "Thunderstorm",           icon: "⛈️" },
  96: { label: "Thunderstorm",           icon: "⛈️" },
  99: { label: "Severe thunderstorm",    icon: "⛈️" },
};

function wmoMeta(code: number): { label: string; icon: string } {
  return WMO[code] ?? WMO[Math.floor(code / 10) * 10] ?? { label: "Weather", icon: "🌡️" };
}

let _cache: { data: WeatherData; at: number; lat: number; lng: number } | null = null;
const CACHE_MS = 10 * 60 * 1000;

export async function fetchWeather(lat: number, lng: number): Promise<WeatherData | null> {
  const now = Date.now();
  if (
    _cache &&
    now - _cache.at < CACHE_MS &&
    Math.abs(_cache.lat - lat) < 0.05 &&
    Math.abs(_cache.lng - lng) < 0.05
  ) {
    return _cache.data;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current_weather=true`;
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current_weather?: { temperature: number; weathercode: number };
    };
    const cw = json.current_weather;
    if (!cw) return null;
    const meta = wmoMeta(cw.weathercode);
    const data: WeatherData = {
      temp: Math.round(cw.temperature),
      code: cw.weathercode,
      label: meta.label,
      icon: meta.icon,
    };
    _cache = { data, at: now, lat, lng };
    return data;
  } catch {
    return null;
  }
}
