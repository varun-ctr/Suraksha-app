# 10. Compliance

## Apple App Store readiness

- **Privacy Manifest (`PrivacyInfo.xcprivacy`)**: not present anywhere in the repo, no Expo config plugin generates one. Apple requires an aggregated manifest for apps using "required reason" APIs or bundling third-party SDKs (Firebase, Sentry) that ship their own manifests. **This is a real submission-blocking gap** if not addressed before an App Store Connect upload targeting current review requirements. Cannot be generated blind from this environment (requires knowing the exact final set of third-party SDK manifests at build time, and ideally a real Xcode/EAS build to verify) — tracked as the top App Store item in `12-Production-Certification.md`.
- **App Privacy Nutrition Labels**: this is an App Store Connect *configuration* step (a form filled in on Apple's dashboard describing data collection practices), not something expressible in this codebase. This document's data inventory (`03-Privacy-Audit.md`) provides the accurate source-of-truth answers for filling that form out correctly (location — linked to user, used for app functionality; contact info — linked to user; user content — community reports; identifiers — Firebase uid) — but the actual form submission is an operational step outside this repo.
- **Background location justification**: reviewed favorably in `06-Network-Security.md` — narrowly-scoped request timing, user-visible tracking indicator, graceful degradation without the "Always" grant. This is exactly the evidence Apple's review process asks for; no code change needed here, but the review notes/App Store Connect submission description should explicitly reference this narrow scoping (an operational/submission-copy step, not code).
- **eas.json placeholders**: `"TODO_APP_STORE_CONNECT_APP_ID"` and `"TODO_APPLE_TEAM_ID"` are still literal placeholder strings — confirms the App Store submission pipeline configuration is incomplete, an operational item, not a security defect.
- **In-app privacy policy**: exists, substantive, bilingual (`app/privacy.tsx` / `shared/utils/legal.ts`) — satisfies the basic App Store requirement of having an accessible privacy policy; content aligns with the actual data-handling behavior found in this audit (verified, not just assumed).

## GDPR principles (this app is India-focused per its locale strings, but GDPR principles are a reasonable universal bar to hold a safety app to)

| Principle | Status |
|---|---|
| Lawfulness/consent | In-app privacy policy discloses data use; no explicit granular consent flow (e.g. separate opt-in checkboxes per data category) exists — acceptable for a safety app where the core features (location, contacts) are the product itself, not optional add-ons, but worth noting for a strict GDPR reading |
| Data minimization | Generally strong (see `03-Privacy-Audit.md`); one real gap found and fixed this pass (`/sos/alert` no longer round-trips/caches contact name/phone unnecessarily) |
| Purpose limitation | Each data category's use matches its stated purpose (location for SOS/maps, contacts for alerts) — no evidence of secondary/undisclosed use found |
| Storage limitation (retention) | Open product decision for `sos_events`/`journeys`/`community_reports` (documented, not a silent gap — see `docs/backend-hardening/05-Retention.md`) |
| Right to erasure | Account deletion exists and covers Firebase + Supabase + push tokens + live sessions + contacts + storage (prior phase); schema now supports an atomic cascade version (backend-hardening pass) not yet wired into the deletion flow itself |
| Data portability | No explicit "export my data" feature exists in the app today — a genuine gap if this app is ever subject to a formal GDPR/DPDP compliance review; not a security defect, a feature gap |
| Security of processing | Addressed throughout this document set — RLS, encrypted session storage, verified server-side auth, rate limiting, etc. |

## India's Digital Personal Data Protection Act (DPDPA) — relevant given the app's clear India focus (locale strings, phone-number normalization defaults to +91)

Not separately assessed in depth in this pass (outside the requested MASVS/privacy scope), but the same underlying controls reviewed above (consent/disclosure via the privacy policy, data minimization, deletion) are the same building blocks DPDPA compliance would need — no DPDPA-specific gap was identified beyond what's already listed under GDPR principles above.

## Security disclosures / vulnerability-reporting readiness

No `SECURITY.md` or public vulnerability-disclosure policy/contact was found in the repository. For a safety-critical app handling location and emergency-contact data, having a clear, published way for a security researcher to report a finding is a reasonable operational best practice — not implemented in this pass (a documentation/process addition, not a code fix), tracked in `12-Production-Certification.md`.

## App Store Compliance summary

| Item | Status |
|---|---|
| Privacy Manifest | **Missing** — submission-blocking under current Apple requirements |
| App Privacy Nutrition Labels | Data inventory ready; App Store Connect form submission is operational, not code |
| Background location justification | Strong — code behavior matches a narrowly-scoped, reviewable story |
| In-app privacy policy | Present, substantive, bilingual |
| eas.json submission config | Incomplete (placeholder App Store Connect / Apple Team IDs) |
| Permission usage strings | All present, specific, honest (no generic placeholder text) |

**Estimated App Store Compliance: ~70%** — the code/product side (permissions, privacy policy, background-location justification) is genuinely strong; the gap is entirely in submission-pipeline completeness (Privacy Manifest, placeholder IDs, Nutrition Label form) rather than in the app's actual behavior.
