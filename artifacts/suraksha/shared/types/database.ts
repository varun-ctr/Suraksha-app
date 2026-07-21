/**
 * TypeScript types for every Supabase table in the Suraksha database.
 * Generated manually from DATABASE_SETUP.sql — keep in sync when schema changes.
 */

// ------------------------------------------------------------------
// profiles
// ------------------------------------------------------------------
export interface ProfileRow {
  id: string;
  name: string | null;
  phone: string | null;
  language: string;
  avatar_url: string | null;
  walkthrough_seen: boolean;
  created_at: string;
  updated_at: string;
}

export type ProfileInsert = Partial<Omit<ProfileRow, "id" | "created_at" | "updated_at">> & {
  id: string;
};

export type ProfileUpdate = Partial<Omit<ProfileRow, "id" | "created_at">>;

// ------------------------------------------------------------------
// sos_events
// ------------------------------------------------------------------
export interface SosEventRow {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  address: string | null;
  triggered_at: string;
  resolved_at: string | null;
  contacts_notified: ContactNotifiedEntry[];
  created_at: string;
  updated_at: string;
}

export interface ContactNotifiedEntry {
  name: string;
  phone: string;
  method: "call" | "sms" | "whatsapp";
  notified_at: string;
}

export type SosEventInsert = Pick<SosEventRow, "lat" | "lng"> &
  Partial<Pick<SosEventRow, "address" | "contacts_notified" | "triggered_at">>;

export type SosEventUpdate = Partial<Pick<SosEventRow, "resolved_at" | "contacts_notified">>;

// ------------------------------------------------------------------
// journeys
// ------------------------------------------------------------------
export interface JourneyRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  route_json: RoutePoint[];
  created_at: string;
  updated_at: string;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  recorded_at: string;
}

export type JourneyInsert = Partial<Pick<JourneyRow, "started_at" | "duration_minutes" | "route_json">>;

export type JourneyUpdate = Partial<Pick<JourneyRow, "ended_at" | "duration_minutes" | "route_json">>;

// ------------------------------------------------------------------
// community_reports
// ------------------------------------------------------------------
export type CommunityReportType =
  | "unsafe_area"
  | "harassment"
  | "stalking"
  | "suspicious_activity"
  | "accident"
  | "medical"
  | "road_block"
  | "fire"
  | "flood"
  | "animal_attack"
  | "other";

export type ModerationStatus = "pending" | "reviewed" | "removed";

export interface CommunityReportRow {
  id: string;
  user_id: string;
  type: CommunityReportType;
  lat: number;
  lng: number;
  address: string | null;
  description: string | null;
  photo_url: string | null;
  moderation_status: ModerationStatus;
  created_at: string;
  updated_at: string;
}

export type CommunityReportInsert = Pick<CommunityReportRow, "type" | "lat" | "lng"> &
  Partial<Pick<CommunityReportRow, "address" | "description" | "photo_url">>;

export type CommunityReportUpdate = Partial<
  Pick<CommunityReportRow, "description" | "photo_url" | "moderation_status">
>;

// ------------------------------------------------------------------
// subscriptions
// ------------------------------------------------------------------
export type SubscriptionPlan = "free" | "monthly" | "yearly" | "lifetime";
export type SubscriptionStatus = "active" | "inactive" | "cancelled" | "expired";

export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SubscriptionInsert = Partial<
  Pick<SubscriptionRow, "plan" | "status" | "expires_at">
>;

export type SubscriptionUpdate = Partial<
  Pick<SubscriptionRow, "plan" | "status" | "expires_at">
>;

// ------------------------------------------------------------------
// notification_tokens
// ------------------------------------------------------------------
export type NotificationPlatform = "ios" | "android" | "web";

export interface NotificationTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: NotificationPlatform;
  created_at: string;
  updated_at: string;
}

export type NotificationTokenInsert = Pick<
  NotificationTokenRow,
  "token" | "platform"
>;

// ------------------------------------------------------------------
// live_sessions
// ------------------------------------------------------------------
export interface LiveSessionRow {
  id: string;
  user_id: string;
  share_id: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type LiveSessionInsert = Pick<LiveSessionRow, "lat" | "lng"> &
  Partial<Pick<LiveSessionRow, "accuracy" | "expires_at">>;

export type LiveSessionUpdate = Partial<
  Pick<LiveSessionRow, "lat" | "lng" | "accuracy" | "is_active" | "expires_at">
>;

/**
 * Return type of the `get_live_session(p_share_id)` SECURITY DEFINER RPC.
 * This is the safe public-facing shape — no user_id is exposed.
 */
export interface LiveSessionPublic {
  id: string;
  share_id: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  is_active: boolean;
  expires_at: string | null;
  updated_at: string;
}

// ------------------------------------------------------------------
// emergency_contacts
// ------------------------------------------------------------------
export interface EmergencyContactRow {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type EmergencyContactInsert = Pick<EmergencyContactRow, "id" | "user_id" | "name" | "phone"> &
  Partial<Pick<EmergencyContactRow, "avatar_url">>;

export type EmergencyContactUpdate = Partial<Pick<EmergencyContactRow, "name" | "phone" | "avatar_url" | "updated_at">>;

// ------------------------------------------------------------------
// Convenience union — all table row types
// ------------------------------------------------------------------
export type AnyRow =
  | ProfileRow
  | SosEventRow
  | JourneyRow
  | CommunityReportRow
  | SubscriptionRow
  | NotificationTokenRow
  | LiveSessionRow;
