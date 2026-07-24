# 3. Real Device Certification Matrix & Minimum Supported Versions

Ten capability checks per device. Every cell is pass / fail / N-A — no partial
credit, no "looked fine."

---

## Minimum supported versions — NOT DETERMINABLE FROM THIS REPOSITORY

This was investigated directly and the honest answer is that it cannot be
answered from source. Recording that, rather than guessing a plausible number,
is the correct output.

**What was actually checked:**

| Source | Finding |
|---|---|
| `app.config.ts` → `ios` block | No `deploymentTarget` key. Absent, not empty. |
| `app.config.ts` → `android` block | No `minSdkVersion`, `compileSdkVersion`, or `targetSdkVersion`. |
| `package.json` | `"expo": "~54.0.36"` — the SDK whose defaults therefore apply |
| `eas.json` | Build profiles only; no platform version overrides |
| `ios/` and `android/` directories | **Do not exist.** This project uses Expo's Continuous Native Generation — native projects are produced at build time and are not in version control. |

Because no explicit override exists anywhere, the effective minimum is whatever
Expo SDK 54's prebuild templates emit — a value that lives only in a generated
native project this repository does not contain. Any specific version number
stated here would be a guess dressed up as a fact, and this app's App Store
submission risk is real enough that a guess is worse than a gap.

### How to determine it for real

```bash
# iOS — generates the native project without building
npx expo prebuild --platform ios
grep "platform :ios" ios/Podfile
#   → platform :ios, 'X.Y'   ← the authoritative minimum iOS version

# Android
npx expo prebuild --platform android
grep -E "minSdkVersion|targetSdkVersion|compileSdkVersion" android/build.gradle
#   → the authoritative Android API levels
```

Either run `expo prebuild` locally (it writes `ios/`/`android/` into the working
tree — do not commit them, CNG regenerates them) or download the build artifact
from a real `eas build` and read the same values out of it.

### Then, before submitting

1. Record both values in the release ticket.
2. Cross-check against Apple's and Google's **current** minimum-OS submission
   policy at the time of submission. Those policies move; a value verified six
   months ago is not evidence today.
3. Update this section with the confirmed numbers and the date they were read.

Until step 1 is done, every "Min OS" cell below reads **"see above — not yet
determined."** This is the single open App-Store-rejection-risk item in the
entire certification (`09-Regression-Gate.md`).

---

## Capability checks (identical for every device)

| # | Check | Pass criterion |
|---|---|---|
| 1 | **GPS** | Position acquires outdoors within ~15s; SOS activates with *no* fix at all (must not block) |
| 2 | **Background execution** | Journey elapsed time is correct to wall-clock after 30+ min backgrounded |
| 3 | **Notifications** | Permission prompt appears; journey-overdue local notification fires while backgrounded |
| 4 | **Biometrics** | App Lock enables where hardware exists; degrades with a toast where it does not |
| 5 | **Camera** | Incident-report photo capture and library pick both work; denial shows the failure toast added in the UX phase, never silence |
| 6 | **Contacts** | Native contact picker opens and imports |
| 7 | **Battery** | 1h active journey does not produce anomalous drain vs. baseline; behavior unchanged in Low Power Mode |
| 8 | **Offline** | Airplane mode: SOS triggers, countdown runs, cancel works; "Saving emergency record…" persists and resolves on reconnect |
| 9 | **Dark Mode** | Every screen legible; map re-skins via `customMapStyle`; no white-box or invisible text |
| 10 | **Accessibility** | VoiceOver/TalkBack names SOS trigger, Cancel, and "I'm Safe"; Reduce Motion stops both pulses; large Dynamic Type does not clip the countdown |

## iOS matrix

| Device | Min OS | Recommended OS | Known limitations / focus |
|---|---|---|---|
| iPhone SE (2nd/3rd gen) | **Not yet determined** — see the section above | Latest available for device | **Highest-priority device in the matrix.** Smallest viewport; the documented "'I'm Safe' may require scrolling with 5 contacts" finding (`docs/ux-audit/08-Emergency-UX.md`) is most acute here. Verify check #10 and the active-SOS layout with 5 contacts configured. |
| iPhone 12 | ditto | Latest | Baseline. No device-specific concern identified. |
| iPhone 13 | ditto | Latest | Baseline. |
| iPhone 14 | ditto | Latest | Baseline. |
| iPhone 15 | ditto | Latest | Baseline. |
| iPhone 16 | ditto | Latest | Dynamic Island present; app draws no custom status-bar content, so no interaction expected — confirm rather than assume. |
| iPad | **Out of scope** | — | `ios.supportsTablet: false` in `app.config.ts` (verified). Not to be tested or claimed. |

## Android matrix

| Class | Min OS | Recommended OS | Known limitations / focus |
|---|---|---|---|
| Low-end | See the "Minimum supported versions" section above | Latest available | Aggressive OEM battery optimization is the top risk to checks #2 and #3. Verify background location survives with the app *not* allowlisted, and document what actually happens — this is where background tracking is most likely to be killed. |
| Mid-range | ditto | Latest | Baseline. |
| Flagship | ditto | Latest | Baseline. |
| Tablet | **Out of scope** | — | No tablet-specific layout exists in the codebase (verified). Not claimed as supported. |

## Cross-cutting Android constraints (platform facts, not app defects)

- `react-native-maps`, `expo-notifications` (FCM), and Google Sign In all
  require Google Play Services. On GMS-less hardware (some China-market ROMs,
  Amazon Fire) maps, push, and Google auth degrade. Not defects; document
  observed behavior if such a device is in the pool.
- `react-native-purchases` needs a working Play Store account.

## Minimum device pool for a credible pass

If the full matrix is not achievable, the smallest defensible set is:
**iPhone SE + one recent iPhone + one low-end Android + one flagship Android.**
That covers the two extremes where failures actually cluster (smallest
viewport, most aggressive battery management) plus two baselines. Certifying on
flagships alone would be certifying the easy case.

## Recording results

One row per device × check in the release ticket. A failed cell blocks release
only if it maps to a Launch Blocker in `09-Regression-Gate.md`; otherwise it is
logged as a known issue in the release notes.
