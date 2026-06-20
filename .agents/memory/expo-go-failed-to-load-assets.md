---
name: Diagnosing Expo Go "Failed to load all assets" on Replit
description: What the Expo Go launch error "Failed to load all assets" means, and how to verify server-side health vs device-side failure for a Replit-hosted Expo app.
---

# "Failed to load all assets" is an Expo Go (native) error, not your code

The string `Failed to load all assets` does NOT exist in `node_modules` — it is baked
into the Expo Go iOS/Android binary. Expo Go shows it when, after fetching the manifest,
it cannot download the **launch asset (JS bundle)** or one of the entries in the
manifest `assets[]` array from the dev server. So it points to a download/load failure
on the device, NOT a JS/runtime bug in your app.

**Why this matters:** don't chase code bugs first. Verify the dev server is actually
serving the manifest, bundle, and splash to the same public domain the phone uses.

# How to verify server-side health (reproduce what the phone does)

Use the public Expo dev domain `$REPLIT_EXPO_DEV_DOMAIN` (the `...expo.pike.replit.dev`
host), NOT localhost.

1. Manifest: `curl -s -H "expo-platform: ios" -H "Accept: application/expo+json,application/json" "https://$REPLIT_EXPO_DEV_DOMAIN" -o /tmp/m.json -w "%{http_code}\n"` → expect 200.
2. Bundle: extract the EXACT `launchAsset.url` from the manifest and curl it. It uses the
   full pnpm path (`node_modules/.pnpm/expo-router@.../node_modules/expo-router/entry.bundle?...`).
   **Pitfall:** the short path `node_modules/expo-router/entry.bundle` returns a bogus
   404 `UnableToResolveError` from the workspace root — that is a FALSE POSITIVE, not the
   real bundle. Always use the manifest's launchAsset.url verbatim.
3. Splash/icon: curl the `splash.imageUrl` from the manifest → expect 200.

Metro also logs `iOS Bundled <ms> ... entry.js (<n> modules)` on a successful build.

# If the server is healthy but the device still errors

The failure is device-side: large dev bundle download over the tunnel timing out, a stale
Expo Go cache, or a flaky connection. Have the user force-quit Expo Go and rescan the QR;
if it persists, get the exact red-screen text / screenshot to pinpoint. Server health does
NOT rule out a runtime Hermes/bytecode issue, but rule out the download path first.

# #1 real cause seen: device got Replit's "Run this app" placeholder HTML (restart race)

Have the user tap **Copy** on the red screen and paste it. If the copied text is the Replit
placeholder page (`<title>Run this app to see the results here.</title>`, dark `#1c2333`
background, ASCII robot, "Go to Replit" link), then Expo Go downloaded an HTML page instead
of the JS bundle → it can't parse it → "Failed to load all assets." This is NOT a code bug.

**Why it happens:** Replit's edge proxy serves that placeholder for the expo domain whenever
Metro is NOT currently listening on the port. There is a ~10-20s window after every workflow
restart where Metro isn't up yet. If you restart the `expo` workflow and then immediately ask
the user to scan/Reload, they hit that window and get the placeholder.

**Internal curl is misleading:** `curl` from inside the container reaches Metro via loopback
and returns the real manifest/bundle even during edge-proxy gaps. To reproduce what the phone
sees, make a TRUE external request — use the `screenshot` tool with `type=external_url` on
`https://$REPLIT_EXPO_DEV_DOMAIN`. Dark ASCII placeholder page = Metro down/not routed; blank
white page (browser rendering the JSON manifest) or real content = Metro up and reachable.

**Fix / how to apply:** Do NOT restart the expo workflow right before telling the user to scan.
Confirm Metro is fully up first (manifest curl returns real JSON with an `id`, log shows the
Expo dev menu / "Logs for your project will appear below"), THEN have the user Reload JS or
rescan the CURRENT QR (not an Expo Go "Recently opened" entry). The expo dev domain
(`$REPLIT_EXPO_DEV_DOMAIN`) is STABLE across restarts, so a stale-domain QR is not the cause.
