import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { ESLint, type Linter } from "eslint";
import { readSourceFile } from "../../helpers/tracked-source-files.ts";

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type Contract = {
  pkg: PackageJson;
  config: string;
};

const BASELINE_TEST =
  'node --experimental-strip-types --experimental-specifier-resolution=node --test "test/**/*.test.ts"';
const BASELINE_COVERAGE =
  'node --experimental-strip-types --experimental-specifier-resolution=node --experimental-test-coverage --test "test/**/*.test.ts"';
const REQUIRED_SCOPES = ["server", "scripts", "drizzle"] as const;
const REQUIRED_DEPENDENCIES = [
  "@eslint/js",
  "@typescript-eslint/eslint-plugin",
  "@typescript-eslint/parser",
  "eslint",
  "globals",
] as const;
const FORBIDDEN_DEPENDENCIES = [
  "prettier",
  "eslint-config-prettier",
  "eslint-plugin-prettier",
  "@stylistic/eslint-plugin",
] as const;
// WBR-04a (VET-10): rules promoted from the diagnostic baseline to a real
// bloqueante severity. Checked by exact severity string, never by mere
// rule-name presence, so a silent "error" -> "warn" downgrade is caught.
const PROMOTED_ERROR_RULES = [
  "no-case-declarations",
  "no-unsafe-optional-chaining",
] as const;

// TEST-GLOBAL-05B: test/** is linted by its own block. The backend scope stays
// frozen to server/scripts/drizzle; the test block is frozen to its glob, its
// type-aware parser and its three rules.
const BACKEND_LINTABLE_FILES = [
  "server/**/*.{ts,mts,mjs}",
  "scripts/**/*.{ts,mts,mjs}",
  "drizzle/**/*.{ts,mts,mjs}",
];
const LINTABLE_FILES_DECLARATION = `const lintableFiles = [\n${BACKEND_LINTABLE_FILES.map((glob) => `  "${glob}",\n`).join("")}];`;
const TEST_LINT_GLOB = "test/**/*.ts";
const TEST_FILES_DECLARATION = `const testFiles = ["${TEST_LINT_GLOB}"];`;
const TEST_PROBE_FILE = "test/unit/infrastructure/backend-lint-baseline-contract.test.ts";
const SERVER_PROBE_FILE = "server/index.ts";
const FRONTEND_PROBE_FILE = "frontend/src/lib/api.ts";
const ONLY_RULE = "no-restricted-syntax";
const FLOATING_RULE = "@typescript-eslint/no-floating-promises";
const UNUSED_RULE = "@typescript-eslint/no-unused-vars";
const TEST_RUNNER = "/^(test|it|describe|suite)$/";
const ONLY_SELECTORS = [
  `CallExpression[callee.property.name='only'][callee.object.name=${TEST_RUNNER}]`,
  `CallExpression[callee.property.name='only'][callee.object.property.name=${TEST_RUNNER}]`,
  `CallExpression[callee.name=${TEST_RUNNER}] > ObjectExpression > Property[key.name='only'][value.value=true]`,
  `CallExpression[callee.property.name=${TEST_RUNNER}] > ObjectExpression > Property[key.name='only'][value.value=true]`,
];
const FLOATING_SUBTEST_SELECTOR = `ExpressionStatement > CallExpression[callee.type='MemberExpression'][callee.property.name=${TEST_RUNNER}]`;
const NODE_TEST_SAFE_CALLS = [
  { from: "package", package: "node:test", name: ["test", "it", "describe", "suite"] },
];
const UNUSED_VARS_OPTIONS = {
  argsIgnorePattern: "^_",
  caughtErrorsIgnorePattern: "^_",
  varsIgnorePattern: "^_",
};

function readContract(): Contract {
  return {
    pkg: JSON.parse(
      readSourceFile("package.json"),
    ) as PackageJson,
    config: readSourceFile("eslint.config.mjs"),
  };
}

