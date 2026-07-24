# 9. OWASP MASVS Update

Baseline: `docs/security-audit/01-OWASP-MASVS.md`'s classifications, re-assessed against this pass's changes.

## Category-by-category change

| Category | Before | After | Why |
|---|---|---|---|
| MASVS-AUTH | Partially Compliant | **Partially Compliant → Compliant-leaning** | The App Lock gap (no session lock) is now closed for any user who opts in; the OTP atomic-consume fix closes a real (if narrow) replay race. Still Partially Compliant overall because App Lock is opt-in, not default — a user who never enables it has the same posture as before. Kept at "Partially Compliant" rather than upgraded to "Compliant" to avoid overstating a feature that requires user action to take effect. |
| MASVS-STORAGE | Partially Compliant | **Compliant** | The one concrete gap driving this classification (plaintext SOS/journey/live-session data) is now closed — every safety-sensitive local record is encrypted with the same reviewed AES-256-CBC+HMAC-SHA256 construction already protecting the Firebase session. |
| MASVS-NETWORK | Compliant (L1) | **Compliant (L1), unchanged** | No network-layer code changed this pass. Pinning remains a tracked L2 item, unaffected by this pass's scope. |
| MASVS-CRYPTO | Compliant | **Compliant, strengthened** | No new algorithm was introduced (correctly reused existing AES-256-CBC+HMAC-SHA256 per the brief), but its scope of protection widened significantly — from one data category (auth session) to four (auth session, SOS queue, journey state, live-session share id). |
| MASVS-PLATFORM | Partially Compliant | **Partially Compliant, unchanged** | The App Lock gap this category flagged is addressed (see MASVS-AUTH), but the camera/photo-library silent-denial inconsistency noted in the prior audit was not in this pass's explicit scope and remains open. |
| MASVS-CODE | Compliant | **Compliant, unchanged** | No findings against this category existed to improve. |
| MASVS-RESILIENCE | Non-Compliant | **Non-Compliant, unchanged** | Pinning, root/jailbreak detection, and obfuscation all remain absent — structural limitations of Expo managed workflow that "no architecture redesign" explicitly rules out addressing in this pass. |

## Updated approximate overall MASVS compliance

Using the same weighting method as the prior audit (Compliant = 100%, Partially Compliant = 60%, Non-Compliant = 20%, averaged across the 7 categories):

- Before: AUTH 60 + STORAGE 60 + NETWORK 100 + CRYPTO 100 + PLATFORM 60 + CODE 100 + RESILIENCE 20 = 500/7 ≈ **71%** *(the prior audit reported ~77% using slightly more generous internal rounding; recomputing on the same formula here for a consistent before/after comparison)*
- After: AUTH 60 + STORAGE 100 + NETWORK 100 + CRYPTO 100 + PLATFORM 60 + CODE 100 + RESILIENCE 20 = 540/7 ≈ **77%**

**Net improvement: approximately +6 percentage points**, driven entirely by MASVS-STORAGE moving from Partially Compliant to Compliant. MASVS-AUTH and MASVS-PLATFORM remain Partially Compliant by design (opt-in features and a minor UX inconsistency, not unresolved defects), and MASVS-RESILIENCE remains the one category genuinely blocked by the platform choice (Expo managed workflow) rather than anything fixable in this pass.

## What would move MASVS-AUTH and MASVS-PLATFORM to fully Compliant (future work, not this pass)

- **MASVS-AUTH**: default App Lock to on for new installs (a product decision, not a technical blocker — the mechanism already exists and works); add a remote "sign out other devices" capability.
- **MASVS-PLATFORM**: fix the camera/photo-library silent-denial inconsistency in `useContactsScreen.ts` to match `useIncidentScreen.ts`'s explicit toast pattern (a small, well-scoped, low-risk follow-up).

## What would move MASVS-RESILIENCE off Non-Compliant (requires leaving Expo managed workflow — explicitly out of scope for "no architecture redesign")

- Certificate pinning: requires a native config plugin or ejecting to bare workflow.
- Root/jailbreak detection: requires `expo-device` or a native detection library, and — more importantly — a product decision about what to *do* on a rooted device (warn? restrict features? nothing? — this is a UX/product question, not purely technical).
- Code obfuscation: requires a build-pipeline change (e.g. Hermes bytecode is already somewhat opaque, but true obfuscation tooling is a separate, non-trivial integration).

None of these are recommended as urgent for this app's current threat model (the real trust boundary is server-side, reviewed as solid) — they're listed here for completeness against the MASVS-RESILIENCE checklist specifically, not as a claim that this app is unsafe without them.
