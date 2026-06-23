-- =============================================================
-- Suraksha – Full Database Setup
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
-- Safe to re-run: uses IF NOT EXISTS / DO blocks throughout.
-- =============================================================

-- ----------------------------------------------------------
-- 1. PROFILES  (extends auth.users 1-to-1)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT,
  phone         TEXT,
  language      TEXT    NOT NULL DEFAULT 'en',
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add new columns to an existing profiles table if they don't exist yet
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='language') THEN
    ALTER TABLE public.profiles ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='phone') THEN
    ALTER TABLE public.profiles ADD COLUMN phone TEXT;
  END IF;
END $$;

-- Trigger: keep updated_at current
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: auto-create profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles: owner read" ON public.profiles;
CREATE POLICY "profiles: owner read"  ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles: owner write" ON public.profiles;
CREATE POLICY "profiles: owner write" ON public.profiles FOR ALL   USING (auth.uid() = id);


-- ----------------------------------------------------------
-- 2. SOS EVENTS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sos_events (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat                 DOUBLE PRECISION NOT NULL,
  lng                 DOUBLE PRECISION NOT NULL,
  address             TEXT,
  triggered_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ,
  contacts_notified   JSONB        NOT NULL DEFAULT '[]'::JSONB,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS sos_events_updated_at ON public.sos_events;
CREATE TRIGGER sos_events_updated_at
  BEFORE UPDATE ON public.sos_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.sos_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sos_events: owner only" ON public.sos_events;
CREATE POLICY "sos_events: owner only" ON public.sos_events FOR ALL USING (auth.uid() = user_id);


-- ----------------------------------------------------------
-- 3. JOURNEYS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journeys (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  duration_minutes  INTEGER,
  route_json        JSONB       NOT NULL DEFAULT '[]'::JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS journeys_updated_at ON public.journeys;
CREATE TRIGGER journeys_updated_at
  BEFORE UPDATE ON public.journeys
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "journeys: owner only" ON public.journeys;
CREATE POLICY "journeys: owner only" ON public.journeys FOR ALL USING (auth.uid() = user_id);


-- ----------------------------------------------------------
-- 4. COMMUNITY REPORTS
--    Readable by ALL authenticated users (for map display).
--    Writable / deletable only by the owning user.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_reports (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                TEXT        NOT NULL
                        CHECK (type IN ('unsafe_area','harassment','stalking','suspicious_activity')),
  lat                 DOUBLE PRECISION NOT NULL,
  lng                 DOUBLE PRECISION NOT NULL,
  address             TEXT,
  description         TEXT,
  photo_url           TEXT,
  moderation_status   TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (moderation_status IN ('pending','reviewed','removed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS community_reports_updated_at ON public.community_reports;
CREATE TRIGGER community_reports_updated_at
  BEFORE UPDATE ON public.community_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_reports: auth read" ON public.community_reports;
CREATE POLICY "community_reports: auth read"
  ON public.community_reports FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "community_reports: owner insert" ON public.community_reports;
CREATE POLICY "community_reports: owner insert"
  ON public.community_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "community_reports: owner update" ON public.community_reports;
CREATE POLICY "community_reports: owner update"
  ON public.community_reports FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "community_reports: owner delete" ON public.community_reports;
CREATE POLICY "community_reports: owner delete"
  ON public.community_reports FOR DELETE
  USING (auth.uid() = user_id);


-- ----------------------------------------------------------
-- 5. SUBSCRIPTIONS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan        TEXT        NOT NULL DEFAULT 'free'
                CHECK (plan IN ('free','monthly','yearly','lifetime')),
  status      TEXT        NOT NULL DEFAULT 'inactive'
                CHECK (status IN ('active','inactive','cancelled','expired')),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions: owner only" ON public.subscriptions;
CREATE POLICY "subscriptions: owner only" ON public.subscriptions FOR ALL USING (auth.uid() = user_id);


-- ----------------------------------------------------------
-- 6. NOTIFICATION TOKENS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL,
  platform    TEXT        NOT NULL
                CHECK (platform IN ('ios','android','web')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

DROP TRIGGER IF EXISTS notification_tokens_updated_at ON public.notification_tokens;
CREATE TRIGGER notification_tokens_updated_at
  BEFORE UPDATE ON public.notification_tokens
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.notification_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_tokens: owner only" ON public.notification_tokens;
CREATE POLICY "notification_tokens: owner only" ON public.notification_tokens FOR ALL USING (auth.uid() = user_id);


-- ----------------------------------------------------------
-- 7. LIVE SESSIONS  (kept from previous schema)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_id    TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  accuracy    DOUBLE PRECISION,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS live_sessions_updated_at ON public.live_sessions;
CREATE TRIGGER live_sessions_updated_at
  BEFORE UPDATE ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "live_sessions: owner write" ON public.live_sessions;
CREATE POLICY "live_sessions: owner write" ON public.live_sessions FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "live_sessions: public read by share_id" ON public.live_sessions;
CREATE POLICY "live_sessions: public read by share_id"
  ON public.live_sessions FOR SELECT
  USING (is_active = TRUE);


-- ----------------------------------------------------------
-- 8. STORAGE BUCKETS  (run separately if needed)
-- ----------------------------------------------------------
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('contact-avatars', 'contact-avatars', false) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('report-photos', 'report-photos', false) ON CONFLICT DO NOTHING;
