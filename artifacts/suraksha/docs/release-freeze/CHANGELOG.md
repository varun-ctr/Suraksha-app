# Release Freeze Changelog

The application entered **Release Freeze** on 2026-07-24, following completion of all 10 prior
certification phases (Architecture, Authentication, Startup, SOS, Journey, Backend, Backend
Hardening, Security, Security Hardening, Performance).

During Release Freeze, stability outranks feature development. Every change merged from this
point forward must be justified against exactly one of the 10 accepted categories below, and is
logged here at the time it's merged — no exceptions, no batching "while I'm in there."

## Accepted change categories

1. Confirmed bug fix
2. Production crash fix
3. Accessibility improvement
4. App Store compliance
5. Security vulnerability fix
6. Battery/performance improvement with measurable evidence
7. Memory leak fix
8. Data-loss scenario fix
9. Regression fix
10. Observability improvement

Anything else — new features, navigation/UX/UI changes, architecture/repository/domain/DI
changes, schema changes, large refactors, public API renames, non-security-critical dependency
upgrades, analytics/telemetry schema changes, permission changes — is rejected by default. The
standing rule: **if it isn't necessary for production readiness, don't change it.**

## Launch Blockers — the only bypass path

A change is a **Launch Blocker** if it fixes something causing any of:

- App crash
- User cannot authenticate
- SOS cannot be triggered
- Journey safety workflow fails
- Background tracking fails
- Emergency notifications fail
- Data loss
- Security vulnerability (P0/P1)
- App Store rejection issue
- Payment/subscription failure
- Production backend outage

Only a Launch Blocker fix may bypass the normal Release Freeze review-and-wait cycle and land
immediately. Every other accepted change (categories 3, 6, 7, 9, 10 above when *not* rising to a
Launch Blocker's severity, plus routine instances of 1/2/5/8) still waits for the next scheduled
release — being an accepted category is necessary but not sufficient for immediate landing; it
must also be a Launch Blocker to jump the queue. A change that is neither an accepted category nor
a Launch Blocker is rejected outright, full stop.

Every Launch Blocker entry below must additionally state **which criterion** it satisfies, so the
bypass itself stays auditable.

## Entry format

Each accepted change gets one entry:

```
## YYYY-MM-DD — <short title>
- **Category**: <one of the 10 above>
- **Launch Blocker**: Yes (<criterion>) | No — queued for next release
- **Classification**: Critical | High | Medium | Low
- **Reason**: why this change is necessary
- **Risk**: what could go wrong
- **Files changed**: list
- **Regression risk**: assessment
- **Rollback strategy**: how to revert
- **Expected benefit**: concrete, measurable where possible
```

Rejected proposals are not listed here (this file is a log of what shipped, not a review queue) —
they're reported inline in the phase's chat summary as "Rejected Changes" per the release-freeze
final-report format.

---

No changes have been merged under freeze yet. Entries below this line, newest first.
