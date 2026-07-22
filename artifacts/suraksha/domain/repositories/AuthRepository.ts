import type { Result } from "@/domain/result/Result";
import type { AuthError } from "@/domain/errors";
import type { AuthUser } from "@/domain/entities/AuthUser";

/**
 * Opaque token representing a pending social-provider credential that
 * needs linking to an existing email/password account (see
 * `SocialSignInOutcome`'s `needsLink` case). Domain code never inspects
 * its shape — it's handed back to `linkPendingCredential` unchanged; the
 * concrete implementation knows how to use it.
 */
export type PendingCredential = unknown;

export type SocialSignInOutcome =
  | { kind: "success"; user: AuthUser }
  | { kind: "cancelled" }
  | { kind: "needsLink"; email: string; pendingCredential: PendingCredential };

/**
 * Domain-facing contract for authentication operations. The *current*
 * signed-in user and auth-state stream are intentionally NOT part of this
 * interface — Firebase's `onAuthStateChanged` is a genuinely reactive,
 * always-succeeding subscription (not a fallible one-shot operation), so
 * forcing it through a Result-returning repository method would be a
 * mismatched abstraction. AuthContext (the sole consumer) reads the live
 * user directly from repositories/firebase/firebaseAuth.ts for that
 * reason — see docs/adr/0002-repository-pattern.md.
 */
export interface AuthRepository {
  signInWithEmail(email: string, password: string): Promise<Result<AuthUser, AuthError>>;
  signUpWithEmail(email: string, password: string): Promise<Result<AuthUser, AuthError>>;
  signInWithCustomToken(token: string): Promise<Result<AuthUser, AuthError>>;
  signInWithGoogle(): Promise<Result<SocialSignInOutcome, AuthError>>;
  signInWithApple(): Promise<Result<SocialSignInOutcome, AuthError>>;
  linkPendingCredential(
    email: string,
    password: string,
    pendingCredential: PendingCredential,
  ): Promise<Result<AuthUser, AuthError>>;
  /** Firebase sign-out only — does not re-establish anonymous auth; see authService.signOut for that orchestration. */
  signOut(): Promise<Result<void, AuthError>>;
  signInAnonymously(): Promise<Result<AuthUser, AuthError>>;
  sendPasswordReset(email: string): Promise<Result<void, AuthError>>;
  resendVerificationEmail(): Promise<Result<void, AuthError>>;
  reloadCurrentUser(): Promise<Result<void, AuthError>>;
  isAppleSignInAvailable(): Promise<boolean>;
}
