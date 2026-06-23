import { Feather } from "@expo/vector-icons";
import React from "react";

import type { IconName } from "@/constants/data";

const MAP: Record<IconName, React.ComponentProps<typeof Feather>["name"]> = {
  bell: "bell",
  alert: "alert-triangle",
  mapPin: "map-pin",
  home: "home",
  map: "map",
  book: "book-open",
  user: "user",
  phone: "phone",
  plus: "plus",
  x: "x",
  check: "check",
  chevronRight: "chevron-right",
  chevronDown: "chevron-down",
  arrowLeft: "arrow-left",
  users: "users",
  store: "shopping-bag",
  hospital: "plus-square",
  shield: "shield",
  navigation: "navigation",
  clock: "clock",
  search: "search",
  info: "info",
  lock: "lock",
  globe: "globe",
  fileText: "file-text",
  helpCircle: "help-circle",
  crown: "award",
  message: "message-circle",
  phoneCall: "phone-call",
  camera: "camera",
  moon: "moon",
  sun: "sun",
  palette: "droplet",
  share: "share-2",
  heart: "heart",
  send: "send",
  sparkles: "star",
  edit: "edit-2",
  trash: "trash-2",
  logOut: "log-out",
  bellRing: "bell",
  flag: "flag",
  bookmark: "bookmark",
  bookmarkFilled: "bookmark",
  mapPin2: "map-pin",
};

interface Props {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color = "#000" }: Props) {
  return <Feather name={MAP[name] ?? "circle"} size={size} color={color} />;
}
