/**
 * Result/AppError-returning adapter over firebaseAuth.ts's Firebase glue —
 * this IS the AuthRepository (domain/repositories/AuthRepository.ts)
 * implementation, analogous to how repositories/supabase/contactsRepository.ts
 * wraps the Supabase client with mappers. firebaseAuth.ts's Google/Apple
 * linking edge cases are left untouched here; this layer only translates
 * its `{ user, error, cancelled?, needsLink? }` shape into `Result<T, AuthError>`.
 */
import type {
  AuthRepository,
  PendingCredential,
  SocialSignInOutcome,
} from "@/domain/repositories/AuthRepository";
import type { Result } from "@/domain/result/Result";
import { ok, err } from "@/domain/result/Result";
import { AuthError } from "@/domain/errors";
import type { AuthUser } from "@/domain/entities/AuthUser";
import { toAuthUser } from "@/repositories/firebase/mappers/authUserMapper";
import type { AuthResult, OAuthCredential } from "@/repositories/firebase/firebaseAuth";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithCustomTokenFB,
  signInAnonymouslyFB,
  signInWithGoogle as fbSignInWithGoogle,
  signInWithApple as fbSignInWithApple,
  linkPendingCredential as fbLinkPendingCredential,
  isAppleSignInAvailable as fbIsAppleSignInAvailable,
  signOutFB,
  sendPasswordReset as fbSendPasswordReset,
  resendVerificationEmail as fbResendVerificationEmail,
  reloadCurrentUser as fbReloadCurrentUser,
  reauthenticateWithPassword as fbReauthenticateWithPassword,
} from "@/repositories/firebase/firebaseAuth";

function toUserResult(r: AuthResult): Result<AuthUser, AuthError> {
  if (r.error) return err(new AuthError(r.error));
  // firebaseAuth.ts guarantees `user` is non-null whenever `error` is null
  // for these call sites (checked directly below, not re-derived).
  return ok(toAuthUser(r.user!));
}

function toVoidResult(r: { error: string | null }): Result<void, AuthError> {
  return r.error ? err(new AuthError(r.error)) : ok(undefined);
}

function toSocialResult(r: AuthResult): Result<SocialSignInOutcome, AuthError> {
  if (r.cancelled) return ok({ kind: "cancelled" });
  if (r.needsLink) {
    return ok({
      kind: "needsLink",
      email: r.needsLink.email,
      pendingCredential: r.needsLink.pendingCredential satisfies OAuthCredential as PendingCredential,
    });
  }
  if (r.error) return err(new AuthError(r.error));
  return ok({ kind: "success", user: toAuthUser(r.user!) });
}

export const authRepository: AuthRepository = {
  async signInWithEmail(email, password) {
    return toUserResult(await signInWithEmail(email, password));
  },
  async signUpWithEmail(email, password) {
    return toUserResult(await signUpWithEmail(email, password));
  },
  async signInWithCustomToken(token) {
    return toUserResult(await signInWithCustomTokenFB(token));
  },
  async signInWithGoogle() {
    return toSocialResult(await fbSignInWithGoogle());
  },
  async signInWithApple() {
    return toSocialResult(await fbSignInWithApple());
  },
  async linkPendingCredential(email, password, pendingCredential) {
    return toUserResult(
      await fbLinkPendingCredential(email, password, pendingCredential as OAuthCredential),
    );
  },
  async signOut() {
    return toVoidResult(await signOutFB());
  },
  async signInAnonymously() {
    return toUserResult(await signInAnonymouslyFB());
  },
  async sendPasswordReset(email) {
    return toVoidResult(await fbSendPasswordReset(email));
  },
  async resendVerificationEmail() {
    return toVoidResult(await fbResendVerificationEmail());
  },
  async reloadCurrentUser() {
    await fbReloadCurrentUser();
    return ok(undefined);
  },
  async reauthenticateWithPassword(password) {
    return toVoidResult(await fbReauthenticateWithPassword(password));
  },
  async isAppleSignInAvailable() {
    return fbIsAppleSignInAvailable();
  },
};
