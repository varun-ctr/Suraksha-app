# 4. Loading States

## Method

Reviewed every major async screen: map/nearby-places, rights/legal-articles list, Sakhi chat, incident report, profile, sessions, auth, App Lock, premium.

## Findings — no code changes needed; coverage is already solid

- **Map** (`app/(tabs)/map.tsx`): per-category `ActivityIndicator` while fetching a place category, a `noResults` empty state with actual copy (not a blank screen), and a location-denied notice with a refresh action — now additionally given an "Open Settings" action this pass (see `06-Permissions.md`).
- **Rights/legal articles**: a defined `noResults` text state rather than an indefinite spinner or blank list.
- **Sakhi chat** (`app/(tabs)/sakhi.tsx`): the strongest offline-handling in the app — a typing indicator distinguishes "thinking" from "retrying" copy, and a dedicated offline banner (wifi-off icon + explicit retry button) is shown instead of a generic error, matching the retry-backoff mechanism hardened in the prior performance-certification phase.
- **Incident / Profile / Sessions / Login / Premium / App Lock**: all use `ActivityIndicator` for in-flight states; incident submission specifically distinguishes "not signed in" / "no location" / "rate-limited" / generic-failure toasts (see `05-Errors.md`) rather than a single undifferentiated spinner-then-error.

## Assessment

No loading-state gap was found that meets the Release Freeze bar (accessibility, HIG compliance, emergency usability, App Store acceptance, error reduction, or cognitive-load reduction) strongly enough to justify a change. This section is a certification of existing behavior, not a list of fixes — consistent with the instruction to reject cosmetic preference and not invent problems where the evidence doesn't support one.

## One related, already-covered fix

The incident-report photo-picker's previously-silent failure (denied camera/library permission, or a picker error) is technically an "unbounded loading state" in the sense that `uploadingPhoto` would resolve back to `false` with zero user-visible outcome — now surfaces `contacts.photoFailed` via toast. Filed under `05-Errors.md` since it's fundamentally an error-surfacing gap, not a loading-indicator gap.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors. `pnpm run test`: 100/100 passing.
