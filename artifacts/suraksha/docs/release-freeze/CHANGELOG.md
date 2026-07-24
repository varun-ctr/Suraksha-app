# Release Freeze Changelog

The application entered **Release Freeze** on 2026-07-24, following completion of all 10 prior
certification phases (Architecture, Authentication, Startup, SOS, Journey, Backend, Backend
Hardening, Security, Security Hardening, Performance).

During Release Freeze, stability outranks feature development. Every change merged from this
point forward must be justified against exactly one of the 10 accepted categories below, and is
logged here at the time it's merged — no exceptions, no batching "while I'm in there."

## Accepted change categories

1. Confirmed bug fix
2. Production crash fix
3. Accessibility improvement
4. App Store compliance
5. Security vulnerability fix
6. Battery/performance improvement with measurable evidence
7. Memory leak fix
8. Data-loss scenario fix
9. Regression fix
10. Observability improvement

Anything else — new features, navigation/UX/UI changes, architecture/repository/domain/DI
changes, schema changes, large refactors, public API renames, non-security-critical dependency
upgrades, analytics/telemetry schema changes, permission changes — is rejected by default. The
standing rule: **if it isn't necessary for production readiness, don't change it.**

## Launch Blockers — the only bypass path

A change is a **Launch Blocker** if it fixes something causing any of:

- App crash
- User cannot authenticate
- SOS cannot be triggered
- Journey safety workflow fails
- Background tracking fails
- Emergency notifications fail
- Data loss
- Security vulnerability (P0/P1)
- App Store rejection issue
- Payment/subscription failure
- Production backend outage

