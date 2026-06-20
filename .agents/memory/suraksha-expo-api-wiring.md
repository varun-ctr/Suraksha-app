---
name: Suraksha Expo ↔ api-server wiring
description: How the Suraksha Expo mobile artifact reaches the shared api-server through the Replit proxy, and why the api-server must be restarted after route edits.
---

# Expo mobile artifact → api-server over the Replit proxy

The Expo app (`artifacts/suraksha`) calls the separate `artifacts/api-server` artifact
through the shared Replit dev-domain proxy.

- Set the client base URL with `setBaseUrl(\`https://${process.env.EXPO_PUBLIC_DOMAIN}\`)`
  (from `@workspace/api-client-react`) at module load in `app/_layout.tsx`.
- **Why the `https://` prefix:** `EXPO_PUBLIC_DOMAIN` is set to `$REPLIT_DEV_DOMAIN`,
  which has **no protocol**. The generated client paths already start with `/api/...`,
  so the final URL is `https://<domain>/api/sakhi/chat`.
- The api-server mounts its router at `/api` (`app.use("/api", router)`). Requests to
  `https://<domain>/api/...` route straight through the proxy to the api-server with the
  `/api` prefix intact (no prefix stripping). Health check is `/api/healthz` (note: `z`),
  NOT `/api/health`.
- CORS is open on the api-server (`app.use(cors())`), so browser/web-preview fetches work.

# api-server does NOT hot-reload — restart after route changes

**Rule:** After adding or editing any api-server route, restart the
`artifacts/api-server: API Server` workflow before testing.

**Why:** its dev script is `pnpm run build && pnpm run start` (esbuild → `node dist/index.mjs`).
It builds once and runs the bundle; it does not watch for changes. Symptom of forgetting:
a brand-new endpoint returns 404 while older endpoints (e.g. `/api/healthz`) still 200.

**How to apply:** quick verify with
`curl -s -X POST "https://$REPLIT_DEV_DOMAIN/api/sakhi/chat" -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"hi"}],"language":"en"}'`.
