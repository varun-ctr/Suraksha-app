/**
 * Web stub — react-native-maps is not available on web.
 * Renders nothing; the map.tsx route shows the web-only ScrollView UI instead.
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
  onPress?: () => void;
  navigateTip?: string;
}

interface NativeMapProps {
  lat?: number;
  lng?: number;
  markers?: MarkerData[];
  showsUserLocation?: boolean;
}

export function NativeMap(_: NativeMapProps) {
  return <View />;
}
