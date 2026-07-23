import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously as fbSignInAnonymously,
  signInWithCustomToken,
  signInWithCredential,
  linkWithCredential,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  fetchSignInMethodsForEmail,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut as fbSignOut,
  onAuthStateChanged,
  reload,
  type User,
  type OAuthCredential,
} from "firebase/auth";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { firebaseAuth } from "./firebaseClient";
import { optionalPublicEnv } from "@/core/config/env";
import { isReauthRequired } from "./reauthCheck";

export type FirebaseUser = User;
export type { OAuthCredential };
export { isReauthRequired };

export type AuthResult = {
  user: User | null;
  error: string | null;
  cancelled?: boolean;
  needsLink?: {
    email: string;
    pendingCredential: OAuthCredential;
  };
};

// ── Google Sign-In ─────────────────────────────────────────────────────────────

let _googleConfigured = false;

function ensureGoogleConfigured(): void {
  if (_googleConfigured) return;
  const webClientId = optionalPublicEnv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID");
  GoogleSignin.configure({ webClientId });
  _googleConfigured = true;
}

export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    ensureGoogleConfigured();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    await GoogleSignin.signIn();
    const { idToken } = await GoogleSignin.getTokens();
    if (!idToken) throw new Error("No ID token returned from Google Sign-In.");

    const credential = GoogleAuthProvider.credential(idToken);
    return await _applyCredential(credential, () => GoogleAuthProvider.credentialFromResult({ user: null } as never) ?? credential);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === statusCodes.SIGN_IN_CANCELLED) return { user: null, error: null, cancelled: true };
    if (code === statusCodes.IN_PROGRESS) return { user: null, error: "Sign-in already in progress." };
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { user: null, error: "Google Play Services are not available on this device." };

    // Handle account-exists-with-different-credential from the signInWithCredential call
    if ((e as { code?: string }).code === "auth/account-exists-with-different-credential") {
      const err = e as { code: string; customData?: { email?: string }; credential?: OAuthCredential };
      const email = err.customData?.email ?? "";
      const pendingCredential = (err.credential ?? GoogleAuthProvider.credentialFromError(e as never)) as OAuthCredential | null;
      if (email && pendingCredential) {
        return { user: null, error: null, needsLink: { email, pendingCredential } };
      }
    }

    return { user: null, error: firebaseErrMsg(e) };
  }
}

// ── Apple Sign-In ──────────────────────────────────────────────────────────────

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<AuthResult> {
  try {
    // Replay protection: a random raw nonce is hashed (SHA-256) and sent to
    // Apple, which embeds the hash in the returned identityToken's `nonce`
    // claim. The RAW nonce is then given to Firebase alongside that token,
    // and Firebase's backend verifies SHA-256(rawNonce) matches the token's
    // claim before accepting it — without this, a captured identityToken
    // could be replayed by an attacker to sign in as the victim, since
    // nothing would otherwise tie the token to *this specific* sign-in
    // attempt. Invisible to the user — no UX change.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    const { identityToken } = appleCredential;
    if (!identityToken) throw new Error("No identity token returned from Apple Sign-In.");

    const provider = new OAuthProvider("apple.com");
    const firebaseCredential = provider.credential({ idToken: identityToken, rawNonce }) as OAuthCredential;
    return await _applyCredential(firebaseCredential, () => OAuthProvider.credentialFromResult({ user: null } as never) ?? firebaseCredential);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "ERR_REQUEST_CANCELED") return { user: null, error: null, cancelled: true };

    if (code === "auth/account-exists-with-different-credential") {
      const err = e as { code: string; customData?: { email?: string }; credential?: OAuthCredential };
      const email = err.customData?.email ?? "";
      const pendingCredential = (err.credential ?? (OAuthProvider.credentialFromError(e as never) as OAuthCredential | null));
      if (email && pendingCredential) {
        return { user: null, error: null, needsLink: { email, pendingCredential } };
      }
    }

    return { user: null, error: firebaseErrMsg(e) };
  }
}

// ── Internal: apply credential with anon-upgrade + same-email merge ───────────

async function _applyCredential(
  credential: OAuthCredential,
  _getCredential: () => OAuthCredential,
): Promise<AuthResult> {
  const current = firebaseAuth.currentUser;

  // Anonymous → link to preserve UID and user data
  if (current?.isAnonymous) {
    try {
      const linked = await linkWithCredential(current, credential);
      return { user: linked.user, error: null };
    } catch (linkErr: unknown) {
      const code = (linkErr as { code?: string }).code;
      if (code === "auth/credential-already-in-use") {
        // Social account already exists: sign in directly (data already there)
        const cred = await signInWithCredential(firebaseAuth, credential);
        return { user: cred.user, error: null };
      }
      if (code === "auth/email-already-in-use" || code === "auth/account-exists-with-different-credential") {
        // Email is registered with a different provider: need to link accounts
        const err = linkErr as { customData?: { email?: string }; credential?: OAuthCredential };
        const email = err.customData?.email ?? current.email ?? "";
        const pendingCredential = (err.credential ?? credential) as OAuthCredential;
        if (email && pendingCredential) {
          return { user: null, error: null, needsLink: { email, pendingCredential } };
        }
      }
      return { user: null, error: firebaseErrMsg(linkErr) };
    }
  }

  // Non-anonymous or signed-out: straight sign-in
  try {
    const cred = await signInWithCredential(firebaseAuth, credential);
    return { user: cred.user, error: null };
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "auth/account-exists-with-different-credential") {
      const err = e as { customData?: { email?: string }; credential?: OAuthCredential };
      const email = err.customData?.email ?? "";
      const pendingCredential = (err.credential ?? credential) as OAuthCredential;
      if (email && pendingCredential) {
        return { user: null, error: null, needsLink: { email, pendingCredential } };
      }
    }
    return { user: null, error: firebaseErrMsg(e) };
  }
}

