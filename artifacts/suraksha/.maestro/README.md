# Maestro E2E flows

These flows were **authored against the app's real, verified on-screen strings**
(sourced from `features/settings/locales/strings/en.ts` and the accessibility
labels added in the UX & Accessibility certification phase). They have **not
been executed** — the environment they were written in has no device, emulator,
or Maestro CLI. Treat every flow as *unvalidated until first run*: expect to fix
selectors on the first real execution, and budget for that.

That caveat is the point of writing them anyway: the selectors, the ordering,
and the safety gating are the hard part and are all derived from real code. A
QA engineer with a device can run `maestro test` and iterate from a working
skeleton rather than a blank file.

## Prerequisites

1. Install Maestro: `curl -Ls "https://get.maestro.mobile.dev" | bash`
2. A running simulator/emulator **or** a connected device with a development or
   preview build of the app installed (`eas build --profile preview`).
   Maestro drives the installed binary — it does not build the app.
3. Set `APP_EMAIL` / `APP_PASSWORD` env vars to a **disposable test account**:
   `maestro test .maestro/flows -e APP_EMAIL=... -e APP_PASSWORD=...`

## Safety rules — read before running anything tagged `emergency`

The SOS flows in this directory are deliberately split:

- **`06-sos-countdown-cancel.yaml` (tag: `safe`)** cancels during the 3-second
  countdown. It never reaches the `active` phase, so it never writes an
  `sos_events` row and never dispatches SMS/calls/WhatsApp to anyone. This is
  the SOS flow CI should run.
- **`07-sos-activate-cancel.yaml` (tag: `emergency`)** lets the countdown
  complete. On a production build with real trusted contacts configured, **this
  sends real emergency messages to real people.** It must only ever run against
  a staging backend, on an account whose trusted contacts are numbers the tester
  personally controls. It is excluded from the default tag filter for exactly
  this reason.

Never add `emergency`-tagged flows to an unattended CI run.

## What is deliberately absent

Apple Sign In, Google Sign In, premium purchase, and restore-purchase flows are
not present. Those hand off to native OS/StoreKit sheets that Maestro cannot
reliably drive, and faking them would produce a test that passes while proving
nothing. They stay on the manual checklist
(`docs/testflight/06-Tester-Checklist.md`) where they belong.

OTP and password-reset flows stop at "the request was accepted" — retrieving a
real code or reset link from an inbox needs a test-mailbox API that this project
does not have.
