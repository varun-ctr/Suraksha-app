import OpenAI from "openai";

let cached: OpenAI | null = null;

/**
 * Lazily creates (and caches) the OpenAI client on first use.
 *
 * Reads a plain OpenAI API key (`OPENAI_API_KEY`) or the integration-scoped
 * `AI_INTEGRATIONS_OPENAI_API_KEY`, and defaults the base URL to the real
 * OpenAI endpoint (override with `AI_INTEGRATIONS_OPENAI_BASE_URL` only if you
 * proxy through a gateway).
 *
 * Crucially this throws only when actually CALLED without a key — never at
 * import time. Previously the client was constructed at module load and threw
 * immediately if no key was set, which meant a missing key took down the
 * entire server at boot (every route, including SOS), not just the one feature
 * that needs OpenAI. Now the route that calls this can catch the error and
 * degrade to a clean 503.
 */
export function getOpenAI(): OpenAI {
  if (cached) return cached;

  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  const baseURL =
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1";

  if (!apiKey) {
    throw new Error(
      "Neither AI_INTEGRATIONS_OPENAI_API_KEY nor OPENAI_API_KEY is set.",
    );
  }

  cached = new OpenAI({ apiKey, baseURL });
  return cached;
}
