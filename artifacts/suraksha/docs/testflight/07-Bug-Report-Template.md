# 7. Bug Report, Known Issues, Feedback & Crash Workflow

## Bug report template

```markdown
### Summary
<One sentence. What broke, not what you were doing.>

### Severity
- [ ] Launch Blocker — crash, SOS/journey/auth broken, data loss, security
- [ ] High — core feature broken, no workaround
- [ ] Medium — feature broken, workaround exists
- [ ] Low — cosmetic or minor

### Environment
- Device:          <e.g. iPhone SE 3rd gen>
- OS version:      <e.g. iOS 18.2>
- App version:     <Settings → About, or the TestFlight build number>
- Build:           <TestFlight build #>
- Network:         <WiFi / cellular / airplane mode / poor signal>
- Language:        <if not English>

### Steps to reproduce
1.
2.
3.

### Expected
<What should have happened.>

### Actual
<What did happen.>

### Frequency
- [ ] Every time   - [ ] Sometimes (___ of ___ attempts)   - [ ] Once

### Evidence
<Screenshot / screen recording. For a crash, the TestFlight crash prompt.>

### Safety impact  ← answer this for anything touching SOS or journey
- [ ] Could an SOS have failed to send?
- [ ] Could a journey have failed to escalate?
- [ ] Was an alert sent that should not have been?
- [ ] None of the above
```

**Rule:** any box ticked in *Safety impact* is automatically at least High
severity, regardless of what the reporter selected above.

---

## Known issues template

Publish with every build so testers do not re-report documented gaps.

```markdown
## Known issues — build <N>

| # | Issue | Impact | Workaround | Status |
|---|-------|--------|------------|--------|
| 1 | Sign-in screen shows English regardless of selected language | Cosmetic; flow works | None | Documented, planned post-freeze |
| 2 | Legal text (Privacy/Terms) available in English and Hindi only | Cosmetic | None | Documented |
| 3 | Counts are not pluralised per-language ("1 contacts") | Cosmetic | None | Documented |
| 4 | Contact edits may not sync to server if offline; no retry, no indicator | Contacts can differ across devices | Re-edit while online | Documented |
| 5 | Account deletion may require signing out and back in first | Rare; message explains | Sign out, sign in, retry | Documented |
| 6 | Community reports cannot be submitted offline | Report is lost on failure | Retry when online | Documented |
| 7 | Nearby-places relative timestamps localised for English/Hindi only | Cosmetic | None | Documented |

Please do not file these — they are tracked.
```

Items 1–7 are drawn from `docs/ux-audit/` and `docs/qa-certification/`; refresh
the list from those documents each release rather than letting it drift.

---

## Beta feedback form

For qualitative feedback that is not a bug.

```markdown
### 1. What were you trying to do?

### 2. Did the app help, hinder, or confuse you?

### 3. Emergency features — answer honestly, this matters most
- Did you feel confident you could trigger SOS quickly if you needed to?  Y/N
- Did you feel confident you could STOP a false alarm?                     Y/N
- Was anything about the emergency flow unclear or slow?

### 4. Trust
- Was it clear when the app uses your location?     Y/N
- Anything that made you uneasy about privacy?

### 5. Performance
- Noticeable battery drain?  Y/N — after roughly how long?
- Anything slow or unresponsive?

### 6. One thing to change
```

---

## Crash reporting workflow

**Automatic capture (already live, verified):**
- Sentry is initialised in `core/analytics/crashReporting.ts` with SDK
  defaults, so unhandled JS exceptions and native crashes are captured
  automatically.
- `ErrorBoundary` catches render-phase errors and reports via `reportError`.
- `installCrashBeforeRenderHandler` (`core/analytics/startupTelemetry.ts`)
  covers module-eval crashes that happen *before* React mounts — the blank-white-
  screen class of failure.
- All events pass through `scrubSentryEvent`, which strips emails, tokens,
  phone numbers, and GPS-precision coordinates (8 unit tests).

**Triage:**

| Step | Action |
|---|---|
| 1 | Sentry issue arrives. Read the breadcrumb trail — the 48 existing events plus the location/notification events added this phase reconstruct the sequence without any PII. |
| 2 | Classify against `09-Regression-Gate.md`'s Launch Blocker list. |
| 3 | **Launch Blocker** → halt distribution, expire the build in TestFlight, fix, re-run the full gate. |
| 4 | **Not a blocker** → log it, add to known issues, schedule normally. |
| 5 | If crash volume spikes without a matching Sentry issue, suspect a *native* crash on a device Sentry cannot reach — cross-check App Store Connect crash logs. |

**Alerting gap, stated plainly:** Sentry alert rules live in the Sentry
dashboard, not in this repository. Nothing in the codebase can confirm whether
crash-spike alerting is actually configured. Verify it in the Sentry UI before
external TestFlight — capture without alerting only helps if a human happens to
look.