Only a Launch Blocker fix may bypass the normal Release Freeze review-and-wait cycle and land
immediately. Every other accepted change (categories 3, 6, 7, 9, 10 above when *not* rising to a
Launch Blocker's severity, plus routine instances of 1/2/5/8) still waits for the next scheduled
release — being an accepted category is necessary but not sufficient for immediate landing; it
must also be a Launch Blocker to jump the queue. A change that is neither an accepted category nor
a Launch Blocker is rejected outright, full stop.

Every Launch Blocker entry below must additionally state **which criterion** it satisfies, so the
bypass itself stays auditable.

## Entry format

Each accepted change gets one entry:

```
## YYYY-MM-DD — <short title>
- **Category**: <one of the 10 above>
- **Launch Blocker**: Yes (<criterion>) | No — queued for next release
- **Classification**: Critical | High | Medium | Low
- **Reason**: why this change is necessary
- **Risk**: what could go wrong
- **Files changed**: list
- **Regression risk**: assessment
- **Rollback strategy**: how to revert
- **Expected benefit**: concrete, measurable where possible
```

Rejected proposals are not listed here (this file is a log of what shipped, not a review queue) —
they're reported inline in the phase's chat summary as "Rejected Changes" per the release-freeze
final-report format.

---

Entries below this line, newest first.

## 2026-07-24 — Location & notification failure telemetry (closes both QA-phase monitoring gaps)

- **Category**: Observability improvement
- **Launch Blocker**: No — queued for next release
- **Classification**: Medium
- **Reason**: `docs/qa-certification/11-Production-Monitoring.md` identified exactly two production-failure categories with no detection mechanism: notification failures and location failures. Both subsystems fail silently by design — `getCurrentLocation()` returns `null` on permission denial and on fetch error, and every failure path in `notifications.ts` is non-fatal. That behavior is correct (a location failure must never block an SOS) but it meant production could not distinguish "user has location off" from "the OS geocoder is failing" during a live emergency. The highest-consequence case is `scheduleLocalNotification` returning `null`: that call schedules the journey-overdue notification, which is the durability backstop that fires even when the OS never wakes the JS engine — if it silently failed, that guarantee was gone and nothing reported it.
- **Risk**: Low. Two new files following the existing telemetry pattern exactly (Sentry breadcrumb, no-op without a DSN, wrapped in try/catch), plus nine call sites all placed inside existing `catch` or denial branches. Event name only — no coordinates, addresses, push tokens, or user identifiers, preserving the closed-enum payload guarantee the privacy audit relies on.
- **Files changed**: `core/analytics/locationTelemetry.ts` (new), `core/analytics/notificationTelemetry.ts` (new), `core/permissions/location.ts`, `core/permissions/notifications.ts`
- **Regression risk**: None. No control flow, return value, or branch condition changed — every path returns exactly what it returned before.
- **Rollback strategy**: Delete the two new files; revert the added lines in the two permission modules.
- **Expected benefit**: The two remaining blind spots in production monitoring are closed. A location failure during an active SOS, and a failure to schedule the journey-overdue backstop, are both detectable for the first time.

## 2026-07-24 — Maestro E2E infrastructure (authored, not yet executed)

- **Category**: Test improvement
- **Launch Blocker**: No — queued for next release
- **Classification**: Low
- **Reason**: No E2E, integration, or contract test tooling existed anywhere in the codebase (verified). Flagged P1 in the QA certification.
- **Risk**: None to production. Twelve YAML/Markdown files under `.maestro/`. Maestro installs as a standalone CLI, so **no npm dependency is added** — `package.json`, `pnpm-lock.yaml`, and the production bundle are untouched. Nothing in the app imports these files.
- **Files changed**: `.maestro/config.yaml`, `.maestro/README.md`, `.maestro/flows/01`–`10` (new)
- **Regression risk**: None — structurally incapable of affecting runtime behavior.
- **Rollback strategy**: Delete `.maestro/`.
- **Expected benefit**: A safety-gated E2E skeleton grounded in real on-screen selectors. SOS coverage is deliberately split so the CI-runnable flow cancels during the countdown and therefore never dispatches a real alert to anyone; the full-activation flow is tagged `emergency` and excluded from the default filter.
- **Honest status**: These flows have **never been executed** — no device or Maestro CLI existed in the authoring environment. They are a working skeleton, not a passing suite, and `09-Regression-Gate.md` records the E2E gate as advisory rather than passing until the suite first goes green on a real device.

## 2026-07-24 — UX/HIG/Accessibility certification: emergency-UX transparency + SOS accessibility

- **Category**: Accessibility improvement / Data-loss scenario fix
- **Launch Blocker**: No — queued for next release
- **Classification**: Medium
- **Reason**: The active-SOS UI never surfaced whether the emergency database record had actually reached the backend (silent while the existing 15s DB-write retry ran); the SOS trigger, countdown-cancel, "I'm Safe," and per-contact call/SMS/WhatsApp buttons had zero VoiceOver labels; the SOS pulse animation looped indefinitely with no Reduce Motion check; a WhatsApp button's hardcoded colors computed 1.79:1 contrast (fails WCAG AA).
- **Risk**: Low — all additive UI (a new conditional status row, new accessibility props) or a contained, single-component color swap.
- **Files changed**: `features/sos/components/SosBottomSheet.tsx`, `features/settings/locales/strings/en.ts` (new keys)
- **Regression risk**: None — no existing SOS activation/cancellation/countdown logic or timing was touched.
- **Rollback strategy**: Revert `SosBottomSheet.tsx` and drop the newly-added `en.ts` keys.
- **Expected benefit**: A user during a real emergency can now see whether their SOS record is confirmed-saved; VoiceOver users can identify and operate the SOS trigger, cancel, and per-contact actions by name; Reduce-Motion users no longer see an indefinite pulse loop; the WhatsApp button now clears WCAG AA contrast.

## 2026-07-24 — Home screen: SOS accessibility, reduce motion, Settings deep-link

- **Category**: Accessibility improvement / Reduce user error
- **Launch Blocker**: No — queued for next release
- **Classification**: Medium
- **Reason**: The home-screen SOS trigger had no VoiceOver label; its idle pulse animation looped indefinitely with no Reduce Motion check; header icon buttons (language/helpline/avatar) were under the 44pt touch-target minimum with no `hitSlop`; a denied-location user had no in-app path to fix it.
- **Risk**: Low — additive props/handlers only; new `openAppSettings()` helper is a try/caught wrapper around a documented Expo API that no-ops on web.
- **Files changed**: `app/(tabs)/index.tsx`, `shared/utils/native.ts` (new `openAppSettings()` helper)
- **Regression risk**: None — no existing SOS-trigger or navigation behavior changed.
- **Rollback strategy**: Revert both files.
- **Expected benefit**: VoiceOver-nameable SOS trigger and header controls; 44pt+ touch targets; a denied-location user can reach OS Settings in one tap instead of navigating there manually.

## 2026-07-24 — Map screen: Settings deep-link for denied location

- **Category**: Reduce user error
- **Launch Blocker**: No — queued for next release
- **Classification**: Low
- **Reason**: Both of the map screen's location-denied notices offered a "retry" action but no way to fix a *permanently* denied permission.
- **Risk**: Low — additive button only.
- **Files changed**: `app/(tabs)/map.tsx`
- **Regression risk**: None.
- **Rollback strategy**: Revert file.
- **Expected benefit**: One-tap path from a denied-location state to OS Settings.

## 2026-07-24 — Incident report: photo-remove touch target and label

- **Category**: Accessibility improvement
- **Launch Blocker**: No — queued for next release
- **Classification**: Low
- **Reason**: The photo-remove "×" button was 28×28pt with no `hitSlop` and no accessible label (existing `incident.removePhoto` translation key was unused).
- **Risk**: Low.
- **Files changed**: `app/(tabs)/incident.tsx`
- **Regression risk**: None.
- **Rollback strategy**: Revert file.
- **Expected benefit**: 44pt+ effective touch target; VoiceOver-nameable control.

## 2026-07-24 — Login: password-manager support and toggle accessibility

- **Category**: Accessibility improvement
- **Launch Blocker**: No — queued for next release
- **Classification**: Low
- **Reason**: None of the 3 password fields set `textContentType`/`autoComplete`, so OS password managers had no signal to offer saved-credential autofill or strong-password suggestions; the show/hide-password toggles had no accessible label or adequate hit area.
- **Risk**: Low — OS input hints only, no validation/submit logic touched.
- **Files changed**: `app/login.tsx`
- **Regression risk**: None.
- **Rollback strategy**: Revert file.
- **Expected benefit**: Password-manager autofill/suggestion support; VoiceOver-nameable, larger-hit-area toggle.

## 2026-07-24 — Onboarding: privacy-claim accuracy, localization, contrast

- **Category**: Confirmed bug fix / App Store compliance / Accessibility improvement
- **Launch Blocker**: No — queued for next release
- **Classification**: Medium
- **Reason**: The location-permission step claimed "never tracked in background," which is factually false (background tracking activates during an active SOS/journey by design). This and 2 sibling "trust row" strings were hardcoded English (never localized), and all 3 used a text color computing 2.54:1 contrast (fails WCAG AA).
- **Risk**: Low — content and color changes only, no logic touched.
- **Files changed**: `app/onboarding.tsx`, `features/settings/locales/strings/en.ts` (new keys)
- **Regression risk**: None.
- **Rollback strategy**: Revert both files.
- **Expected benefit**: Users are no longer told something untrue about background location use; the 3 strings are now localizable; contrast now clears WCAG AA.

## 2026-07-24 — Contacts: photo-picker failure no longer silent

- **Category**: Confirmed bug fix
- **Launch Blocker**: No — queued for next release
- **Classification**: Low
- **Reason**: A denied camera/library permission or a picker error was caught and silently swallowed — the user saw no feedback at all, a dead end.
- **Risk**: Low — one added toast call in an existing catch block.
- **Files changed**: `features/profile/hooks/useContactsScreen.ts`, `features/settings/locales/strings/en.ts` (new key)
- **Regression risk**: None.
- **Rollback strategy**: Revert the added line.
- **Expected benefit**: User gets a visible, actionable message instead of a silent no-op.

## 2026-07-24 — RTL-restart alert translation; shared Toast/Button/Chip accessibility; BackHeader label

- **Category**: Accessibility improvement / App Store compliance
- **Launch Blocker**: No — queued for next release
- **Classification**: Low
- **Reason**: The RTL-language restart `Alert.alert` was entirely hardcoded English (shown precisely when a user switches to Arabic/Urdu); toasts (the app's primary error/confirmation channel in many screens) had zero screen-reader announcement; the shared `Button`/`Chip` primitives exposed no `accessibilityState` for disabled/loading/selected; `BackHeader`'s icon-only back button (used by nearly every pushed screen) had no accessible label.
- **Risk**: Low — additive props, one dependency-array reorder to fix a declaration-order TypeScript error introduced while wiring the RTL fix (caught by `tsc`, fixed before commit).
- **Files changed**: `features/settings/context/LanguageContext.tsx`, `features/settings/context/ToastContext.tsx`, `shared/components/ui.tsx`, `shared/components/Headers.tsx`, `features/settings/locales/strings/en.ts` (new keys)
- **Regression risk**: None — `npx tsc`, `pnpm run lint` (0 errors, including a caught-and-fixed attempt to import `features/` from `shared/`, correctly blocked by the `import/no-restricted-paths` architecture-boundary rule), and `pnpm run test` all pass.
- **Rollback strategy**: Revert all 5 files.
- **Expected benefit**: RTL-switching users see a dialog they can read; every existing toast message app-wide is now screen-reader-announced; shared Button/Chip states are VoiceOver-exposed everywhere they're used; the back button on nearly every pushed screen is now nameable.

**Batch verification for all entries above**: `npx tsc -p tsconfig.json --noEmit`: 0 errors. `pnpm run lint`: 0 errors (9 pre-existing warnings, unchanged). `pnpm run test`: 100/100 passing. `npx madge --circular`: clean (215 files). `npx expo export --platform web`: builds clean. Full findings, scores, and deferred items: `docs/ux-audit/` (12 files).
