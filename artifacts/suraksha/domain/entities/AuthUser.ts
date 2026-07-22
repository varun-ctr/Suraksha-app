/**
 * The signed-in identity, decoupled from the Firebase SDK's `User` shape.
 * Not yet wired through AuthContext (see docs/adr/0003-domain-layer.md) —
 * defined now so new auth-facing code has a domain type to target.
 */
export interface AuthUser {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  isAnonymous: boolean;
  emailVerified: boolean;
}
