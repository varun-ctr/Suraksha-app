---
name: Suraksha truthfulness invariants
description: Honesty constraints for the Suraksha women's-safety app — what must stay in lockstep so no feature lies to the user.
---

Suraksha was deliberately hardened so every feature is TRUTHFUL and on-device-only (user's "Bucket A": no external accounts, no cloud beyond the pre-existing, disclosed Sakhi AI chat). Keep these invariants whenever touching data, location, or legal copy.

- **Legal copy must match actual data/network behavior.** `constants/legal.ts` (en+hi) is a set of claims; any change to what the app reads, stores, or sends must update it in lockstep.
  - Reverse geocoding (`lib/location.ts`) uses the OS geocoder, which **may hit a network service** (esp. iOS/CLGeocoder). Do NOT describe it as "on-device" or claim location "never leaves the device automatically" — the copy must disclose OS geocoding.

- **"Delete all my data" must clear EVERY storage key ever written, including legacy versioned ones.** Storage keys are versioned: `suraksha.secure.v1` (PII keystore), `suraksha.app.v2` (plain). `resetAllData()` must also remove `LEGACY_PLAIN_KEYS` (e.g. `suraksha.app.v1` from the first build) or upgraded users keep old data after a delete-all. When you bump a key version, add the old key to the legacy list.

- **No fake success / fake GPS / hardcoded places.** SOS/journey never claim "delivered/sent" — they only prepare manual call/SMS/WhatsApp actions. Map shows only the user's real location and opens the device maps app for category search; there is no baked-in places list. Premium is "coming soon" (no fake purchase).

- **Why:** the whole point of the hardening audit was that a safety app must never mislead a user about whether help was actually summoned or whether their data is private. A lie here is a safety risk, not just a UX bug.
