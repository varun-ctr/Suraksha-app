import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { Icon } from "@/components/Icon";
import { SakhiIcon } from "@/components/SakhiIcon";
import type { IconName } from "@/constants/data";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

const TABS: { name: string; icon: IconName | "sakhi_custom"; key: string }[] = [
  { name: "index", icon: "home", key: "tab.home" },
  { name: "map", icon: "map", key: "tab.map" },
  { name: "sakhi", icon: "sakhi_custom", key: "tab.sakhi" },
  { name: "rights", icon: "book", key: "tab.rights" },
  { name: "profile", icon: "user", key: "tab.profile" },
];

export default function TabLayout() {
  const { c } = useTheme();
  const { t } = useI18n();
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textFaint,
        tabBarLabelStyle: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
          elevation: 0,
          ...(isWeb ? { height: 64 } : {}),
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.key),
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                {tab.icon === "sakhi_custom" ? (
                  <SakhiIcon color={color} size={focused ? 24 : 22} focused={focused} />
                ) : (
                  <Icon name={tab.icon as IconName} size={focused ? 24 : 22} color={color} />
                )}
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
