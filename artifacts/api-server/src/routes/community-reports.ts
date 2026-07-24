import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import { getBearerToken, verifyFirebaseToken } from "../lib/firebaseAdmin";
import { optionalEnv } from "../lib/env";
import { checkRateLimit } from "../lib/rateLimit";
import { detectSpamSignals } from "../lib/spamDetection";
import { captureAlert } from "../lib/errorReporting";

const router: IRouter = Router();

// Mirrors /sos/alert's rate-limit shape (see sos-alert.ts) — a genuine
// user submits at most a handful of incident reports per hour; 10/hour
// gives real, repeated legitimate use (e.g. reporting several unrelated
// hazards while out) comfortable headroom without leaving the shared
// community map open to unbounded spam from one compromised/malicious
// account (see docs/security-audit/08-Abuse-Prevention.md).
const RATE_LIMIT = { windowSeconds: 60 * 60, limit: 10 };

// Client-retry-safety / duplicate-prevention window: a retried POST (e.g.
// after a client-side timeout whose insert actually succeeded server-side)
// within this window, from the same user, with the same type/coordinates,
// returns the existing report instead of inserting a visually-identical
// second one onto the shared map.
const DUPLICATE_WINDOW_MS = 60 * 1000;

function getSupabaseClient() {
  const url = optionalEnv("SUPABASE_URL");
  // Prefer the service role key (bypasses RLS); fall back to anon key.
  const key =
    optionalEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    optionalEnv("SUPABASE_PUBLISHABLE_KEY") ??
    optionalEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) throw new Error("Supabase env vars not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** POST /community-reports — insert a new community safety report */
router.post("/community-reports", async (req, res) => {
  // Auth is REQUIRED. This route writes with the service-role key (RLS is
  // bypassed), so the row owner must come from a verified token — never from
  // client-supplied input — otherwise anyone could forge reports attributed
  // to any user.
  const user = await verifyFirebaseToken(getBearerToken(req)).catch(() => null);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rate = await checkRateLimit("community_report", user.uid, RATE_LIMIT);
  if (!rate.allowed) {
    req.log.warn({ uid: user.uid, count: rate.count }, "Community report rate limit exceeded");
    res.status(429).json({ error: "rate_limited", message: "Too many reports submitted — please wait and try again." });
    return;
  }

  const { type, lat, lng, address, description, photo_url } = req.body as {
    type?: string;
    lat?: number;
    lng?: number;
    address?: string | null;
    description?: string | null;
    photo_url?: string | null;
  };

  if (!type || lat == null || lng == null) {
    res.status(400).json({ error: "type, lat, lng are required" });
    return;
  }

  try {
    const supa = getSupabaseClient();

    // Client-retry-safety / duplicate-prevention: see DUPLICATE_WINDOW_MS
    // above. Checked before insert so a retried request adopts the prior
    // successful write instead of creating a second, visually-identical
    // report on the shared community map.
    const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
    const { data: existing } = await supa
      .from("community_reports")
      .select("*")
      .eq("user_id", user.uid)
      .eq("type", type)
      .eq("lat", lat)
      .eq("lng", lng)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      res.status(200).json(existing);
      return;
    }

    // Spam-detection hook — see lib/spamDetection.ts for why this is
    // currently a deliberate no-op; logged (not blocked) so a future real
    // implementation has a place to plug in without a route change.
    const spamSignals = detectSpamSignals({ type, description: description ?? null });
    if (spamSignals.length > 0) {
      captureAlert("community_report_spam_signal", {
        uid: user.uid,
        signals: spamSignals.map((s) => s.reason),
      });
    }

    const { data, error } = await supa
      .from("community_reports")
      .insert({
        type,
        lat,
        lng,
        address: address ?? null,
        description: description ?? null,
        user_id: user.uid,
        photo_url: photo_url ?? null,
        moderation_status: "pending",
      })
      .select()
      .single();

    if (error) {
      req.log.error({ err: error }, "Community report insert failed");
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    res.status(201).json(data);
  } catch (err) {
    req.log.error({ err }, "Community reports route error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /community-reports/mine — list the authenticated caller's own reports */
router.get("/community-reports/mine", async (req, res) => {
  // Auth is REQUIRED and the owner is taken from the verified token only. A
  // prior version read `user_id` from the query string with no auth, which let
  // anyone read any user's report locations/PII (IDOR). Any `?user_id=` query
  // param is now ignored.
  const user = await verifyFirebaseToken(getBearerToken(req)).catch(() => null);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const supa = getSupabaseClient();
    const { data, error } = await supa
      .from("community_reports")
      .select("*")
      .eq("user_id", user.uid)
      .order("created_at", { ascending: false });

    if (error) {
      req.log.error({ err: error }, "Community reports list failed");
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    res.json(data ?? []);
  } catch (err) {
    req.log.error({ err }, "Community reports list route error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
