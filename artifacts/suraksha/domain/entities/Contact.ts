/** A trusted emergency contact. Pure domain shape — no persistence-format detail. */
export interface Contact {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
}
