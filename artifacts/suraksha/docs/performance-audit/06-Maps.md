# 6. Maps Performance

## Library and setup

`features/journey/components/NativeMap.tsx` wraps `react-native-maps` (not `expo-maps`), with `PROVIDER_GOOGLE` on native and a trivial empty-`View` stub on web (`NativeMap.web.tsx`, since `react-native-maps` can't run in a web bundle). This is the only map surface in the app (`app/(tabs)/map.tsx`).

## Map rendering — fixed in this pass

**Before**: `NativeMap` was not `React.memo`'d, and its caller (`map.tsx`) rebuilt the `markers` array (and every marker's `onNavigate` closure) fresh on every render — so any unrelated re-render of `MapScreen` (e.g. toggling `loadingCategory` while tapping a different category chip) rebuilt and re-diffed the entire native map view, including every `Marker`/`Callout` element.
**Fix**: (1) `markers` is now `useMemo`'d in `map.tsx`, keyed on `[places, activeCategory, c]`; (2) `NativeMap` is now wrapped in `React.memo`. See `02-Rendering.md` for the full before/after and why fix (2) only became effective once fix (1) gave it stable props to compare against.

## Marker updates

Markers are keyed by `m.id` (`<Marker key={m.id} ...>`), so React already reconciled them correctly (updating in place, not unmounting/remounting native views) even before this pass's fix — the fix's value is in reducing *how often* that reconciliation runs, not in fixing incorrect reconciliation (there wasn't any).

## Region updates / camera movement

Two independent mechanisms drive the camera, both reviewed:
1. **Prop-driven** (`lat`/`lng` from the parent): an effect calls `mapRef.current?.animateToRegion(...)` only when these props actually change. Traced the only real caller (`map.tsx`, via `useMapScreen()`'s `point`) — `useLocation()` fetches the initial position **once** on mount, not as a continuous stream, so in practice this effect fires once per screen visit, not repeatedly. Confirmed via reading `useLocation.ts` directly, not assumed.
2. **Internal GPS watch** (inside `NativeMap` itself): `Location.watchPositionAsync({ timeInterval: 5000, distanceInterval: 10 }, handleLocationUpdate)` calls `animateToRegion(...)` on every watch callback — imperatively, via the `mapRef`, **not** via `setState`. This means it does **not** by itself trigger a React re-render of `NativeMap` or its children — an important distinction from the fixed markers-array issue, since this camera-follow mechanism was never causing the re-render problem in the first place.

**Not changed in this pass**: the internal watch's `distanceInterval: 10` (meters) means a walking user could trigger a camera re-animation quite often. This is imperative native-side work (not a React re-render), so its cost profile is different from the render-cost issues this pass fixed — whether it causes visible jank is a real-device profiling question (see below), and changing the threshold without being able to observe the actual on-map visual effect on a real device risks making the "follow me" behavior feel unresponsive instead. Not touched.

## Polyline rendering

No polylines are rendered anywhere in the app — `journeys.route_json` (the schema column that would back a route polyline) is confirmed dead/unwritten (cross-referenced with the prior backend audit's independent finding). Not applicable.

## `showsUserLocation` vs. JS-driven marker

`showsUserLocation={true}` (the default) is used — the native "blue dot" for the user's own position is OS-driven, which is the cheaper option compared to a JS-managed marker requiring its own state updates. `followsUserLocation` is not used; camera-following is instead done manually via `animateToRegion` (see above) — this is a slightly more expensive pattern than letting the native SDK handle following directly, but changing it would be a behavioral change to camera-follow feel that needs real-device comparison, not a code-only "obviously better" swap — not changed in this pass.

## Re-render frequency — before/after

**Before this pass**: every `MapScreen` re-render (for any reason) forced a full `NativeMap` re-render.
**After this pass**: `NativeMap` only re-renders when `lat`, `lng`, `markers` (content, not just array reference), `showsUserLocation`, or `isDark` actually change.

## Memory usage

No map-specific memory issue was found — `NativeMap`'s only module-level-adjacent state is its own `mapRef`/`internalRegion`/`initialRegionSet` refs and state, all scoped to the component instance and cleaned up implicitly on unmount (no manual cleanup needed for these). The internal `Location.watchPositionAsync` subscription **is** properly cleaned up: `useEffect(() => { ...; return () => { cancelled = true; sub?.remove(); }; }, [handleLocationUpdate])` — confirmed present and correct, not changed.

## What would need real-device profiling to further quantify

- Actual frame-time cost of a `Marker`/`Callout` re-render on a real device with the Google Maps SDK view (Flipper's React DevTools profiler or Xcode Instruments' Core Animation trace) — this pass's fix is verified correct by React's own documented `memo`/prop-identity semantics, but the *magnitude* of the improvement (how many milliseconds saved per avoided re-render) needs a real device to measure.
- Whether the internal 5-second/10-meter GPS watch's `animateToRegion` calls cause visible jank on lower-end Android devices — not measurable from source alone.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run test`: 100/100 passing. `npx madge --circular`: clean. No behavioral change to what the map displays — verified by reading the fix's diff (a `useMemo` wrapper and a `React.memo` wrapper add no new logic, only memoization boundaries).
