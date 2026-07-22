# 3. Domain layer

## Status

Accepted

## Context

Screens and feature hooks previously consumed database row types directly
(e.g. `CommunityReportRow` with `photo_url`, `moderation_status`,
`created_at` snake_case fields straight from Supabase). This means a
backend schema change or a Firebase↔Supabase migration ripples all the way
into UI components, and there is no single definition of "what is a
Contact" independent of how it's stored.

## Decision

`domain/` holds the vocabulary of the app, expressed with zero external
dependencies — no React, no Firebase/Supabase SDK, no Expo APIs:

- `domain/entities/*` — plain interfaces for `Contact`, `Profile`,
  `SosEvent`, `LiveSession`, `CommunityReport`, `AuthUser`. Field names are
  camelCase and shaped for how the app reasons about them (e.g.
  `CommunityReport.moderationStatus`, not `moderation_status`), not for how
  a particular backend stores them.
- `domain/repositories/*` — the data-access contracts features depend on
  (ADR 0002).
- `domain/result/Result.ts` and `domain/errors/*` — the `Result<T, E>` type
  and `AppError` hierarchy (ADR 0004) live here too. These are pure,
  framework-agnostic types that are part of the domain's own vocabulary for
  expressing "this operation can fail," not an infrastructure concern —
  keeping them in `core/` would have made every domain repository interface
  depend on `core/`, inverting the intended dependency direction.

UI code (`app/`, `features/`) depends only on `domain/entities/*` types,
never on a DTO or a raw database row type. `app/(tabs)/incident.tsx`'s
`ReportCard`, for example, is typed against domain `CommunityReport`, not
`CommunityReportRow`.

`domain/` is enforced to have zero outward dependencies by the same
`import/no-restricted-paths` ESLint rule described in ADR 0001 — the
`domain` zone forbids imports from `features`, `app`, `core`, `shared`, and
`repositories`.

`AuthUser` is defined but deliberately not yet wired through
`AuthContext` in this pass — introducing it is scoped as a follow-up, not
bundled into this hardening pass, to keep the change set behavior-neutral.

## Consequences

- A backend migration (e.g. Supabase → another Postgres provider, or
  extending Firebase usage) only requires new DTOs/mappers/repository
  implementations (ADR 0002) — domain entities and the UI that consumes
  them are unaffected.
- Domain types are safe to reuse from any layer without pulling in
  React Native, Expo, or a specific backend SDK — including, if it's ever
  needed, from non-mobile code (a backend script, a web admin tool).
- Adding a field to a domain entity is a deliberate, visible decision
  (edit `domain/entities/*.ts` + the relevant mapper), not an incidental
  side effect of a database migration leaking into the UI.
