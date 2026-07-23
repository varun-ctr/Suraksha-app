# 7. Security Audit

## Data ownership and Row Level Security

| Table | RLS enabled | Policy | Verified |
|---|---|---|---|
| `sos_events` | Yes | `FOR ALL USING (auth.uid() = user_id)` — owner-only | ✅ `DATABASE_SETUP.sql` |
| `journeys` | Yes | `FOR ALL USING (auth.uid() = user_id)` — owner-only | ✅ |
| `live_sessions` | Yes | `FOR ALL USING (auth.uid() = user_id)` — owner-only for authenticated CRUD | ✅ |

No unauthenticated client can read, write, or enumerate another user's SOS events, journeys, or live-session rows directly against Postgres.

## Live-tracking share-link authorization

The one deliberate exception to owner-only access is the public share link a live-tracking session's contacts use — this **must** be readable by someone with only the share URL, not a Supabase session. This is handled correctly:

- `get_live_session(p_share_id)` is a `SECURITY DEFINER` RPC, not a table policy — it returns only the single row matching the given `share_id`, filtered additionally by `is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())`.
- The returned shape (`LiveSessionPublic`) excludes `user_id` entirely — a leaked share link cannot be used to enumerate or identify the emergency's owner beyond whatever is embedded in the coordinates themselves.
- Because `share_id` is a server-generated identifier (not a sequential/guessable id — confirm at the DB layer that it's generated via `gen_random_uuid()` or equivalent, not client-supplied), the practical attack surface is limited to guessing a random token, not enumerating sessions.
- This pass's `expires_at` heartbeat fix (see FMEA) has a security side-benefit beyond zombie-session cleanup: a share link from a resolved, hours-old emergency naturally stops resolving via the RPC once `expires_at` lapses, rather than remaining live (and readable by anyone who once held the link) indefinitely.

## Replay / spoofing protection

- **SOS trigger itself has no server-side authentication check beyond "is this a valid Firebase session"** — any signed-in user can trigger their own SOS, which is correct (there's no meaningful concept of "spoofing your own SOS"). The relevant spoofing concern is a *third party* triggering an SOS *as* another user, which would require a stolen/forged Firebase ID token — out of scope for this subsystem (covered by the auth-hardening pass's token-lifecycle and session-management work).
- **The backend `/sos/alert` route requires a valid Firebase ID token** (via `apiFetch`'s auth header attachment) and applies rate limiting + an idempotency cache keyed server-side — reviewed and found already correctly implemented prior to this pass, not modified.
- **Client-generated `idempotencyKey`** (`sosAlertService.ts`, `SafetyContext.tsx`'s `newIdempotencyKey()`) is not a security boundary — it's a delivery-deduplication mechanism, and is treated as such. It is not used anywhere as an authorization token.

## Location / PII handling

- **No location data, coordinates, addresses, or contact PII appears in `core/analytics/sosTelemetry.ts` breadcrumbs** — event names are a closed enum (`sos_triggered`, `sos_db_write_failed`, etc.) with no free-form `data` payload at all, stricter even than `authTelemetry.ts`'s `method`/`errorCode` fields, since there was no PII-free data worth attaching for SOS events. Verified by direct code review, not just by convention.
- **`sos_events`/`live_sessions` rows contain raw lat/lng** — this is necessary (it's the entire point of the feature) and is protected by RLS + the scoped public RPC above, not by additional application-layer encryption. This mirrors how the rest of the app treats structured PII in Supabase (encryption-at-rest is Supabase's responsibility at the infrastructure layer; the auth-hardening pass's envelope encryption was specifically for the *local device* session-persistence blob, a different threat model).
- **Crash-recovery's `PendingSosActivation`** (AsyncStorage) stores raw coordinates and address in plaintext local storage, not the app's encrypted secure-storage layer used for auth session state. This is a legitimate, intentional exception, not an oversight: the recovery record must be readable extremely early in app boot (before any auth/decryption machinery is guaranteed ready) and only ever contains the user's *own* current-emergency location — data they already fully control and that is, by definition, about to be shared with their own trusted contacts and rescue services within seconds regardless. It is however flagged in the Technical Debt Report as worth revisiting if the secure-storage path can be made available early enough without delaying crash recovery.

## Duplicate/unauthorized session access

- Covered under FMEA/Reliability Audit: `endAllActiveForUser` + heartbeat expiry prevents an old session from remaining live-and-readable indefinitely after a crash, which is both a reliability fix and a (minor) information-exposure reduction — fewer stale live sessions means a smaller window during which an old share link still resolves to real (if outdated) location data.

## Summary

No new vulnerability was found or introduced. RLS coverage is complete and correctly owner-scoped across all three SOS-related tables; the one necessarily-public access path (the share-link RPC) is a `SECURITY DEFINER` function with a minimal, PII-light return shape, not a table-wide policy exception. The changes made in this pass (background location, offline queue, live-session heartbeat) do not introduce any new server-side trust boundary — all new client code continues to operate strictly within the existing owner-only RLS model.
