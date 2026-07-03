---
name: OpenAI integration key fallback
description: The integrations-openai-ai-server library expects AI_INTEGRATIONS_OPENAI_API_KEY; fall back to OPENAI_API_KEY so the server starts without the Replit OpenAI integration provisioned
---

## The rule

`lib/integrations-openai-ai-server/src/client.ts` and `lib/integrations-openai-ai-server/src/image/client.ts` should resolve the API key as:

```ts
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1";
```

**Why:** The Replit OpenAI AI integration sets `AI_INTEGRATIONS_OPENAI_API_KEY` + `AI_INTEGRATIONS_OPENAI_BASE_URL`. When the integration is not provisioned, only the raw `OPENAI_API_KEY` secret is available. Throwing at module load time crashes the entire api-server on startup, taking down all routes (not just the Sakhi AI route).

**How to apply:** If either client file is regenerated or the integration library is upgraded, re-add this fallback. The guard (`if (!apiKey) throw`) stays — it just checks both names first.
