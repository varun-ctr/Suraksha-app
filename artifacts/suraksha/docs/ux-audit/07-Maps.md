# 7. Maps UX

## Method

Reviewed `features/journey/components/NativeMap.tsx` (the app's only map surface, used from `app/(tabs)/map.tsx`) and its wrapping screen for camera behavior, marker clarity, gesture support, and how the location-permission notice interacts with map controls.

## Findings — reviewed, no gaps requiring a code change

- **Camera movement** is animated, not jarring: `animateToRegion(next, 600)` on prop-driven moves, `800ms` on the internal 5-second GPS watch. No abrupt jumps.
- **Current location** uses the native `showsUserLocation` blue dot (OS-driven, the cheaper and HIG-correct option vs. a JS-managed marker).
- **Markers** are color-coded, keyed by `id` (correct React reconciliation — no unmount/remount churn), with a tappable `Callout` showing name/address and a "Navigate →" action. Clear tap-for-detail feedback.
- **Zoom/pan gestures** are left at `react-native-maps` defaults — never disabled — so pinch-zoom works normally.
- **Safe areas**: the category panel is a fixed-height absolute strip, not a full sheet, and does not obscure the map body.
- **`showsCompass` and `showsMyLocationButton` are explicitly disabled** (`NativeMap.tsx`), and the app provides no substitute for either (no compass indicator, no recenter button). This is a genuine, if minor, feature gap relative to typical native map UX — but adding a compass/recenter control is new UI surface, not a targeted bug fix, so it was **not implemented this pass**. Flagged as a P2 recommendation.

## Fixed this pass (cross-referenced from `06-Permissions.md`)

The map screen's location-denied notice gained an "Open Settings" action alongside its existing "Enable Location" retry button — see `06-Permissions.md` for the full description; listed here because it's the map screen's only user-facing change this pass.

## Reviewed, deliberately not changed

- **Internal 5-second/10-meter GPS-watch `animateToRegion` calls**: this is imperative, native-side camera movement (not a React re-render — already established as a non-issue in the prior performance-certification phase's `06-Maps.md`). Whether its cadence causes visible jank on lower-end Android hardware is a real-device profiling question this environment cannot answer; not changed without that evidence.
- **`followsUserLocation` is not used** in favor of the manual `animateToRegion` pattern — changing this would alter the camera-follow *feel*, which needs real-device comparison before a decision, not a code-only "obviously better" swap.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors. `pnpm run test`: 100/100 passing. No behavioral change to map rendering or gesture handling this pass.
