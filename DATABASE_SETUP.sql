-- =============================================================================
-- Suraksha Database Setup
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================================================

-- ─────────────────────────────────────────────
-- 1. profiles table
-- Auto-created for every new auth user via trigger.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_premium       boolean NOT NULL DEFAULT false,
  premium_until    timestamptz,
  sakhi_message_count int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Trigger: create a profile row whenever a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: users can read their own row
CREATE POLICY "profiles: select own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: users can update is_premium on their own row
-- (needed for client-side RevenueCat entitlement sync)
CREATE POLICY "profiles: update own is_premium"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─────────────────────────────────────────────
-- 2. live_sessions table
-- Stores active SOS location shares.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_sessions (
  share_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  accuracy    double precision,
  is_active   boolean NOT NULL DEFAULT true,
  started_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '6 hours')
);

-- Enable RLS on live_sessions
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: owning user can do anything on their own rows
CREATE POLICY "live_sessions: all own"
  ON public.live_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: anyone who knows the exact share_id can read that single session row.
-- This is intentional: the share_id is a 128-bit random UUID (2^122 search
-- space), so possession of it is the access credential for the web tracker.
-- The USING clause further restricts to active, non-expired sessions so ended
-- sessions become invisible even to someone who had the link.
CREATE POLICY "live_sessions: public read by share_id"
  ON public.live_sessions
  FOR SELECT
  USING (
    is_active = true
    AND expires_at > now()
    AND share_id = (current_setting('request.jwt.claims', true)::json->>'share_id')::uuid
  );

-- NOTE: The policy above works when the share_id is embedded in the JWT claim.
-- For anonymous web-tracker access (no JWT), use a Postgres security-definer
-- RPC function instead. Paste and run the function below, then replace the
-- policy above with the more permissive version commented out at the end of
-- this file if you prefer the simpler approach for MVP.

-- Secure RPC (preferred): restricts DB access to a single row by share_id.
CREATE OR REPLACE FUNCTION public.get_live_session(p_share_id uuid)
RETURNS TABLE (
  share_id   uuid,
  lat        double precision,
  lng        double precision,
  accuracy   double precision,
  is_active  boolean,
  expires_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT share_id, lat, lng, accuracy, is_active, expires_at, updated_at
  FROM   live_sessions
  WHERE  share_id   = p_share_id
    AND  is_active  = true
    AND  expires_at > now()
  LIMIT  1;
$$;

-- Grant execute to the anon (unauthenticated) Supabase role so the web tracker
-- can call this without a logged-in session.
GRANT EXECUTE ON FUNCTION public.get_live_session(uuid) TO anon;

-- Simple alternative policy (use this for MVP instead of the JWT-claim policy
-- above if you do not embed share_id in the JWT). Uncomment and re-run:
-- CREATE POLICY "live_sessions: public read active by share"
--   ON public.live_sessions
--   FOR SELECT
--   USING (is_active = true AND expires_at > now());

-- Enable Realtime for live_sessions so the web tracker gets push updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;

-- =============================================================================
-- Done. Required Replit Secrets:
--   SUPABASE_URL              — your Supabase project URL
--   SUPABASE_SERVICE_ROLE_KEY — service role key (never expose to client)
--   OPENAI_API_KEY            — OpenAI key for Sakhi chat
--   GOOGLE_PLACES_API_KEY     — Google Places API key for nearby places
--   REVENUECAT_WEBHOOK_SECRET — (optional) RevenueCat webhook secret
--
-- Required Expo public env vars (set in Replit environment):
--   EXPO_PUBLIC_SUPABASE_URL             — same as SUPABASE_URL
--   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY — anon/public key (safe to expose)
--   EXPO_PUBLIC_BACKEND_URL              — your Express server URL
--   EXPO_PUBLIC_LIVE_TRACKER_URL         — base URL for live tracker pages
-- =============================================================================
