import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const BASELINE_TEST =
  "node --experimental-strip-types --experimental-specifier-resolution=node --test test/**/*.test.ts";
const COVERAGE_SCRIPT =
  'node --experimental-strip-types --experimental-specifier-resolution=node --experimental-test-coverage --test "test/**/*.test.ts"';
const EXTERNAL_COVERAGE_PACKAGES = [
  "@vitest/coverage-istanbul",
  "@vitest/coverage-v8",
  "c8",
  "istanbul",
  "jest",
  "nyc",
  "vitest",
] as const;

function readPackageJson(): PackageJson {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
  ) as PackageJson;
}

function validatePackage(pkg: PackageJson): string[] {
  const issues: string[] = [];
  const scripts = pkg.scripts ?? {};
  const coverage = scripts["test:coverage"] ?? "";
  const tokens = coverage.split(/\s+/).filter(Boolean);

  if (scripts.test !== BASELINE_TEST) issues.push("test changed");
  if (!coverage) issues.push("test:coverage missing");
  if (tokens[0] !== "node") issues.push("node is not invoked directly");
  if (tokens.filter((token) => token === "--experimental-test-coverage").length !== 1) {
    issues.push("coverage flag count");
  }
  if (!tokens.includes("--experimental-strip-types")) issues.push("strip-types missing");
  if (!tokens.includes("--experimental-specifier-resolution=node")) {
    issues.push("specifier-resolution missing");
  }
  if (!tokens.includes("--test")) issues.push("test flag missing");
  if (
    tokens.filter((token) => token === '"test/**/*.test.ts"').length !== 1 ||
    tokens.at(-1) !== '"test/**/*.test.ts"'
  ) {
    issues.push("test glob changed");
  }
  if (!coverage.endsWith('--test "test/**/*.test.ts"')) {
    issues.push("test glob is not shell-protected");
  }
  if (/--test-coverage-(?:lines|functions|branches)(?:=|\s|$)/i.test(coverage)) {
    issues.push("threshold present");
  }
  if (/\b(?:c8|nyc|istanbul|jest|vitest)\b/i.test(coverage)) {
    issues.push("external coverage tool present");
  }
  if (/[|<>]/.test(coverage)) issues.push("pipe or redirection present");
  if (coverage !== COVERAGE_SCRIPT) issues.push("coverage script changed");

  const packageNames = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ];
  if (
    packageNames.some((name) =>
      EXTERNAL_COVERAGE_PACKAGES.includes(
        name as (typeof EXTERNAL_COVERAGE_PACKAGES)[number],
      ),
    )
  ) {
    issues.push("external coverage dependency present");
  }

  return issues;
}

function mutate(
  pkg: PackageJson,
  apply: (candidate: PackageJson) => void,
): PackageJson {
  const candidate = structuredClone(pkg);
  apply(candidate);
  return candidate;
}

function assertMutationRejected(
  pkg: PackageJson,
  name: string,
  apply: (candidate: PackageJson) => void,
  expectedIssue: string,
): void {
  assert.ok(
    validatePackage(mutate(pkg, apply)).includes(expectedIssue),
    `${name} mutation must be rejected with "${expectedIssue}"`,
  );
}

test("coverage script preserves the test command and uses native Node coverage", () => {
  assert.deepEqual(validatePackage(readPackageJson()), []);
});

test("coverage script contract rejects unsafe local mutations", () => {
  const pkg = readPackageJson();

  assertMutationRejected(
    pkg,
    "missing test:coverage",
    (candidate) => {
      delete candidate.scripts?.["test:coverage"];
    },
    "test:coverage missing",
  );
  assertMutationRejected(
    pkg,
    "missing coverage flag",
    (candidate) => {
      candidate.scripts!["test:coverage"] = COVERAGE_SCRIPT.replace(
        " --experimental-test-coverage",
        "",
      );
    },
    "coverage flag count",
  );
  assertMutationRejected(
    pkg,
    "changed test script",
    (candidate) => {
      candidate.scripts!.test = "pnpm test:coverage";
    },
    "test changed",
  );
  assertMutationRejected(
    pkg,
    "changed glob",
    (candidate) => {
      candidate.scripts!["test:coverage"] = COVERAGE_SCRIPT.replace(
        "test/**/*.test.ts",
        "test/unit/**/*.test.ts",
      );
    },
    "test glob changed",
  );
  assertMutationRejected(
    pkg,
    "unquoted glob",
    (candidate) => {
      candidate.scripts!["test:coverage"] = COVERAGE_SCRIPT.replaceAll('"', "");
    },
    "test glob is not shell-protected",
  );
  assertMutationRejected(
    pkg,
    "coverage threshold",
    (candidate) => {
      candidate.scripts!["test:coverage"] =
        `${COVERAGE_SCRIPT} --test-coverage-lines=80`;
    },
    "threshold present",
  );
  assertMutationRejected(
    pkg,
    "external coverage dependency",
    (candidate) => {
      candidate.scripts!["test:coverage"] = `c8 ${COVERAGE_SCRIPT}`;
    },
    "external coverage tool present",
  );
  assertMutationRejected(
    pkg,
    "external coverage package",
    (candidate) => {
      candidate.devDependencies!.c8 = "10.1.3";
    },
    "external coverage dependency present",
  );
  assertMutationRejected(
    pkg,
    "test aliases coverage",
    (candidate) => {
      candidate.scripts!.test = "pnpm test:coverage";
    },
    "test changed",
  );
  assertMutationRejected(
    pkg,
    "duplicate coverage flag",
    (candidate) => {
      candidate.scripts!["test:coverage"] =
        `${COVERAGE_SCRIPT} --experimental-test-coverage`;
    },
    "coverage flag count",
  );
  assertMutationRejected(
    pkg,
    "pipe",
    (candidate) => {
      candidate.scripts!["test:coverage"] = `${COVERAGE_SCRIPT} | tee coverage.txt`;
    },
    "pipe or redirection present",
  );
  assertMutationRejected(
    pkg,
    "redirection",
    (candidate) => {
      candidate.scripts!["test:coverage"] = `${COVERAGE_SCRIPT} > coverage.txt`;
    },
    "pipe or redirection present",
  );
});
