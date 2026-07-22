import type { ContactDto, ContactInsertDto } from "../dto/ContactDto";
import type { Contact } from "@/domain/entities/Contact";

export function toContact(row: ContactDto): Contact {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
  };
}

/** Maps a domain Contact to insert/upsert fields. Timestamps are stamped by the repository at write time, not here. */
export function toContactInsertDto(userId: string, contact: Contact): ContactInsertDto {
  return {
    id: contact.id,
    user_id: userId,
    name: contact.name,
    phone: contact.phone,
    avatar_url: contact.avatarUrl ?? null,
  };
}
