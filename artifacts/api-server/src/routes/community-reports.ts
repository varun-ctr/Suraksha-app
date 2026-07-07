import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import { getBearerToken, verifyFirebaseToken } from "../lib/firebaseAdmin";
import { optionalEnv } from "../lib/env";

const router: IRouter = Router();

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
  const token = getBearerToken(req);
  const user = token ? await verifyFirebaseToken(token).catch(() => null) : null;

  const { type, lat, lng, address, description, user_id, photo_url } = req.body as {
    type?: string;
    lat?: number;
    lng?: number;
    address?: string | null;
    description?: string | null;
    user_id?: string;
    photo_url?: string | null;
  };

  if (!type || lat == null || lng == null || !user_id) {
    res.status(400).json({ error: "type, lat, lng, user_id are required" });
    return;
  }

  const uid = user?.uid ?? user_id;

  try {
    const supa = getSupabaseClient();
    const { data, error } = await supa
      .from("community_reports")
      .insert({
        type,
        lat,
        lng,
        address: address ?? null,
        description: description ?? null,
        user_id: uid,
        photo_url: photo_url ?? null,
        moderation_status: "pending",
      })
      .select()
      .single();

    if (error) {
      req.log.error({ err: error }, "Community report insert failed");
      res.status(500).json({ error: error.message, code: error.code });
      return;
    }

    res.status(201).json(data);
  } catch (err) {
    req.log.error({ err }, "Community reports route error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /community-reports/mine?user_id=xxx — list reports for a user */
router.get("/community-reports/mine", async (req, res) => {
  const user_id = req.query.user_id as string | undefined;
  if (!user_id) {
    res.status(400).json({ error: "user_id query param is required" });
    return;
  }

  try {
    const supa = getSupabaseClient();
    const { data, error } = await supa
      .from("community_reports")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    if (error) {
      req.log.error({ err: error }, "Community reports list failed");
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data ?? []);
  } catch (err) {
    req.log.error({ err }, "Community reports list route error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
