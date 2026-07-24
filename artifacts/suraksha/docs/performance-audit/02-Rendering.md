# 2. React Rendering

## Headline finding

Before this pass, **`React.memo` appeared zero times anywhere in the app**, and `useMemo` appeared exactly once (`LanguagePicker.tsx`). `useCallback` was used in 9 files (concentrated in the three large context providers). This didn't mean the app was broadly re-rendering badly — the three largest state containers (`AppContext`, `AuthContext`, `SafetyContext`) were already correctly memoized (every mutator wrapped in `useCallback`, every provider `value` wrapped in `useMemo` with an accurate dependency list) — but it meant several concrete, evidence-backed opportunities existed at the leaf/screen level, which this pass fixed.

## Context updates — reviewed, already correct

All three large providers were read in full:
- **`AppContext.tsx`**: every mutator (`addContact`, `setSettings`, etc.) is `useCallback`-wrapped; `value` is `useMemo`'d with a complete dependency list.
- **`AuthContext.tsx`**: every method is `useCallback`-wrapped; `authUser` is itself derived via `useMemo`; `value` is `useMemo`'d.
- **`SafetyContext.tsx`**: every public method and internal helper is `useCallback`-wrapped; `safetyStatus` and `value` are `useMemo`'d.

**No unmemoized object/array/function literal was found in any of these three `value={...}` props.** Consumers of `useApp()`/`useAuth()`/`useSafety()` only re-render when the state they actually use changes — the deep provider nesting in `app/_layout.tsx` is not, by itself, a re-render amplifier here. No change was needed or made to these three files' memoization structure.

## Fixed in this pass

### 1. `NativeMap` markers array — memoized (`app/(tabs)/map.tsx`)

**Before**: `const markers = places.map((p) => ({...}))` was rebuilt fresh — new array, new object identities, new `onNavigate` closures — on every render of `MapScreen`, including renders triggered by unrelated state (`loadingCategory` toggling while tapping a different category chip).
**Fix**: wrapped in `useMemo(() => places.map(...), [places, activeCategory, c])`.
**Why this measurably helps**: `NativeMap` (below) is now `React.memo`'d, and `React.memo`'s shallow prop comparison only skips a re-render if every prop is reference-equal to the previous render. Before this fix, `markers` had a new identity on every parent render regardless of memoization on `NativeMap`, which would have made the `React.memo` wrapper a no-op. With both fixes together, a `MapScreen` re-render for an unrelated reason no longer forces `NativeMap` to re-render or re-diff its `markers.map(...)` JSX (which builds a `Marker`+`Callout` tree per place) at all.

### 2. `NativeMap` — wrapped in `React.memo`

