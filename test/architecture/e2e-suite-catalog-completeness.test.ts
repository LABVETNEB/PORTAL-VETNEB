import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  CURRENT_COHORTS,
  DOMAINS,
  E2E_COHORT_SPECS,
  E2E_CURRENT_COHORT_SPECS,
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

const EXPECTED_SPEC_COUNT = 72;
const EXPECTED_DOMAIN_COUNTS = new Map([
  ["admin", 18],
  ["clinic", 21],
  ["public", 8],
  ["particular", 2],
  ["platform", 18],
  ["regression", 5],
]);
const EXPECTED_CURRENT_COUNTS = new Map([
  ["smoke", 7],
  ["admin-mobile", 13],
  ["visual-contract", 11],
  ["public-clinic", 11],
]);
const EXPECTED_EXECUTION_COUNTS = new Map<E2eExecutionCohort, number>([
  ["ci", 42],
  ["extended", 25],
  ["evidence", 2],
  ["visual-linux", 3],
  ["full", 72],
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

function frontendPath(path: string): string {
  return path.startsWith("frontend/") ? path.slice("frontend/".length) : path;
}

function repoPath(path: string): string {
  return path.startsWith("frontend/") ? path : `frontend/${path}`;
}

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

async function trackedE2eSpecs(): Promise<string[]> {
  const { listTrackedFiles } = await import("../helpers/tracked-source-files.ts");
  return listTrackedFiles()
    .filter((path) => path.startsWith("frontend/e2e/") && path.endsWith(".spec.ts"))
    .sort();
}

function validateCatalog(entries: readonly E2eCatalogEntry[], trackedSpecs: readonly string[]): void {
  const catalogPaths = entries.map((entry) => entry.path);
  const catalogRepoPaths = catalogPaths.map(repoPath);
  const sortedCatalogPaths = [...catalogPaths].sort((a, b) => a.localeCompare(b));

  assert.equal(trackedSpecs.length, EXPECTED_SPEC_COUNT);
  assert.equal(entries.length, EXPECTED_SPEC_COUNT);
  assert.deepEqual(catalogPaths, sortedCatalogPaths, "catalog paths must stay sorted");
  assert.equal(new Set(catalogPaths).size, catalogPaths.length, "catalog paths must be unique");

  assert.deepEqual(
    trackedSpecs.map(frontendPath).sort(),
    catalogPaths,
    "every tracked frontend/e2e spec must be cataloged exactly once",
  );
  assert.deepEqual(
    catalogRepoPaths.sort(),
    trackedSpecs,
    "every catalog entry must point to a tracked spec",
  );

  for (const path of catalogPaths) {
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
  assert.equal(currentUnion.length, 42);
  assert.deepEqual(E2E_COHORT_SPECS.ci, currentUnion, "ci must equal the current four-cohort union");

  for (const cohort of ["extended", "evidence", "visual-linux", "full"] as const) {
    assert.ok(E2E_COHORT_SPECS[cohort].length > 0, `${cohort} must not be empty`);
  }

  const logout = entries.find((entry) => entry.path === "e2e/dashboard-logout-private-cache.spec.ts");
  assert.ok(logout);
  assert.equal(logout.targetGate, "future-p1");
  assert.equal(logout.executionCohorts.includes("ci"), false);
  assert.equal(E2E_COHORT_SPECS.ci.includes(logout.path), false);
}

test("E2E suite catalog is complete, deterministic and fail-closed", async () => {
  const trackedSpecs = await trackedE2eSpecs();
  validateCatalog(E2E_SUITE_CATALOG, trackedSpecs);
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
  const trackedSpecs = await trackedE2eSpecs();
  const missing = E2E_SUITE_CATALOG.slice(1);
  const duplicated = [...E2E_SUITE_CATALOG, E2E_SUITE_CATALOG[0]];

  assert.throws(() => validateCatalog(missing, trackedSpecs), /72|cataloged/);
  assert.throws(() => validateCatalog(duplicated, trackedSpecs), /72|unique/);
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
  const runner = await import(runnerPath) as {
    classifyAffectedPaths: (changedPaths: string[]) => {
      specs: readonly string[];
      fallback: boolean;
      reason: string;
    };
  };

  const noRelevantSelection = runner.classifyAffectedPaths(["docs/audit/readme.md"]);
  assert.deepEqual(noRelevantSelection.specs, []);
  assert.equal(noRelevantSelection.fallback, false);

  const sharedSelection = runner.classifyAffectedPaths(["frontend/e2e/helpers/admin-mobile-contracts.ts"]);
  assert.equal(sharedSelection.fallback, true);
  assert.equal(sharedSelection.specs.length, 42);
  assert.match(sharedSelection.reason, /shared E2E infrastructure/);
});
