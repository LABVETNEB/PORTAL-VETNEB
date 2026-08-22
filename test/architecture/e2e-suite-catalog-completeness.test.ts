import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  CURRENT_COHORTS,
  DOMAINS,
  E2E_COHORT_SPECS,
  E2E_CURRENT_COHORT_SPECS,
  E2E_MANUAL_ONLY_SPECS,
  E2E_SUITE_CATALOG,
  EXECUTION_COHORTS,
  PLATFORMS,
  type E2eCatalogEntry,
  type E2eCurrentCohort,
  type E2eExecutionCohort,
} from "../../frontend/e2e/suites/catalog.ts";

const TEST_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(TEST_FILE), "..", "..");
process.chdir(REPO_ROOT);

const EXPECTED_WORKSPACE_SPEC_COUNT = 84;
const EXPECTED_CATALOG_SPEC_COUNT = 84;
const EXPECTED_MANUAL_ONLY_SPEC_COUNT = 0;
const EXPECTED_DOMAIN_COUNTS = new Map([
  ["admin", 19],
  ["clinic", 22],
  ["public", 8],
  ["particular", 3],
  ["platform", 18],
  ["regression", 14],
]);
const EXPECTED_CURRENT_COUNTS = new Map([
  ["smoke", 9],
  ["admin-mobile", 13],
  ["visual-contract", 16],
  ["public-clinic", 12],
]);
const EXPECTED_EXECUTION_COUNTS = new Map<E2eExecutionCohort, number>([
  ["ci", 50],
  ["extended", 29],
  ["evidence", 2],
  ["visual-linux", 3],
  ["full", 84],
  ["affected", 0],
]);
const EXECUTION_PARTITION_COHORTS = [
  "ci",
  "extended",
  "evidence",
  "visual-linux",
] as const satisfies readonly E2eExecutionCohort[];
const REQUIRED_SCRIPTS = [
  "e2e",
  "e2e:ui",
  "e2e:report",
  "e2e:full",
  "e2e:ci",
  "e2e:verify-teardown",
  "e2e:smoke",
  "e2e:admin-mobile",
  "e2e:visual-contract",
  "e2e:public-clinic",
  "e2e:extended",
  "e2e:evidence",
  "e2e:visual-linux",
  "e2e:affected",
  "e2e:verify-catalog",
] as const;

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function countBy<T extends string>(items: readonly T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

function assertCountMap(actual: Map<string, number>, expected: Map<string, number>): void {
  assert.deepEqual([...actual.entries()].sort(), [...expected.entries()].sort());
}

function assertExportedExecutionCohortsMatchCatalog(entries: readonly E2eCatalogEntry[]): void {
  for (const cohort of EXECUTION_COHORTS) {
    const expectedPaths = entries
      .filter((entry) => entry.executionCohorts.includes(cohort))
      .map((entry) => entry.path);

    assert.deepEqual(
      E2E_COHORT_SPECS[cohort],
      expectedPaths,
      `${cohort} exported paths must match catalog declarations`,
    );
  }
}

function assertExecutionCohortPartition(catalogPaths: readonly E2eCatalogEntry["path"][]): void {
  for (const [cohort, expectedCount] of EXPECTED_EXECUTION_COUNTS) {
    assert.equal(E2E_COHORT_SPECS[cohort].length, expectedCount, `${cohort} count drifted`);
  }

  assert.deepEqual(
    E2E_COHORT_SPECS.full,
    catalogPaths,
    "full must match every catalog path in deterministic catalog order",
  );

  const partitionMemberships = new Map<E2eCatalogEntry["path"], E2eExecutionCohort>();
  for (const cohort of EXECUTION_PARTITION_COHORTS) {
    for (const path of E2E_COHORT_SPECS[cohort]) {
      assert.equal(
        partitionMemberships.has(path),
        false,
        `${path} appears in both ${partitionMemberships.get(path)} and ${cohort}`,
      );
      partitionMemberships.set(path, cohort);
    }
  }

  const partitionUnion = [...partitionMemberships.keys()].sort((a, b) => a.localeCompare(b));
  const sortedFull = [...E2E_COHORT_SPECS.full].sort((a, b) => a.localeCompare(b));

  assert.deepEqual(
    partitionUnion,
    sortedFull,
    "ci, extended, evidence and visual-linux must partition full exactly",
  );
  assert.equal(
    E2E_COHORT_SPECS.affected.length,
    0,
    "affected must stay outside the static execution partition because it is resolved dynamically",
  );
}

function readPackageScripts(): Record<string, string> {
  const packageJson = JSON.parse(readFileSync(resolve(REPO_ROOT, "frontend/package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };

  return packageJson.scripts ?? {};
}

const EXCLUDED_E2E_DIRECTORIES = new Set([
  "node_modules",
  "test-results",
  "playwright-report",
  "helpers",
  "fixtures",
  "scripts",
]);

function workspaceE2eSpecs(): string[] {
  const e2eRoot = resolve(REPO_ROOT, "frontend/e2e");
  const specs: string[] = [];

  function visit(directory: string): void {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      if (item.isDirectory()) {
        if (!EXCLUDED_E2E_DIRECTORIES.has(item.name)) visit(join(directory, item.name));
        continue;
      }
      if (!item.isFile() || !item.name.endsWith(".spec.ts")) continue;

      specs.push(relative(resolve(REPO_ROOT, "frontend"), join(directory, item.name)).split(sep).join("/"));
    }
  }

  visit(e2eRoot);
  return specs.sort((a, b) => a.localeCompare(b));
}

function validateCatalog(
  entries: readonly E2eCatalogEntry[],
  workspaceSpecs: readonly string[],
  manualOnlySpecs: readonly string[],
): void {
  const catalogPaths = entries.map((entry) => entry.path);
  const sortedCatalogPaths = [...catalogPaths].sort((a, b) => a.localeCompare(b));
  const sortedManualOnlySpecs = [...manualOnlySpecs].sort((a, b) => a.localeCompare(b));
  const classifiedPaths = [...catalogPaths, ...manualOnlySpecs].sort((a, b) => a.localeCompare(b));

  assert.equal(workspaceSpecs.length, EXPECTED_WORKSPACE_SPEC_COUNT);
  assert.equal(entries.length, EXPECTED_CATALOG_SPEC_COUNT);
  assert.equal(manualOnlySpecs.length, EXPECTED_MANUAL_ONLY_SPEC_COUNT);
  assert.deepEqual(catalogPaths, sortedCatalogPaths, "catalog paths must stay sorted");
  assert.deepEqual(manualOnlySpecs, sortedManualOnlySpecs, "manual-only paths must stay sorted");
  assert.equal(new Set(catalogPaths).size, catalogPaths.length, "catalog paths must be unique");
  assert.equal(
    new Set(manualOnlySpecs).size,
    manualOnlySpecs.length,
    "manual-only paths must be unique",
  );
  assert.equal(
    catalogPaths.some((path) => manualOnlySpecs.includes(path)),
    false,
    "catalog and manual-only specs must be disjoint",
  );

  assert.deepEqual(
    workspaceSpecs,
    classifiedPaths,
    "every physical frontend/e2e spec must be classified exactly once as cataloged or manual-only",
  );

  for (const path of classifiedPaths) {
    assert.equal(path.includes("\\"), false, `${path} must use forward slashes`);
    assert.equal(path.startsWith("e2e/"), true, `${path} must be relative to frontend/`);
    assert.equal(path.endsWith(".spec.ts"), true, `${path} must be a Playwright spec`);
    assert.equal(path.includes("/helpers/"), false, `${path} must not be a helper`);
    assert.equal(path.includes("/fixtures/"), false, `${path} must not be a fixture`);
    assert.equal(path.includes("/scripts/"), false, `${path} must not be a script`);
    assert.equal(path.endsWith(".png"), false, `${path} must not be a PNG`);
  }

  const allowedDomains = new Set<string>(DOMAINS);
  const allowedPlatforms = new Set<string>(PLATFORMS);
  const allowedExecutionCohorts = new Set<string>(EXECUTION_COHORTS);
  const allowedCurrentCohorts = new Set<string>(CURRENT_COHORTS);

  for (const entry of entries) {
    assert.ok(allowedDomains.has(entry.domain), `${entry.path} has invalid domain`);
    assert.ok(entry.owner.trim(), `${entry.path} must have owner`);
    assert.ok(entry.feature.trim(), `${entry.path} must have feature`);
    assert.ok(allowedPlatforms.has(entry.platform), `${entry.path} has invalid platform`);
    for (const cohort of entry.currentCohorts) {
      assert.ok(allowedCurrentCohorts.has(cohort), `${entry.path} has invalid current cohort`);
    }
    for (const cohort of entry.executionCohorts) {
      assert.ok(allowedExecutionCohorts.has(cohort), `${entry.path} has invalid execution cohort`);
    }
  }

  assertCountMap(countBy(entries.map((entry) => entry.domain)), EXPECTED_DOMAIN_COUNTS);
  assertExportedExecutionCohortsMatchCatalog(entries);
  assertExecutionCohortPartition(catalogPaths);

  for (const [cohort, expectedCount] of EXPECTED_CURRENT_COUNTS) {
    const currentCohort = cohort as E2eCurrentCohort;
    const members = entries.filter((entry) => entry.currentCohorts.includes(currentCohort));
    assert.equal(members.length, expectedCount, `${cohort} count drifted`);
    assert.deepEqual(E2E_CURRENT_COHORT_SPECS[currentCohort], members.map((entry) => entry.path));
  }

  const currentMemberships = new Map<string, string>();
  for (const entry of entries) {
    for (const cohort of entry.currentCohorts) {
      assert.equal(
        currentMemberships.has(entry.path),
        false,
        `${entry.path} appears in both ${currentMemberships.get(entry.path)} and ${cohort}`,
      );
      currentMemberships.set(entry.path, cohort);
    }
  }

  const currentUnion = unique([...currentMemberships.keys()]).sort();
  assert.equal(currentUnion.length, 50);
  assert.deepEqual(E2E_COHORT_SPECS.ci, currentUnion, "ci must equal the current four-cohort union");

  for (const cohort of ["extended", "evidence", "visual-linux", "full"] as const) {
    assert.ok(E2E_COHORT_SPECS[cohort].length > 0, `${cohort} must not be empty`);
  }

  const logout = entries.find((entry) => entry.path === "e2e/platform/auth/dashboard-logout-private-cache.spec.ts");
  assert.ok(logout);
  assert.equal(logout.targetGate, "current-ci");
  assert.equal(logout.currentCohorts.includes("smoke"), true);
  assert.equal(logout.executionCohorts.includes("ci"), true);
  assert.equal(E2E_COHORT_SPECS.ci.includes(logout.path), true);
}

test("E2E suite catalog is complete, deterministic and fail-closed", async () => {
  const workspaceSpecs = workspaceE2eSpecs();
  validateCatalog(E2E_SUITE_CATALOG, workspaceSpecs, E2E_MANUAL_ONLY_SPECS);
});

test("frontend package scripts delegate cohorts to the catalog runner", () => {
  const scripts = readPackageScripts();

  for (const script of REQUIRED_SCRIPTS) {
    assert.ok(scripts[script], `missing script ${script}`);
  }

  for (const cohort of ["smoke", "admin-mobile", "visual-contract", "public-clinic", "ci", "extended", "evidence", "visual-linux", "full", "affected"]) {
    const script = cohort === "full" ? "e2e:full" : `e2e:${cohort}`;
    assert.equal(
      scripts[script],
      `node e2e/scripts/run-cohort.mjs ${cohort}`,
      `${script} must delegate to the runner`,
    );
  }

  assert.equal(scripts["e2e"], "node e2e/scripts/run-cohort.mjs full");
  assert.equal(scripts["e2e:verify-catalog"], "node --experimental-strip-types --experimental-specifier-resolution=node --test ../test/architecture/e2e-suite-catalog-completeness.test.ts");
  assert.equal(scripts["e2e:ci"].includes("&&"), false, "e2e:ci must be a single runner invocation");

  for (const [name, command] of Object.entries(scripts)) {
    if (name.startsWith("e2e:") && name !== "e2e:ui" && name !== "e2e:report") {
      assert.equal(command.includes(".spec.ts"), false, `${name} must not contain literal spec lists`);
    }
  }
});

test("catalog validation catches missing and duplicate entries in memory", async () => {
  const workspaceSpecs = workspaceE2eSpecs();
  const missing = E2E_SUITE_CATALOG.slice(1);
  const duplicated = [...E2E_SUITE_CATALOG, E2E_SUITE_CATALOG[0]];

  assert.throws(
    () => validateCatalog(missing, workspaceSpecs, E2E_MANUAL_ONLY_SPECS),
    /84|classified/,
  );
  assert.throws(
    () => validateCatalog(duplicated, workspaceSpecs, E2E_MANUAL_ONLY_SPECS),
    /84|unique/,
  );
});

test("runner rejects unknown cohorts and prints valid cohorts", () => {
  const result = spawnSync(process.execPath, ["e2e/scripts/run-cohort.mjs", "unknown-cohort"], {
    cwd: resolve(REPO_ROOT, "frontend"),
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown cohort/);
  assert.match(result.stderr, /Valid cohorts:/);
});

test("affected selection fails closed for empty or shared changes", async () => {
  const runnerPath = pathToFileURL(resolve(REPO_ROOT, "frontend/e2e/scripts/run-cohort.mjs")).href;
  const exitCodeBeforeImport = process.exitCode;
  const runner = await import(runnerPath) as {
    classifyAffectedPaths: (changedPaths: string[]) => {
      specs: readonly string[];
      fallback: boolean;
      reason: string;
    };
  };

  assert.equal(
    process.exitCode,
    exitCodeBeforeImport,
    "importing the cohort runner must not execute its CLI entrypoint",
  );

  const noRelevantSelection = runner.classifyAffectedPaths(["docs/audit/readme.md"]);
  assert.deepEqual(noRelevantSelection.specs, []);
  assert.equal(noRelevantSelection.fallback, false);

  const sharedSelection = runner.classifyAffectedPaths(["frontend/e2e/helpers/admin-mobile-contracts.ts"]);
  assert.equal(sharedSelection.fallback, true);
  assert.equal(sharedSelection.specs.length, 50);
  assert.match(sharedSelection.reason, /shared E2E infrastructure/);
});

test("runner platform preflight rejects Linux-only selections off Linux before Playwright", async () => {
  const runnerPath = pathToFileURL(resolve(REPO_ROOT, "frontend/e2e/scripts/run-cohort.mjs")).href;
  const exitCodeBeforeImport = process.exitCode;
  const runner = (await import(runnerPath)) as {
    validatePlatformCompatibility: (
      selectedSpecs: readonly string[],
      platform: string,
    ) => { compatible: boolean; platform: string; incompatibleSpecs: readonly string[] };
  };

  assert.equal(
    process.exitCode,
    exitCodeBeforeImport,
    "importing the cohort runner must not execute its CLI entrypoint",
  );

  const visualSpecs = E2E_COHORT_SPECS["visual-linux"];
  const evidenceSpecs = E2E_COHORT_SPECS.evidence;
  const fullSpecs = E2E_COHORT_SPECS.full;

  const visualOnWindows = runner.validatePlatformCompatibility(visualSpecs, "win32");
  assert.equal(visualOnWindows.compatible, false, "visual-linux must be incompatible on win32");
  assert.deepEqual(
    [...visualOnWindows.incompatibleSpecs].sort(),
    [...visualSpecs].sort(),
    "every visual-linux spec must be reported as incompatible on win32",
  );

  const visualOnLinux = runner.validatePlatformCompatibility(visualSpecs, "linux");
  assert.equal(visualOnLinux.compatible, true, "visual-linux must be compatible on linux");
  assert.equal(visualOnLinux.incompatibleSpecs.length, 0);

  const evidenceOnWindows = runner.validatePlatformCompatibility(evidenceSpecs, "win32");
  assert.equal(evidenceOnWindows.compatible, true, "evidence selection must run on any platform");
  assert.equal(evidenceOnWindows.incompatibleSpecs.length, 0);

  const fullOnWindows = runner.validatePlatformCompatibility(fullSpecs, "win32");
  assert.equal(fullOnWindows.compatible, false, "full must be blocked off Linux while it carries visual specs");
  assert.deepEqual(
    [...fullOnWindows.incompatibleSpecs].sort(),
    [...visualSpecs].sort(),
    "full must surface exactly the Linux-only visual specs on win32",
  );
});