**Before**: not memoized at all — every parent (`MapScreen`) render re-rendered the whole native map view unconditionally.
**Fix**: `export const NativeMap = React.memo(function NativeMap({...}) {...})`.
**Why this is safe now (it wasn't, before fix #1)**: `NativeMap`'s props are `lat`/`lng` (primitives), `markers` (now memoized, see above), `showsUserLocation`/`isDark` (primitives/booleans), `onLocationUpdate` (not passed by the only caller, always `undefined`). With `markers` now stable, every prop is either a primitive or a reference that only changes when the underlying data actually changes — exactly the condition `React.memo`'s default shallow comparison needs to work correctly.

### 3. Tab bar icon functions — hoisted to module scope (`app/(tabs)/_layout.tsx`)

**Before**: each of the 5 tabs' `tabBarIcon` was an inline arrow function defined inside `TabLayout`'s JSX, recreated on every render of `TabLayout` (which happens on any theme or language change, since it calls `useTheme()`/`useI18n()`).
**Fix**: hoisted to 5 named functions (`renderHomeIcon`, `renderMapIcon`, etc.) at module scope, plus a small shared `TabIcon` component.
**Why this is safe**: none of these functions ever closed over any component-scoped value — `color`/`focused` are supplied fresh by React Navigation's own tab-bar renderer on every call, and the icon `name`/size mapping is fixed per tab. There was no reason for them to be defined inside the component in the first place.
**Why this measurably helps**: a module-scope function has one stable identity for the entire app lifetime. Before this fix, a theme or language switch gave all 5 tabs' `options.tabBarIcon` a new function identity, which React Navigation's internal tab-bar renderer would treat as "this tab's icon changed" even though the rendered output is identical — forcing it to re-render the icon for every tab, not just re-apply the new color.

## Reviewed, not changed (with reasoning)

- **`SosBottomSheet.tsx` re-rendering once per second during an active SOS**: this is *substantially* legitimate, not a bug — the sheet displays a live elapsed-seconds counter (`sos.seconds`, incremented every second by `SafetyContext`'s `sosTimer`), so the component genuinely must re-render on that cadence to show the correct number. Wrapping the whole component in `React.memo` would have **zero effect** here, since the `sos` prop's content (specifically `.seconds`) truly changes every tick — memoization only helps when props *don't* need to change, and this is exactly the case where they do. The narrower, real opportunity — extracting the per-contact alert-status list into a separately-memoized sub-component so *that* portion doesn't rebuild its inline `onPress` handlers every second even though only the timer text needs to update — was reviewed but **not implemented in this pass**: `SosBottomSheet` is the single most safety-critical UI surface in the app (the active-emergency screen), and a structural component-extraction carries more risk of an unintended visual/behavioral regression than this pass's other fixes (all either pure-logic, additive memoization, or module-scope hoisting with byte-for-byte identical output). Recommended as a well-scoped follow-up with real-device verification, not rushed here.
- **Contacts list / incident-reports list rendered via `ScrollView` + `.map()` instead of `FlatList`**: reviewed and left as-is — both lists are hard-bounded (`MAX_CONTACTS = 5`; a single user's own incident reports), so virtualization would add complexity for no measurable benefit at this scale. The one `FlatList` in the app (`LanguagePicker.tsx`, a closed set of supported languages) was already well-optimized (`useCallback`-wrapped `renderItem`/`keyExtractor`) before this pass — no change needed.
- **`Avatar` component using core `Image` instead of `expo-image`**: **fixed** — see the "Image rendering" section below.

## Image rendering — fixed in this pass

**Before**: `expo-image` (which has built-in persistent disk+memory caching, unlike core React Native's `Image`) was used in exactly one place in the whole app — the incident-photo preview in `app/(tabs)/incident.tsx`. Every other image-rendering path — most importantly `shared/components/ui.tsx`'s `Avatar` component, used for every contact/profile avatar app-wide, including inside `SosBottomSheet` — used core RN `Image`, which has no persistent caching.
**Fix**: swapped `Avatar`'s `Image` import from `"react-native"` to `"expo-image"`, and added `contentFit="cover"` (matching RN `Image`'s default `resizeMode`, so the rendered output is visually identical — no UI change) and `cachePolicy="memory-disk"`.
**Why this measurably helps**: the same remote avatar URL (`profile.avatarUrl` or a contact's `avatarUrl`) is re-rendered on the home screen, profile screen, contacts screen, and — critically — once per second inside `SosBottomSheet` for the entire duration of an active SOS (driven by the elapsed-timer re-render discussed above). With core `Image`, each of those re-renders/remounts had no guaranteed persistent-disk cache to serve from; with `expo-image`, the same URL is fetched and decoded once, then served from disk/memory cache on every subsequent render — directly reducing redundant network fetches and image-decode CPU work specifically during an active SOS, when the device's resources matter most.
**Why this is safe / zero UI change**: `expo-image`'s `<Image>` is designed as a drop-in replacement for RN's `Image` for the `source={{uri}}` + `style` usage pattern this component already used; `contentFit="cover"` is the explicit equivalent of RN's default behavior, so the rendered pixels are unchanged.

## Navigation re-renders

`Gate`'s `RootLayoutNav` is a separate top-level function component (not defined inline), with static `<Stack.Screen>` JSX and no inline `options` render-prop functions — no re-mount risk found here, no change needed.

## What would need real-device profiling to further quantify

Whether the `NativeMap`/tab-bar fixes produce a *measurable* frame-time improvement (vs. simply "correct, lower-cost React behavior verified by code reasoning") would need Flipper's React DevTools profiler or Xcode Instruments' Core Animation trace on a real device with the actual Google Maps SDK view — not something this environment can produce. The causal mechanism for each fix (identity-stable props enabling `React.memo`'s comparison to actually skip work) is verified directly from React's own documented behavior, not speculated.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors (9 pre-existing warnings, unrelated). `pnpm run test`: 100/100 passing. `npx madge --circular`: clean.
