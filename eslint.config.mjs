import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Extract plugins registered by nextVitals so we can reference their rules in overrides.
const nextVitalsArr = Array.isArray(nextVitals) ? nextVitals : [nextVitals];
const reactHooksPlugin = nextVitalsArr.find((c) => c.plugins?.["react-hooks"])?.plugins?.["react-hooks"];
const nextPlugin = nextVitalsArr.find((c) => c.plugins?.["@next/next"])?.plugins?.["@next/next"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Legacy Vite build output (not part of Next.js build)
    "dist/**",
    // Backend compiled JS and source (not part of Next.js frontend)
    "server/**",
    // Duplicate node_modules directories
    "node_modules 3/**",
    // Build/utility scripts (CommonJS, not part of Next.js frontend)
    "scripts/**",
    "health-check-v2.mjs",
  ]),
  // Downgrade rules that fire extensively in Vite-migrated code.
  // TODO: fix these incrementally after migration stabilises.
  {
    plugins: {
      ...(reactHooksPlugin ? { "react-hooks": reactHooksPlugin } : {}),
      ...(nextPlugin ? { "@next/next": nextPlugin } : {}),
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      ...(reactHooksPlugin ? {
        "react-hooks/rules-of-hooks": "warn",
        "react-hooks/set-state-in-effect": "warn",
        "react-hooks/static-components": "warn",
        "react-hooks/refs": "warn",
        "react-hooks/immutability": "warn",
        "react-hooks/purity": "warn",
        "react-hooks/preserve-manual-memoization": "warn",
        "react-hooks/use-memo": "warn",
      } : {}),
      ...(nextPlugin ? { "@next/next/no-html-link-for-pages": "warn" } : {}),
    },
  },
]);

export default eslintConfig;
