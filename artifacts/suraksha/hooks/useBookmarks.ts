import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "suraksha.rights.bookmarks";

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const ids = JSON.parse(raw) as number[];
            setBookmarks(new Set(ids));
          } catch {
            // ignore malformed data
          }
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const toggle = useCallback(async (id: number) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      const arr = [...next];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr)).catch(() => {});
      return next;
    });
  }, []);

  const isBookmarked = useCallback(
    (id: number) => bookmarks.has(id),
    [bookmarks],
  );

  return { bookmarks, toggle, isBookmarked, loaded };
}
