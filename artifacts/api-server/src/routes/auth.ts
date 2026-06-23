import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * DELETE /api/auth/account
 *
 * Permanently deletes the authenticated user's account from Supabase Auth
 * (and cascades to all related rows via ON DELETE CASCADE foreign keys).
 *
 * Requires: Authorization: Bearer <access_token>
 */
router.delete("/auth/account", async (req: Request, res: Response) => {
  const authHeader = req.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "auth_required", message: "No auth token provided." });
    return;
  }

  const { data: userData, error: authError } = await serviceSupabase.auth.getUser(token);
  if (authError || !userData.user) {
    res.status(401).json({ error: "invalid_token", message: "Token is invalid or expired." });
    return;
  }

  const userId = userData.user.id;

  const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(userId);
  if (deleteError) {
    res.status(500).json({ error: "delete_failed", message: deleteError.message });
    return;
  }

  res.status(200).json({ success: true, message: "Account permanently deleted." });
});

export default router;
