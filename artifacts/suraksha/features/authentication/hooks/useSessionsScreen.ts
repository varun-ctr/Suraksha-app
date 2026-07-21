import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";

import { getCurrentUser, signOut } from "@/features/authentication/services/authService";
import { apiFetch } from "@/core/network/apiClient";

export interface SessionInfo {
  id: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  userAgent: string | null;
  ip: string | null;
  isCurrentSession: boolean;
}

async function fetchSessions(): Promise<SessionInfo[]> {
  const { response } = await apiFetch("/auth/sessions", { timeoutMs: 8_000 });
  if (!response || !response.ok) return [];
  try {
    const body = (await response.json()) as { sessions?: SessionInfo[] };
    return body.sessions ?? [];
  } catch {
    return [];
  }
}

/** All state and handlers for the active-sessions screen: session list load + sign-out. */
export function useSessionsScreen() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const loadData = async () => {
    setLoadingSessions(true);
    const [u, sessionList] = await Promise.all([
      getCurrentUser(),
      fetchSessions(),
    ]);
    setUser(u);
    setSessions(sessionList);
    setLoadingSessions(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Firebase has no server-side "revoke every device" call available here —
  // this ends the session on this device only, same as Profile's Sign Out.
  const confirmSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.replace("/login" as never);
  };

  return {
    user, sessions, loadingSessions, signingOut, confirmSignOut,
    goToProfile: () => router.push("/(tabs)/profile" as never),
  };
}
