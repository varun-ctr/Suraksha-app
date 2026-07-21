import { Tabs } from "expo-router";
import React, { useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/shared/components/Icon";
import { SakhiIcon } from "@/features/community/components/SakhiIcon";
import type { IconName } from "@/shared/utils/data";
import { useI18n } from "@/features/settings/context/LanguageContext";
import { useTheme } from "@/features/settings/context/ThemeContext";

type TabBtnProps = {
  onPress?: ((...args: unknown[]) => void) | null;
  onLongPress?: ((...args: unknown[]) => void) | null;
  accessibilityState?: { selected?: boolean };
  style?: unknown;
};

function SakhiFABButton({ onPress, onLongPress, accessibilityState }: TabBtnProps) {
  const { c } = useTheme();
  const { t } = useI18n();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isSelected = accessibilityState?.selected;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={() => onLongPress?.()}
      style={styles.fabWrap}
      accessibilityRole="button"
      accessibilityLabel={t("tab.sakhi")}
      accessibilityState={{ selected: isSelected }}
    >
      <Animated.View
        style={[
          styles.fabCircle,
          {
            backgroundColor: c.primary,
            shadowColor: c.primary,
          },
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <SakhiIcon color="#fff" size={24} focused />
      </Animated.View>
      <Text style={[styles.fabLabel, { color: isSelected ? c.primary : c.textFaint }]}>
        {t("tab.sakhi")}
      </Text>
    </Pressable>
  );
}

const SIDE_TABS: { name: string; icon: IconName; key: string }[] = [
  { name: "index",   icon: "home", key: "tab.home"    },
  { name: "map",     icon: "map",  key: "tab.map"     },
  { name: "rights",  icon: "book", key: "tab.rights"  },
  { name: "profile", icon: "user", key: "tab.profile" },
];

export default function TabLayout() {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  // Base bar height plus the device's bottom safe-area inset (home indicator on
  // notched iPhones). A fixed height ignored the inset, leaving an uneven gap
  // and misaligned tab items.
  const bottomInset = isWeb ? 0 : insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textFaint,
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
          elevation: 0,
          height: (isWeb ? 60 : 58) + bottomInset,
          paddingBottom: isWeb ? 4 : Math.max(bottomInset, 8),
          paddingTop: 6,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab.home"),
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Icon name="home" size={focused ? 22 : 20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t("tab.map"),
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Icon name="map" size={focused ? 22 : 20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="sakhi"
        options={{
          title: t("tab.sakhi"),
          tabBarButton: (props) => (
            <SakhiFABButton
              onPress={props.onPress as TabBtnProps["onPress"]}
              onLongPress={props.onLongPress as TabBtnProps["onLongPress"]}
              accessibilityState={props.accessibilityState}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="incident"
        options={{
          title: t("tab.incident"),
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Icon name="flag" size={focused ? 22 : 20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="rights"
        options={{
          title: t("tab.rights"),
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Icon name="book" size={focused ? 22 : 20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tab.profile"),
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Icon name="user" size={focused ? 22 : 20} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    top: -14,
  },
  fabCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    elevation: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
  },
  fabLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
});
