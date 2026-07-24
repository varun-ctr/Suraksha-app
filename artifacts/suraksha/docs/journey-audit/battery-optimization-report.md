# 5. Battery Optimisation Report

## Current battery footprint of the journey feature: effectively zero beyond a single GPS fix

Since journey tracking involves no continuous location updates, no background GPS, and no periodic network polling, its battery cost is limited to:

1. **One foreground GPS fix** at journey start (via `useJourney.ts`'s `useLocation()`, for the "journey started" alert's location context) — identical one-shot cost to any other single `getCurrentLocation()` call elsewhere in the app.
2. **A 1-second JS interval while the app is foregrounded and a journey is active** — negligible CPU cost (a single arithmetic comparison and, at most, one state update per second), and it stops entirely the moment the app backgrounds (no background wake-lock, no background CPU usage at all).
3. **One OS-scheduled local notification** — effectively free; the OS handles delivery timing without any app-side polling.
4. **One Supabase insert + one update per journey** (start/end) — two network requests per journey, not per unit time.

There is no GPS frequency, accuracy, or distance-filter tuning to review for journeys specifically (Section 3's typical concerns — distance filter, update interval, speed/heading/altitude — apply to SOS's continuous background location, already reviewed in the SOS audit, not to journey's single one-shot fix).

## Adaptive tracking recommendation (high accuracy while moving / reduced when stationary / idle when paused)

This is a real, well-known battery optimization pattern — but it only applies to a feature that does continuous location tracking, which journey does not. Recommending it here would mean recommending that journey tracking be rebuilt into a continuous-GPS feature, which is explicitly out of scope for this audit (see Architecture Diagram's scope note and Technical Debt Report). If continuous route tracking is added to journeys in the future (see the geofencing/route-tracking recommendation in the Reliability Audit), that is exactly where this pattern belongs:

- High accuracy + short update interval while `speed > walking threshold` (moving).
- Reduced accuracy/frequency when speed drops near zero for a sustained window (stationary).
- Fully paused (no location calls at all) whenever the journey itself is paused/inactive — which is already true today by construction, since there's no tracking running at all outside an active journey.

## Battery Efficiency Score: 10/10 (for the feature as it exists today)

There is no battery inefficiency to find in a feature with no continuous background activity. This score reflects the current, narrow scope honestly — it should not be read as "adaptive tracking has been implemented," since there is no tracking loop to adapt. If/when continuous journey route-tracking is built, this score and report should be redone against that feature specifically, using the SOS audit's battery analysis of `core/permissions/backgroundLocation.ts` (accuracy `High` not `Highest`, `distanceInterval: 10`, `pausesUpdatesAutomatically: false`) as the template for what "already reviewed and tuned" looks like.
