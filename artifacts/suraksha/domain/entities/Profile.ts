/** The signed-in user's editable profile fields. */
export interface Profile {
  name: string;
  phone: string;
  email: string;
  premium: boolean;
  avatarUrl?: string;
}
