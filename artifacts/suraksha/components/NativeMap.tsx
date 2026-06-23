/**
 * Native-only wrapper around react-native-maps with Google Maps SDK.
 * Imported by map.tsx so the route file itself never directly imports
 * react-native-maps (which crashes the web bundler).
 *
 * Features:
 * - PROVIDER_GOOGLE on Android + iOS
 * - showsUserLocation animated blue dot
 * - 5-second GPS position watch → animates map to follow user
 * - Colour-coded place markers with Callout (name, address, Navigate button)
 * - Dark map style via customMapStyle when isDark=true
 */
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Callout, Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";

import { DARK_MAP_STYLE } from "@/lib/mapStyle";

export interface MarkerData {
  id: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
  pinColor?: string;
  /** Called when user taps the Navigate button in the callout */
  onNavigate?: () => void;
}

interface NativeMapProps {
  lat?: number;
  lng?: number;
  markers?: MarkerData[];
  showsUserLocation?: boolean;
  isDark?: boolean;
  /** Fired whenever the internal 5-second GPS watch delivers a new position */
  onLocationUpdate?: (lat: number, lng: number) => void;
}

const INDIA: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 24,
  longitudeDelta: 24,
};

const ZOOM_DELTA = 0.012;

export function NativeMap({
  lat,
  lng,
  markers = [],
  showsUserLocation = true,
  isDark = false,
  onLocationUpdate,
}: NativeMapProps) {
  const mapRef = useRef<MapView>(null);

  // Track whether we've done the initial fly-to so we only animate on prop changes, not on mount
  const initialRegionSet = useRef(false);

  const [internalRegion, setInternalRegion] = useState<Region>(
    lat !== undefined && lng !== undefined
      ? { latitude: lat, longitude: lng, latitudeDelta: ZOOM_DELTA, longitudeDelta: ZOOM_DELTA }
      : INDIA,
  );

  // Animate to new lat/lng when parent props change (e.g. useLocation() updates)
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const next: Region = { latitude: lat, longitude: lng, latitudeDelta: ZOOM_DELTA, longitudeDelta: ZOOM_DELTA };
    if (!initialRegionSet.current) {
      setInternalRegion(next);
      initialRegionSet.current = true;
      return;
    }
    mapRef.current?.animateToRegion(next, 600);
  }, [lat, lng]);

  // 5-second GPS watch — animates map to follow user and calls onLocationUpdate callback
  const handleLocationUpdate = useCallback(
    (loc: Location.LocationObject) => {
      const { latitude, longitude } = loc.coords;
      onLocationUpdate?.(latitude, longitude);
      mapRef.current?.animateToRegion(
        { latitude, longitude, latitudeDelta: ZOOM_DELTA, longitudeDelta: ZOOM_DELTA },
        800,
      );
    },
    [onLocationUpdate],
  );

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== "granted") return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        handleLocationUpdate,
      );
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [handleLocationUpdate]);

  // PROVIDER_GOOGLE is supported on Android + iOS. On web this file is never loaded.
  const provider = Platform.OS !== "web" ? PROVIDER_GOOGLE : undefined;

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={provider}
      initialRegion={internalRegion}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      customMapStyle={isDark ? DARK_MAP_STYLE : []}
    >
      {markers.map((m) => (
        <Marker
          key={m.id}
          coordinate={{ latitude: m.lat, longitude: m.lng }}
          pinColor={m.pinColor}
        >
          <Callout tooltip={false}>
            <View style={styles.callout}>
              <Text style={styles.calloutName} numberOfLines={2}>{m.name}</Text>
              {!!m.address && (
                <Text style={styles.calloutAddr} numberOfLines={2}>{m.address}</Text>
              )}
              {m.onNavigate && (
                <Pressable
                  onPress={m.onNavigate}
                  style={[styles.navBtn, { backgroundColor: m.pinColor ?? "#5B2FBF" }]}
                >
                  <Text style={styles.navBtnText}>Navigate →</Text>
                </Pressable>
              )}
            </View>
          </Callout>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  callout: {
    width: 210,
    padding: 10,
    borderRadius: 10,
  },
  calloutName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A0A2E",
    marginBottom: 3,
    lineHeight: 18,
  },
  calloutAddr: {
    fontSize: 11,
    color: "#555",
    marginBottom: 8,
    lineHeight: 16,
  },
  navBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  navBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
});
