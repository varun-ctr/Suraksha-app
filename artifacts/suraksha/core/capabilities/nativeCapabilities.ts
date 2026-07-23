/**
 * Centralized, safe access to optional native modules.
 *
 * expo-modules-core's `requireNativeModule()` throws *synchronously* when a
 * native module isn't present in the running binary (see
 * node_modules/expo-modules-core/src/requireNativeModule.ts). Expo Go in
 * particular doesn't ship every native module a dev-client/release build
 * has — expo-task-manager's background-task support was the concrete case
 * that crashed app startup: a plain `import * as TaskManager from
 * "expo-task-manager"` at module scope threw before React ever mounted,
 * before the root ErrorBoundary or crash reporting could see it, producing
 * a blank white screen with no error (see
 * core/permissions/backgroundLocation.ts's fix and
 * docs/startup-audit/README.md for the full postmortem).
 *
 * Any optional native module should be reached through this file, not a new
 * ad-hoc `require()` + try/catch at its own call site: it's loaded lazily
 * (require, not a static import, so the throw can't happen during another
 * module's import phase), wrapped in try/catch exactly once, and cached —
 * so a module missing in this runtime degrades only the ONE feature that
 * needs it, is only attempted once (not re-thrown on every call site), and
 * is consistently logged in one place.
 */
// Relative import (with explicit extension) rather than the usual "@/..."
// alias: this file is directly unit-tested by the plain Node test runner
// (see __tests__/nativeCapabilities.test.ts), which has no tsconfig
// path-alias resolution — only relative imports with an explicit extension
// work there. allowImportingTsExtensions in tsconfig.json keeps this valid
// for the Metro/tsc side too.
import { logger } from "../logger/logger.ts";

const cache = new Map<string, unknown>();

/**
 * Requires `moduleId` lazily via `loader` and caches the result — including
 * a cached `null` on failure, so a module missing in this runtime is only
 * attempted (and logged) once. Never throws.
 */
function safeRequire<T>(moduleId: string, loader: () => T): T | null {
  if (cache.has(moduleId)) return cache.get(moduleId) as T | null;
  try {
    const mod = loader();
    cache.set(moduleId, mod);
    return mod;
  } catch (e) {
    logger.warn(`[capabilities] native module '${moduleId}' unavailable in this runtime`, e);
    cache.set(moduleId, null);
    return null;
  }
}

/** expo-task-manager — not fully available in Expo Go (background execution in particular). Used by core/permissions/backgroundLocation.ts. */
export function getTaskManager(): typeof import("expo-task-manager") | null {
  return safeRequire("expo-task-manager", () => require("expo-task-manager"));
}

/** expo-local-authentication (Face ID / Touch ID) — not yet wired into any screen (see core/permissions/biometrics.ts), guarded proactively since it's the other genuinely-optional native module in this app. */
export function getLocalAuthentication(): typeof import("expo-local-authentication") | null {
  return safeRequire("expo-local-authentication", () => require("expo-local-authentication"));
}

/** For tests only — clears the memoized capability cache between cases. */
export function __resetCapabilityCacheForTests(): void {
  cache.clear();
}
