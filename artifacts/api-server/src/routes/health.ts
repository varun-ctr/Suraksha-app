import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get(["/healthz", "/health", "/api"], (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Readiness probe: reports which integrations are configured, so an operator
// (or an autoscale health check) can tell a mis-provisioned instance apart
// from a healthy one. Env-presence only — no outbound network calls, so it
// can't hang or flap on a downstream blip. Never leaks secret values.
router.get("/ready", (_req, res) => {
  const has = (...keys: string[]) => keys.every((k) => !!process.env[k]);
  const integrations = {
    firebase: has("FIREBASE_SERVICE_ACCOUNT") || has("GOOGLE_APPLICATION_CREDENTIALS") || has("FIREBASE_PROJECT_ID"),
    supabase: has("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"),
    twilio: has("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"),
    openai: has("OPENAI_API_KEY") || has("AI_INTEGRATIONS_OPENAI_API_KEY"),
    resend: has("RESEND_API_KEY"),
    googlePlaces: has("GOOGLE_PLACES_API_KEY"),
  };
  res.json({ status: "ok", integrations });
});

export default router;
