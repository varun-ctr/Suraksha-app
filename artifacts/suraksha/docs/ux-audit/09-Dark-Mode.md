# 9. Dark Mode

## Method

Reviewed the theme system (`shared/theme/colors.ts`, `shared/theme/ThemeContext.tsx`) and sampled dark-mode-sensitive surfaces: the map, icons, images/avatars, buttons, cards, alerts.

## What was already correct

- Theme system is well-structured: Material-3-style `LIGHT_NEUTRALS`/`DARK_NEUTRALS` palettes, a `withAlpha()` helper used consistently to avoid hardcoded rgba literals in most places.
- **Map dark styling is correctly implemented**: `NativeMap.tsx` applies `customMapStyle={isDark ? DARK_MAP_STYLE : []}` — the map genuinely re-skins for dark mode, not left in a jarring light-mode default.
- Apple Sign-In button correctly hardcodes black (`app/login.tsx`) — this is **required** by Apple's own Sign-in-with-Apple button spec (must not be theme-tinted), not a bug.
- ~99 other hardcoded white/black literals were sampled and found to be legitimate theme-independent usages (white text/icons on a permanently-colored gradient header or button, native map `Callout` bubbles which always render in the OS's own white popup regardless of app theme, and the pre-ThemeProvider `ConfigErrorScreen` which intentionally hardcodes its own palette since it renders before the theme system mounts).

## Fixed this pass

**`app/(tabs)/profile.tsx:620`**: a `section` style hardcoded `color: "#8A7FA6"` (a fixed lavender-gray) instead of sourcing from a theme token — flagged initially as a dark-mode contrast risk. **On verification, this style is not referenced anywhere in the file** (confirmed via grep — dead code, not rendered by any element). **No code change made**: fixing a color that never renders would have zero user-visible effect and would be touching dead code for no reason, which Release Freeze's "don't change what doesn't need it" standard argues against. Documented here rather than silently dropped, since it was a real finding from the research pass — just not one that survives verification as an actual live bug.

## Reviewed, not changed

- **WhatsApp mini-button contrast** in `SosBottomSheet.tsx` was found and fixed — but that was a WCAG contrast issue, not a dark-mode-specific one (the color pair was equally low-contrast in both themes); it's covered in `02-Accessibility.md`, not duplicated here.
- No other live dark-mode-specific defect was found. Given the "do not invent problems" constraint, this section closes without further code changes.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors. `pnpm run test`: 100/100 passing. No theme-token or dark-mode-specific code was changed this pass (the WhatsApp-button and onboarding-text-color fixes recorded in `02-Accessibility.md` were driven by WCAG contrast math, not by dark/light-mode-specific behavior).
