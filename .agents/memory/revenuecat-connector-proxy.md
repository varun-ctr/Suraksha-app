---
name: RevenueCat connectors proxy
description: How to wire @replit/revenuecat-sdk through @replit/connectors-sdk proxy; key gotchas.
---

## Rule
When creating a custom `fetch` for `createClient` from `@replit/revenuecat-sdk/client`, the `input` argument is a `Request` object — not a plain string or URL. Using `input.toString()` yields `[object Request]` and the proxy gets a 404.

**Correct pattern:**
```ts
const proxyFetch = async (input: string | URL | Request, init?: RequestInit) => {
  let urlStr: string;
  let method: string;
  let body: string | undefined;

  if (input instanceof Request) {
    urlStr = input.url;                          // ← extract .url
    method = init?.method ?? input.method ?? "GET";
    body = (init?.body as string | undefined) ?? (input.method !== "GET" ? await input.text() : undefined);
    input.headers.forEach((v, k) => { extraHeaders[k] = v; });
  } else {
    urlStr = typeof input === "string" ? input : input.toString();
    method = (init?.method ?? "GET") as string;
    body = init?.body as string | undefined;
  }

  // Always set Content-Type for POST/PUT with body
  if (body && !extraHeaders["content-type"]) extraHeaders["Content-Type"] = "application/json";

  // Strip PROXY_BASE ("https://api.revenuecat.com") only — preserve /v2 prefix for proxy
  const path = urlStr.startsWith(PROXY_BASE) ? urlStr.slice(PROXY_BASE.length) || "/" : urlStr;
  return connectors.proxy("revenuecat", path, { method, body, headers: extraHeaders });
};
```

**Why:**
- `createClient` builds a `Request` object internally before calling the custom fetch. `input.toString()` on a `Request` returns `[object Request]`, making the path unresolvable → 404.
- Without `Content-Type: application/json`, the RevenueCat v2 API rejects POSTs with "Content-Type not application/json" → 400 invalid_request.
- `BASE_URL = "https://api.revenuecat.com/v2"` — strip only the host (not `/v2`) so the proxy receives `/v2/projects/...` paths.

**How to apply:**
Any time you call `createClient` from `@replit/revenuecat-sdk/client` with a custom fetch bridging through `ReplitConnectors.proxy`, follow this pattern exactly.

## Test store key usage (Expo/web)
- `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` → used on `Platform.OS === "web"`, Expo Go (`IS_EXPO_GO`), or `__DEV__`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` → used for native iOS builds
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` → used for native Android builds
- `isPurchasesAvailable()` returns `true` whenever `platformKey()` is non-empty (includes web/dev now)
- Console confirms: "Web platform detected. Using RevenueCat in Browser Mode."

## Project IDs (Suraksha — proj08105b3e)
- Test Store App: `appb057e8b928`
- App Store App: `app1ab7d08976`
- Play Store App: `app932c16787d`
- Entitlement: `premium` (`entl72377d91b5`)
- Product: `suraksha_premium_monthly` / `$4.99 USD`
- Offering: default (`ofrng8a902cab02`), Package monthly (`pkgec3f8047225`)
