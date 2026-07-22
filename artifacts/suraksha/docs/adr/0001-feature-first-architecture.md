# 1. Feature-first architecture

## Status

Accepted

## Context

Suraksha is a React Native / Expo safety app expected to grow well past its
current size. Organizing code by technical type (`components/`, `hooks/`,
`context/`, `utils/` at the root) scales poorly once a codebase reaches
production size: every change to a feature (SOS, contacts, community
reports, profile) touches several unrelated top-level folders, unrelated
features accumulate hidden coupling through shared context files, and there
is no structural signal for which code is safe to change without touching
another feature.

## Decision

Code is organized by layer first, and by feature within the `features/`
layer:

- `domain/` — pure entities and repository interfaces. No framework, no I/O,
  no dependency on any other layer. See ADR 0003.
- `core/` — cross-cutting infrastructure: DI container (`core/di`), logger,
  config, network client, permissions, storage, analytics. Depends only on
  `domain/` (with one documented exception — see below).
- `shared/` — generic, feature-agnostic UI components and utilities (theme,
  buttons, validators). Depends only on `domain/`.
- `repositories/` — concrete Firebase/Supabase/REST implementations of
  `domain/repositories/*` interfaces, plus DTOs and mappers. See ADR 0002.
- `features/<name>/` — business logic per feature: context providers, hooks,
  feature-local components and utilities. May depend on any lower layer.
- `app/` — Expo Router screens. File-based routing, presentational only. May
  depend on any layer.

Allowed dependency direction: `app` → `features` → `repositories` →
`domain`, with `core` and `shared` sitting beside `repositories` as
infrastructure that also depends only on `domain`. Nothing in `domain`,
`core`, `shared`, or `repositories` may import from `features` or `app`.

One documented exception: `core/di` (the DI composition root, ADR 0002) is
allowed to import concrete `repositories/*` implementations, since wiring
concrete implementations to interfaces is exactly its job. Two further
narrow exceptions — `core/network/apiClient.ts` and
`core/permissions/notifications.ts` importing the Firebase/Supabase clients
directly for auth-token access — are marked with inline
`eslint-disable-next-line import/no-restricted-paths` comments explaining
why, rather than folded into a blanket carve-out.

The boundary is enforced mechanically, not just by convention: ESLint's
`import/no-restricted-paths` rule (`eslint.config.js`) fails the build if a
disallowed import direction is introduced. This turns "please don't do
that" into a compile-time-adjacent check that scales past the point where
any one person can review every PR for layering violations.

## Consequences

- A new contributor can find all code for a feature under one
  `features/<name>/` directory instead of hunting across the tree.
- The lint rule makes accidental layer inversions (e.g. a `shared/`
  component importing a feature's context) a CI failure instead of a slow
  architectural leak — this was not hypothetical: implementing this rule
  surfaced two pre-existing violations (`shared/components/Headers.tsx` and
  `shared/utils/native.ts` importing feature-local modules), both fixed by
  relocating the shared code they actually needed (`ThemeContext` →
  `shared/theme/`, a geo helper → `shared/utils/geo.ts`) rather than
  weakening the rule.
- `app/` routes and route file paths are unaffected by this pass — this
  refactor only changes where non-route code lives and how it depends on
  itself.
