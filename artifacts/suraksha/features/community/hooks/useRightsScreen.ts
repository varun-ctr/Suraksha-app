import { useRouter } from "expo-router";
import { useMemo, useState } from "react";

import { RIGHTS, type RightsCategory } from "@/shared/utils/data";
import { useBookmarks } from "@/features/community/hooks/useBookmarks";

export type RightsTab = "all" | "bookmarks";

/** All state and filtering logic for the legal-rights list screen. */
export function useRightsScreen() {
  const router = useRouter();
  const { isBookmarked, toggle } = useBookmarks();

  const [tab, setTab] = useState<RightsTab>("all");
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<"all" | RightsCategory>("all");

  const visible = useMemo(() => {
    return RIGHTS.filter((r) => {
      if (tab === "bookmarks") return isBookmarked(r.id);
      if (activeCat !== "all" && r.category !== activeCat) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q) ||
        r.en.toLowerCase().includes(q) ||
        r.hi.toLowerCase().includes(q)
      );
    });
  }, [tab, activeCat, search, isBookmarked]);

  const selectTab = (key: RightsTab) => {
    setTab(key);
    setSearch("");
    setActiveCat("all");
  };

  const onCardPress = (id: number) => {
    router.push({ pathname: "/right-detail", params: { id: String(id) } } as never);
  };

  return {
    tab, selectTab, search, setSearch, activeCat, setActiveCat,
    visible, onCardPress, isBookmarked, toggle,
  };
}
