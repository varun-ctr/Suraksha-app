# 5. Error Handling UX

## Method

Traced every error path across auth, SOS, journey, community/incident reports, profile, premium/purchases, and settings to its rendering site — checking specifically for raw technical text leaking to the UI, and for dead ends (an error shown with no way forward).

## What was already correct — the safety-critical paths are the most hardened

- **Auth**: Firebase errors are mapped via a `switch` on `error.code` (`repositories/firebase/firebaseAuth.ts:349-376`) to plain-language strings with a safe default ("Something went wrong. Please try again.") — never a raw code. Email-OTP errors go through a typed mapper (`repositories/api/emailOtpErrorMapper.ts`) before reaching the UI. Retry/resend affordances exist with a 30s cooldown.
- **Premium/purchases**: the service layer (`purchasesService.ts`) does capture the raw RevenueCat/StoreKit error message, but the UI (`usePremiumScreen.ts:107-123`) never displays it — it shows a generic, translated `premium.purchaseFailed` toast instead, with retry/restore both available. No leak, no dead end.
- **Community/incident reports** (`useIncidentScreen.ts`): distinct, actionable toasts for no-location, not-signed-in, and rate-limited states — each maps to a concrete next step (enable GPS, sign in, wait and retry).
- **SOS/journey**: DB-write failures are logged and auto-retried every 15 seconds indefinitely (`SafetyContext.tsx:297-317`, the reliability fix from the prior performance-certification phase) without ever blocking the emergency UI — the correct behavior for this domain.

## Fixed this pass

1. **Silent photo-picker failure** (`features/profile/hooks/useContactsScreen.ts`): the camera/library picker's `catch` block was empty (`// ignore`) — a denied permission or picker error left the user staring at an unchanged screen with zero feedback, a genuine dead end. Now shows `t("contacts.photoFailed")` via the existing toast system. **Category**: Fix a confirmed bug / reduce user error. **Risk**: none — the catch block already existed, this only adds a user-visible consequence to it. **Regression risk**: none. **Rollback**: revert the one added line.
2. **No visibility into SOS record status** (`features/sos/components/SosBottomSheet.tsx`): the active-SOS UI never surfaced whether the emergency's database record had actually reached the backend versus still silently retrying (`sos.eventId` was tracked in state but never rendered). Added a status row in the location panel: "Saving emergency record…" while `sos.eventId` is null, "Emergency record saved" once confirmed — mirroring the existing live-tracking-status pattern already used two lines above it. **Category**: Emergency usability / data-loss-scenario transparency. **Risk**: low — purely additive UI, reads an already-existing state field. **Regression risk**: none (no existing behavior changed, only a new conditional row added). **Rollback**: remove the added `View`/`Text` block. See `08-Emergency-UX.md` for the full emergency-UX framing of this fix.
3. **Hardcoded "Alerting contacts…" string** (`SosBottomSheet.tsx:197`): was plain English regardless of app language; routed through a new `sos.alertingContacts` translation key (falls back to English for the 26 locales that don't yet have a translated value, same graceful-fallback behavior the i18n system already uses everywhere else). **Category**: Reduce user error / localization consistency. **Risk**: none.

## Reviewed, not changed

- **Toast auto-dismiss with no retry affordance baked into the toast itself** (`ToastContext.tsx`, 2.2s auto-dismiss): acceptable for confirmations; for errors, the underlying screens already provide their own retry buttons (map refresh, Sakhi chat retry, incident resubmit) rather than relying on the toast itself to carry a retry action — reviewed as adequate, not a gap.
- **`incident.error`'s catch-all message** ("Could not submit. Check your connection and try again.") swallows the real exception for any failure mode not covered by the more specific toasts (no-location/not-signed-in/rate-limited). Not changed — surfacing more specific messages here would require broader error-classification work in `useIncidentScreen.ts` beyond a freeze-appropriate scope; flagged as a P2 finding for a future pass.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors. `pnpm run test`: 100/100 passing.
