---
name: Expo CI startup
description: How to run expo start non-interactively in Replit without breaking Expo Go clients.
---

## Rule
Do NOT set `CI=1` in the dev script. Use `</dev/null` (stdin redirect) instead.

```json
"dev": "fuser -k $PORT/tcp 2>/dev/null; <env vars> pnpm exec expo start --localhost --port $PORT --clear </dev/null"
```

**Why:** `CI=1` sets Expo to non-interactive mode AND requires `EXPO_TOKEN` for auth. When an Expo Go device connects and Expo tries to show the "Log in / Proceed anonymously" prompt, CI mode returns HTTP 500: "CommandError: Input is required, but 'npx expo' is in non-interactive mode." The `</dev/null` redirect keeps Metro non-interactive (Inquirer reads EOF and falls through) without triggering the auth gate. The manifest endpoint still returns 200 and Expo Go clients can connect.

**How to apply:** Any time the dev script is edited or the workflow is recreated, ensure `CI=1` is absent and `</dev/null` is appended to the `expo start` command.

**What NOT to use:**
- `CI=1` — causes Expo Go 500 errors (auth required)
- `--non-interactive` flag — rejected by this Expo version
- `--offline` — mutually exclusive with `--localhost`, causes startup failure
