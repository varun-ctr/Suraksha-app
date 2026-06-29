import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { requiredEnv } from "./../lib/env";

const router: IRouter = Router();

const SUPABASE_URL = requiredEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Extract bearer token from Authorization header. */
function getBearerToken(req: Request): string | null {
  const h = req.headers["authorization"] ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

/** Decode JWT payload without verification (we verify via Supabase admin). */
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth/sessions
//
// Returns all active Supabase Auth sessions for the authenticated user.
// Uses the GoTrue admin REST API (not exposed via supabase-js).
// ---------------------------------------------------------------------------
router.get("/auth/sessions", async (req: Request, res: Response) => {
  const token = getBearerToken(req);
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

  // Parse current session ID from JWT (claim: session_id)
  const payload = decodeJwtPayload(token);
  const currentSessionId = (payload.session_id as string | undefined) ?? null;

  // Fetch all sessions via GoTrue admin REST API
  let rawSessions: unknown[] = [];
  try {
    const gotrue = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${userId}/sessions`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (gotrue.ok) {
      const body = await gotrue.json() as { sessions?: unknown[] };
      rawSessions = body.sessions ?? [];
    }
  } catch {
    // GoTrue endpoint unavailable — return a synthetic single-session list
    // built from the current user metadata so the UI still works.
  }

  interface RawSession {
    id?: string;
    created_at?: string;
    updated_at?: string;
    user_agent?: string;
    ip?: string;
  }

  // If GoTrue returned nothing (older Supabase version), synthesise current session
  if (rawSessions.length === 0) {
    rawSessions = [
      {
        id: currentSessionId ?? "current",
        created_at: userData.user.created_at,
        updated_at: userData.user.last_sign_in_at ?? userData.user.created_at,
        user_agent: req.headers["user-agent"] ?? null,
        ip: null,
      },
    ];
  }

  const sessions = (rawSessions as RawSession[])
    .map((s) => ({
      id: s.id ?? null,
      createdAt: s.created_at ?? null,
      updatedAt: s.updated_at ?? s.created_at ?? null,
      userAgent: s.user_agent ?? null,
      ip: s.ip ?? null,
      isCurrentSession: s.id === currentSessionId,
    }))
    .sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta; // most recent first
    });

  res.json({ sessions });
});

// ---------------------------------------------------------------------------
// DELETE /api/auth/account
//
// Permanently deletes the authenticated user's account from Supabase Auth
// (cascades to all related rows via ON DELETE CASCADE foreign keys).
//
// Requires: Authorization: Bearer <access_token>
// ---------------------------------------------------------------------------
router.delete("/auth/account", async (req: Request, res: Response) => {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "auth_required", message: "No auth token provided." });
    return;
  }

  const { data: userData, error: authError } = await serviceSupabase.auth.getUser(token);
  if (authError || !userData.user) {
    res.status(401).json({ error: "invalid_token", message: "Token is invalid or expired." });
    return;
  }

  const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    res.status(500).json({ error: "delete_failed", message: deleteError.message });
    return;
  }

  res.status(200).json({ success: true, message: "Account permanently deleted." });
});

export default router;
