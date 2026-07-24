# 1. Apple Human Interface Guidelines

## Method

Reviewed under Release Freeze — no navigation, architecture, or visual-redesign changes were in scope unless directly justified by HIG compliance, accessibility, or emergency usability. Findings below cite real file:line evidence gathered from a dedicated research pass across representative screens (home, map, SOS bottom sheet, profile, settings, incident report, community, sakhi chat, auth/login) plus the shared UI primitives and theme system. No Instruments/Xcode session was available in this environment — every finding is a structural/code-level fact, not a device measurement.

## Typography

No centralized type-scale token file exists; `fontSize` is a raw literal at ~340 call sites (e.g. `shared/components/ui.tsx:193` `small ? 13 : 14.5`; `SosBottomSheet.tsx` uses `12.5`/`10.5`/`11.5`). Font family is consistent (`Inter_400/500/600/700`, loaded once in `app/_layout.tsx`). **Assessment**: inconsistency-of-scale gap, but not a HIG violation (HIG requires legible, consistent hierarchy, not a specific scale) — cosmetic, out of scope for freeze; the 340-site migration this would require is disproportionate to a freeze-era pass. **Not changed.**

## Spacing

No spacing-token constant exists; `18`/`14`/`16` recur informally as a de facto convention but nothing enforces it. Same disposition as typography: real but cosmetic, **not changed**.

## Navigation patterns

Root `Stack` (`app/_layout.tsx:87-102`) never sets `gestureEnabled: false` or `presentation: "modal"` anywhere in the app — native iOS swipe-back is preserved on every screen. **Compliant, no gap.**

## Modal presentation & bottom sheets

`SosBottomSheet.tsx`'s backdrop has no tap-to-dismiss and its drag handle (`styles.handle`) is decorative only (no `PanResponder`). This is assessed as **intentional safety design** — an emergency sheet should not be dismissible by an accidental stray tap or gesture — and is called out here rather than "fixed." Other modals (profile edit/delete-account, `app/(tabs)/profile.tsx`) use `Modal` with correct backdrop-dismiss and Cancel-first ordering. **No change made**; the SOS sheet's non-dismissibility is a reviewed, deliberate exception documented for the certification record.

## Alerts & action sheets

All 3 `Alert.alert` call sites (`app/sessions.tsx:110-121` sign-out, `LanguageContext.tsx` RTL-restart, `useContactsScreen.ts` photo-source picker) mark destructive actions with `style: "destructive"` and place Cancel first. The 2-step "type DELETE to confirm" account-deletion flow (`app/(tabs)/profile.tsx:472+`) exceeds baseline expectations for a high-consequence action. **Compliant, no gap.**

## Status indicators

Loading/success/error/connection states are consistently communicated with icon + text + color (never color alone) — `SmsBadge`/`Badge` in `SosBottomSheet.tsx:39-58`, `ToastContext.tsx`. **Compliant.**

## Tab navigation

`app/(tabs)/_layout.tsx`: 5 standard tabs plus a raised, custom `SakhiFABButton` (58×58, elevated) replacing the 6th tab slot via `tabBarButton` override. This is a recognizable pattern in Android/Material design but **not a native iOS `UITabBar` precedent** (Apple's own tab bar HIG has no raised-FAB convention). **Flagged as a HIG deviation, not changed** — reworking the tab bar structure would be a navigation-architecture change, explicitly out of scope under Release Freeze.

## Large titles / headers

No screen uses `headerLargeTitle`; all screens use one of two shared header components (`GradientHeader`, `BackHeader` — `shared/components/Headers.tsx`), applied uniformly. Diverges from native large-title/collapsing-header convention, but the divergence is **consistent app-wide**, which is what matters most for a HIG grade. **Not changed** — adopting native large titles would be a header-architecture change, out of scope.

## Safe areas

`useSafeAreaInsets` is used directly in 15+ files, and every screen that doesn't call it directly goes through `BackHeader`/`GradientHeader`, which handle insets internally. Coverage is effectively universal. **Compliant, no gap.**

## Fixed this pass (justified under Release Freeze)

- `shared/components/Headers.tsx`: `BackHeader`'s icon-only back button had zero accessible name — added `accessibilityRole="button"` + `accessibilityLabel` (hardcoded "Go back", not routed through i18n — `shared/` cannot import `features/` under the dependency-boundary rule enforced by `import/no-restricted-paths`; matches the existing hardcoded `headerBackTitle: "Back"` convention in `app/_layout.tsx`). **Category**: Accessibility. **Risk**: none — purely additive prop, used by nearly every pushed screen. **Regression risk**: none (no visual change). **Rollback**: revert the one-line addition.

## Per-screen HIG scores (evidence-based, not a device walkthrough)

| Screen | Score /10 | Note |
|---|---|---|
| Home | 8 | Consistent header pattern, safe areas correct; type/spacing not tokenized |
| Map | 8 | Same; disabled native compass/recenter button with no substitute (see `07-Maps.md`) |
| SOS bottom sheet | 8.5 | Deliberately non-dismissible by design; otherwise well-structured |
| Profile/Settings | 8 | Correct modal/destructive-action conventions |
| Incident report | 7.5 | Functional but no large-title/native form conventions |
| Auth/Login | 7 | Functionally sound; lowest score reflects the unlocalized-string finding (see `10-Localization.md`), not a HIG defect |
| Tab bar | 7 | Raised FAB tab is the one real, documented HIG deviation |

**Overall HIG score: see `12-UX-Certification.md`.**
