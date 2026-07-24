# 8. Performance Report

No physical device or profiler is available in this sandboxed environment — this is a code-path analysis and estimate, not a measured benchmark, consistent with every prior audit this session.

| Metric | Estimate | Basis |
|---|---|---|
| Journey start latency (tap → timer visibly running) | Near-instant (<50ms) | `startJourney()` is a synchronous `setJourney(...)` call; the AsyncStorage write and Supabase insert both happen after, non-blocking (`void saveActiveJourney(...)`, `.then()` on the repository call) |
| GPS acquisition time (for the one-shot start alert) | Same as any other single `getCurrentLocation()` call elsewhere in the app — not re-measured here, not journey-specific | `useLocation()` — see `core/permissions/location.ts`, already reviewed in the SOS audit |
| Average tick latency | <1ms per tick | `computeJourneyStatus()` is a handful of arithmetic operations — no I/O, no allocation beyond a small object literal |
| Upload latency (journey start/end record) | Governed by Supabase round-trip time, not measured here | Two requests per journey total (insert, update) — see Battery Optimisation Report; not on the critical path of anything user-visible |
| Battery impact | Effectively zero beyond a single GPS fix per journey | See Battery Optimisation Report |
| Memory usage | Negligible | A handful of refs (`journeyStartedAtMsRef`, `journeyDbIdRef`, two boolean flags) and one small `JourneyState` object in React state — no arrays, no accumulating buffers (unlike a continuous-tracking feature's breadcrumb list, which this feature doesn't have) |
| CPU usage | One `setInterval` tick per second while foregrounded and active; zero while backgrounded (the interval itself is cleared, not just idle — see the tick effect's cleanup) | Confirmed by reading the effect's `if (!journey.active) { clearInterval... }` guard |
| Network requests/hour | 2 total per journey (not per hour — no recurring network activity at all) | `startJourney`/`endJourney`, one call each |
| Bundle impact | Negligible — no new native dependency added | `journeyRepository.ts`, `journeyPersistence.ts`, `journeyRecoveryPolicy.ts`, `journeyTelemetry.ts` are all pure TypeScript/AsyncStorage/Sentry-breadcrumb code, reusing infrastructure (DI, `Result`/`AppError`, the Supabase client) that already exists |

## Recommendation

As with every other performance report produced this session, real-device measurement should be done before relying on these estimates for a launch decision — flagged as a pre-launch action item, not silently assumed adequate.
