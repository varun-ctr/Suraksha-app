import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { requiredEnv } from "./../lib/env";

const router: IRouter = Router();

const SUPABASE_URL = requiredEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PURCHASE_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
]);

router.post("/revenuecat-webhook", async (req: Request, res: Response) => {
  if (!REVENUECAT_WEBHOOK_SECRET) {
    res.status(501).json({ error: "not_configured", message: "RevenueCat webhooks are not configured." });
    return;
  }

  const authHeader = req.headers["authorization"] ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (provided !== REVENUECAT_WEBHOOK_SECRET) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const event = req.body?.event as {
    type: string;
    app_user_id: string;
    expiration_at_ms?: number;
  } | undefined;

  if (!event?.type || !event?.app_user_id) {
    res.status(400).json({ error: "bad_request" });
    return;
  }

  const userId = event.app_user_id;

  try {
    if (PURCHASE_EVENTS.has(event.type)) {
      const premiumUntil = event.expiration_at_ms
        ? new Date(event.expiration_at_ms).toISOString()
        : null;
      await serviceSupabase
        .from("profiles")
        .update({ is_premium: true, premium_until: premiumUntil })
        .eq("id", userId);
    } else if (event.type === "EXPIRATION") {
      await serviceSupabase
        .from("profiles")
        .update({ is_premium: false })
        .eq("id", userId);
    }

    res.json({ received: true });
  } catch (err) {
    req.log?.error?.({ err }, "RevenueCat webhook processing failed");
    res.status(500).json({ error: "server" });
  }
});

export default router;
