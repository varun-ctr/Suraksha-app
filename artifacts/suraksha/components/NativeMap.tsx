/**
 * Native-only wrapper around react-native-maps.
 * Imported by map.tsx so the route file itself never directly imports
 * react-native-maps (which crashes the web bundler).
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";

export interface MarkerData {
  id: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
  pinColor?: string;
  onPress?: () => void;
  navigateTip?: string;
}

interface NativeMapProps {
  lat?: number;
  lng?: number;
  markers?: MarkerData[];
  showsUserLocation?: boolean;
}

const INDIA = { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 24, longitudeDelta: 24 };

export function NativeMap({ lat, lng, markers = [], showsUserLocation = true }: NativeMapProps) {
  const region =
    lat !== undefined && lng !== undefined
      ? { latitude: lat, longitude: lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
      : INDIA;

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      region={region}
    >
      {markers.map((m) => (
        <Marker
          key={m.id}
          coordinate={{ latitude: m.lat, longitude: m.lng }}
          pinColor={m.pinColor}
        >
          {m.onPress && (
            <Callout onPress={m.onPress}>
              <View style={styles.callout}>
                <Text style={styles.calloutName}>{m.name}</Text>
                {!!m.address && <Text style={styles.calloutAddr}>{m.address}</Text>}
                {!!m.navigateTip && <Text style={styles.calloutNav}>{m.navigateTip} →</Text>}
              </View>
            </Callout>
          )}
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  callout: { width: 200, padding: 4 },
  calloutName: { fontSize: 13, fontWeight: "700", color: "#1A0A2E", marginBottom: 3 },
  calloutAddr: { fontSize: 11, color: "#555", marginBottom: 4, lineHeight: 15 },
  calloutNav: { fontSize: 11, color: "#7C3AED", fontWeight: "600" },
});
