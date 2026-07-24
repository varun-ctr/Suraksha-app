# 2. E2E Plan

## Framework decision: **Maestro**

Evaluated against Detox, Playwright Mobile, and Expo-native tooling.

| Criterion | Maestro | Detox | Playwright Mobile | Expo-native |
|---|---|---|---|---|
| Learning curve | YAML, no build step, readable by non-JS testers | JS + explicit sync APIs; steepest | Familiar to web teams, weakest mobile story | N/A — no first-party E2E runner exists |
| Expo compatibility | Drives the installed binary; no config plugin, no prebuild coupling | Historically needs native project access; awkward with Continuous Native Generation | Not designed for native RN apps | — |
| CI compatibility | Single CLI binary; Maestro Cloud available; no npm dependency added | Heavier native build matrix | Poor fit | — |
| Maintenance | Flows are data; no compile step to break on RN upgrades | Breaks with RN/native toolchain churn | — | — |
| Reliability | Built-in implicit waits and retries; tolerant of RN's async render | Powerful but brittle; sync assumptions leak | — | — |
| Speed | Fast per-flow startup | Slower | — | — |
| Developer productivity | Edit YAML, rerun instantly | Edit, rebuild, rerun | — | — |
| Future scalability | Tags/subflows scale; Maestro Cloud for device farm | Scales but at higher upkeep cost | — | — |

**Decisive factor for this repo specifically:** this project uses Expo's
Continuous Native Generation — there is no `ios/` or `android/` directory in
version control (verified). Detox's model assumes access to native projects,
which here exist only transiently at build time. Maestro drives the *installed
binary* and is indifferent to how it was produced, which fits this repository's
actual shape rather than fighting it.

**Second decisive factor:** Maestro adds **zero npm dependencies**. It installs
as a standalone CLI. Under Release Freeze, an E2E framework that changes
`package.json`, `pnpm-lock.yaml`, and the dependency graph is a materially
riskier proposition than one that adds only YAML files. Maestro adds nothing to
the production bundle and cannot alter runtime behavior — satisfying the
acceptance criterion "any new automation must not change production behavior"
by construction, not by inspection.

## What was built this phase

10 flows in `.maestro/flows/`, plus `.maestro/config.yaml` and
`.maestro/README.md`.

**These flows have not been executed.** No device, emulator, or Maestro CLI
exists in the environment they were written in. Selectors were derived from
real, verified on-screen strings (`features/settings/locales/strings/en.ts`)
and the accessibility labels added in the UX & Accessibility phase — but
"derived from real strings" is not "proven to match at runtime." Expect
selector fixes on first execution. They are a working skeleton, not a passing
suite, and are labelled that way everywhere they appear.

| Flow | Tag | Covers |
|---|---|---|
| `01-smoke-launch` | safe | Cold start, splash/font gate, tab bar, SOS control present |
| `02-navigation-smoke` | safe | All five tabs render; return to Home intact |
| `03-login` | safe | Email/password sign-in with a disposable account |
| `04-emergency-contacts` | safe | Add contact; survives app restart (proves persistence) |
| `05-journey-start-complete` | safe | Start → restart mid-journey → check-in (wall-clock recovery) |
| `06-sos-countdown-cancel` | safe | Trigger → cancel in countdown → survives restart |
| `07-sos-activate-cancel` | **emergency** | Full activation → record-saved → "I'm Safe" |
| `08-permissions-denied` | safe | Location denied: app usable, SOS still works, Settings affordance shown |
| `09-background-resume` | safe | Background/foreground and cold-restart state restoration |
| `10-settings-persistence` | safe | Shake-to-SOS toggle survives restart |

## Safety design — the part that mattered most

SOS is split into two flows on purpose. `06` cancels during the 3-second
countdown, so `SafetyContext` never enters the `active` phase and therefore
**never writes an `sos_events` row and never dispatches SMS/calls/WhatsApp to
anyone** (verified against the phase machine — dispatch is gated on the active
phase, not on the trigger). That is the flow CI runs.

`07` lets the countdown complete and *does* reach real dispatch. On a
production build with real contacts, it sends real emergency messages to real
people. It is tagged `emergency`, excluded from the default `--include-tags
safe` filter, and carries a precondition block requiring a staging backend,
tester-owned contact numbers, and a human watching. An automated emergency-app
test suite that pages real humans would be worse than no suite at all.

## Scenario coverage against the 20 requested

**Automated (10 flows above):** Login, Emergency Contacts, Journey Start,
Journey Complete, SOS Trigger, SOS Cancel, Settings, Background Resume,
Permissions, plus launch/navigation smoke.

**Automatable but not built this phase — scoped, not forgotten:** Logout,
Registration, Community Report. Each is straightforward to add on the same
pattern; they were left out to keep the first suite small enough to actually
get green on first contact with a device. A 10-flow suite that runs beats a
20-flow suite that nobody finishes debugging.

**Partially automatable:** Password Reset and OTP can be driven as far as "the
request was accepted." Retrieving a real reset link or code needs a
test-mailbox API this project does not have. The flows stop at the honest
boundary rather than asserting something they cannot observe.

**Not automatable — permanently manual:**

| Scenario | Why |
|---|---|
| Apple Sign In | Native ASAuthorization sheet; Maestro cannot drive it reliably, and mocking it would prove nothing about the real nonce/token round-trip |
| Premium Purchase | Real StoreKit/Play Billing sheet |
| Restore Purchase | Same, plus requires prior-purchase account state |
| Journey Timeout | Requires waiting out a real overdue window plus OS background scheduling; feasible manually, impractical in CI |
| Offline Recovery | Maestro cannot toggle airplane mode on iOS; partially scriptable on Android only |
| Account Deletion | Destructive and non-repeatable — each run consumes an account. Kept manual with a disposable account per `06-Tester-Checklist.md` |

These live on the manual checklist. Listing them as "not automated" with a
reason is the accurate position; writing a flow that stubs them would
manufacture false confidence in exactly the paths that carry real money and
real identity.

## Running the suite

```bash
# Safe subset — the CI default
maestro test .maestro/flows --include-tags safe

# With credentials for the login flow
maestro test .maestro/flows --include-tags safe \
  -e APP_EMAIL=tester@example.com -e APP_PASSWORD=...
```

Never add `--include-tags emergency` to an unattended run.
