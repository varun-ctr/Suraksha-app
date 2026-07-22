/**
 * The API server forwards Supabase rows for community reports as-is, so the
 * REST DTO shape is identical to the DB row.
 */
export type { CommunityReportRow as CommunityReportDto } from "@/shared/types/database";
