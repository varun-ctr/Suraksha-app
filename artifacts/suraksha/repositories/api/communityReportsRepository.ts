import { getBackendUrl } from "@/core/config/env";
import { firebaseAuth } from "@/repositories/firebase/firebaseClient";
import { AuthError, NetworkError, type AppError } from "@/domain/errors";
import { ok, err, type Result } from "@/domain/result/Result";
import type { CommunityReport } from "@/domain/entities/CommunityReport";
import type {
  CommunityReportsRepository,
  SubmitCommunityReportInput,
} from "@/domain/repositories/CommunityReportsRepository";
import type { CommunityReportDto } from "./dto/CommunityReportDto";
import { toCommunityReport, toSubmitReportBody } from "./mappers/communityReportMapper";

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

/** The signed-in user's own community incident reports. Empty (Ok([])) if signed out or the backend is unreachable. */
async function fetchMyReports(): Promise<Result<CommunityReport[], AppError>> {
  const user = firebaseAuth.currentUser;
  const backendUrl = getBackendUrl();
  if (!user || !backendUrl) return ok([]);
  try {
    const headers = await authHeaders();
    // The backend derives the owner from the verified token; no user_id query param.
    const res = await fetch(`${backendUrl}/community-reports/mine`, { headers });
    if (!res.ok) return ok([]);
    const rows = (await res.json()) as CommunityReportDto[];
    return ok(rows.map(toCommunityReport));
  } catch {
    return ok([]);
  }
}

async function submitReport(input: SubmitCommunityReportInput): Promise<Result<void, AppError>> {
  const user = firebaseAuth.currentUser;
  if (!user) return err(new AuthError("Not signed in"));
  const backendUrl = getBackendUrl();
  if (!backendUrl) return err(new NetworkError("Backend not configured"));

  try {
    const headers = await authHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${backendUrl}/community-reports`, {
      method: "POST",
      headers,
      body: JSON.stringify(toSubmitReportBody(input)),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return err(new NetworkError(body.error ?? `HTTP ${res.status}`, { status: res.status, url: `${backendUrl}/community-reports` }));
    }
    return ok(undefined);
  } catch (cause) {
    return err(new NetworkError(cause instanceof Error ? cause.message : "Network error", { cause }));
  }
}

export const communityReportsRepository: CommunityReportsRepository = {
  fetchMyReports,
  submitReport,
};
