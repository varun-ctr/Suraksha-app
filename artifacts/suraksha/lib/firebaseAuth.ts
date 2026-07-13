import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously as fbSignInAnonymously,
  signInWithCustomToken,
  linkWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut as fbSignOut,
  onAuthStateChanged,
  reload,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "./firebase";

export type FirebaseUser = User;
export type AuthResult = { user: User | null; error: string | null };

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
    return { user: cred.user, error: null };
  } catch (e) {
    return { user: null, error: firebaseErrMsg(e) };
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
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

export async function sendPasswordReset(
  email: string,
): Promise<{ error: string | null }> {
  try {
    await sendPasswordResetEmail(firebaseAuth, email);
    return { error: null };
  } catch (e) {
    return { error: firebaseErrMsg(e) };
  }
}

export async function resendVerificationEmail(): Promise<{
  error: string | null;
}> {
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

/** Completes sign-in after the backend has verified an email OTP code and minted a Firebase custom token. */
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

export function onFirebaseAuthStateChanged(
  callback: (user: User | null) => void,
): () => void {
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
        return "This email is already linked to another account.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}
