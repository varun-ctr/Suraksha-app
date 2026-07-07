import { Router, type IRouter, type Request, type Response } from "express";
import { getBearerToken, verifyFirebaseToken } from "../lib/firebaseAdmin";
import { getServiceSupabase } from "../lib/supabaseAdmin";

const router: IRouter = Router();

// Supabase tables that store user-owned rows keyed by `user_id` (the Firebase uid).
const USER_DATA_TABLES = [
  "emergency_contacts",
  "sos_events",
  "journeys",
  "community_reports",
  "subscriptions",
  "notification_tokens",
  "live_sessions",
] as const;

// ---------------------------------------------------------------------------
// GET /api/auth/sessions
//
// Firebase Auth does not expose a list of active sessions/devices the way
// Supabase GoTrue did, so we return the current device as a single session
// synthesised from the verified ID token. Keeps the "manage devices" screen
// working without pretending to list sessions we can't see.
// ---------------------------------------------------------------------------
router.get("/auth/sessions", async (req: Request, res: Response) => {
  const user = await verifyFirebaseToken(getBearerToken(req));
  if (!user) {
    res.status(401).json({ error: "invalid_token", message: "Token is invalid or expired." });
    return;
  }

  const signedInAt = user.authTime ? new Date(user.authTime * 1000).toISOString() : null;

  res.json({
    sessions: [
      {
        id: "current",
        createdAt: signedInAt,
        updatedAt: signedInAt,
        userAgent: req.headers["user-agent"] ?? null,
        ip: null,
        isCurrentSession: true,
      },
    ],
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/auth/account
//
// The Firebase user record is deleted client-side (authoritative). This
// endpoint is best-effort server-side cleanup: it removes the user's rows
// from Supabase, keyed by the Firebase uid. Requires a valid Firebase token.
// ---------------------------------------------------------------------------
router.delete("/auth/account", async (req: Request, res: Response) => {
  const user = await verifyFirebaseToken(getBearerToken(req));
  if (!user) {
    res.status(401).json({ error: "invalid_token", message: "Token is invalid or expired." });
    return;
  }

  const errors: string[] = [];
  const serviceSupabase = getServiceSupabase();

  if (!serviceSupabase) {
    // Firebase user deletion (client-side, authoritative) still proceeds
    // regardless of this response — this is best-effort server cleanup only.
    res.status(200).json({
      success: true,
      cleanupErrors: ["Supabase not configured on the server — data cleanup was skipped."],
    });
    return;
  }

  // Delete owned rows from every user-data table (best-effort, keep going on error).
  await Promise.all(
    USER_DATA_TABLES.map(async (table) => {
      const { error } = await serviceSupabase.from(table).delete().eq("user_id", user.uid);
      if (error) errors.push(`${table}: ${error.message}`);
    }),
  );

  // The profile row is keyed by `id` (the Firebase uid), not `user_id`.
  const { error: profileError } = await serviceSupabase
    .from("profiles")
    .delete()
    .eq("id", user.uid);
  if (profileError) errors.push(`profiles: ${profileError.message}`);

  res.status(200).json({ success: true, cleanupErrors: errors });
});

export default router;
