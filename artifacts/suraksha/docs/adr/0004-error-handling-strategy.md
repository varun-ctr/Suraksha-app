# 4. Error handling strategy

## Status

Accepted

## Context

Repository methods previously threw generic `Error`s or silently returned
`null`/empty arrays on failure (e.g. `syncContactsOnLoad` returning `[]`
for both "remote is empty" and "fetch failed," which could trigger a
spurious local→remote overwrite on a network error). Call sites used
`try/catch` or dead `.catch(() => {})` chains, and there was no consistent,
typed vocabulary for *why* an operation failed — a network timeout, an
auth problem, and a permission denial were all just `Error`.

Separately, the codebase used ad hoc `console.log`/`console.warn`/
`console.error` calls scattered across contexts and repositories, with no
central place to gate, redact, or later redirect logging (e.g. to a crash
reporter).

## Decision

**`Result<T, E>`** (`domain/result/Result.ts`) is a discriminated union —
`Ok<T> | Err<E>` — returned by every repository method instead of a thrown
exception or a nullable value:

```ts
export type Result<T, E> = Ok<T> | Err<E>;
export interface Ok<T> { readonly ok: true; readonly value: T; }
export interface Err<E> { readonly ok: false; readonly error: E; }
```

Helper functions (`ok`, `err`, `isOk`, `isErr`, `mapResult`, `mapErr`,
`unwrapOr`) support composing and unwrapping results without exceptions.
Callers check `.ok` and branch — a failure is a value, not a thrown
control-flow jump, so it can't be accidentally swallowed by an empty catch
block.

**`AppError`** (`domain/errors/AppError.ts`) is an abstract base class with
a `readonly code` discriminator, subclassed into six typed errors matching
the actual failure categories in this app:

- `NetworkError` (`status`, `url`)
- `AuthError` (`reason`)
- `ValidationError` (`field`)
- `RepositoryError` (`operation`)
- `PermissionError` (`permission`)
- `LocationError` (`reason`)

Each carries an optional `cause` for the underlying error, and each still
extends `Error` (so `throw result.error` remains valid where a call site
chooses to convert back to a thrown exception, e.g. at a screen-level
catch-all).

Introducing `Result` surfaced one real latent bug as a side effect:
`contactsRepository.syncContactsOnLoad` could not previously distinguish
"the fetch failed" from "the remote genuinely has zero contacts," both of
which returned `[]`; only the latter should trigger a local→remote push.
`Result` makes the two cases distinguishable at the type level, and the fix
was applied as part of this pass since it was a direct consequence of
correctly typing the existing method.

**Logging**: `core/logger/logger.ts` provides `logger.info` / `.warn` /
`.debug` (gated behind `__DEV__`, so nothing extra ships to production
console output) and `logger.error` (always active). All `console.*` call
sites in application code were replaced with the equivalent `logger.*`
call — this is a mechanical substitution with a single seam, so a future
crash-reporting integration (e.g. Sentry) is a one-file change in
`core/logger/logger.ts` rather than a repo-wide find-and-replace.

**Fail-fast config validation**: `core/config/config.ts` exports
`validateConfig()` (existing, unchanged behavior — returns
`{ ok, missing }` and logs via `logger` in dev) and a new
`assertConfig()`, which calls `validateConfig()` and throws a
`ValidationError` if required environment variables are missing. This is
for contexts that should hard-stop (build/CI scripts, server-side tooling,
tests). The Expo Router app entry (`app/_layout.tsx`) deliberately keeps
calling `validateConfig()` and rendering `ConfigErrorScreen`, not
`assertConfig()` — a hard native crash on a misconfigured build is worse
UX than a clear in-app message for a safety app the user may be relying on
in an emergency.

## Consequences

- Every repository method's possible failure modes are visible in its
  return type (`Promise<Result<T, AppError>>`), not hidden in undocumented
  throw behavior.
- Call sites that ignore a failure now do so visibly (an unhandled `.ok ===
  false` branch is a code-review-visible omission) rather than invisibly
  (an empty `catch` block).
- `console.*` usage in application code is gone in favor of `logger.*`;
  `logger.ts` itself is the one place allowed to call `console.*`.
- `assertConfig()` exists specifically so a future non-UI entry point
  (a script, a server function, a test setup) can fail fast without
  duplicating `validateConfig()`'s missing-vars logic — it is not currently
  called from `app/_layout.tsx`, and should not be, per above.
