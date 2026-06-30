import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";

import {
  buildPalette,
  type ColorMode,
  type Palette,
  RADIUS,
  type ThemeKey,
} from "@/constants/colors";

const THEME_KEY = "suraksha.theme.v1";
const MODE_KEY = "suraksha.mode.v1";

interface ThemeContextValue {
  c: Palette;
  radius: number;
  themeKey: ThemeKey;
  setThemeKey: (k: ThemeKey) => void;
  mode: ColorMode;
  setMode: (m: ColorMode) => void;
  isDark: boolean;
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [themeKey, setThemeKeyState] = useState<ThemeKey>("blue");
  const [mode, setModeState] = useState<ColorMode>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [savedTheme, savedMode] = await Promise.all([
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(MODE_KEY),
        ]);
        if (savedTheme) setThemeKeyState(savedTheme as ThemeKey);
        if (savedMode) setModeState(savedMode as ColorMode);
      } catch {
        // ignore — fall back to defaults
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setThemeKey = useCallback((k: ThemeKey) => {
    setThemeKeyState(k);
    AsyncStorage.setItem(THEME_KEY, k).catch(() => {});
  }, []);

  const setMode = useCallback((m: ColorMode) => {
    setModeState(m);
    AsyncStorage.setItem(MODE_KEY, m).catch(() => {});
  }, []);

  const isDark = mode === "system" ? system === "dark" : mode === "dark";
  const c = useMemo(() => buildPalette(themeKey, isDark), [themeKey, isDark]);

  const value = useMemo(
    () => ({ c, radius: RADIUS, themeKey, setThemeKey, mode, setMode, isDark, ready }),
    [c, themeKey, setThemeKey, mode, setMode, isDark, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
