import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import type { Place } from "@/constants/data";
import { useTheme } from "@/context/ThemeContext";

/**
 * Web fallback: react-native-maps has no web implementation, so we render a
 * stylised faux-map (matching the prototype) with pins positioned by percent.
 */
export function MapPreview({
  places,
  colorFor,
}: {
  places: Place[];
  colorFor: (cat: Place["category"]) => string;
}) {
  const { c, radius } = useTheme();
  return (
    <View style={[styles.wrap, { borderRadius: radius + 2, borderColor: c.border }]}>
      <LinearGradient
        colors={["#CFE8D6", "#BFE0DB", "#D9E7C8", "#CFE0CF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.road, { top: "46%", left: 0, right: 0, height: 6 }]} />
      <View style={[styles.road, { left: "40%", top: 0, bottom: 0, width: 6 }]} />

      <View style={[styles.userWrap, { left: "45%", top: "48%" }]}>
        <View style={[styles.userRing, { borderColor: c.primary }]} />
        <View style={[styles.userDot, { backgroundColor: c.primary }]} />
      </View>

      {places.map((p) => (
        <View key={p.id} style={[styles.pin, { left: `${p.x}%`, top: `${p.y}%` }]}>
          <Svg width={26} height={32} viewBox="0 0 24 30">
            <Path
              d="M12 0C5.4 0 0 5.3 0 11.8 0 20.5 12 30 12 30s12-9.5 12-18.2C24 5.3 18.6 0 12 0Z"
              fill={colorFor(p.category)}
            />
            <Circle cx="12" cy="11.5" r="5" fill="#fff" />
          </Svg>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 230,
    overflow: "hidden",
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
  },
  road: { position: "absolute", backgroundColor: "rgba(255,255,255,0.65)" },
  userWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  userRing: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    opacity: 0.5,
  },
  userDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: "#fff" },
  pin: { position: "absolute", marginLeft: -13, marginTop: -32 },
});
