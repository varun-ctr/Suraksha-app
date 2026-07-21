/**
 * Web stub — react-native-maps is not available on web.
 * Renders nothing; the map.tsx route shows the web-only ScrollView UI instead.
 * Type signatures must stay in sync with NativeMap.tsx.
 */
import React from "react";
import { View } from "react-native";

export interface MarkerData {
  id: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
  pinColor?: string;
  onNavigate?: () => void;
}

interface NativeMapProps {
  lat?: number;
  lng?: number;
  markers?: MarkerData[];
  showsUserLocation?: boolean;
  isDark?: boolean;
  onLocationUpdate?: (lat: number, lng: number) => void;
}

export function NativeMap(_: NativeMapProps) {
  return <View />;
}
