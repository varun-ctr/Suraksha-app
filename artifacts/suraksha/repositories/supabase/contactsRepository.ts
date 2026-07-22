/**
 * Supabase implementation of the domain ContactsRepository.
 *
 * Strategy:
 *  - Local SecureStore is always written first (offline-safe) — see
 *    features/profile/context/AppContext.tsx.
 *  - Supabase is the cross-device source of truth.
 *  - On first authenticated load we do a one-time merge:
 *      remote ∪ local → push local-only to remote, use remote list.
 *  - Mutations (add / edit / delete) call the remote helpers fire-and-forget
 *    after the local update has already committed.
 *
 * See domain/repositories/ContactsRepository.ts for the contract and
 * docs/adr/0002-repository-pattern.md for why this returns Result instead
 * of throwing or masking failure as an empty list.
 */
import { supabase } from "@/repositories/supabase/supabaseClient";
import { RepositoryError, type AppError } from "@/domain/errors";
import { ok, err, type Result } from "@/domain/result/Result";
import { logger } from "@/core/logger/logger";
import type { Contact } from "@/domain/entities/Contact";
import type { ContactsRepository } from "@/domain/repositories/ContactsRepository";
import { toContact, toContactInsertDto } from "./mappers/contactMapper";

// ── Read ─────────────────────────────────────────────────────────────────────

async function fetchContacts(userId: string): Promise<Result<Contact[], AppError>> {
  const { data, error } = await supabase
    .from("emergency_contacts")
    .select("id, user_id, name, phone, avatar_url, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return err(new RepositoryError("Failed to fetch contacts", { operation: "fetchContacts", cause: error }));
  }
  return ok(data.map(toContact));
}

// ── Write ─────────────────────────────────────────────────────────────────────

async function upsertContact(userId: string, contact: Contact): Promise<Result<void, AppError>> {
  const { error } = await supabase.from("emergency_contacts").upsert(
    { ...toContactInsertDto(userId, contact), updated_at: new Date().toISOString() },
    { onConflict: "id,user_id" },
  );
  if (error) {
    return err(new RepositoryError("Failed to save contact", { operation: "upsertContact", cause: error }));
  }
  return ok(undefined);
}

async function upsertContactsBatch(userId: string, contacts: Contact[]): Promise<Result<void, AppError>> {
  if (contacts.length === 0) return ok(undefined);
  const { error } = await supabase.from("emergency_contacts").upsert(
    contacts.map((c) => ({ ...toContactInsertDto(userId, c), updated_at: new Date().toISOString() })),
    { onConflict: "id,user_id" },
  );
  if (error) {
    return err(new RepositoryError("Failed to save contacts", { operation: "upsertContactsBatch", cause: error }));
  }
  return ok(undefined);
}

async function deleteContact(userId: string, id: string): Promise<Result<void, AppError>> {
  const { error } = await supabase
    .from("emergency_contacts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    return err(new RepositoryError("Failed to delete contact", { operation: "deleteContact", cause: error }));
  }
  return ok(undefined);
}

async function deleteAllContacts(userId: string): Promise<Result<void, AppError>> {
  const { error } = await supabase.from("emergency_contacts").delete().eq("user_id", userId);
  if (error) {
    return err(new RepositoryError("Failed to delete contacts", { operation: "deleteAllContacts", cause: error }));
  }
  return ok(undefined);
}

// ── Merge on first load ───────────────────────────────────────────────────────

/**
 * Called once after the user's auth session is confirmed.
 * Always resolves Ok — a failed remote fetch falls back to the local list
 * (offline-first) rather than surfacing an error, matching the previous
 * behavior. Unlike the previous implementation, a genuine fetch failure no
 * longer triggers a spurious push-local-to-remote attempt, since Result lets
 * this distinguish "remote fetch failed" from "remote really is empty."
 *
 * Cases:
 *  - Remote has data  → use remote; push any local-only IDs up.
 *  - Remote is empty  → push local to remote; use local.
 *  - Both empty       → return [].
 */
async function syncContactsOnLoad(
  userId: string,
  localContacts: Contact[],
): Promise<Result<Contact[], AppError>> {
  const remoteResult = await fetchContacts(userId);
  if (!remoteResult.ok) {
    logger.warn("[contactsRepository] remote fetch failed during sync — keeping local contacts", remoteResult.error);
    return ok(localContacts);
  }
  const remote = remoteResult.value;

  // Case 1: nothing anywhere
  if (remote.length === 0 && localContacts.length === 0) return ok([]);

  // Case 2: remote empty → push local up
  if (remote.length === 0) {
    void upsertContactsBatch(userId, localContacts).then((r) => {
      if (!r.ok) logger.warn("[contactsRepository] failed to push local contacts to remote", r.error);
    });
    return ok(localContacts);
  }

  // Case 3: local empty → use remote (cross-device restore)
  if (localContacts.length === 0) return ok(remote);

  // Case 4: both have data → merge
  const remoteIds = new Set(remote.map((c) => c.id));
  const localOnly = localContacts.filter((c) => !remoteIds.has(c.id));
  if (localOnly.length > 0) {
    void upsertContactsBatch(userId, localOnly).then((r) => {
      if (!r.ok) logger.warn("[contactsRepository] failed to push local-only contacts to remote", r.error);
    });
  }
  return ok([...remote, ...localOnly].slice(0, 10));
}

export const contactsRepository: ContactsRepository = {
  fetchContacts,
  upsertContact,
  upsertContactsBatch,
  deleteContact,
  deleteAllContacts,
  syncContactsOnLoad,
};
