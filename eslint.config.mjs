import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
    // Agent-Worktrees liegen im Repo und enthalten eine komplette Kopie samt
    // Build-Ordner — ohne diese Zeile lintet jeder Lauf das Projekt doppelt.
    ".claude/**",
  ]),
]);

export default eslintConfig;
