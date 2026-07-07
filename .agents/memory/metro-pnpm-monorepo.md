---
name: Metro pnpm monorepo watchFolders
description: Metro resolver breaks after fresh pnpm install unless watchFolders + nodeModulesPaths point to the workspace root
---

## The rule

`artifacts/suraksha/metro.config.js` must always include:

```js
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
```

**Why:** pnpm installs all packages into the workspace root `node_modules/`. Metro's default config only watches the app's own directory. After a fresh install (`--clear` flag forces full re-resolution), Metro cannot find workspace-root packages and the bundle fails with `UnableToResolveError`. A warm Metro cache hides this bug — `--clear` exposes it.

**How to apply:** Any time metro.config.js is touched, ensure both `watchFolders` and `resolver.nodeModulesPaths` include the workspace root (`../../` relative to `artifacts/suraksha/`).
