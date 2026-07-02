import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

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

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : (null as unknown as ReturnType<typeof createClient<never>>);

// ------------------------------------------------------------------
// Typed table helpers
// Prefer these over writing raw `.from("table_name")` in screens.
// All helpers guard against missing config — they return a rejected
// promise instead of crashing when Supabase is not configured.
// ------------------------------------------------------------------

function notConfigured(): Promise<never> {
  return Promise.reject(new Error("Supabase not configured — add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
}

export const db = {
  profiles: {
    select: () =>
      isConfigured ? supabase.from("profiles").select<"*", ProfileRow>("*") : notConfigured(),

    getById: (id: string) =>
      isConfigured
        ? supabase.from("profiles").select<"*", ProfileRow>("*").eq("id", id).single()
        : notConfigured(),

    upsert: (row: ProfileInsert) =>
      isConfigured ? supabase.from("profiles").upsert(row) : notConfigured(),

    update: (id: string, patch: ProfileUpdate) =>
      isConfigured ? supabase.from("profiles").update(patch).eq("id", id) : notConfigured(),
  },

  sosEvents: {
    insert: (userId: string, row: SosEventInsert) =>
      isConfigured
        ? supabase.from("sos_events").insert({ ...row, user_id: userId }).select<"*", SosEventRow>("*").single()
        : notConfigured(),

    resolve: (id: string, patch: SosEventUpdate) =>
      isConfigured ? supabase.from("sos_events").update(patch).eq("id", id) : notConfigured(),

    listForUser: (userId: string) =>
      isConfigured
        ? supabase.from("sos_events").select<"*", SosEventRow>("*").eq("user_id", userId).order("triggered_at", { ascending: false })
        : notConfigured(),
  },

  journeys: {
    insert: (userId: string, row: JourneyInsert) =>
      isConfigured
        ? supabase.from("journeys").insert({ ...row, user_id: userId }).select<"*", JourneyRow>("*").single()
        : notConfigured(),

    end: (id: string, patch: JourneyUpdate) =>
      isConfigured ? supabase.from("journeys").update(patch).eq("id", id) : notConfigured(),

    listForUser: (userId: string) =>
      isConfigured
        ? supabase.from("journeys").select<"*", JourneyRow>("*").eq("user_id", userId).order("started_at", { ascending: false })
        : notConfigured(),
  },

  communityReports: {
    insert: (userId: string, row: CommunityReportInsert) =>
      isConfigured
        ? supabase.from("community_reports").insert({ ...row, user_id: userId }).select<"*", CommunityReportRow>("*").single()
        : notConfigured(),

    update: (id: string, patch: CommunityReportUpdate) =>
      isConfigured ? supabase.from("community_reports").update(patch).eq("id", id) : notConfigured(),

    delete: (id: string) =>
      isConfigured ? supabase.from("community_reports").delete().eq("id", id) : notConfigured(),

    listAll: () =>
      isConfigured
        ? supabase.from("community_reports").select<"*", CommunityReportRow>("*").eq("moderation_status", "pending").order("created_at", { ascending: false })
        : notConfigured(),

    listForUser: (userId: string) =>
      isConfigured
        ? supabase.from("community_reports").select<"*", CommunityReportRow>("*").eq("user_id", userId).order("created_at", { ascending: false })
        : notConfigured(),
  },

  subscriptions: {
    getForUser: (userId: string) =>
      isConfigured
        ? supabase.from("subscriptions").select<"*", SubscriptionRow>("*").eq("user_id", userId).single()
        : notConfigured(),

    upsert: (userId: string, patch: SubscriptionInsert) =>
      isConfigured
        ? supabase.from("subscriptions").upsert({ user_id: userId, ...patch }, { onConflict: "user_id" })
        : notConfigured(),

    update: (userId: string, patch: SubscriptionUpdate) =>
      isConfigured ? supabase.from("subscriptions").update(patch).eq("user_id", userId) : notConfigured(),
  },

  notificationTokens: {
    upsert: (userId: string, row: NotificationTokenInsert) =>
      isConfigured
        ? supabase.from("notification_tokens").upsert({ user_id: userId, ...row }, { onConflict: "user_id, token" })
        : notConfigured(),

    deleteForUser: (userId: string) =>
      isConfigured ? supabase.from("notification_tokens").delete().eq("user_id", userId) : notConfigured(),

    listForUser: (userId: string) =>
      isConfigured
        ? supabase.from("notification_tokens").select<"*", NotificationTokenRow>("*").eq("user_id", userId)
        : notConfigured(),
  },

  liveSessions: {
    insert: (userId: string, row: LiveSessionInsert) =>
      isConfigured
        ? supabase.from("live_sessions").insert({ ...row, user_id: userId }).select<"*", LiveSessionRow>("*").single()
        : notConfigured(),

    update: (shareId: string, patch: LiveSessionUpdate) =>
      isConfigured ? supabase.from("live_sessions").update(patch).eq("share_id", shareId) : notConfigured(),

    end: (shareId: string) =>
      isConfigured
        ? supabase.from("live_sessions").update({ is_active: false }).eq("share_id", shareId)
        : notConfigured(),

    getByShareId: (shareId: string) =>
      isConfigured
        ? supabase.from("live_sessions").select<"*", LiveSessionRow>("*").eq("share_id", shareId).single()
        : notConfigured(),

    getPublicByShareId: (shareId: string) =>
      isConfigured
        ? supabase.rpc("get_live_session", { p_share_id: shareId }).returns<LiveSessionPublic[]>().single()
        : notConfigured(),
  },
};
