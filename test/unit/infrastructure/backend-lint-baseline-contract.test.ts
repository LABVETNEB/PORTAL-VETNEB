import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { ESLint } from "eslint";

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

function readContract(): Contract {
  return {
    pkg: JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as PackageJson,
    config: readFileSync(resolve(process.cwd(), "eslint.config.mjs"), "utf8"),
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
  if (/(?:frontend\/|test\/\*\*)/.test(config)) issues.push("config scope expanded");

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

test("backend lint baseline is scoped, diagnostic, and independently configured", () => {
  assert.deepEqual(validateContract(readContract()), []);
});

test("backend lint contract rejects unsafe in-memory mutations", () => {
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
