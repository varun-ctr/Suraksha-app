/**
 * Firebase Admin token verification.
 *
 * The mobile app authenticates with Firebase Auth and sends the Firebase ID
 * token in the `Authorization: Bearer <token>` header. Backend routes must
 * verify that token here (previously they incorrectly validated it as a
 * Supabase JWT, which always failed after the Firebase migration).
 *
 * Initialization strategy (first that applies wins):
 *   1. FIREBASE_SERVICE_ACCOUNT — full service-account JSON (recommended in prod;
 *      also required for privileged operations like revoking tokens).
 *   2. GOOGLE_APPLICATION_CREDENTIALS — path to a service-account file (ADC).
 *   3. FIREBASE_PROJECT_ID (or EXPO_PUBLIC_FIREBASE_PROJECT_ID) — project id only.
 *      ID-token *verification* needs only the project id plus Google's public
 *      certs, so no private key is required for this path.
 */
import {
  initializeApp,
  applicationDefault,
  cert,
  getApps,
  type App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { type Request } from "express";
import { optionalEnv } from "./env";

let app: App | null = null;

function getFirebaseApp(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length) {
    app = existing[0]!;
    return app;
  }

  const serviceAccountJson = optionalEnv("FIREBASE_SERVICE_ACCOUNT");
  const projectId =
    optionalEnv("FIREBASE_PROJECT_ID") ?? optionalEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID");

  if (serviceAccountJson) {
    app = initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
  } else if (optionalEnv("GOOGLE_APPLICATION_CREDENTIALS")) {
    app = initializeApp({ credential: applicationDefault(), projectId });
  } else if (projectId) {
    app = initializeApp({ projectId });
  } else {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT (JSON) " +
        "or FIREBASE_PROJECT_ID so backend routes can verify Firebase ID tokens.",
    );
  }
  return app;
}

/** Extracts the bearer token from an Authorization header, or null. */
export function getBearerToken(req: Request): string | null {
  const h = req.headers["authorization"] ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

export interface VerifiedUser {
  uid: string;
  email?: string;
  /** Firebase `auth_time` claim (seconds since epoch), if present. */
  authTime?: number;
}

/**
 * Verifies a Firebase ID token. Returns the user, or null when the token is
 * missing/invalid/expired or Firebase Admin is not configured.
 */
export async function verifyFirebaseToken(token: string | null): Promise<VerifiedUser | null> {
  if (!token) return null;
  try {
    const decoded = await getAuth(getFirebaseApp()).verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email, authTime: decoded.auth_time };
  } catch {
    return null;
  }
}

/**
 * Finds the Firebase user for an email (used after a successful email-OTP
 * verification), creating one if it doesn't exist yet — this is effectively
 * "sign in or create" in one step, standard for OTP-style auth. Marks the
 * new/existing user as email-verified, since the OTP itself just proved
 * ownership of the inbox.
 */
export async function getOrCreateUserByEmail(email: string): Promise<string> {
  const auth = getAuth(getFirebaseApp());
  try {
    const existing = await auth.getUserByEmail(email);
    return existing.uid;
  } catch {
    const created = await auth.createUser({ email, emailVerified: true });
    return created.uid;
  }
}

/**
 * Mints a Firebase custom token for the given uid so the client can complete
 * sign-in via `signInWithCustomToken` — the bridge between our own
 * email-OTP verification and a real Firebase session.
 *
 * Unlike `verifyFirebaseToken` above (which only needs a project id to
 * verify ID tokens against Google's public certs), minting a custom token
 * requires signing a JWT with a real service-account private key. This
 * throws if Firebase Admin was initialized in the project-id-only path —
 * callers must catch this and degrade gracefully rather than crash.
 */
export async function mintCustomToken(uid: string): Promise<string> {
  return getAuth(getFirebaseApp()).createCustomToken(uid);
}
