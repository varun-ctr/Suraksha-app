import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

import { firebaseAuth } from "@/repositories/firebase/firebaseClient";
import { dedupeInFlight } from "@/core/network/inFlightDedup";

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

// Unlike core/network/apiClient.ts's calls to this app's own backend (which
// already have a bounded timeout via AbortSignal.timeout — see
// DEFAULT_TIMEOUT_MS there), Supabase's own client had no timeout at all: a
// degraded connection could leave an emergency-critical call (sos_events,
// live_sessions, journeys) hanging indefinitely instead of failing fast into
// the retry/offline-queue paths that already exist for exactly that case.
// Applied only to the safety-critical tables below — see
// docs/backend-audit/repository-audit.md for the rationale on why the
// remaining tables (profiles, community_reports, subscriptions,
// notification_tokens) are lower-priority follow-ups, not left out by
// oversight.
const SUPABASE_TIMEOUT_MS = 10_000;

/** `AbortSignal.timeout()` is constructed fresh per call — a signal can only ever fire once, so a shared instance couldn't be reused across requests. */
function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(SUPABASE_TIMEOUT_MS);
}

function fetchProfileById(id: string) {
  return Promise.resolve(supabase.from("profiles").select<"*", ProfileRow>("*").eq("id", id).single());
}

// In-flight de-duplication for db.profiles.getById — two independent call
// sites (LanguageContext's post-sign-in language sync and
// useLoginScreen's post-sign-in walkthrough check) both fetch the same
// profile row within moments of each other on every sign-in. Rather than
// coordinate two unrelated modules, dedup at the query itself: a second
// call for the same id while the first is still in flight awaits that same
// promise instead of firing a second, identical SELECT. No TTL/staleness
// window — this only collapses genuinely concurrent calls, never serves a
// result older than the request that's actually in flight.
const inFlightProfileGetById = new Map<string, ReturnType<typeof fetchProfileById>>();

export const db = {
  profiles: {
    select: () =>
      supabase.from("profiles").select<"*", ProfileRow>("*"),

    getById: (id: string) => dedupeInFlight(inFlightProfileGetById, id, () => fetchProfileById(id)),

    upsert: (row: ProfileInsert) =>
      supabase.from("profiles").upsert(row),

    update: (id: string, patch: ProfileUpdate) =>
      supabase.from("profiles").update(patch).eq("id", id),
  },

  sosEvents: {
    /**
     * Upserts on (user_id, idempotency_key) — see api-server/migrations/005_emergency_data_idempotency.sql's
     * partial unique index. A retried insert with the same client-generated key is an idempotent no-op
     * rather than a possible duplicate emergency record. Callers that don't yet supply a key fall back to
     * a plain insert (no onConflict target), unchanged from prior behavior.
     */
    insert: (userId: string, row: SosEventInsert) =>
      row.idempotency_key
        ? supabase
            .from("sos_events")
            .upsert({ ...row, user_id: userId }, { onConflict: "user_id,idempotency_key" })
            .select<"*", SosEventRow>("*")
            .abortSignal(timeoutSignal())
            .single()
        : supabase
            .from("sos_events")
            .insert({ ...row, user_id: userId })
            .select<"*", SosEventRow>("*")
            .abortSignal(timeoutSignal())
            .single(),

    resolve: (id: string, patch: SosEventUpdate) =>
      supabase.from("sos_events").update(patch).eq("id", id).abortSignal(timeoutSignal()),

    listForUser: (userId: string) =>
      supabase
        .from("sos_events")
        .select<"*", SosEventRow>("*")
        .eq("user_id", userId)
        .order("triggered_at", { ascending: false })
        .abortSignal(timeoutSignal()),

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
        .abortSignal(timeoutSignal())
        .maybeSingle(),
  },

  journeys: {
    insert: (userId: string, row: JourneyInsert) =>
      supabase
        .from("journeys")
        .insert({ ...row, user_id: userId })
        .select<"*", JourneyRow>("*")
        .abortSignal(timeoutSignal())
        .single(),

    end: (id: string, patch: JourneyUpdate) =>
      supabase.from("journeys").update(patch).eq("id", id).abortSignal(timeoutSignal()),

    listForUser: (userId: string) =>
      supabase
        .from("journeys")
        .select<"*", JourneyRow>("*")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .abortSignal(timeoutSignal()),

    /** Used by journeyRepository's retry loop to check whether a previous, client-generated-id insert actually succeeded before assuming it failed and retrying. */
    getById: (id: string) =>
      supabase
        .from("journeys")
        .select<"*", JourneyRow>("*")
        .eq("id", id)
        .abortSignal(timeoutSignal())
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
        .order("created_at", { ascending: false })
        .limit(50),

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
        .abortSignal(timeoutSignal())
        .single(),

    update: (shareId: string, patch: LiveSessionUpdate) =>
      supabase.from("live_sessions").update(patch).eq("share_id", shareId).abortSignal(timeoutSignal()),

    end: (shareId: string) =>
      supabase
        .from("live_sessions")
        .update({ is_active: false })
        .eq("share_id", shareId)
        .abortSignal(timeoutSignal()),

    getByShareId: (shareId: string) =>
      supabase
        .from("live_sessions")
        .select<"*", LiveSessionRow>("*")
        .eq("share_id", shareId)
        .abortSignal(timeoutSignal())
        .single(),

    getPublicByShareId: (shareId: string) =>
      supabase
        .rpc("get_live_session", { p_share_id: shareId })
        .returns<LiveSessionPublic[]>()
        .abortSignal(timeoutSignal())
        .single(),

    /** Marks any other still-active sessions for this user inactive — closes zombie sessions a prior crash/kill left behind before a new one starts. */
    endAllActiveForUser: (userId: string) =>
      supabase
        .from("live_sessions")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("is_active", true)
        .abortSignal(timeoutSignal()),
  },
};
