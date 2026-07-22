import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/shared/components/Icon";
import { withAlpha } from "@/shared/theme/colors";
import { useTheme } from "@/shared/theme/ThemeContext";

/** Full-width gradient header used at the top of tab screens. */
export function GradientHeader({
  title,
  subtitle,
  colors,
  children,
  right,
  paddingBottom = 22,
}: {
  title: string;
  subtitle?: string;
  colors?: [string, string];
  children?: React.ReactNode;
  right?: React.ReactNode;
  paddingBottom?: number;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={colors ?? [c.primary, c.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        paddingTop: insets.top + 14,
        paddingHorizontal: 18,
        paddingBottom,
      }}
    >
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </LinearGradient>
  );
}

/** Sticky back header used by pushed stack screens. */
export function BackHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: 14,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: c.card,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      }}
    >
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
        hitSlop={10}
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: withAlpha(c.primary, 0.12),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="arrowLeft" size={17} color={c.primary} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: c.text }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontSize: 11.5, color: c.textMuted, fontFamily: "Inter_500Medium" }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  title: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 2, fontFamily: "Inter_500Medium" },
});
