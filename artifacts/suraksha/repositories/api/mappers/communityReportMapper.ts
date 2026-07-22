import type { CommunityReportDto } from "../dto/CommunityReportDto";
import type { CommunityReport } from "@/domain/entities/CommunityReport";
import type { SubmitCommunityReportInput } from "@/domain/repositories/CommunityReportsRepository";

export function toCommunityReport(row: CommunityReportDto): CommunityReport {
  return {
    id: row.id,
    type: row.type,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    description: row.description,
    photoUrl: row.photo_url,
    moderationStatus: row.moderation_status,
    createdAt: row.created_at,
  };
}

export function toSubmitReportBody(input: SubmitCommunityReportInput) {
  return {
    type: input.type,
    lat: input.lat,
    lng: input.lng,
    address: input.address,
    description: input.description,
    photo_url: input.photoUrl,
  };
}
