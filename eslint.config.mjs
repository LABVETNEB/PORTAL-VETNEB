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

// TEST-GLOBAL-05B: the test suite gets its own minimal, type-aware rule set,
// kept out of lintableFiles so backend rules and results do not change.
// Mirrors test/tsconfig.json, which only includes *.ts.
const testFiles = ["test/**/*.ts"];
const testRunner = "/^(test|it|describe|suite)$/";
const onlyMessage = "Committed .only narrows the suite; remove it.";

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
  {
    files: testFiles,
    languageOptions: {
      globals: globals.node,
      parser: typescriptParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `CallExpression[callee.property.name='only'][callee.object.name=${testRunner}]`,
          message: onlyMessage,
        },
        {
          selector: `CallExpression[callee.property.name='only'][callee.object.property.name=${testRunner}]`,
          message: onlyMessage,
        },
        {
          selector: `CallExpression[callee.name=${testRunner}] > ObjectExpression > Property[key.name='only'][value.value=true]`,
          message: onlyMessage,
        },
        {
          selector: `CallExpression[callee.property.name=${testRunner}] > ObjectExpression > Property[key.name='only'][value.value=true]`,
          message: onlyMessage,
        },
        {
          selector: `CallExpression[callee.name=${testRunner}] > ObjectExpression > Property[key.value='only'][value.value=true]`,
          message: onlyMessage,
        },
        {
          selector: `CallExpression[callee.property.name=${testRunner}] > ObjectExpression > Property[key.value='only'][value.value=true]`,
          message: onlyMessage,
        },
        // The allowlist below also matches TestContext#test, so floating
        // subtests are rejected here instead.
        {
          selector: `ExpressionStatement > CallExpression[callee.type='MemberExpression'][callee.property.name=${testRunner}]`,
          message: "Await subtests; a floating t.test() is cancelled when its parent ends.",
        },
        {
          selector: `ExpressionStatement > UnaryExpression[operator='void'] > CallExpression[callee.type='MemberExpression'][callee.property.name=${testRunner}]`,
          message: "Await subtests; a floating t.test() is cancelled when its parent ends.",
        },
      ],
      // node:test registers top-level test()/it()/describe()/suite() promises
      // with the runner itself.
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          allowForKnownSafeCalls: [
            { from: "package", package: "node:test", name: ["test", "it", "describe", "suite"] },
          ],
        },
      ],
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
