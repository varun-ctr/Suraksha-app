# 7. Security Audit

## Row Level Security

| Table | RLS enabled | Policy | Verified |
|---|---|---|---|
| `journeys` | Yes | `FOR ALL USING (auth.uid() = user_id)` — owner-only | ✅ `DATABASE_SETUP.sql`, unchanged by this pass — reviewed as part of the SOS audit previously and reconfirmed here since `journeyRepository.ts` is the first code to actually exercise this table |

No unauthenticated or cross-user access to journey records is possible — `journeyRepository.startJourney()`/`endJourney()` both operate strictly within the signed-in user's own rows (via `getCurrentFirebaseUser()`, mirroring `liveSessionRepository`'s pattern exactly), and RLS enforces owner-only access server-side regardless of client behavior.

## Journey spoofing / unauthorized access

- **No public/shareable journey link exists** (unlike SOS's `live_sessions`, which deliberately has a `SECURITY DEFINER` public-read RPC for the share link). Journeys have no equivalent public surface at all — there is nothing for a third party to read, spoof, or replay, since the only consumer of a journey record is its own owner.
- **Journey ownership** is enforced identically to every other owner-scoped table in this app (`sos_events`, `live_sessions`) — no new trust boundary was introduced.
- **No replay-attack surface**: `startJourney`/`endJourney` aren't idempotency-keyed the way `sos_events`/`/sos/alert` are, but there's also no meaningful "replay" to guard against — a duplicate `startJourney()` insert would just be a second historical row for the same user, not a security or safety issue (see Offline Sync Diagram's duplicate-journey analysis).

## Cross-user data leakage

None found. `journeyRepository.ts` never queries or reads another user's rows — `startJourney`/`endJourney` are both scoped to `getCurrentFirebaseUser()`'s own uid, and there is no `listForUser`-style read implemented yet (not needed by any current UI, so not built — see Technical Debt Report for whether a "journey history" screen is a legitimate future feature).

## Offline queue tampering

Journey's local persistence (`journeyPersistence.ts`, plain `AsyncStorage`, not `SecureStore`) stores only `startedAtMs`, `durationSec`, `overdueGraceSec`, `dbJourneyId`, and `autoSosTriggered` — no PII, no coordinates, no contact information. A malicious actor with access to the device's local storage (already implying a compromised device, a far larger threat than this specific record) could at most tamper with the timing values, causing an incorrect overdue/expired computation on next resume — the failure mode is "the safety timer behaves incorrectly," not "an attacker gains access to anything sensitive." This is judged an acceptable risk profile matching how `sosOfflineQueue.ts`'s equivalent plaintext AsyncStorage record was already assessed in the SOS audit (the data itself isn't sensitive; SecureStore's overhead isn't warranted for a timing record with no PII).

## API validation

`journeyRepository.startJourney(durationMinutes: number)` passes `durationMinutes` directly into the Supabase insert as `duration_minutes` — no explicit range validation (e.g., rejecting a negative or absurdly large duration) exists at this layer. In practice, the UI only ever supplies a small fixed set of preset durations (confirmed via `app/(tabs)/index.tsx`'s duration-picker options), so this isn't reachable through normal use — but it is not defended against a malformed direct call. Flagged as a minor hardening item in Technical Debt, not a live vulnerability given the current UI's fixed input set and RLS's ownership enforcement (a malformed duration can't expose or corrupt another user's data, only the caller's own row).

## Summary

No new vulnerability introduced or found. Journey inherits the same solid owner-only RLS posture as every other table in this app, has no public-read surface to abuse (unlike live-tracking's necessarily-public share link), and its local persistence contains no sensitive data.
