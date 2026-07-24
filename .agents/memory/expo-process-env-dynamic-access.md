---
name: Expo process.env dynamic access
description: Metro/Babel cannot inline process.env[dynamicKey] — only static process.env.FOO accesses are substituted at bundle time.
---

## Rule
Never use `process.env[key]` (computed/dynamic access) for EXPO_PUBLIC_* vars in Expo apps. Metro's `babel-plugin-transform-inline-environment-variables` only handles static MemberExpression accesses (`process.env.FOO`). Dynamic access returns `undefined` in the bundled app, causing all vars to appear "missing".

**Why:** validateConfig() originally used `REQUIRED_VARS.filter((key) => !process.env[key]?.trim())`. The dynamic `process.env[key]` was never inlined, so all 8 required vars evaluated to undefined in the bundle, always showing ConfigErrorScreen — even though the secrets were correctly set.

**How to apply:** In any function that checks or reads EXPO_PUBLIC_* vars, enumerate each variable by its literal static name. Use a snapshot object pattern:
```ts
const snapshot = {
  EXPO_PUBLIC_FOO: process.env.EXPO_PUBLIC_FOO,
  EXPO_PUBLIC_BAR: process.env.EXPO_PUBLIC_BAR,
};
const missing = Object.keys(snapshot).filter(k => !snapshot[k]?.trim());
```

## Also: explicitly forward Firebase vars in dev script
The Expo dev script must explicitly pass all EXPO_PUBLIC_FIREBASE_* vars:
```
EXPO_PUBLIC_FIREBASE_API_KEY=$EXPO_PUBLIC_FIREBASE_API_KEY ...
```
Without this, even if secrets are set, a Babel quirk may not pick them up from the inherited env in certain pnpm exec subprocess chains.
</content>
</invoke>