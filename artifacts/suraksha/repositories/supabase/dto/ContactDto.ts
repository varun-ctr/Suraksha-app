/**
 * Wire-format types for the `emergency_contacts` table — re-exported under
 * repository-local DTO names so the mapper layer (and anything importing it)
 * names the Supabase row shape distinctly from the domain `Contact` entity.
 * The field definitions themselves stay in shared/types/database.ts, the
 * single source of truth for the DB schema.
 */
export type {
  EmergencyContactRow as ContactDto,
  EmergencyContactInsert as ContactInsertDto,
} from "@/shared/types/database";
