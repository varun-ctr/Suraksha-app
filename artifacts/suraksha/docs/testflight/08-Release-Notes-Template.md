# 8. Release Notes Template

## TestFlight release notes (tester-facing)

Testers of a safety app need to know what changed and what to hammer on.
"Bug fixes and improvements" is not acceptable here.

```markdown
## Build <N> — <YYYY-MM-DD>

### Please focus on
- <The 1–3 areas that changed and most need eyes>

### What's new
- <User-visible change, in user language>

### Fixed
- <Fix, described by what the user experienced, not the code>

### Known issues
See the pinned known-issues list. New this build:
- <Anything newly known-broken>

### Safety note
<Include whenever SOS, journey, permissions, or notifications changed.
 If nothing safety-relevant changed, say so explicitly: "No changes to
 emergency features in this build.">
```

### Worked example

```markdown
## Build 12 — 2026-07-24

### Please focus on
- The active-SOS screen: it now shows whether your emergency record has been
  saved. Please check it reaches "Emergency record saved" even on a poor
  connection.
- VoiceOver users: the SOS button, Cancel, and "I'm Safe" now have proper
  labels. Please confirm they read correctly.

### What's new
- The active SOS screen now tells you whether your emergency has been recorded
  on our servers, instead of leaving you guessing.
- If you have denied location access, the app now offers a direct "Open
  Settings" shortcut.

### Fixed
- Setting a contact photo failed silently when permission was denied — it now
  tells you.
- Onboarding incorrectly claimed location is "never tracked in background."
  It now accurately explains that background access is used only during an
  active SOS or journey.
- The restart prompt shown when switching to Arabic or Urdu appeared in
  English. It is now translated.

### Known issues
See the pinned list. Nothing new this build.

### Safety note
No change to how SOS is triggered, how the countdown works, or how alerts are
sent. The only SOS change is a new status indicator — it adds information,
it does not alter behavior.
```

---

## App Store release notes (public)

Shorter, user-benefit framed, no internal terminology.

```markdown
Version <X.Y.Z>

<1–3 sentences of user-facing benefit.>

• <Improvement>
• <Improvement>
• <Fix>
```

**For a safety app specifically:** never describe a security or emergency-
reliability fix in terms that tell an attacker what was wrong. "Improved
reliability of emergency alerts" is right; naming the failure mode is not.

---

## Version numbering

- `app.config.ts` holds `version` (marketing), `ios.buildNumber`, and
  `android.versionCode`.
- `eas.json`'s `production` profile sets `autoIncrement: true`, so build
  numbers advance automatically. Confirm it actually incremented rather than
  assuming.
- Bump the marketing `version` deliberately for user-visible releases; let
  build numbers move on their own.
