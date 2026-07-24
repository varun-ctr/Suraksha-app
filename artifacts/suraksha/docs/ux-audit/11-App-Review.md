# 11. App Store Review Readiness

## Method

Scanned for placeholder/unfinished text, legal-link presence and correctness, premium/subscription messaging completeness, permission-string specificity, and onboarding-flow dead ends.

## Findings — reviewed, none required a code change this pass

- **`"premium.comingSoon"`** ("Premium is not yet available. These features are planned for a future update.") renders unconditionally on the premium screen whenever that card is shown. Whether this is accurate depends entirely on the current, real-world launch status of the premium tier — a product decision this engineering pass cannot make on its own. **Not changed** — flagged for product confirmation before submission; if premium *is* live, this string needs to be removed/updated by whoever owns that decision, not guessed at here.
- **Build-config placeholder fallbacks** (`app.config.ts`: `backendUrl` falls back to `"https://example.com"`, `easProjectId` falls back to `"TODO_EAS_PROJECT_ID"`): these are correctly meant to be overridden by real environment variables/CI secrets at build time. **Not changed** — there is no legitimate real value this engineering pass could substitute; the correct action is verifying these are actually injected at the real submission build, which is a release-ops checklist item, not a code fix. Flagged prominently so it isn't missed before submission.
- **Restore Purchases button**: present (`app/premium.tsx`), required by Apple — confirmed, not a gap.
- **Auto-renewal/cancellation disclosure**: present ("Payment is charged to your App Store or Google Play account. Cancel anytime from your store account.") — meets Apple's disclosure requirement, though brief. Not changed — no confirmed deficiency, just noted as adequate rather than exemplary.
- **Permission usage strings** (`app.config.ts`): location, background location, photos/camera, contacts, and Face ID strings are all specific and non-generic (e.g. the location string explains the 3 concrete uses: SOS sharing, nearby-place display, incident-report attachment) — this reads as compliant with Apple's specificity requirement. **No gap found.**
- **Support/legal links**: `mailto:support@suraksha.in` and `https://suraksha.in` are real, non-placeholder URLs. **No gap found** at the link-presence level (legal-text *translation coverage* is a separate, already-documented gap — see `10-Localization.md`).
- **Onboarding flow**: navigation was not found to reference any broken route; the flow's completeness issue is the untranslated/inaccurate copy already fixed in `06-Permissions.md` and `10-Localization.md`, not a structural dead end.

## Assessment

No placeholder text, broken flow, or missing legal link was found that both (a) is a genuine App Store rejection risk and (b) has a responsible code-level fix available in this pass. The two items flagged above (premium "coming soon" copy, build-config placeholders) require a product/release-ops decision, not an engineering change — surfacing them clearly here is the correct action under "do not invent problems, do not fix what isn't actually broken."

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors. `pnpm run test`: 100/100 passing. No code changed for this section specifically.
