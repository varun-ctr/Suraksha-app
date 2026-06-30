import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";

import { withAlpha } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Icon } from "@/components/Icon";
import type { IconName } from "@/constants/data";

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  const { c, radius } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: radius,
          padding: 16,
          elevation: 1,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children, top }: { children: React.ReactNode; top?: number }) {
  const { c } = useTheme();
  return (
    <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: c.textMuted, marginBottom: 8, marginTop: top ?? 0, textTransform: "uppercase", letterSpacing: 0.6 }}>
      {children}
    </Text>
  );
}

export function Avatar({
  label,
  uri,
  size = 38,
  color,
}: {
  label: string;
  uri?: string;
  size?: number;
  color?: string;
}) {
  const { c } = useTheme();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color ?? c.primaryLight,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: size * 0.38 }}>
        {label.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export function IconBadge({
  name,
  color,
  size = 18,
  box = 38,
}: {
  name: IconName;
  color: string;
  size?: number;
  box?: number;
}) {
  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: box * 0.3,
        backgroundColor: withAlpha(color, 0.12),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={name} size={size} color={color} />
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "success" | "accent" | "ghost" | "danger";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  small?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  style,
  textStyle,
  small,
}: ButtonProps) {
  const { c, radius } = useTheme();
  const bg = {
    primary: c.primary,
    success: c.success,
    accent: c.accent,
    danger: c.danger,
    ghost: c.cardAlt,
  }[variant];
  const fg = variant === "ghost" ? c.primary : "#fff";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius + 2,
          paddingVertical: small ? 9 : 13,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          opacity: pressed || disabled ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon && <Icon name={icon} size={small ? 14 : 16} color={fg} />}
          <Text
            style={[
              { color: fg, fontFamily: "Inter_700Bold", fontSize: small ? 13 : 14.5 },
              textStyle,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
}) {
  const { c } = useTheme();
  const activeColor = color ?? c.primary;
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: active ? activeColor : c.card,
        borderWidth: 1,
        borderColor: active ? activeColor : c.border,
      }}
    >
      <Text
        style={{
          fontSize: 12.5,
          fontFamily: "Inter_700Bold",
          color: active ? "#fff" : c.textMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export const sharedStyles = StyleSheet.create({
  screen: { flex: 1 },
  pad: { paddingHorizontal: 18 },
});
