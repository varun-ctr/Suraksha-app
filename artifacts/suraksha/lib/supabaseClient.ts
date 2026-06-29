import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

import { requiredPublicEnv } from "./env";
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
} from "../types/database";

const supabaseUrl = requiredPublicEnv("EXPO_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = requiredPublicEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ------------------------------------------------------------------
// Typed table helpers
// Prefer these over writing raw `.from("table_name")` in screens.
// ------------------------------------------------------------------

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
    // userId is always required — user_id NOT NULL in schema + RLS enforces ownership
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
  },

  journeys: {
    // userId is always required — user_id NOT NULL in schema + RLS enforces ownership
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
  },

  communityReports: {
    // userId is always required — user_id NOT NULL in schema + RLS enforces ownership
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
    // userId is always required — user_id NOT NULL in schema + RLS enforces ownership
    // Share-link reads (public tracker page) must go through the api-server
    // using the service-role key, NOT the anon client, to avoid leaking all sessions.
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

    // Owner-only: reads the full row including user_id
    getByShareId: (shareId: string) =>
      supabase
        .from("live_sessions")
        .select<"*", LiveSessionRow>("*")
        .eq("share_id", shareId)
        .single(),

    // Public-safe: calls the SECURITY DEFINER RPC — only returns the one
    // session matching p_share_id, never exposes user_id or other sessions.
    getPublicByShareId: (shareId: string) =>
      supabase
        .rpc("get_live_session", { p_share_id: shareId })
        .returns<LiveSessionPublic[]>()
        .single(),
  },
};
