# 2. Accessibility (WCAG 2.2 AA / VoiceOver / TalkBack)

## Method

Grep-and-read audit across the shared UI primitives (`shared/components/ui.tsx`), the SOS trigger and active-SOS UI, the tab bar, icon-only controls app-wide, and the theme's color tokens. No VoiceOver/TalkBack device session or Xcode Accessibility Inspector was available in this environment — contrast ratios below were computed directly from the theme's actual hex values (WCAG relative-luminance formula), not estimated.

## Before this pass — the gap

App-wide: 6 `accessibilityLabel`, 5 `accessibilityRole`, 0 `accessibilityHint`, 5 `accessibilityState` occurrences total, vs. 24 files using `Pressable` (no `TouchableOpacity` anywhere). Zero uses of `AccessibilityInfo` for reduce-motion, live-region announcements, or focus management. The best-implemented control in the app, by a wide margin, was already the custom `SakhiFABButton` tab (`app/(tabs)/_layout.tsx:19-58`), which had `accessibilityRole`, `accessibilityLabel`, and `accessibilityState` from a prior phase.

## Fixed this pass

All items below are additive props or narrow content/behavior fixes — no visual redesign, no navigation change.

1. **SOS trigger button** (`app/(tabs)/index.tsx`, `HoldSOSButton`): added `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityHint` to the single most safety-critical control in the app, which previously had none.
2. **SOS countdown Cancel button and "I'm Safe" button** (`features/sos/components/SosBottomSheet.tsx`): added role/label/hint to both — the two controls a user under stress most needs VoiceOver to name correctly.
3. **Per-contact Call/SMS/WhatsApp buttons** (`SosBottomSheet.tsx`): added `accessibilityLabel` that includes the contact's name (e.g. "Call Priya") — previously every contact's three action buttons announced identically ("Call button", "SMS button"...) with no way for a VoiceOver user to tell which contact they were about to act on.
4. **Icon-only header controls** (`app/(tabs)/index.tsx`): language-picker, helpline, and avatar/profile buttons in the home-screen header gained `accessibilityRole`/`accessibilityLabel` (sourced from existing translation keys — `home.selectLanguage`, `helpline.title`, `tab.profile`) plus `hitSlop={8}` where missing.
5. **`BackHeader`'s back button** (`shared/components/Headers.tsx`) — used by nearly every pushed screen — gained a label (see `01-HIG.md` for why it's hardcoded rather than translated).
6. **Incident photo-remove button** (`app/(tabs)/incident.tsx`): added `hitSlop={10}` and `accessibilityLabel` (existing `incident.removePhoto` key, previously unused).
7. **Password show/hide toggles** (`app/login.tsx`, 2 instances): added `accessibilityRole`, `accessibilityLabel` ("Show/Hide password"), and enlarged the touch target via `paddingVertical`/`paddingLeft`/`hitSlop`.
8. **Shared `Button` and `Chip` primitives** (`shared/components/ui.tsx`): `Button` gained `accessibilityRole`, `accessibilityLabel`, and `accessibilityState={{ disabled, busy: loading }}` — previously a disabled/loading button gave VoiceOver no indication of either state. `Chip` gained `accessibilityState={{ selected: active }}` — previously an active category/incident-type chip was visually color-coded only, with no VoiceOver-exposed selected state.
9. **Toast announcements** (`features/settings/context/ToastContext.tsx`): added `AccessibilityInfo.announceForAccessibility(msg)` on every `showToast` call, plus `accessibilityLiveRegion="polite"` on the toast view. Toasts are the app's primary channel for many error/confirmation messages (incident submission, contact save, offline errors) and previously had **zero** screen-reader announcement — a VoiceOver/TalkBack user had to blindly discover a toast had appeared.
10. **Reduce Motion**: two indefinitely-looping decorative animations — the SOS pulse ring (`SosBottomSheet.tsx`) and the home-screen SOS button's idle pulse (`app/(tabs)/index.tsx`) — now check `AccessibilityInfo.isReduceMotionEnabled()` on mount and subscribe to `reduceMotionChanged`, skipping the loop entirely when the setting is on. This was the one **uncontroversial, zero-ambiguity** accessibility gap found: no code path anywhere in the app previously checked this OS setting at all.
11. **WhatsApp mini-button contrast** (`SosBottomSheet.tsx`): the hardcoded `#25D366` (WhatsApp brand green) on `#E7F7EE` background computed to **1.79:1** — a severe WCAG failure. Changed to `#0E7A3D` on the same background, computed at **4.89:1** (clears AA's 4.5:1 normal-text threshold). Scoped to this one hardcoded, non-theme color pair; the shared theme tokens were not touched.
12. **Onboarding "trust row" text** (`app/onboarding.tsx`, 3 instances): `c.textFaint` (computed **2.54:1** on light backgrounds, fails AA) swapped to `c.textMuted` (computed **4.83:1**, passes). Scoped to these 3 specific instances, not the shared `textFaint` token.

## Reviewed, found low-risk-to-fix-but-out-of-scope this pass

- **`textFaint` token contrast** (`shared/theme/colors.ts`): computed at 2.54:1 (light) / 3.07:1 (dark) against card/bg — fails WCAG AA for normal-size text. Used broadly: tab-bar inactive tint, legal-page "last updated" text, incident address/timestamp text. **Not changed globally** — this token has dozens of call sites app-wide (per the research pass), and a blanket recolor carries real, hard-to-verify-without-a-device visual regression risk across every screen simultaneously. The 3 onboarding instances were fixed locally (above) because they were already being touched for a copy-accuracy fix; the token itself is flagged as a P1 finding requiring a dedicated pass with real-device/Instruments color verification before a global change is made.
- Tab-bar inactive-tab low contrast specifically: **reviewed and deliberately not changed** — de-emphasizing inactive tabs relative to the active one is itself an Apple-endorsed pattern (iOS's own system tab bar uses a similarly muted inactive tint), so a blind WCAG-only fix here would work against HIG-recommended visual hierarchy. Documented as a reviewed tension between the two conventions, not an oversight.
- **`danger` red (`#EF4444`) on white, 3.76:1**, used for small action-button text (e.g. "Call Emergency 112"): fails AA for normal-size text. Not changed — `danger` is the app's single, brand-load-bearing "emergency red," reused for the SOS button, alerts, and destructive actions; a token-level change here has much higher signal-recognition risk in an emergency-safety app than the WhatsApp-button fix above (which was scoped to one hardcoded, non-brand color pair). Flagged as a P1 finding: the correct fix is per-site (use `danger` only for icon+bold/large text or icon+colored-background combinations, not small plain text), which needs a screen-by-screen pass, not a token swap.
- **Focus management**: no modal/bottom sheet anywhere moves VoiceOver focus into new content or traps it (confirmed zero `AccessibilityInfo.setAccessibilityFocus`/`importantForAccessibility` usage). Not implemented this pass — doing this correctly for the SOS sheet specifically needs real-device VoiceOver verification to avoid trapping focus during a genuine emergency, which this environment cannot provide. Flagged as a P1 finding for a real-device-validated pass.
- **Dynamic Type overflow risk**: no `maxFontSizeMultiplier` exists anywhere; several fixed-size circular containers with matched `lineHeight` (SOS button, countdown number) could clip text at very large Dynamic Type settings. Not fixed — the correct cap value can't be responsibly chosen without visually verifying the largest accessibility text sizes on a real device.

## Touch target audit (44×44pt HIG minimum)

| Control | Size found | hitSlop before | Status |
|---|---|---|---|
| SOS button (`sosCircle`) | 164×164 | n/a | Compliant |
| Tab bar cells | full-width, ~58px+ tall | n/a | Compliant |
| Language-flag button | 38×38 | 8 | Compliant (54×54 effective) |
| Bell/helpline button | 38×38 | **none → added 8** | **Fixed this pass** |
| Avatar button | 40×40 | **none → added 8** | **Fixed this pass** |
| `BackHeader` back button | 34×34 | 10 | Compliant (54×54 effective) |
| Incident photo-remove "×" | 28×28 | **none → added 10** | **Fixed this pass** |
| Password eye-toggle | icon-only, no box | **none → added 8 + padding** | **Fixed this pass** |

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors (9 pre-existing warnings, unchanged). `pnpm run test`: 100/100 passing. `npx madge --circular`: clean.
