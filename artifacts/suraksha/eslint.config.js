// Flat ESLint config (ESLint 9). Scope is intentionally narrow: this repo's
// safety net is `tsc --noEmit` + the test suite; this config exists purely to
// enforce the feature-first dependency direction — see
// docs/adr/0001-feature-first-architecture.md.
const importPlugin = require("eslint-plugin-import");
const reactHooksPlugin = require("eslint-plugin-react-hooks");
const tsParser = require("@typescript-eslint/parser");

module.exports = [
  {
    ignores: ["node_modules/**", ".expo/**", "dist/**", "server/**"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
      },
    },
    plugins: {
      import: importPlugin,
      // Registered only so pre-existing `eslint-disable-next-line
      // react-hooks/exhaustive-deps` comments in the codebase resolve to a
      // real rule instead of erroring as unknown — the rule itself isn't
      // enabled here since enforcing it is outside this pass's scope.
      "react-hooks": reactHooksPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      // Enforces the allowed dependency direction between architectural
      // layers: domain -> (nothing), core/shared/repositories -> domain
      // only, features -> anything, app -> anything. A violation here means
      // the dependency graph has grown a cycle or an inverted layer.
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./domain",
              from: ["./features", "./app", "./core", "./shared", "./repositories"],
              message:
                "domain/ must have zero dependencies on outer layers — see docs/adr/0003-domain-layer.md",
            },
            {
              // core/di is the DI composition root (see
              // docs/adr/0001-feature-first-architecture.md) and is
              // deliberately excluded here — it's the one place allowed to
              // import concrete repository implementations to wire them up.
              target: [
                "./core/analytics",
                "./core/config",
                "./core/logger",
                "./core/network",
                "./core/permissions",
                "./core/storage",
              ],
              from: ["./features", "./app", "./repositories"],
              message:
                "core/ must not depend on features, app, or repositories — see docs/adr/0001-feature-first-architecture.md",
            },
            {
              target: "./shared",
              from: ["./features", "./app", "./repositories"],
              message:
                "shared/ must not depend on features, app, or repositories — see docs/adr/0001-feature-first-architecture.md",
            },
            {
              target: "./repositories",
              from: ["./features", "./app"],
              message:
                "repositories/ must not depend on features or app — see docs/adr/0002-repository-pattern.md",
            },
          ],
        },
      ],
    },
  },
];
