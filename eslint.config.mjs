import eslint from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import globals from "globals";

const asWarnings = (rules) =>
  Object.fromEntries(
    Object.entries(rules).map(([name, setting]) => {
      if (setting === "off" || setting === 0) return [name, "off"];
      if (Array.isArray(setting)) return [name, ["warn", ...setting.slice(1)]];
      return [name, "warn"];
    }),
  );

const lintableFiles = [
  "server/**/*.{ts,mts,mjs}",
  "scripts/**/*.{ts,mts,mjs}",
  "drizzle/**/*.{ts,mts,mjs}",
];

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "drizzle/migrations/**",
    ],
  },
  {
    files: lintableFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      ...asWarnings(eslint.configs.recommended.rules),
      // WBR-04a (VET-10): promoted to error. Zero current violations across
      // server/**, scripts/**, drizzle/**; both catch runtime-correctness
      // bugs (TDZ/scope leaks across switch cases, TypeError on the
      // short-circuited side of `?.`), not style.
      "no-case-declarations": "error",
      "no-unsafe-optional-chaining": "error",
    },
  },
  {
    files: ["server/**/*.{ts,mts}", "scripts/**/*.{ts,mts}", "drizzle/**/*.{ts,mts}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      ...asWarnings(typescriptEslint.configs.recommended.rules),
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];
