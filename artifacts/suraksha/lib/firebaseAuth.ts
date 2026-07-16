import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously as fbSignInAnonymously,
  signInWithCustomToken,
  signInWithCredential,
  linkWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut as fbSignOut,
  onAuthStateChanged,
  reload,
  type User,
} from "firebase/auth";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import { firebaseAuth } from "./firebase";
import { optionalPublicEnv } from "./env";

export type FirebaseUser = User;
export type AuthResult = { user: User | null; error: string | null; cancelled?: boolean };

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
    const current = firebaseAuth.currentUser;

    if (current?.isAnonymous) {
      try {
        const linked = await linkWithCredential(current, credential);
        return { user: linked.user, error: null };
      } catch (linkErr: unknown) {
        const code = (linkErr as { code?: string }).code;
        if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
          const cred = await signInWithCredential(firebaseAuth, credential);
          return { user: cred.user, error: null };
        }
        return { user: null, error: firebaseErrMsg(linkErr) };
      }
    }

    const cred = await signInWithCredential(firebaseAuth, credential);
    return { user: cred.user, error: null };
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === statusCodes.SIGN_IN_CANCELLED) return { user: null, error: null, cancelled: true };
    if (code === statusCodes.IN_PROGRESS) return { user: null, error: "Sign-in already in progress.", cancelled: false };
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { user: null, error: "Google Play Services are not available on this device.", cancelled: false };
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
    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const { identityToken } = appleCredential;
    if (!identityToken) throw new Error("No identity token returned from Apple Sign-In.");

    const provider = new OAuthProvider("apple.com");
    const firebaseCredential = provider.credential({ idToken: identityToken });

    const current = firebaseAuth.currentUser;

    if (current?.isAnonymous) {
      try {
        const linked = await linkWithCredential(current, firebaseCredential);
        return { user: linked.user, error: null };
      } catch (linkErr: unknown) {
        const code = (linkErr as { code?: string }).code;
        if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
          const cred = await signInWithCredential(firebaseAuth, firebaseCredential);
          return { user: cred.user, error: null };
        }
        return { user: null, error: firebaseErrMsg(linkErr) };
      }
    }

    const cred = await signInWithCredential(firebaseAuth, firebaseCredential);
    return { user: cred.user, error: null };
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "ERR_REQUEST_CANCELED") return { user: null, error: null, cancelled: true };
    return { user: null, error: firebaseErrMsg(e) };
  }
}

// ── Email / Password ───────────────────────────────────────────────────────────

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
        return "This account is already linked to another sign-in method.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}
