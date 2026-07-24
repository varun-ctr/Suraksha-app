# 3. Forms & Inputs

## Method

Read every text input across auth (login/signup/OTP/account-linking), profile edit, and incident report.

## What was already correct

- **Email fields** consistently use `keyboardType="email-address"` + `autoCapitalize="none"` (`app/login.tsx:576-577`, `app/(tabs)/profile.tsx:454-455`).
- **Phone fields** consistently use `keyboardType="phone-pad"` (`app/(tabs)/profile.tsx:446`, `app/onboarding.tsx:255`).
- **OTP field** correctly uses `textContentType="oneTimeCode"` + `autoComplete="one-time-code"` (`app/login.tsx:323-324`) for SMS autofill — this is the one field that was already fully HIG-compliant for its input type.
- **Return-key behavior** is set purposefully per field (`returnKeyType="next"`/`"done"`, wired to the correct submit handler via `onSubmitEditing`).

## Fixed this pass

**Gap found**: none of the 3 password fields in the app (sign-in/sign-up password, confirm-password, account-linking password) had `textContentType` or `autoComplete` set — meaning iOS/Android password managers had no signal to offer saved-credential autofill or strong-password suggestions, despite `secureTextEntry` being set correctly on all three.

- `app/login.tsx` sign-in/sign-up password field: `textContentType={mode === "signup" ? "newPassword" : "password"}`, `autoComplete={mode === "signup" ? "password-new" : "password"}` (the field is shared between both modes, so the value is now mode-aware).
- Confirm-password field (signup only): `textContentType="newPassword"`, `autoComplete="password-new"`.
- Account-linking password field: `textContentType="password"`, `autoComplete="password"`.

**Category**: Reduces user error / HIG forms compliance. **Risk**: none — these are OS-input hints with no effect on validation logic or submit behavior. **Regression risk**: none. **Rollback**: remove the two props per field.

Also fixed alongside the password-toggle accessibility work (see `02-Accessibility.md`): the show/hide-password eye icons gained `hitSlop` and a proper accessible label, which doubles as a forms-usability fix (previously an icon-only tap target with no name or generous hit area).

## Validation & error messaging — reviewed

- Error banners (`login.tsx` sign-in error, OTP error) render inline, in plain language, mapped through `repositories/firebase/firebaseAuth.ts:349-376`'s error-code switch (never a raw Firebase/Supabase error string) — see `05-Errors.md` for the full error-handling review.
- **Gap not fixed this pass**: inline validation/error text has no `accessibilityLiveRegion`/`accessibilityRole="alert"` of its own (distinct from the toast-announcement fix in `02-Accessibility.md`, which covers toast-based errors only). A VoiceOver user must manually discover an inline error banner by swiping to it. Not fixed here because the correct implementation (live-region vs. explicit `AccessibilityInfo.setAccessibilityFocus` vs. announcement) needs to be verified against how each specific screen already structures its error state, and this environment cannot verify the VoiceOver experience live. Flagged as a P1/P2 finding for a follow-up pass.

## Localization gap (cross-referenced, not re-fixed here)

`app/login.tsx` — the entire sign-in/sign-up screen, including all labels, placeholders, and 6 validation-error strings in `useLoginScreen.ts` — is hardcoded English, never routed through the app's i18n system. This is a significant, high-visibility gap (it's the first screen for any non-English-selecting user) but is a large, dedicated localization effort (60+ strings), not a forms-mechanics fix — see `10-Localization.md` for the full finding and why it's deferred rather than attempted piecemeal this pass.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors. `pnpm run test`: 100/100 passing.
