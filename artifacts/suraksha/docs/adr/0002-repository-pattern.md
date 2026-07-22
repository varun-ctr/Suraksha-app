# 2. Repository pattern + dependency injection

## Status

Accepted

## Context

Before this pass, features imported concrete Firebase/Supabase modules
directly (e.g. `import { contactsRepository } from
"@/repositories/supabase/contactsRepository"` inside `AppContext.tsx`).
This works at small scale, but couples every feature directly to a specific
backend and its wire format, makes swapping or mocking a backend for tests
require editing every call site, and gives no single place to see "what
data operations does this app perform" independent of how they're
implemented.

## Decision

**Repository interfaces** live in `domain/repositories/*.ts`
(`ContactsRepository`, `SosEventsRepository`, `LiveSessionRepository`,
`CommunityReportsRepository`). They describe operations in terms of domain
entities and `Result<T, AppError>` (ADR 0004) only — no Firebase/Supabase
types leak into the interface.

**Concrete implementations** live under `repositories/supabase/*` and
`repositories/api/*`, one file per repository, using **DTOs** and
**mappers** to isolate wire formats from domain entities:

- DTOs (`repositories/supabase/dto/*`, `repositories/api/dto/*`) are the
  shape of a row/response as the backend actually returns it. Currently
  these are thin re-exported aliases of the existing
  `shared/types/database.ts` "Row" types, which were already the de facto
  wire schema.
- Mappers (`repositories/supabase/mappers/*`, `repositories/api/mappers/*`)
  are pure functions converting DTO → domain entity (`toContact`,
  `toSosEvent`, `toLiveSession`, `toCommunityReport`) and, where needed,
  domain input → DTO for writes (`toContactInsertDto`,
  `toSubmitReportBody`).

A concrete repository implementation is the only code allowed to import
both a domain repository interface and a backend client/DTO — features
never see DTOs.

**Dependency injection** wires interfaces to implementations, so features
depend on the interface and never construct or import a concrete
repository directly:

- `core/di/container.ts` — a minimal, type-safe service registry
  (`Container<TRegistry>`, `register`/`resolve`). No reflection, no
  decorators — appropriate for a React Native runtime.
- `core/di/registry.ts` — the composition root: defines `AppRegistry` and
  `createAppContainer(overrides?)`, which wires each concrete repository to
  its domain interface. This is the one file in `core/` permitted to import
  from `repositories/*` (ADR 0001).
- `core/di/DependencyProvider.tsx` — a React Context provider exposing the
  container to the component tree; mounted once in `app/_layout.tsx`.
- `core/di/hooks.ts` — one convenience hook per repository
  (`useContactsRepository`, `useSosEventsRepository`,
  `useLiveSessionRepository`, `useCommunityReportsRepository`) so call
  sites read `const contactsRepository = useContactsRepository();` instead
  of reaching into the container directly.

`createAppContainer` accepts an `overrides` argument specifically so tests
(or a future Storybook/preview harness) can substitute fake repositories
without touching feature code.

## Consequences

- Features (`AppContext.tsx`, `SafetyContext.tsx`, `useIncidentScreen.ts`)
  now depend only on `domain/repositories/*` interfaces and DI hooks, never
  on `repositories/supabase/*` or `repositories/api/*` directly.
- Swapping Supabase for another backend, or writing a test double, means
  writing one new file that satisfies the existing interface and changing
  one line in `core/di/registry.ts` — no feature code changes.
- This is one additional layer of indirection for a small app; it earns
  its cost specifically because the brief targets a 100k+ line production
  codebase where "just import the concrete repository" stops scaling long
  before that size.