function validateContract({ pkg, config }: Contract): string[] {
  const issues: string[] = [];
  const scripts = pkg.scripts ?? {};
  const command = scripts["lint:backend"] ?? "";
  const packageNames = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);

  if (scripts.test !== BASELINE_TEST) issues.push("test changed");
  if (scripts["test:coverage"] !== BASELINE_COVERAGE) {
    issues.push("test:coverage changed");
  }
  if (!command) issues.push("lint:backend missing");
  if (!/^eslint\s/.test(command)) issues.push("eslint is not invoked directly");
  if (/\beslint\s+\.(?:\s|$)/.test(command)) issues.push("repository-wide lint");
  if (/(?:^|\s)["']?(?:frontend(?:\/|\b)|test\/)/.test(command)) {
    issues.push("unauthorized scope");
  }
  if (/--fix(?:-dry-run)?(?:\s|$)/.test(command)) issues.push("autofix flag");
  if (/[|<>]|&&/.test(command)) issues.push("shell control or redirection");
  if (/\|\|\s*true\b/.test(command)) issues.push("failure tolerance");

  for (const scope of REQUIRED_SCOPES) {
    const quotedGlob = new RegExp(
      `(["'])${scope.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/\\*\\*\\/\\*\\.\\{[^"']+\\}\\1`,
    );
    const occurrences = command.match(new RegExp(`${scope}/`, "g"))?.length ?? 0;
    if (occurrences !== 1) issues.push(`${scope} scope count`);
    if (!quotedGlob.test(command)) issues.push(`${scope} glob is not quoted`);
  }

  if (!config.trim()) issues.push("eslint config missing");
  if (!/globals:\s*globals\.node/.test(config)) issues.push("Node globals missing");
  if (!/rules:\s*(?:asWarnings|\{)/.test(config)) issues.push("active rules missing");
  if (/rules:\s*\{\s*\}/.test(config)) issues.push("empty rules");
  if (!/files:\s*lintableFiles/.test(config)) issues.push("scoped config missing");
  if (!config.includes(LINTABLE_FILES_DECLARATION)) issues.push("backend lint scope changed");
  if (/frontend\//.test(config)) issues.push("config scope expanded");
  if (
    (config.match(/test\/\*\*/g) ?? []).length !== 1 ||
    !config.includes(TEST_FILES_DECLARATION)
  ) {
    issues.push("config scope expanded");
  }
  if (!/files:\s*testFiles/.test(config)) issues.push("test lint block missing");

  for (const rule of PROMOTED_ERROR_RULES) {
    const exactSeverity = new RegExp(`"${rule}":\\s*"error"`);
    if (!exactSeverity.test(config)) {
      issues.push(`${rule} not promoted to error`);
    }
  }

  for (const dependency of REQUIRED_DEPENDENCIES) {
    if (!packageNames.has(dependency)) {
      issues.push(`lint dependency missing: ${dependency}`);
    }
  }
  for (const dependency of FORBIDDEN_DEPENDENCIES) {
    if (packageNames.has(dependency)) {
      issues.push(`forbidden formatting dependency: ${dependency}`);
    }
  }

  return issues;
}

function mutate(
  contract: Contract,
  apply: (candidate: Contract) => void,
): Contract {
  const candidate = structuredClone(contract);
  apply(candidate);
  return candidate;
}

function assertMutationRejected(
  contract: Contract,
  name: string,
  apply: (candidate: Contract) => void,
  expectedIssue: string,
): void {
  assert.ok(
    validateContract(mutate(contract, apply)).includes(expectedIssue),
    `${name} mutation must be rejected with "${expectedIssue}"`,
  );
}

type EffectiveLanguageOptions = {
  parser?: { meta?: { name?: string } };
  parserOptions?: { projectService?: unknown; tsconfigRootDir?: unknown };
};

async function loadLintConfig(): Promise<Linter.Config[]> {
  const module = await import(pathToFileURL(resolve(process.cwd(), "eslint.config.mjs")).href);
  return module.default as Linter.Config[];
}

function severityOf(entry: unknown): "error" | "warn" | "off" {
  const level = Array.isArray(entry) ? entry[0] : entry;
  if (level === 2 || level === "error") return "error";
  if (level === 1 || level === "warn") return "warn";
  return "off";
}

function optionsOf(entry: unknown): unknown[] {
  return Array.isArray(entry) ? entry.slice(1) : [];
}

// Checks the declared blocks and the config ESLint actually resolves for a real
// spec, a backend file and a frontend file, so a weakened rule, a leaked glob or
// an ignore that silences test/** cannot pass by keeping the text shape.
async function validateTestLintConfig(blocks: readonly Linter.Config[]): Promise<string[]> {
  const issues: string[] = [];
  const testBlocks = blocks.filter((block) => block.files?.includes(TEST_LINT_GLOB));

  if (blocks.filter((block) => isDeepStrictEqual(block.files, BACKEND_LINTABLE_FILES)).length !== 1) {
    issues.push("backend lintableFiles changed");
  }
  if (testBlocks.length !== 1) issues.push("test lint block missing");
  for (const block of blocks) {
    for (const glob of (block.files ?? []).flat()) {
      if (typeof glob !== "string") {
        issues.push("unsupported files matcher");
        continue;
      }
      if (glob.startsWith("frontend/")) issues.push("frontend glob present");
      if (
        glob.startsWith("test/") &&
        !(testBlocks.length === 1 && block === testBlocks[0] && isDeepStrictEqual(block.files, [TEST_LINT_GLOB]))
      ) {
        issues.push("test glob outside the test block");
      }
    }
  }

  const eslint = new ESLint({
    cwd: process.cwd(),
    overrideConfigFile: true,
    overrideConfig: [...blocks],
  });
  if (await eslint.isPathIgnored(TEST_PROBE_FILE)) issues.push("test file ignored");

  const testConfig = (await eslint.calculateConfigForFile(TEST_PROBE_FILE)) as Linter.Config | undefined;
  const testRules = testConfig?.rules;
  if (!testRules) {
    issues.push("test file not linted");
  } else {
    const languageOptions = (testConfig?.languageOptions ?? {}) as EffectiveLanguageOptions;
    if (languageOptions.parser?.meta?.name !== "typescript-eslint/parser") {
      issues.push("test parser is not typescript-eslint");
    }
    if (languageOptions.parserOptions?.projectService !== true) {
      issues.push("type information disabled");
    }
    if (resolve(String(languageOptions.parserOptions?.tsconfigRootDir)) !== resolve(process.cwd())) {
      issues.push("type information root changed");
    }
    if (severityOf(testRules[FLOATING_RULE]) !== "error") issues.push("no-floating-promises is not error");
    if (!isDeepStrictEqual(optionsOf(testRules[FLOATING_RULE]), [{ allowForKnownSafeCalls: NODE_TEST_SAFE_CALLS }])) {
      issues.push("floating safe calls changed");
    }
    if (severityOf(testRules[ONLY_RULE]) !== "error") issues.push(".only guard is not error");
    const selectors = optionsOf(testRules[ONLY_RULE]).map((option) => (option as { selector?: string }).selector);
    for (const selector of ONLY_SELECTORS) {
      if (!selectors.includes(selector)) issues.push(".only selector missing");
    }
    if (!selectors.includes(FLOATING_SUBTEST_SELECTOR)) issues.push("floating subtest selector missing");
    if (severityOf(testRules[UNUSED_RULE]) !== "warn") issues.push("no-unused-vars is not warn");
    if (!isDeepStrictEqual(optionsOf(testRules[UNUSED_RULE]), [UNUSED_VARS_OPTIONS])) {
      issues.push("no-unused-vars options changed");
    }
    if (testRules["no-case-declarations"] !== undefined) issues.push("backend rules leaked into test lint");
  }

  const serverConfig = (await eslint.calculateConfigForFile(SERVER_PROBE_FILE)) as Linter.Config | undefined;
  if (!serverConfig?.rules) {
    issues.push("backend file not linted");
  } else {
    const serverOptions = (serverConfig.languageOptions ?? {}) as EffectiveLanguageOptions;
    if (
      serverConfig.rules[FLOATING_RULE] !== undefined ||
      serverConfig.rules[ONLY_RULE] !== undefined ||
      serverOptions.parserOptions?.projectService !== undefined
    ) {
      issues.push("test rules leaked into backend lint");
    }
  }

  if ((await eslint.calculateConfigForFile(FRONTEND_PROBE_FILE)) !== undefined) {
    issues.push("frontend linted by root config");
  }

  return issues;
}

function cloneBlocks(blocks: readonly Linter.Config[]): Linter.Config[] {
  return blocks.map((block) => ({
    ...block,
    ...(block.files ? { files: [...block.files] } : {}),
    ...(block.rules ? { rules: { ...block.rules } } : {}),
    ...(block.languageOptions
      ? {
          languageOptions: {
            ...block.languageOptions,
            ...(block.languageOptions.parserOptions
              ? { parserOptions: { ...block.languageOptions.parserOptions } }
              : {}),
          },
        }
      : {}),
  }));
}

function testBlockOf(blocks: Linter.Config[]): Linter.Config {
  const block = blocks.find((candidate) => candidate.files?.includes(TEST_LINT_GLOB));
  assert.ok(block, "test lint block must exist before mutating it");
  return block;
}

function blockWithFile(blocks: Linter.Config[], glob: string): Linter.Config {
  const block = blocks.find((candidate) => candidate.files?.includes(glob));
  assert.ok(block, `block for ${glob} must exist before mutating it`);
  return block;
}

async function assertConfigMutationRejected(
  blocks: readonly Linter.Config[],
  name: string,
  apply: (candidate: Linter.Config[]) => void,
  expectedIssues: readonly string[],
): Promise<void> {
  const candidate = cloneBlocks(blocks);
  apply(candidate);
  const issues = await validateTestLintConfig(candidate);
  for (const expectedIssue of expectedIssues) {
    assert.ok(
      issues.includes(expectedIssue),
      `${name} mutation must be rejected with "${expectedIssue}"; got ${JSON.stringify(issues)}`,
    );
  }
}

test("backend lint baseline is scoped, diagnostic, and independently configured", () => {
  assert.deepEqual(validateContract(readContract()), []);
});

test("backend lint contract rejects unsafe in-memory mutations", async () => {
  const contract = readContract();
  const lint = contract.pkg.scripts!["lint:backend"];

  for (const scope of REQUIRED_SCOPES) {
    assertMutationRejected(
      contract,
      `missing ${scope} scope`,
      (candidate) => {
        candidate.pkg.scripts!["lint:backend"] = lint.replace(
          new RegExp(`\\s"${scope}/[^"]+"`),
          "",
        );
      },
      `${scope} scope count`,
    );
  }
  assertMutationRejected(
    contract,
    "frontend scope",
    (candidate) => {
      candidate.pkg.scripts!["lint:backend"] = `${lint} "frontend/**/*.ts"`;
    },
    "unauthorized scope",
  );
  assertMutationRejected(
    contract,
    "repository-wide lint",
    (candidate) => {
      candidate.pkg.scripts!["lint:backend"] = "eslint .";
    },
    "repository-wide lint",
  );
  assertMutationRejected(
    contract,
    "unquoted glob",
    (candidate) => {
      candidate.pkg.scripts!["lint:backend"] = lint.replaceAll('"', "");
    },
    "server glob is not quoted",
  );
  for (const flag of ["--fix", "--fix-dry-run"]) {
    assertMutationRejected(
      contract,
      flag,
      (candidate) => {
        candidate.pkg.scripts!["lint:backend"] = `${lint} ${flag}`;
      },
      "autofix flag",
    );
  }
  for (const suffix of ["|| true", "| tee lint.txt", "> lint.txt"]) {
    assertMutationRejected(
      contract,
      suffix,
      (candidate) => {
        candidate.pkg.scripts!["lint:backend"] = `${lint} ${suffix}`;
      },
      suffix === "|| true" ? "failure tolerance" : "shell control or redirection",
    );
  }
  assertMutationRejected(
    contract,
    "empty rules",
    (candidate) => {
      candidate.config = candidate.config.replace(
        /rules:\s*\{\n\s*\.\.\.asWarnings\(eslint\.configs\.recommended\.rules\),[\s\S]*?\n    \},/,
        "rules: {},",
      );
    },
    "empty rules",
  );
  for (const rule of PROMOTED_ERROR_RULES) {
    assertMutationRejected(
      contract,
      `${rule} downgraded to warn`,
      (candidate) => {
        candidate.config = candidate.config.replace(
          `"${rule}": "error"`,
          `"${rule}": "warn"`,
        );
      },
      `${rule} not promoted to error`,
    );
  }
  assertMutationRejected(
    contract,
    "script alias",
    (candidate) => {
      candidate.pkg.scripts!["lint:backend"] = "pnpm lint";
    },
    "eslint is not invoked directly",
  );
  assertMutationRejected(
    contract,
    "test script",
    (candidate) => {
      candidate.pkg.scripts!.test = "pnpm lint:backend";
    },
    "test changed",
  );
  assertMutationRejected(
    contract,
    "coverage script",
    (candidate) => {
      candidate.pkg.scripts!["test:coverage"] = "pnpm test";
    },
    "test:coverage changed",
  );
  const testGlobInBackendScope = (candidate: Contract) => {
    candidate.config = candidate.config.replace(
      LINTABLE_FILES_DECLARATION,
      LINTABLE_FILES_DECLARATION.replace("];", `  "${TEST_LINT_GLOB}",\n];`),
    );
  };
  assertMutationRejected(contract, "test glob in lintableFiles", testGlobInBackendScope, "backend lint scope changed");
  assertMutationRejected(contract, "test glob in lintableFiles", testGlobInBackendScope, "config scope expanded");
  assertMutationRejected(
    contract,
    "frontend glob in test lint scope",
    (candidate) => {
      candidate.config = candidate.config.replace(
        TEST_FILES_DECLARATION,
        TEST_FILES_DECLARATION.replace("];", ', "frontend/**/*.ts"];'),
      );
    },
    "config scope expanded",
  );
  assertMutationRejected(
    contract,
    "widened test glob",
    (candidate) => {
      candidate.config = candidate.config.replace(TEST_FILES_DECLARATION, 'const testFiles = ["test/**/*"];');
    },
    "config scope expanded",
  );
  assertMutationRejected(
    contract,
    "test lint block removed",
    (candidate) => {
      candidate.config = candidate.config.replace(/files:\s*testFiles/, "files: []");
    },
    "test lint block missing",
  );

  // TEST-GLOBAL-05B: the same weakenings, checked against the config ESLint
  // actually resolves rather than the file text.
  const blocks = await loadLintConfig();

  await assertConfigMutationRejected(blocks, "floating promises error -> warn", (candidate) => {
    const rules = testBlockOf(candidate).rules!;
    rules[FLOATING_RULE] = ["warn", ...optionsOf(rules[FLOATING_RULE])] as Linter.RuleEntry;
  }, ["no-floating-promises is not error"]);
  await assertConfigMutationRejected(blocks, ".only guard error -> warn", (candidate) => {
    const rules = testBlockOf(candidate).rules!;
    rules[ONLY_RULE] = ["warn", ...optionsOf(rules[ONLY_RULE])] as Linter.RuleEntry;
  }, [".only guard is not error"]);
  await assertConfigMutationRejected(blocks, ".only selector dropped", (candidate) => {
    const rules = testBlockOf(candidate).rules!;
    rules[ONLY_RULE] = ["error", ...optionsOf(rules[ONLY_RULE]).slice(1)] as Linter.RuleEntry;
  }, [".only selector missing"]);
  await assertConfigMutationRejected(blocks, "floating subtest selector dropped", (candidate) => {
    const rules = testBlockOf(candidate).rules!;
    const kept = optionsOf(rules[ONLY_RULE]).filter(
      (option) => (option as { selector?: string }).selector !== FLOATING_SUBTEST_SELECTOR,
    );
    rules[ONLY_RULE] = ["error", ...kept] as Linter.RuleEntry;
  }, ["floating subtest selector missing"]);
  await assertConfigMutationRejected(blocks, "safe calls widened", (candidate) => {
    testBlockOf(candidate).rules![FLOATING_RULE] = [
      "error",
      { allowForKnownSafeCalls: [{ ...NODE_TEST_SAFE_CALLS[0], name: [...NODE_TEST_SAFE_CALLS[0].name, "skip"] }] },
    ];
  }, ["floating safe calls changed"]);
  await assertConfigMutationRejected(blocks, "unused vars warn -> off", (candidate) => {
    testBlockOf(candidate).rules![UNUSED_RULE] = "off";
  }, ["no-unused-vars is not warn"]);
  await assertConfigMutationRejected(blocks, "unused vars ignore pattern loosened", (candidate) => {
    testBlockOf(candidate).rules![UNUSED_RULE] = ["warn", { ...UNUSED_VARS_OPTIONS, varsIgnorePattern: "." }];
  }, ["no-unused-vars options changed"]);
  await assertConfigMutationRejected(blocks, "test lint block removed", (candidate) => {
    candidate.splice(candidate.indexOf(testBlockOf(candidate)), 1);
  }, ["test lint block missing", "test file not linted"]);
  await assertConfigMutationRejected(blocks, "test glob moved into lintableFiles", (candidate) => {
    candidate.splice(candidate.indexOf(testBlockOf(candidate)), 1);
    blockWithFile(candidate, BACKEND_LINTABLE_FILES[0]).files!.push(TEST_LINT_GLOB);
  }, ["backend lintableFiles changed", "test glob outside the test block", "backend rules leaked into test lint"]);
  await assertConfigMutationRejected(blocks, "frontend glob added", (candidate) => {
    testBlockOf(candidate).files!.push("frontend/**/*.ts");
  }, ["frontend glob present", "frontend linted by root config"]);
  await assertConfigMutationRejected(blocks, "projectService disabled", (candidate) => {
    const languageOptions = testBlockOf(candidate).languageOptions!;
    languageOptions.parserOptions = {
      ...(languageOptions.parserOptions as Record<string, unknown>),
      projectService: false,
    };
  }, ["type information disabled"]);
  await assertConfigMutationRejected(blocks, "projectService removed", (candidate) => {
    const languageOptions = testBlockOf(candidate).languageOptions!;
    const { projectService: _removed, ...rest } = languageOptions.parserOptions as Record<string, unknown>;
    languageOptions.parserOptions = rest;
  }, ["type information disabled"]);
  await assertConfigMutationRejected(blocks, "TypeScript parser removed", (candidate) => {
    const { parser: _removed, ...rest } = testBlockOf(candidate).languageOptions!;
    testBlockOf(candidate).languageOptions = rest;
  }, ["test parser is not typescript-eslint"]);
  await assertConfigMutationRejected(blocks, "test tree ignored", (candidate) => {
    candidate.push({ ignores: ["test/**"] });
  }, ["test file ignored", "test file not linted"]);
  await assertConfigMutationRejected(blocks, "test rules leaked into backend", (candidate) => {
    blockWithFile(candidate, "server/**/*.{ts,mts}").rules![FLOATING_RULE] = "error";
  }, ["test rules leaked into backend lint"]);
});

// WBR-04a (VET-10): proves the promoted rules can actually FAIL the linter,
// not just that the config text mentions "error". Uses ESLint's own Node API
// (`lintText`) against in-memory snippets under the real eslint.config.mjs:
// no file is written to disk, nothing is left behind, no fixture is sembrada
// in production code.
async function lintSnippet(
  code: string,
  filePath: string,
): Promise<{ errorCount: number; ruleIds: (string | null)[] }> {
  const eslint = new ESLint({
    overrideConfigFile: resolve(process.cwd(), "eslint.config.mjs"),
  });
  const [result] = await eslint.lintText(code, {
    filePath: resolve(process.cwd(), filePath),
  });

  return {
    errorCount: result.errorCount,
    ruleIds: result.messages
      .filter((message) => message.severity === 2)
      .map((message) => message.ruleId),
  };
}

test("promoted rule no-case-declarations fails the linter on a real violation", async () => {
  const valid = await lintSnippet(
    "declare const x: number;\nswitch (x) {\n  case 1: {\n    const y = 1;\n    console.log(y);\n    break;\n  }\n  default:\n    break;\n}\n",
    "server/__wbr04a_probe_valid_case.ts",
  );
  assert.equal(valid.errorCount, 0);

  const violation = await lintSnippet(
    "declare const x: number;\nswitch (x) {\n  case 1:\n    const y = 1;\n    console.log(y);\n    break;\n  default:\n    break;\n}\n",
    "server/__wbr04a_probe_violation_case.ts",
  );
  assert.equal(violation.errorCount, 1);
  assert.deepEqual(violation.ruleIds, ["no-case-declarations"]);
});

test("promoted rule no-unsafe-optional-chaining fails the linter on a real violation", async () => {
  const valid = await lintSnippet(
    "declare const obj: { fn?: () => void } | undefined;\nobj?.fn?.();\n",
    "server/__wbr04a_probe_valid_chain.ts",
  );
  assert.equal(valid.errorCount, 0);

  const violation = await lintSnippet(
    "declare const obj: { fn?: () => void } | undefined;\n(obj?.fn)();\n",
    "server/__wbr04a_probe_violation_chain.ts",
  );
  assert.equal(violation.errorCount, 1);
  assert.deepEqual(violation.ruleIds, ["no-unsafe-optional-chaining"]);
});

test("TEST-GLOBAL-05B test lint block is separate, type-aware and enforces its three rules", async () => {
  assert.deepEqual(await validateTestLintConfig(await loadLintConfig()), []);
});

// Probe literals are assembled at runtime so this file does not add committed
// occurrences to the 01B census patterns it would otherwise match as text.
const ONLY = "only";
const REJECTS = "rejects";
const PROBE_HEADER =
  'import assert from "node:assert/strict";\nimport test, { describe, it, suite } from "node:test";\n';
const RULE_PROBES: readonly (readonly [string, string, readonly string[]])[] = [
  ["top-level test() registration", 'test("a", () => {});\n', []],
  ["top-level describe/it/suite registration", 'describe("d", () => { it("i", () => {}); });\nsuite("s", () => {});\n', []],
  ["test .only", `test.${ONLY}("a", () => {});\n`, [FLOATING_RULE, ONLY_RULE]],
  ["it .only", `it.${ONLY}("a", () => {});\n`, [FLOATING_RULE, ONLY_RULE]],
  ["describe .only", `describe.${ONLY}("a", () => {});\n`, [FLOATING_RULE, ONLY_RULE]],
  ["suite .only", `suite.${ONLY}("a", () => {});\n`, [FLOATING_RULE, ONLY_RULE]],
  ["{ only: true } option", 'test("a", { only: true }, () => {});\n', [ONLY_RULE]],
  ["subtest .only", `test("a", async (t) => { await t.test.${ONLY}("b", () => {}); });\n`, [ONLY_RULE]],
  ["subtest { only: true } option", 'test("a", async (t) => { await t.test("b", { only: true }, () => {}); });\n', [ONLY_RULE]],
  ["unrelated only() member", `const q = { ${ONLY}: (x: number) => x };\nassert.equal(q.${ONLY}(1), 1);\n`, []],
  ["{ only: false } option", 'test("a", { only: false }, () => {});\n', []],
  ["floating subtest", 'test("a", async (t) => { t.test("b", () => {}); });\n', [ONLY_RULE]],
  ["awaited subtest", 'test("a", async (t) => { await t.test("b", () => {}); });\n', []],
  ["returned subtest", 'test("a", (t) => t.test("b", () => {}));\n', []],
  ["regex test() as an argument", 'test("a", () => { assert.ok(/x/.test("x")); });\n', []],
  ["floating promise", 'test("a", () => { Promise.resolve(1); });\n', [FLOATING_RULE]],
  ["floating assertion promise", `test("a", async () => { assert.${REJECTS}(Promise.reject(new Error("x"))); });\n`, [FLOATING_RULE]],
  ["awaited assertion promise", `test("a", async () => { await assert.${REJECTS}(Promise.reject(new Error("x"))); });\n`, []],
  ["unused variable", 'test("a", () => { const x = 1; });\n', [UNUSED_RULE]],
  ["underscore unused variable", 'test("a", () => { const _x = 1; });\n', []],
];

test("TEST-GLOBAL-05B rules flag .only, floating promises and unused vars but not node:test registrations", async () => {
  const eslint = new ESLint({
    overrideConfigFile: resolve(process.cwd(), "eslint.config.mjs"),
  });
  const mismatches: string[] = [];

  for (const [name, body, expected] of RULE_PROBES) {
    const [result] = await eslint.lintText(`${PROBE_HEADER}${body}`, {
      filePath: resolve(process.cwd(), TEST_PROBE_FILE),
    });
    // Lines 1-2 are the shared header; its unused imports are not the probe.
    const ruleIds = [
      ...new Set(
        result.messages
          .filter((message) => message.fatal || message.line > 2)
          .map((message) => message.ruleId ?? `fatal: ${message.message}`),
      ),
    ].sort();
    if (!isDeepStrictEqual(ruleIds, [...expected].sort())) {
      mismatches.push(`${name}: ${JSON.stringify(ruleIds)}`);
    }
  }

  assert.deepEqual(mismatches, []);
});
