/**
 * Thin storage wrapper used for sensitive data (trusted contacts, profile).
 *
 * On a real device we use the OS-backed encrypted keystore via
 * `expo-secure-store`. On web (the Replit preview) SecureStore is unavailable,
 * so we fall back to AsyncStorage — web is preview-only and cannot offer a true
 * secure enclave.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

export async function secureGet(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // ignore
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // ignore
  }
}

export async function secureDelete(key: string): Promise<void> {
  if (isWeb) {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}
