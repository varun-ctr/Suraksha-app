import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "suraksha.rights.bookmarks";

interface BookmarksContextValue {
  bookmarks: Set<number>;
  isBookmarked: (id: number) => boolean;
  toggle: (id: number) => Promise<void>;
  loaded: boolean;
}

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
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
          }
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const toggle = useCallback(async (id: number) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  const isBookmarked = useCallback((id: number) => bookmarks.has(id), [bookmarks]);

  return (
    <BookmarksContext.Provider value={{ bookmarks, isBookmarked, toggle, loaded }}>
      {children}
    </BookmarksContext.Provider>
  );
}

export function useBookmarksCtx(): BookmarksContextValue {
  const ctx = useContext(BookmarksContext);
  if (!ctx) throw new Error("useBookmarksCtx must be used within BookmarksProvider");
  return ctx;
}
