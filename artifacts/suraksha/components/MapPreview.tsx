import React from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import type { Place } from "@/constants/data";
import { useTheme } from "@/context/ThemeContext";

const CENTER = { latitude: 12.9352, longitude: 77.6245 };

export function MapPreview({
  places,
  colorFor,
}: {
  places: Place[];
  colorFor: (cat: Place["category"]) => string;
}) {
  const { radius } = useTheme();
  return (
    <View style={[styles.wrap, { borderRadius: radius + 2 }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        showsUserLocation
        showsMyLocationButton={false}
        initialRegion={{
          ...CENTER,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        }}
      >
        {places.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            title={p.name}
            description={p.address}
          >
            <View style={[styles.pin, { backgroundColor: colorFor(p.category) }]}>
              <View style={styles.pinDot} />
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 230, overflow: "hidden", marginHorizontal: 18, marginBottom: 14 },
  pin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  pinDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#fff" },
});
