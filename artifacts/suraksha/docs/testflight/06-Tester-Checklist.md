# 6. Tester Checklists

## Onboarding — read this first (all testers)

**What this app is.** Suraksha is a personal-safety app. Its core features are
SOS emergency alerting and journey ("walk with me") tracking.

**The one safety rule.** Tapping SOS starts a 3-second countdown. If you let it
finish, the app sends **real messages to whatever contacts you have added**.

> Before testing SOS, add only phone numbers **you personally control** as
> trusted contacts. Do not use a family member's real number "to see if it
> works." It will work.

To exercise SOS without messaging anyone, cancel during the 3-second countdown.

**What to expect.**
- The app will ask for location, notification, and contacts permissions. Testing
  what happens when you **deny** them is as valuable as testing when you allow.
- Background location activates only during an active SOS or journey.
- Some strings appear in English even when another language is selected. This is
  a known, documented gap (`docs/ux-audit/10-Localization.md`) — please do not
  file it repeatedly.

**Reporting.** Use `07-Bug-Report-Template.md`. Include your device model and OS
version every time.

---

## Internal tester checklist

Assumes access to a staging backend and a disposable account.

### Every build
- [ ] `04-Smoke-Test.md` in full (15 min)
- [ ] Cold start after a fresh install — no white screen, no crash
- [ ] Force-quit and relaunch — session persists

### Authentication
- [ ] Register a new account
- [ ] Sign in / sign out / sign in again
- [ ] Password reset — email arrives, link works
- [ ] OTP — code arrives, verifies, resend cooldown behaves
- [ ] **Apple Sign In on a real device** *(not automatable — manual only)*
- [ ] **Google Sign In on a real device** *(manual only)*
- [ ] Account deletion on a **disposable** account; afterwards confirm
      server-side that the account's rows are gone

### SOS *(staging + your own numbers only)*
- [ ] Trigger → cancel during countdown → no message sent to anyone
- [ ] Trigger → let it complete → messages arrive at your own number
- [ ] "Saving emergency record…" resolves to "Emergency record saved"
- [ ] "I'm Safe" clears the alert
- [ ] Airplane mode: countdown and cancel still work; record saves after
      reconnect
- [ ] GPS off: SOS still activates
- [ ] Force-quit mid-SOS, relaunch — state recovers correctly
- [ ] Shake-to-SOS: enable it, then handle the phone normally for a few
      minutes. It must **not** fire. Then deliberately shake it three times —
      it must fire.

### Journey
- [ ] Start / check in / cancel
- [ ] Force-quit mid-journey — elapsed time correct on relaunch
- [ ] **Let a journey go overdue** and confirm the grace-period countdown and
      auto-SOS escalation behave as described *(manual only — impractical to
      automate)*
- [ ] **4-hour backgrounded journey** — elapsed time still correct *(manual
      only)*

### Subscriptions *(manual only — cannot be automated)*
- [ ] Sandbox purchase completes; premium unlocks immediately
- [ ] Restore Purchases on a fresh install recovers it
- [ ] Cancelling the purchase sheet shows **no** error

### Permissions
- [ ] Deny each permission in turn; confirm graceful degradation
- [ ] Revoke location in OS Settings while the app runs; confirm the app
      notices
- [ ] "Open Settings" affordance actually opens OS Settings

### Accessibility & appearance
- [ ] VoiceOver/TalkBack: SOS trigger, Cancel, "I'm Safe" all announce real
      names
- [ ] Reduce Motion: both pulse animations stop
- [ ] Largest Dynamic Type: countdown number and button labels are not clipped
- [ ] Dark mode on every screen

---

## External tester checklist

Shorter and safer — external testers are on production infrastructure.

### First session
- [ ] Install, launch, complete onboarding
- [ ] Add at least one trusted contact **that you control**
- [ ] Confirm the app works in your language; report anything untranslated or
      wrong (not merely English — English fallback is known)

### Daily use (over the beta period)
- [ ] Use the app as you actually would; report anything confusing, slow, or
      surprising
- [ ] Start and complete at least one real journey
- [ ] Cancel at least one SOS **during the countdown** (safe — sends nothing)
- [ ] Note battery impact after a long journey

### Explicitly do NOT
- ❌ Do not complete an SOS countdown unless every trusted contact is a number
      you own
- ❌ Do not test with emergency services numbers
- ❌ Do not delete your account unless you intend to lose the data

### Report
- [ ] Any crash — immediately, with device + OS version
- [ ] Anything that felt unsafe, unclear, or slow in an emergency flow. This is
      the most valuable feedback an external tester can give and the hardest
      thing to catch internally.
