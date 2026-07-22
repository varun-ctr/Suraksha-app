import type { Result } from "@/domain/result/Result";
import type { AppError } from "@/domain/errors";
import type { CommunityReport, CommunityReportType } from "@/domain/entities/CommunityReport";

export interface SubmitCommunityReportInput {
  type: CommunityReportType;
  lat: number;
  lng: number;
  address: string | null;
  description: string | null;
  photoUrl: string | null;
}

export interface CommunityReportsRepository {
  /** The signed-in user's own community incident reports. Empty if signed out or the backend is unreachable. */
  fetchMyReports(): Promise<Result<CommunityReport[], AppError>>;
  submitReport(input: SubmitCommunityReportInput): Promise<Result<void, AppError>>;
}
