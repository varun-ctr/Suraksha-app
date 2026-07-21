import { test } from "node:test";
import assert from "node:assert/strict";

import {
  interpolate,
  coordLink,
  buildEmergencyMessage,
  type Translate,
} from "../emergencyMessage.ts";

/** Minimal English string table mirroring the `sos.msg.*` keys in en.ts. */
const EN: Record<string, string> = {
  "sos.msg.title": "🚨 EMERGENCY ALERT",
  "sos.msg.someone": "Someone",
  "sos.msg.danger": "{name} may be in danger and needs immediate help!",
  "sos.msg.datetime": "📅 {date} at {time}",
  "sos.msg.location": "📍 Location: {address}",
  "sos.msg.coords": "📍 Coordinates: {coords}",
  "sos.msg.tracking": "🗺️ Live tracking:",
  "sos.msg.cta": "Please call them or go to their location right away.",
  "sos.msg.signature": "— Sent via Suraksha Safety App",
};

const t: Translate = (key) => EN[key] ?? key;

test("interpolate replaces named placeholders", () => {
  assert.equal(interpolate("Hi {name}!", { name: "Asha" }), "Hi Asha!");
  // Missing var -> empty string, unknown placeholders left blank
  assert.equal(interpolate("{a}-{b}", { a: "1" }), "1-");
});

test("coordLink builds a shareable maps URL", () => {
  assert.equal(coordLink(12.34, 56.78), "https://maps.google.com/?q=12.34,56.78");
});

test("buildEmergencyMessage prefers shareUrl over coordinate fallback", () => {
  const msg = buildEmergencyMessage(
    t,
    "Asha",
    { lat: 12.34, lng: 56.78, accuracy: null },
    "https://track.example/abc",
  );
  assert.match(msg, /🚨 EMERGENCY ALERT/);
  assert.match(msg, /Asha may be in danger/);
  assert.match(msg, /🗺️ Live tracking:/);
  assert.match(msg, /https:\/\/track\.example\/abc/);
  // The static maps fallback must NOT appear when a shareUrl is present
  assert.doesNotMatch(msg, /maps\.google\.com/);
});

test("buildEmergencyMessage falls back to a maps link when shareUrl is null", () => {
  const msg = buildEmergencyMessage(
    t,
    "Asha",
    { lat: 12.34, lng: 56.78, accuracy: null },
    null,
  );
  assert.match(msg, /https:\/\/maps\.google\.com\/\?q=12\.34,56\.78/);
});

test("buildEmergencyMessage prefers a human address over raw coordinates", () => {
  const withAddress = buildEmergencyMessage(
    t,
    "Asha",
    { lat: 12.34567, lng: 56.78, accuracy: null },
    null,
    "MG Road, Bengaluru",
  );
  assert.match(withAddress, /📍 Location: MG Road, Bengaluru/);
  assert.doesNotMatch(withAddress, /📍 Coordinates:/);

  const noAddress = buildEmergencyMessage(
    t,
    "Asha",
    { lat: 12.34567, lng: 56.78, accuracy: null },
    null,
  );
  assert.match(noAddress, /📍 Coordinates: 12\.34567, 56\.78000/);
});

test("buildEmergencyMessage uses the localized 'someone' when name is blank", () => {
  const msg = buildEmergencyMessage(t, "   ", null, null);
  assert.match(msg, /Someone may be in danger/);
  // No location section when there are no coords and no address
  assert.doesNotMatch(msg, /📍/);
  assert.doesNotMatch(msg, /🗺️/);
});
