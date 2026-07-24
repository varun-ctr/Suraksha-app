# 7. Bundle Size

## Method

Read `package.json`'s full dependency list, `metro.config.js`, and `app.config.ts` directly; cross-referenced dead-code findings against prior-phase docs rather than re-discovering them from scratch.

## Fixed in this pass

**Removed unused dependency: `@tanstack/react-query`** — confirmed via whole-repository grep, zero imports anywhere in the app's source. Removed from `package.json`'s `devDependencies`; `pnpm-lock.yaml` re-synced via `pnpm install --filter @workspace/suraksha` (a clean, minimal 3-line diff). Metro's bundler only includes what's actually imported, so this had **zero runtime bundle-size impact** either way — the benefit is dependency-graph/install-footprint hygiene (one fewer package to install, audit, and track for vulnerabilities), not a measurable app-size reduction.

## Dead code — cross-referenced with prior-phase findings, not re-litigated

- `journeys.route_json` (database column): confirmed dead/unwritten schema, already documented in `docs/backend-audit/technical-debt-report.md` (BE-P3-1). Not a mobile-bundle item (it's a DB column), noted here only because it corroborates this pass's own independent finding (in `03-Memory.md`) that no route/coordinate-history array is ever accumulated client-side either.
- `db.communityReports.listAll()`: previously documented as having no `.limit()` (BE-P1-5); **already fixed** in the backend-hardening phase (`supabaseClient.ts` now has `.limit(50)` on this query) — confirmed by reading the current code, not assumed from the stale doc reference.
- `db.journeys.listForUser` / `db.sosEvents.listForUser` / `db.communityReports.listForUser` (direct Supabase-client methods): confirmed **not called from any screen or hook** in the current app (traced via grep — only `insertSosEvent`/`resolveSosEvent`/`findRecentUnresolvedEvent`/`startJourney`/`endJourney` are actually used from `SafetyContext.tsx`). Genuinely dead code paths today; not removed in this pass (removing an unused-but-still-potentially-useful repository method is a judgment call for the repository's own maintainers, not a performance fix), but flagged as low-priority (P3) — see `05-Network.md`.
- `SIDE_TABS` constant in `app/(tabs)/_layout.tsx`: declared but never referenced anywhere in that file — pre-existing dead code, not introduced by this pass. Left untouched (out of scope; not a performance-relevant finding, just an unused variable).

## No duplicate/redundant heavy libraries found

Checked specifically for: `moment` (zero matches — the only "moment" hits in the codebase are the English word), `lodash` (zero `from "lodash"` imports), multiple icon libraries (only `@expo/vector-icons` is used). `crypto-js` and `expo-crypto` are not redundant with each other — the former does AES-256-CBC+HMAC encryption (`core/storage/aesCbcHmac.ts`), the latter does CSPRNG/UUID generation (`Crypto.randomUUID()`, `Crypto.getRandomBytesAsync()`) — genuinely different responsibilities, both actively used.

## Dependencies reviewed and confirmed justified

`firebase`, `@supabase/supabase-js`, `react-native-purchases`+`react-native-purchases-ui` (paired, both required for RevenueCat IAP), `@sentry/react-native`, `react-native-maps`, `crypto-js` — each is tied to an actually-shipped feature (auth, database, in-app purchases, crash reporting, maps, session encryption respectively). No package was found that's installed for a feature that was since removed or never built.

## Metro / build configuration

`metro.config.js` only configures monorepo `watchFolders`/`nodeModulesPaths` for the pnpm workspace (via `getDefaultConfig`) — no custom bundle-splitting or asset-optimization configuration exists beyond Expo's own defaults. This is a normal, unremarkable configuration for a project this size — not flagged as a gap requiring immediate action, since Expo/Metro's default tree-shaking (dead-code elimination of unreached `import`s) already applies without any extra configuration.

## Lazy imports / code splitting

No screen in the app uses manual `React.lazy()` or a dynamic `import()` — Expo Router's file-based routing already provides per-route chunking for the web build target; for native builds, the entire JS bundle ships as one file per platform, which is standard for React Native (native "code splitting" isn't a meaningfully separate lever the way it is for a web SPA). Not flagged as a gap at this app's current size.

## What would need real tooling to further verify

An actual bundle-size breakdown (e.g. `npx expo export` + a bundle visualizer, or `react-native-bundle-visualizer`) to get exact per-package byte contributions was not run in this pass — the findings above are based on `package.json`/import-graph review, not a generated bundle-analysis report. If a future pass wants exact numbers, running the actual bundle analyzer against a real build is the correct next step; this pass's review-based approach is sufficient to confirm "no obviously redundant heavy package" but not to produce a precise KB-by-KB breakdown.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run test`: 100/100 passing (package.json change doesn't affect test execution since the package was unused). `npx madge --circular`: clean. `npx expo export --platform web`: builds clean (re-run as part of this pass's final verification, confirming the dependency removal doesn't break the build).
