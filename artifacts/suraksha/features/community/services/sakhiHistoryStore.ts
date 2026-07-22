/**
 * Local persistence for the Sakhi chat: conversation history (so it survives
 * navigation/app restart) and a small reply cache (so a repeated question
 * can surface its last answer while offline).
 *
 * Uses AsyncStorage directly rather than `lib/secureStore.ts`'s SecureStore
 * wrapper: chat transcripts can grow past the OS keychain's ~2KB per-item
 * ceiling, and this content isn't sensitive the way contacts/profile are —
 * the same "plain" bucket AppContext already uses for settings.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface StoredMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const HISTORY_KEY = "sakhi.history.v1";
const CACHE_KEY = "sakhi.cache.v1";
const MAX_HISTORY_MESSAGES = 60;
const MAX_CACHE_ENTRIES = 30;

export async function loadSakhiHistory(): Promise<StoredMsg[] | null> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as StoredMsg[]) : null;
  } catch {
    return null;
  }
}

export async function saveSakhiHistory(messages: StoredMsg[]): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY_MESSAGES)));
  } catch {
    // ignore — history persistence is best-effort
  }
}

export async function clearSakhiHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

function normalizeQuery(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function getCachedReply(lastUserMessage: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Record<string, string>;
    return cache[normalizeQuery(lastUserMessage)] ?? null;
  } catch {
    return null;
  }
}

export async function cacheReply(lastUserMessage: string, reply: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const cache: Record<string, string> = raw ? JSON.parse(raw) : {};
    cache[normalizeQuery(lastUserMessage)] = reply;

    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ENTRIES) {
      for (const k of keys.slice(0, keys.length - MAX_CACHE_ENTRIES)) delete cache[k];
    }
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore — cache is best-effort
  }
}
