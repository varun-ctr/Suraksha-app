import { getBackendUrl } from "@/core/config/env";
import { firebaseAuth } from "@/repositories/firebase/firebaseClient";
import type { CommunityReportRow } from "@/shared/types/database";

async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra };
  try {
    const token = await firebaseAuth.currentUser?.getIdToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } catch {
    // no token — proceed unauthenticated, backend will reject if required
  }
  return headers;
}

/** The signed-in user's own community incident reports. Empty if signed out or the backend is unreachable. */
export async function fetchMyReports(): Promise<CommunityReportRow[]> {
  const user = firebaseAuth.currentUser;
  const backendUrl = getBackendUrl();
  if (!user || !backendUrl) return [];
  try {
    const headers = await authHeaders();
    // The backend derives the owner from the verified token; no user_id query param.
    const res = await fetch(`${backendUrl}/community-reports/mine`, { headers });
    if (!res.ok) return [];
    return (await res.json()) as CommunityReportRow[];
  } catch {
    return [];
  }
}

export interface SubmitReportInput {
  type: string;
  lat: number;
  lng: number;
  address: string | null;
  description: string | null;
  photo_url: string | null;
}

export type SubmitReportResult = { ok: true } | { ok: false; error: string };

export async function submitReport(input: SubmitReportInput): Promise<SubmitReportResult> {
  const user = firebaseAuth.currentUser;
  if (!user) return { ok: false, error: "Not signed in" };
  const backendUrl = getBackendUrl();
  if (!backendUrl) return { ok: false, error: "Backend not configured" };

  try {
    const headers = await authHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${backendUrl}/community-reports`, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

// ── Repository interface ──────────────────────────────────────────────────────

export interface CommunityReportsRepository {
  fetchMyReports(): Promise<CommunityReportRow[]>;
  submitReport(input: SubmitReportInput): Promise<SubmitReportResult>;
}

export const communityReportsRepository: CommunityReportsRepository = {
  fetchMyReports,
  submitReport,
};
