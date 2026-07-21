import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Animated, StyleSheet, Text } from "react-native";

import { useTheme } from "@/features/settings/context/ThemeContext";

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
  }, []);

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setMessage(null));
    }, 2200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [message, opacity]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            { backgroundColor: c.isDark ? "#000000" : c.text, opacity },
          ]}
        >
          <Text style={styles.text} numberOfLines={2}>
            {message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 110,
    alignSelf: "center",
    maxWidth: "86%",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 22,
    zIndex: 999,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  text: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    textAlign: "center",
  },
});

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
