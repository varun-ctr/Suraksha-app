/**
 * Shared client for calls to the app's own backend (`getBackendUrl()`).
 *
 * Before this, six call sites (Sakhi chat, nearby places, SOS alert, journey
 * alert, account deletion, sessions) each independently fetched the current
 * Firebase ID token, built the Authorization header, and picked their own
 * request timeout — and had already drifted (timeouts ranging from none at
 * all to 8s to 10s). This centralizes exactly that shared part; each
 * endpoint's response shape is different, so status-code/body handling
 * stays with the call site.
 */
// Needs the Firebase auth client to attach the caller's ID token; not a
// composition-root concern, but there's no domain-level indirection for
// "get the current auth token" yet.
// eslint-disable-next-line import/no-restricted-paths
import { firebaseAuth } from "@/repositories/firebase/firebaseClient";
import { getBackendUrl } from "@/core/config/env";
import { dedupeInFlight } from "@/core/network/inFlightDedup";

/** Used by every backend call in the app unless a route needs a longer one. */
export const DEFAULT_TIMEOUT_MS = 10_000;

async function getAuthToken(): Promise<string | null> {
  try {
    return (await firebaseAuth.currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "signal" | "headers"> {
  /** Defaults to DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface ApiFetchResult {
  /** null on network error, timeout, or when no backend URL is configured. */
  response: Response | null;
}

async function performFetch(path: string, options: ApiFetchOptions): Promise<ApiFetchResult> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...rest } = options;
  const backendUrl = getBackendUrl();
  if (!backendUrl) return { response: null };

  const token = await getAuthToken();
  const finalHeaders: Record<string, string> = { "Content-Type": "application/json", ...headers };
  if (token) finalHeaders["Authorization"] = `Bearer ${token}`;

  try {
    const response = await fetch(`${backendUrl}${path}`, {
      ...rest,
      headers: finalHeaders,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { response };
  } catch {
    return { response: null };
  }
}

// In-flight de-duplication for concurrent identical GET requests (e.g. a
// fast double-tap on the map screen's category chips firing two
// simultaneous /nearby-places calls) — a second caller for the same path
// while one is already outstanding awaits the first one's result instead
// of firing its own network request. Scoped to GET only: a GET has no side
// effects to duplicate, whereas POST/DELETE call sites (SOS alerts, OTP,
// account deletion) already carry their own call-site-specific
// idempotency-key/retry semantics that must not be silently intercepted
// here. Each waiter gets `response.clone()` (never the shared original),
// since a Response body can only be consumed once — cloning is what lets
// multiple callers each safely call their own `.json()`/`.text()`.
const inFlightGetRequests = new Map<string, Promise<ApiFetchResult>>();

/**
 * fetch() against the app's backend with a Firebase bearer token attached
 * when available (best-effort — proceeds unauthenticated otherwise, letting
 * the server's own auth check reject if one is required) and a bounded
 * timeout. Returns `{ response: null }` instead of throwing on network
 * error/timeout/unconfigured backend — every existing call site already
 * treated those as one case via try/catch, so this just makes that the
 * return contract instead of repeating the try/catch at each site.
 */
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<ApiFetchResult> {
  const method = (options.method ?? "GET").toUpperCase();
  if (method !== "GET") return performFetch(path, options);

  const result = await dedupeInFlight(inFlightGetRequests, path, () => performFetch(path, options));
  return result.response ? { response: result.response.clone() } : result;
}
