/**
 * Supabase sync layer for trusted emergency contacts.
 *
 * Strategy:
 *  - Local SecureStore is always written first (offline-safe).
 *  - Supabase is the cross-device source of truth.
 *  - On first authenticated load we do a one-time merge:
 *      remote ∪ local → push local-only to remote, use remote list.
 *  - Mutations (add / edit / delete) call the remote helpers fire-and-forget
 *    after the local update has already committed.
 */

import type { Contact } from "@/shared/types/contact";
import { supabase } from "@/repositories/supabase/supabaseClient";

interface DbRow {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  avatar_url: string | null;
  created_at?: string;
}

function toContact(row: DbRow): Contact {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
  };
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function fetchContactsFromDb(userId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from("emergency_contacts")
    .select("id, user_id, name, phone, avatar_url, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return (data as DbRow[]).map(toContact);
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function upsertContactToDb(userId: string, contact: Contact): Promise<void> {
  await supabase.from("emergency_contacts").upsert(
    {
      id: contact.id,
      user_id: userId,
      name: contact.name,
      phone: contact.phone,
      avatar_url: contact.avatarUrl ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id,user_id" },
  );
}

export async function upsertContactsBatchToDb(
  userId: string,
  contacts: Contact[],
): Promise<void> {
  if (contacts.length === 0) return;
  await supabase.from("emergency_contacts").upsert(
    contacts.map((c) => ({
      id: c.id,
      user_id: userId,
      name: c.name,
      phone: c.phone,
      avatar_url: c.avatarUrl ?? null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "id,user_id" },
  );
}

export async function deleteContactFromDb(userId: string, id: string): Promise<void> {
  await supabase
    .from("emergency_contacts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
}

export async function deleteAllContactsFromDb(userId: string): Promise<void> {
  await supabase.from("emergency_contacts").delete().eq("user_id", userId);
}

// ── Merge on first load ───────────────────────────────────────────────────────

/**
 * Called once after the user's auth session is confirmed.
 * Returns the authoritative merged contact list to replace local state.
 *
 * Cases:
 *  - Remote has data  → use remote; push any local-only IDs up.
 *  - Remote is empty  → push local to remote; use local.
 *  - Both empty       → return [].
 */
export async function syncContactsOnLoad(
  userId: string,
  localContacts: Contact[],
): Promise<Contact[]> {
  let remote: Contact[];
  try {
    remote = await fetchContactsFromDb(userId);
  } catch {
    // Network unavailable — keep local
    return localContacts;
  }

  // Case 1: nothing anywhere
  if (remote.length === 0 && localContacts.length === 0) return [];

  // Case 2: remote empty → push local up
  if (remote.length === 0) {
    upsertContactsBatchToDb(userId, localContacts).catch(() => {});
    return localContacts;
  }

  // Case 3: local empty → use remote (cross-device restore)
  if (localContacts.length === 0) return remote;

  // Case 4: both have data → merge
  const remoteIds = new Set(remote.map((c) => c.id));
  const localOnly = localContacts.filter((c) => !remoteIds.has(c.id));
  if (localOnly.length > 0) {
    upsertContactsBatchToDb(userId, localOnly).catch(() => {});
  }
  return [...remote, ...localOnly].slice(0, 10);
}

// ── Repository interface ──────────────────────────────────────────────────────
// Lets features depend on this shape rather than the Supabase client directly,
// so a different backend (e.g. a REST-backed repositories/api implementation)
// can be substituted by pointing the import elsewhere — no feature/UI changes.

export interface ContactsRepository {
  fetchContacts(userId: string): Promise<Contact[]>;
  upsertContact(userId: string, contact: Contact): Promise<void>;
  upsertContactsBatch(userId: string, contacts: Contact[]): Promise<void>;
  deleteContact(userId: string, id: string): Promise<void>;
  deleteAllContacts(userId: string): Promise<void>;
  syncContactsOnLoad(userId: string, localContacts: Contact[]): Promise<Contact[]>;
}

export const contactsRepository: ContactsRepository = {
  fetchContacts: fetchContactsFromDb,
  upsertContact: upsertContactToDb,
  upsertContactsBatch: upsertContactsBatchToDb,
  deleteContact: deleteContactFromDb,
  deleteAllContacts: deleteAllContactsFromDb,
  syncContactsOnLoad,
};
