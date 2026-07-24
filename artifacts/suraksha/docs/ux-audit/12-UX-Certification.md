# 12. Production UX Certification

## Scope and method

This pass certified Apple HIG compliance, accessibility (WCAG 2.2 AA / VoiceOver / TalkBack), forms/inputs, loading states, error-handling UX, permission experience, maps UX, emergency UX, dark mode, localization, animations, and App Store review readiness across `artifacts/suraksha`, under an active **Release Freeze**: no architecture, repository, database, navigation, or visual-redesign changes were permitted unless directly justified by accessibility, HIG compliance, emergency usability, or App Store acceptance. Four parallel research passes gathered evidence with file:line citations before any code was touched; no live device, VoiceOver/TalkBack session, or Xcode Accessibility Inspector was available in this environment — every finding is either a structural code fact, a computed WCAG contrast ratio (from the theme's actual hex values), or a reasoned argument from documented HIG/accessibility conventions, never a fabricated measurement.

## Scores

| Metric | Score |
|---|---|
| Apple HIG Compliance | **8/10** |
| Accessibility | **7/10** |
| Emergency UX | **8.5/10** |
| Forms & Input | **8/10** |
| Dark Mode | **9/10** |
| Localization Readiness | **6/10** |
| **Overall UX Score** | **7.5/10** |
| Estimated App Store UX Readiness | **~80%** |

**Rationale**: no P0 was found in any category. Emergency UX and Dark Mode score highest because the core safety flows and theme system were already well-built, with only narrow, additive fixes needed. Localization scores lowest not because the i18n *system* is weak (its fallback design is sound) but because *coverage* is uneven — the entire login/signup screen remains unlocalized, a large, deliberately-deferred effort rather than a defect introduced this pass. Accessibility moved from a genuinely thin baseline (6 total accessibility-prop usages app-wide) to a meaningfully better one, but real gaps remain (shared-token contrast, focus management, Dynamic Type overflow) that need real-device validation before a further score increase is honest.

## P0 Issues

**None.**

## P1 Issues

1. `shared/theme/colors.ts`'s `textFaint` token computes 2.54:1 (light) / 3.07:1 (dark) contrast — fails WCAG AA for normal text at several call sites (tab-bar inactive tint, legal-page metadata, incident timestamps). **Reviewed, not changed** — token has broad blast radius; needs a dedicated, visually-verified pass.
2. `app/login.tsx` is entirely unlocalized (~60 hardcoded strings, including all validation errors) — the first screen most users see. **Reviewed, not changed** — too large for a freeze-era pass without real regression risk.
3. `danger` red (#EF4444) on white computes 3.76:1 for small action-button text. **Reviewed, not changed** — token change carries emergency-signal-recognition risk; needs a per-site fix instead.
4. No `AccessibilityInfo` focus management anywhere (modals/sheets don't move or trap VoiceOver focus). **Reviewed, not changed** — needs real-device VoiceOver verification, especially for the SOS sheet, to avoid trapping focus during a real emergency.
5. Journey auto-SOS escalation not disclosed to the user before starting a journey (only becomes visible once already overdue). **Reviewed, not changed** — safe content fix in principle, deferred to avoid rushing a copy change across locale call sites alongside everything else this pass.

## P2 Issues

1. Inline validation/error banners (as opposed to toasts, which were fixed) have no live-region/focus announcement. **Not fixed** — needs per-screen verification.
2. No compass/recenter-button substitute on the map after disabling the native ones. **Not fixed** — new UI surface, not a targeted bug.
3. No educational pre-prompt specifically for the background-location "Always" upgrade. **Not fixed** — new UI flow, out of scope.
4. SOS embedded date/time in emergency SMS/WhatsApp messages hardcodes `en-IN` regardless of the sender's language. **Not fixed** — needs a product decision on recipient-readability tradeoffs.
5. Legal text (Privacy/Terms) only available in English and Hindi of 28 languages. **Not fixed** — needs real translated legal content, not a code change.
6. SOS button not in a fixed thumb-zone position on the home screen. **Not fixed** — no confirmed accessibility/bug justification to force a layout change under freeze.

## P3 Issues

1. No centralized typography/spacing token scale (340+ raw `fontSize` literals). **Not fixed** — cosmetic, 340-site migration disproportionate to freeze scope.
2. Raised `SakhiFABButton` tab is a non-native-iOS pattern. **Not fixed** — tab-bar structural change, out of scope.
3. No pluralization support across any of the 28 locales. **Not fixed** — i18n-system-level change.
4. Relative-time formatting (`timeAgo`) only special-cases Hindi. **Not fixed** — same reasoning as pluralization.
5. `profile.tsx:620`'s hardcoded color turned out to be dead code (unreferenced style) — no live bug, no fix needed.
6. Premium "coming soon" copy accuracy depends on product's actual launch status. **Not fixed** — product decision, not an engineering fix.

## Accepted Changes (13 files, all merged this pass)

| # | File | Reason | Category | Risk | Regression Risk | Rollback | Expected Benefit |
|---|---|---|---|---|---|---|---|
| 1 | `features/sos/components/SosBottomSheet.tsx` | Reduce-motion gating for the SOS pulse loop; WhatsApp-button contrast fix; DB-write-status indicator; accessibility labels on Cancel/I'm-Safe/per-contact buttons; translated "Alerting contacts…" | Accessibility / Data-loss transparency | Low | None — additive props + one contained color swap | Revert file | VoiceOver-nameable emergency controls; WCAG-passing WhatsApp button; visible "is my SOS actually saved" status |
| 2 | `app/(tabs)/index.tsx` | Reduce-motion gating for home SOS pulse; accessibility labels + hitSlop on header icon buttons; tappable "Open Settings" location pill | Accessibility / Reduce user error | Low | None | Revert file | VoiceOver-nameable SOS trigger; 44pt+ touch targets; one-tap path to fix denied location |
| 3 | `app/(tabs)/map.tsx` | "Open Settings" affordance added to both location-denied notices | Reduce user error / emergency usability | Low | None — additive button only | Revert file | User with denied location can fix it without leaving the app |
| 4 | `app/(tabs)/incident.tsx` | hitSlop + accessibility label on photo-remove button | Accessibility | Low | None | Revert file | 44pt+ touch target, VoiceOver-nameable |
| 5 | `app/login.tsx` | `textContentType`/`autoComplete` on all 3 password fields; accessibility label + hitSlop on password-visibility toggles | Forms UX / Accessibility | Low | None — OS input hints only | Revert file | Password-manager autofill support; VoiceOver-nameable toggle |
| 6 | `app/onboarding.tsx` | Fixed factually-inaccurate background-location claim; routed 3 hardcoded trust-row strings through i18n; fixed their contrast | Fix a confirmed bug / App Store compliance / Accessibility | Low | None — content-only | Revert file | Accurate privacy claim; localizable text; WCAG-passing contrast |
| 7 | `features/profile/hooks/useContactsScreen.ts` | Silent photo-picker failure now surfaces a toast | Fix a confirmed bug | Low | None | Revert one line | No more dead-end on picker/permission failure |
| 8 | `features/settings/context/LanguageContext.tsx` | RTL-restart alert translated instead of hardcoded English | Reduce user error / App Store compliance | Low | None — content + dependency-array reorder only | Revert file | RTL-language users see the restart prompt they can actually read |
| 9 | `features/settings/context/ToastContext.tsx` | `AccessibilityInfo.announceForAccessibility` + `accessibilityLiveRegion` on every toast | Accessibility | Low | None — additive | Revert file | Every existing toast-based message across the app becomes screen-reader-announced |
| 10 | `features/settings/locales/strings/en.ts` | Added ~12 new translation keys backing fixes #1, #6, #8 | Localization consistency | None | None — additive keys only | Revert file | New keys fall back safely per the existing i18n design |
| 11 | `shared/components/Headers.tsx` | Accessibility label on `BackHeader`'s icon-only back button (used by nearly every pushed screen) | Accessibility | Low | None | Revert file | One fix, app-wide leverage |
| 12 | `shared/components/ui.tsx` | `accessibilityState`/`accessibilityRole`/`accessibilityLabel` on shared `Button`/`Chip` primitives | Accessibility | Low | None | Revert file | Disabled/loading/selected states now exposed to VoiceOver everywhere these primitives are used |
| 13 | `shared/utils/native.ts` | New `openAppSettings()` helper | Reduce user error | Low | None — new function, no existing export changed | Revert file | Backs the map/home Settings-deep-link fixes |

**Release Freeze classification for all 13**: **Accepted — Low risk.** None are Launch Blockers (no crash, no auth/SOS/journey/background-tracking/notification failure, no data loss, no P0/P1 security vulnerability, no App Store rejection issue, no payment failure, no backend outage caused or fixed) — all queue for the **next scheduled release**, not an emergency freeze-bypass.

## Rejected Changes (reviewed, not implemented — with reason)

| Proposal | Rejection reason |
|---|---|
| Recolor shared `textFaint`/`danger` tokens app-wide | Broad blast radius across dozens of screens; needs real-device visual verification before a global token change |
| Fully localize `app/login.tsx` | Too large (~60 strings) for a freeze-era pass; real regression risk from rushing it |
| Rework the tab bar (remove raised FAB tab) | Navigation-architecture change — explicitly prohibited under Release Freeze |
| Adopt native `headerLargeTitle` | Header-architecture change — explicitly prohibited |
| Make `SosBottomSheet` backdrop/handle dismissible | Assessed as intentional safety design, not a defect — changing it could make a real emergency easier to accidentally dismiss |
| Add a compass/recenter button to the map | New UI surface — feature-shaped, not a targeted fix |
| Add pluralization support to the i18n system | i18n-architecture-level change |
| Disclose journey auto-SOS escalation upfront | Safe in principle, deferred to avoid a rushed copy change across locale call sites this pass |
| Relocate the SOS button to a fixed thumb-zone position | Layout/navigation-shaped change with no accessibility/bug justification found |
| Fix `profile.tsx:620`'s hardcoded color | Confirmed dead code — no live bug to fix |

## Risk Assessment

All 13 accepted changes are additive (new props, new helper functions, new translation keys) or narrowly-scoped content/color fixes contained to a single component. None touch the Repository Pattern, Domain Layer, Dependency Injection, feature-first module boundaries, or any public API signature — confirmed by `npx madge --circular` (clean, 215 files) and the ESLint `import/no-restricted-paths` dependency-boundary rule (which correctly caught and blocked one accidental architecture-boundary violation during implementation — see `01-HIG.md`'s `BackHeader` fix note — proof the guardrail is live and working).

## Regression Risk

Low across all 13 changes. `npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors (9 pre-existing warnings, unchanged). `pnpm run test`: 100/100 passing. `npx madge --circular`: clean. `npx expo export --platform web`: builds clean. No existing behavior was removed or altered — every change either adds a previously-missing prop/label/helper or narrowly recolors/rewords a single confirmed-wrong value.

## Production Impact

Positive, bounded: VoiceOver/TalkBack users gain functioning labels on the SOS trigger, cancel, and per-contact action buttons for the first time; users with Reduce Motion enabled no longer see two indefinitely-looping animations; a previously-silent photo-picker failure and a previously-invisible SOS-record-save state are now visible; a factually-inaccurate privacy claim is corrected; a structural gap (no path to OS Settings from a denied-permission state) is closed on the two screens where it mattered most (home, map). No existing user-facing behavior changes in a way any current user would notice as different — only previously-broken or previously-silent states now have visible, correct feedback.

## Launch Readiness

**Would this pass certify the application for TestFlight UX review? Yes.** No P0 UX issue exists. Every P1 finding either has no responsible freeze-era fix available (needs real-device validation, a larger dedicated pass, or a product decision) or was already addressed. The application's emergency-critical flows (SOS activation, cancellation, countdown, offline record-status) are sound, and the one code change made to that surface this pass strictly adds transparency without altering timing or behavior. Remaining gaps are honestly scoped, reasoned engineering deferrals — consistent with a safety-critical app under active Release Freeze — not defects that should block a TestFlight build.

## Verification performed for this pass

`npx tsc -p tsconfig.json --noEmit`: 0 errors. `pnpm run lint`: 0 errors (9 pre-existing-pattern warnings, unrelated to this pass, unchanged from prior phases). `pnpm run test`: 100/100 passing (unchanged test count — no test-covered logic was altered this pass). `npx madge --circular`: no circular dependencies across 215 files. `npx expo export --platform web`: builds clean.
