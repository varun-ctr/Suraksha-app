import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

import { firebaseAuth } from "@/repositories/firebase/firebaseClient";

import type {
  ProfileRow,
  ProfileInsert,
  ProfileUpdate,
  SosEventRow,
  SosEventInsert,
  SosEventUpdate,
  JourneyRow,
  JourneyInsert,
  JourneyUpdate,
  CommunityReportRow,
  CommunityReportInsert,
  CommunityReportUpdate,
  SubscriptionRow,
  SubscriptionInsert,
  SubscriptionUpdate,
  NotificationTokenRow,
  NotificationTokenInsert,
  LiveSessionRow,
  LiveSessionInsert,
  LiveSessionUpdate,
  LiveSessionPublic,
} from "@/shared/types/database";

// ── Single lazy Supabase client ───────────────────────────────────────────────
//
// initSupabase() is called from app/_layout.tsx ONLY after config validation
// succeeds — so real env vars are always passed, never placeholders.
// The Proxy forwards every property access to the real client once initialized.

let _client: SupabaseClient | null = null;

/**
 * Initialize the shared Supabase client exactly once.
 * Called by app/_layout.tsx at module level after validateConfig() passes.
 */
export function initSupabase(url: string, key: string): void {
  _client = createClient(url, key, {
    // Auth is handled by Firebase, not Supabase. We hand Supabase the current
    // Firebase ID token so Postgres RLS can authorize the request via the
    // token's `sub` claim (the Firebase uid). This requires Firebase to be
    // registered as a Third-Party Auth provider in the Supabase dashboard.
    accessToken: async () => {
      const user = firebaseAuth.currentUser;
      if (!user) return null;
      return user.getIdToken().catch(() => null);
    },
  });
}

function getClient(): SupabaseClient {
  if (!_client) throw new Error("[Suraksha] Supabase used before initialization — call initSupabase() first");
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getClient();
    const val = Reflect.get(client, prop as string | symbol, client);
    return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(client) : val;
  },
});

// ── Typed table helpers ───────────────────────────────────────────────────────
// Prefer these over writing raw `.from("table_name")` in screens.

export const db = {
  profiles: {
    select: () =>
      supabase.from("profiles").select<"*", ProfileRow>("*"),

    getById: (id: string) =>
      supabase.from("profiles").select<"*", ProfileRow>("*").eq("id", id).single(),

    upsert: (row: ProfileInsert) =>
      supabase.from("profiles").upsert(row),

    update: (id: string, patch: ProfileUpdate) =>
      supabase.from("profiles").update(patch).eq("id", id),
  },

  sosEvents: {
    insert: (userId: string, row: SosEventInsert) =>
      supabase
        .from("sos_events")
        .insert({ ...row, user_id: userId })
        .select<"*", SosEventRow>("*")
        .single(),

    resolve: (id: string, patch: SosEventUpdate) =>
      supabase.from("sos_events").update(patch).eq("id", id),

    listForUser: (userId: string) =>
      supabase
        .from("sos_events")
        .select<"*", SosEventRow>("*")
        .eq("user_id", userId)
        .order("triggered_at", { ascending: false }),

    /** Most recent unresolved event at/after `sinceIso` — used to detect a prior insert that actually succeeded before retrying it. */
    findRecentUnresolved: (userId: string, sinceIso: string) =>
      supabase
        .from("sos_events")
        .select<"*", SosEventRow>("*")
        .eq("user_id", userId)
        .is("resolved_at", null)
        .gte("triggered_at", sinceIso)
        .order("triggered_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
  },

  journeys: {
    insert: (userId: string, row: JourneyInsert) =>
      supabase
        .from("journeys")
        .insert({ ...row, user_id: userId })
        .select<"*", JourneyRow>("*")
        .single(),

    end: (id: string, patch: JourneyUpdate) =>
      supabase.from("journeys").update(patch).eq("id", id),

    listForUser: (userId: string) =>
      supabase
        .from("journeys")
        .select<"*", JourneyRow>("*")
        .eq("user_id", userId)
        .order("started_at", { ascending: false }),

    /** Used by journeyRepository's retry loop to check whether a previous, client-generated-id insert actually succeeded before assuming it failed and retrying. */
    getById: (id: string) =>
      supabase
        .from("journeys")
        .select<"*", JourneyRow>("*")
        .eq("id", id)
        .maybeSingle(),
  },

  communityReports: {
    insert: (userId: string, row: CommunityReportInsert) =>
      supabase
        .from("community_reports")
        .insert({ ...row, user_id: userId })
        .select<"*", CommunityReportRow>("*")
        .single(),

    update: (id: string, patch: CommunityReportUpdate) =>
      supabase.from("community_reports").update(patch).eq("id", id),

    delete: (id: string) =>
      supabase.from("community_reports").delete().eq("id", id),

    listAll: () =>
      supabase
        .from("community_reports")
        .select<"*", CommunityReportRow>("*")
        .eq("moderation_status", "pending")
        .order("created_at", { ascending: false }),

    listForUser: (userId: string) =>
      supabase
        .from("community_reports")
        .select<"*", CommunityReportRow>("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
  },

  subscriptions: {
    getForUser: (userId: string) =>
      supabase
        .from("subscriptions")
        .select<"*", SubscriptionRow>("*")
        .eq("user_id", userId)
        .single(),

    upsert: (userId: string, patch: SubscriptionInsert) =>
      supabase
        .from("subscriptions")
        .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" }),

    update: (userId: string, patch: SubscriptionUpdate) =>
      supabase.from("subscriptions").update(patch).eq("user_id", userId),
  },

  notificationTokens: {
    upsert: (userId: string, row: NotificationTokenInsert) =>
      supabase
        .from("notification_tokens")
        .upsert(
          { user_id: userId, ...row },
          { onConflict: "user_id, token" },
        ),

    deleteForUser: (userId: string) =>
      supabase.from("notification_tokens").delete().eq("user_id", userId),

    listForUser: (userId: string) =>
      supabase
        .from("notification_tokens")
        .select<"*", NotificationTokenRow>("*")
        .eq("user_id", userId),
  },

  liveSessions: {
    insert: (userId: string, row: LiveSessionInsert) =>
      supabase
        .from("live_sessions")
        .insert({ ...row, user_id: userId })
        .select<"*", LiveSessionRow>("*")
        .single(),

    update: (shareId: string, patch: LiveSessionUpdate) =>
      supabase.from("live_sessions").update(patch).eq("share_id", shareId),

    end: (shareId: string) =>
      supabase
        .from("live_sessions")
        .update({ is_active: false })
        .eq("share_id", shareId),

    getByShareId: (shareId: string) =>
      supabase
        .from("live_sessions")
        .select<"*", LiveSessionRow>("*")
        .eq("share_id", shareId)
        .single(),

    getPublicByShareId: (shareId: string) =>
      supabase
        .rpc("get_live_session", { p_share_id: shareId })
        .returns<LiveSessionPublic[]>()
        .single(),

    /** Marks any other still-active sessions for this user inactive — closes zombie sessions a prior crash/kill left behind before a new one starts. */
    endAllActiveForUser: (userId: string) =>
      supabase
        .from("live_sessions")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("is_active", true),
  },
};
