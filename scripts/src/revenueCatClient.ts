import { createClient } from "@replit/revenuecat-sdk/client";
import { ReplitConnectors } from "@replit/connectors-sdk";

const BASE_URL = "https://api.revenuecat.com/v2";
const PROXY_BASE = "https://api.revenuecat.com";

/**
 * Returns a fresh, authenticated RevenueCat API client each call.
 * Never cache the result — the underlying OAuth token expires.
 * Uses the Replit RevenueCat connector for auth injection.
 */
export async function getUncachableRevenueCatClient() {
  const connectors = new ReplitConnectors();

  const proxyFetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    let urlStr: string;
    let method: string;
    let body: string | undefined;
    let extraHeaders: Record<string, string> = {};

    if (input instanceof Request) {
      urlStr = input.url;
      method = init?.method ?? input.method ?? "GET";
      body = (init?.body as string | undefined) ??
        (input.method !== "GET" ? await input.text() : undefined);
      // Collect headers from the original Request
      input.headers.forEach((v, k) => { extraHeaders[k] = v; });
    } else {
      urlStr = typeof input === "string" ? input : input.toString();
      method = (init?.method ?? "GET") as string;
      body = init?.body as string | undefined;
    }

    // Merge any init headers
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        (init.headers as Headers).forEach((v, k) => { extraHeaders[k] = v; });
      } else if (Array.isArray(init.headers)) {
        for (const [k, v] of init.headers) extraHeaders[k] = v;
      } else {
        Object.assign(extraHeaders, init.headers);
      }
    }

    // Ensure JSON content-type for requests with a body
    if (body && !extraHeaders["content-type"] && !extraHeaders["Content-Type"]) {
      extraHeaders["Content-Type"] = "application/json";
    }

    // Strip protocol+host to preserve /v2 for the proxy
    const path = urlStr.startsWith(PROXY_BASE)
      ? urlStr.slice(PROXY_BASE.length) || "/"
      : urlStr;

    const response = await connectors.proxy("revenuecat", path, {
      method,
      body,
      headers: extraHeaders,
    });

    return response as unknown as Response;
  };

  return createClient({ baseUrl: BASE_URL, fetch: proxyFetch });
}
