import type { Result } from "@/domain/result/Result";
import type { AppError } from "@/domain/errors";
import type { Contact } from "@/domain/entities/Contact";

/**
 * Domain-facing contract for trusted-contact persistence. Concrete
 * implementations live under repositories/* and are wired in by the DI
 * container (core/di) — features depend on this interface, never on a
 * specific backend.
 */
export interface ContactsRepository {
  fetchContacts(userId: string): Promise<Result<Contact[], AppError>>;
  upsertContact(userId: string, contact: Contact): Promise<Result<void, AppError>>;
  upsertContactsBatch(userId: string, contacts: Contact[]): Promise<Result<void, AppError>>;
  deleteContact(userId: string, id: string): Promise<Result<void, AppError>>;
  deleteAllContacts(userId: string): Promise<Result<void, AppError>>;
  /** One-time merge of remote and locally-cached contacts on sign-in; see the implementation for the merge rules. */
  syncContactsOnLoad(userId: string, localContacts: Contact[]): Promise<Result<Contact[], AppError>>;
}
