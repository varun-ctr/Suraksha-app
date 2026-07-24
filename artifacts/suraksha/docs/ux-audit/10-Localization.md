# 10. Localization

## Method

Reviewed the i18n system (`features/settings/context/LanguageContext.tsx`, 28 per-locale files under `features/settings/locales/strings/`) and sampled hardcoded-string, pluralization, RTL, and formatting behavior.

## System overview

Flat key→string lookup (`t(key)`), with a graceful fallback chain: `locale[key] ?? enLocale[key] ?? key` — a missing key in any non-English locale silently falls back to English rather than showing a raw key or crashing. This fallback is what makes it safe to add new translation keys only to `en.ts` (as this pass did in several places — see below) without breaking any other locale.

**Coverage gap, pre-existing**: `en.ts` has ~448 lines/~416 keys, `hi.ts` ~436 (near-complete), but every other locale is ~421 lines — roughly 27 keys short of English, silently falling back. Not fixed this pass (translating 27 keys across 26 languages accurately is not something that can be responsibly done without native-speaker review, and is a large, dedicated content effort, not a targeted UX fix).

## Fixed this pass

1. **Onboarding "trust row" strings were hardcoded English** (`app/onboarding.tsx`, 3 instances: "Your data stays private and encrypted," "They'll receive your SOS alerts instantly," and the background-location claim) — none routed through `t()`. Added 3 new keys (`onb.trustDataPrivate`, `onb.trustContactsNotified`, `onb.trustLocationUse`) to `en.ts` and wired all 3 call sites through `t()`. The third one was also a factual-accuracy fix — see `06-Permissions.md`.
2. **The RTL-restart `Alert.alert`** (`features/settings/context/LanguageContext.tsx`) was **entirely hardcoded English** — meaning an Arabic or Urdu user switching *to* their own RTL language would see an English "Restart required" dialog telling them to restart, in the one moment where showing untranslated text is most self-defeating. Added 6 new keys (`common.restartRequired`, `common.restartRtlBody`, `common.restartLater`, `common.restartNow`, `common.rtl`, `common.ltr`) and routed the alert through `t()`.
3. **"Alerting contacts…" in the active-SOS UI** (`SosBottomSheet.tsx`) — see `05-Errors.md` — was hardcoded; now routed through a new `sos.alertingContacts` key.
4. **New SOS status strings added this pass** (`sos.savingRecord`, `sos.recordSaved`, from `08-Emergency-UX.md`'s fix) were written directly as translation keys from the start, not hardcoded.

All 4 fixes above only add keys to `en.ts` — consistent with the existing fallback design, every other locale will show the new strings in English until a dedicated translation pass covers them, exactly as already happens for the pre-existing 27-key gap. **Category**: Reduce user error / App Store compliance (translated content accuracy). **Risk**: none — additive keys only, no existing key was renamed or removed. **Regression risk**: none. **Rollback**: remove the new keys and revert the call sites to their previous hardcoded strings.

## Found, NOT fixed this pass (too large / needs native-speaker review)

- **`app/login.tsx` (the entire sign-in/sign-up/account-linking screen) never imports the i18n system at all** — every one of its ~60 text elements, including all 6 validation-error strings in `useLoginScreen.ts`, is hardcoded English regardless of app language. This is the single largest localization gap in the app, and it's the first screen many users see. **Not attempted this pass**: retrofitting i18n into an entire screen this size, correctly, without introducing a rendering or logic regression, is a substantial, dedicated effort — well beyond what "add a few missing keys" fixes above represent, and rushing it alongside a dozen other freeze-era changes risks exactly the kind of large-diff regression Release Freeze exists to prevent. **This is the #1 recommendation for the next scheduled (non-freeze) release.**
- **Legal text (Privacy Policy, Terms) is only available in English and Hindi** (`shared/utils/legal.ts`'s `pick()` signature is `{en, hi}` only) — all other 26 UI languages silently render English legal copy. Not fixed — this needs actual translated legal text reviewed for accuracy, not a code change.
- **Pluralization is entirely absent** — `t()` has no plural-form support (not manual, not ICU), so e.g. `"sos.contactsReady": "{n} emergency contacts ready"` renders identically for 1 or 5 contacts in all 28 locales; Arabic (6 plural forms) and Russian (3 forms) get no special handling. Not fixed — adding plural support is an i18n-system-level change (arguably an architecture change to the translation layer itself), out of scope for Release Freeze.
- **Relative-time formatting** (`shared/utils/format.ts`'s `timeAgo`, used for community-report timestamps) only special-cases Hindi; all other 26 languages fall through to English "Xm ago"/"Xh ago". Not fixed for the same reason as pluralization.
- **SOS emergency SMS/WhatsApp messages hardcode `"en-IN"` for embedded date/time** (`sosAlertService.ts`, `emergencyMessage.ts`) even when the surrounding message text is in the user's selected language — so a French- or Arabic-speaking user's emergency message would contain an English/Indian-formatted date. Not fixed this pass: correctly localizing this needs to preserve the message's parseability by whoever receives it (a trusted contact who may not share the sender's language), which is a product decision, not a pure bug fix — flagged as a P1 finding for product input.
- **RTL layout readiness**: `app.config.ts` has no RTL-specific configuration; the app relies entirely on `I18nManager.forceRTL()` plus a full JS restart. Only ~8 hardcoded-direction (`marginLeft`/`Right`) style properties exist app-wide vs. 4 direction-agnostic (`marginStart`/`End`) — low absolute volume, but not verified against a real RTL device render. Not fixed — this needs actual visual verification in Arabic/Urdu/Farsi that this environment cannot provide.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors. `pnpm run test`: 100/100 passing. `npx expo export --platform web`: builds clean (all 28 locale bundles still export correctly).