// ── Account linking: email+password sign-in then attach pending social cred ───

/**
 * Called after a `needsLink` result. The user provides their existing
 * email/password; we sign them in and immediately link the pending social
 * credential so both providers work going forward.
 */
export async function linkPendingCredential(
  email: string,
  password: string,
  pendingCredential: OAuthCredential,
): Promise<AuthResult> {
  try {
    // Sign in with the existing email/password account
    const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
    // Link the social credential to this account
    try {
      await linkWithCredential(cred.user, pendingCredential);
    } catch (linkErr: unknown) {
      const code = (linkErr as { code?: string }).code;
      // If already linked (e.g. user retried), that's fine — still signed in
      if (code !== "auth/provider-already-linked" && code !== "auth/credential-already-in-use") {
        return { user: cred.user, error: firebaseErrMsg(linkErr) };
      }
    }
    return { user: cred.user, error: null };
  } catch (e) {
    return { user: null, error: firebaseErrMsg(e) };
  }
}

/**
 * Fetch which sign-in methods exist for an email so we can show the right
 * prompt to the user (e.g. "you used Google before").
 */
export async function getSignInMethodsForEmail(email: string): Promise<string[]> {
  try {
    return await fetchSignInMethodsForEmail(firebaseAuth, email);
  } catch {
    return [];
  }
}

// ── Email / Password ───────────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
    return { user: cred.user, error: null };
  } catch (e) {
    return { user: null, error: firebaseErrMsg(e) };
  }
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const current = firebaseAuth.currentUser;
    let cred;
    if (current?.isAnonymous) {
      const credential = EmailAuthProvider.credential(email, password);
      try {
        const linked = await linkWithCredential(current, credential);
        await sendEmailVerification(linked.user);
        return { user: linked.user, error: null };
      } catch (linkErr: unknown) {
        const code = (linkErr as { code?: string }).code;
        if (code === "auth/email-already-in-use") {
          cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
          return { user: cred.user, error: null };
        }
        return { user: null, error: firebaseErrMsg(linkErr) };
      }
    }
    cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    await sendEmailVerification(cred.user);
    return { user: cred.user, error: null };
  } catch (e) {
    return { user: null, error: firebaseErrMsg(e) };
  }
}

/**
 * Re-authenticates the current user with their email/password credential —
 * satisfies Firebase's "recent login" requirement for sensitive operations
 * (e.g. account deletion) without forcing a full sign-out/sign-in cycle.
 * Not yet wired into any screen (no UI change this pass) — ready for a
 * future re-auth prompt on `auth/requires-recent-login`.
 */
export async function reauthenticateWithPassword(password: string): Promise<{ error: string | null }> {
  const user = firebaseAuth.currentUser;
  if (!user?.email) return { error: "Not signed in." };
  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    return { error: null };
  } catch (e) {
    return { error: firebaseErrMsg(e) };
  }
}

export async function sendPasswordReset(email: string): Promise<{ error: string | null }> {
  try {
    await sendPasswordResetEmail(firebaseAuth, email);
    return { error: null };
  } catch (e) {
    return { error: firebaseErrMsg(e) };
  }
}

export async function resendVerificationEmail(): Promise<{ error: string | null }> {
  const user = firebaseAuth.currentUser;
  if (!user) return { error: "Not signed in." };
  try {
    await sendEmailVerification(user);
    return { error: null };
  } catch (e) {
    return { error: firebaseErrMsg(e) };
  }
}

export async function reloadCurrentUser(): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (user) await reload(user);
}

export async function signInWithCustomTokenFB(token: string): Promise<AuthResult> {
  try {
    const cred = await signInWithCustomToken(firebaseAuth, token);
    return { user: cred.user, error: null };
  } catch (e) {
    return { user: null, error: firebaseErrMsg(e) };
  }
}

export async function signInAnonymouslyFB(): Promise<AuthResult> {
  try {
    const cred = await fbSignInAnonymously(firebaseAuth);
    return { user: cred.user, error: null };
  } catch (e) {
    return { user: null, error: firebaseErrMsg(e) };
  }
}

export async function signOutFB(): Promise<{ error: string | null }> {
  try {
    await fbSignOut(firebaseAuth);
    return { error: null };
  } catch (e) {
    return { error: firebaseErrMsg(e) };
  }
}

export function getCurrentFirebaseUser(): User | null {
  return firebaseAuth.currentUser;
}

export function onFirebaseAuthStateChanged(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(firebaseAuth, callback);
}

function firebaseErrMsg(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    switch ((e as { code: string }).code) {
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Incorrect email or password. Please try again.";
      case "auth/email-already-in-use":
        return "This email is already registered. Please sign in instead.";
      case "auth/weak-password":
        return "Password must be at least 6 characters.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";
      case "auth/network-request-failed":
        return "Connection failed. Please check your internet and try again.";
      case "auth/user-disabled":
        return "This account has been disabled. Please contact support.";
      case "auth/credential-already-in-use":
        return "This account is already linked to another sign-in method.";
      case "auth/provider-already-linked":
        return "This sign-in method is already linked to your account.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}
