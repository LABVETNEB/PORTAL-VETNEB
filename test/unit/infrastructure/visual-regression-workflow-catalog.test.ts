import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { E2E_COHORT_SPECS, E2E_SUITE_CATALOG } from "../../../frontend/e2e/suites/catalog.ts";

// ─────────────────────────────────────────────────────────────────────────────
// E2E-GLOBAL-10 · catalog ↔ visual workflow reconciliation (R-14).
//
// LIMPIEZA E2E recorded a manual list of visual specs inside
// `visual-regression-manual.yml`, maintained in parallel with `catalog.ts`.
// The production-candidate runner is already catalog-driven (`selectSuiteSpecs`
// reads `E2E_COHORT_SPECS["visual-linux"]`); the `dev` diagnostic runner still
// enumerates the three specs by hand, so a fourth visual-linux entry would be
// captured by one runner and skipped by the other with nothing reporting it.
//
// This guard is test-only and READS the workflow: it does not rewrite it.
// Replacing the manual list with the cohort runner is a ci-only change and
// belongs to its own PR — until then, drift here fails closed.
//
// The workflow is parsed as YAML (js-yaml, the parser the completeness contract
// already uses) rather than scanned as text; only the embedded bash inside the
// resolved `run` string is matched by pattern, because that is the level the
// spec list actually lives at.
// ─────────────────────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
const { CORE_SCHEMA, load, mergeTag } = require("js-yaml") as {
  CORE_SCHEMA: { withTags: (tag: unknown) => unknown };
  load: (source: string, options: Record<string, unknown>) => unknown;
  mergeTag: unknown;
};

const TEST_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(TEST_FILE), "..", "..", "..");
const VISUAL_WORKFLOW = ".github/workflows/visual-regression-manual.yml";
const CANDIDATE_SCRIPT = resolve(REPO_ROOT, "frontend/e2e/scripts/visual-production-candidate.mjs");
const DEV_RUNNER_STEP = "Run selected visual regression suite";
const CANDIDATE_STEP = "Produce production visual candidate";

const candidate = (await import(pathToFileURL(CANDIDATE_SCRIPT).href)) as {
  VISUAL_SUITES: readonly string[];
};

type Mapping = Record<string, unknown>;

function isMapping(value: unknown): value is Mapping {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mapping(value: unknown, label: string): Mapping {
  assert.ok(isMapping(value), `${label} must be a mapping`);
  return value;
}

function sequence(value: unknown, label: string): unknown[] {
  assert.ok(Array.isArray(value), `${label} must be a sequence`);
  return value;
}

function readWorkflow(path = VISUAL_WORKFLOW): string {
  return readFileSync(resolve(REPO_ROOT, path), "utf8").replace(/\r\n/g, "\n");
}

function parseWorkflow(source: string): Mapping {
  return mapping(
    load(source, {
      schema: CORE_SCHEMA.withTags(mergeTag),
      maxDepth: 100,
      maxTotalMergeKeys: 20,
      maxAliases: 0,
    }),
    "workflow",
  );
}

function stepByName(document: Mapping, name: string): Mapping {
  const jobs = mapping(document.jobs, "jobs");
  for (const [jobName, jobValue] of Object.entries(jobs)) {
    const job = mapping(jobValue, `jobs.${jobName}`);
    const step = sequence(job.steps, `jobs.${jobName}.steps`)
      .map((value, index) => mapping(value, `steps[${index}]`))
      .find((candidateStep) => candidateStep.name === name);
    if (step) return step;
  }
  throw new Error(`missing workflow step: ${name}`);
}

/**
 * The spec lists the `dev` runner would execute, keyed by the `suite` input it
 * branches on. Fails closed: an unparseable script yields no branches, and the
 * reconciliation then reports every cataloged spec as unexecuted.
 */
export function devRunnerSuiteSpecs(script: string): Map<string, string[]> {
  const branches = new Map<string, string[]>();
  // The YAML block scalar arrives dedented, so the branch indentation is
  // relative: match any indented `<suite>)` label up to its `;;` terminator.
  const branchPattern = /^[ ]+([a-z]+)\)\n([\s\S]*?)\n[ ]*;;/gm;

  for (const match of script.matchAll(branchPattern)) {
    const suite = match[1];
    const body = match[2];
    const specs = [...body.matchAll(/"(e2e\/[^"]*\.spec\.ts)"/g)].map((spec) => spec[1]);
    if (specs.length > 0) branches.set(suite, specs);
  }

  return branches;
}

/** Every `*.spec.ts` literal anywhere in the workflow, however it is reached. */
export function workflowSpecLiterals(source: string): string[] {
  return [...source.matchAll(/(e2e\/[^\s"']*\.spec\.ts)/g)].map((match) => match[1]);
}

export type VisualReconciliation = {
  readonly missingFromWorkflow: readonly string[];
  readonly unknownInWorkflow: readonly string[];
  readonly duplicatedInWorkflow: readonly string[];
  readonly suiteMismatches: readonly string[];
};

/** Returns the divergences instead of asserting, so mutations are provable. */
export function reconcileVisualWorkflow(
  source: string,
  cohortSpecs: readonly string[] = E2E_COHORT_SPECS["visual-linux"],
  suites: readonly string[] = candidate.VISUAL_SUITES,
): VisualReconciliation {
  const script = String(stepByName(parseWorkflow(source), DEV_RUNNER_STEP).run ?? "");
  const branches = devRunnerSuiteSpecs(script);
  const cohort = new Set(cohortSpecs);
  const literals = workflowSpecLiterals(source);

  const seen = new Set<string>();
  const duplicatedInWorkflow: string[] = [];
  for (const specs of branches.values()) {
    const perBranch = new Set<string>();
    for (const spec of specs) {
      if (perBranch.has(spec)) duplicatedInWorkflow.push(spec);
      perBranch.add(spec);
      seen.add(spec);
    }
  }

  const suiteMismatches: string[] = [];
  for (const suite of suites) {
    const specs = branches.get(suite) ?? [];
    if (suite === "all") {
      const sorted = [...specs].sort((a, b) => a.localeCompare(b));
      const expected = [...cohortSpecs].sort((a, b) => a.localeCompare(b));
      if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
        suiteMismatches.push(`all: ${JSON.stringify(sorted)} != ${JSON.stringify(expected)}`);
      }
      continue;
    }
    const expected = cohortSpecs.filter((spec) =>
      spec.endsWith(`/visual-regression-${suite}.spec.ts`),
    );
    if (specs.length !== 1 || expected.length !== 1 || specs[0] !== expected[0]) {
      suiteMismatches.push(`${suite}: ${JSON.stringify(specs)} != ${JSON.stringify(expected)}`);
    }
  }

  return {
    missingFromWorkflow: cohortSpecs.filter((spec) => !seen.has(spec)),
    unknownInWorkflow: [...new Set(literals.filter((spec) => !cohort.has(spec)))].sort(),
    duplicatedInWorkflow: [...new Set(duplicatedInWorkflow)].sort(),
    suiteMismatches,
  };
}

test("the visual workflow executes exactly the catalog's visual-linux cohort", () => {
  const result = reconcileVisualWorkflow(readWorkflow());

  assert.deepEqual(result.missingFromWorkflow, [], "cataloged visual specs the workflow never runs");
  assert.deepEqual(result.unknownInWorkflow, [], "workflow specs outside the visual-linux cohort");
  assert.deepEqual(result.duplicatedInWorkflow, [], "specs listed more than once in one suite");
  assert.deepEqual(result.suiteMismatches, [], "per-suite mapping diverged from the catalog");
});

test("the visual-linux cohort, the workflow choices and the candidate share one vocabulary", () => {
  const document = parseWorkflow(readWorkflow());
  const suiteInput = mapping(
    mapping(
      mapping(mapping(document.on, "on").workflow_dispatch, "workflow_dispatch").inputs,
      "inputs",
    ).suite,
    "inputs.suite",
  );

  assert.deepEqual(suiteInput.options, [...candidate.VISUAL_SUITES]);
  assert.equal(suiteInput.default, "all");

  // One suite per cataloged spec, plus `all`.
  assert.equal(candidate.VISUAL_SUITES.length, E2E_COHORT_SPECS["visual-linux"].length + 1);

  // Every visual-linux entry must actually be declared Linux-only, or the
  // workflow's own Linux preflight would reject a spec the catalog calls
  // portable — and the win32 BLOCKED contract would stop matching the catalog.
  for (const spec of E2E_COHORT_SPECS["visual-linux"]) {
    const entry = E2E_SUITE_CATALOG.find((candidateEntry) => candidateEntry.path === spec);
    assert.ok(entry, `${spec} must stay cataloged`);
    assert.equal(entry.platform, "linux", `${spec} must stay Linux-only`);
  }
});

test("the production-candidate runner stays catalog-driven, with no literal spec list", () => {
  const step = stepByName(parseWorkflow(readWorkflow()), CANDIDATE_STEP);
  const script = String(step.run ?? "");

  assert.match(script, /e2e:visual-production-candidate/);
  assert.equal(
    script.includes(".spec.ts"),
    false,
    "the candidate runner must resolve its specs from the catalog, never from the workflow",
  );
});

test("the reconciliation fails closed on every shape of drift", () => {
  const source = readWorkflow();
  const cohort = E2E_COHORT_SPECS["visual-linux"];

  // 1. A fourth cataloged visual spec the workflow does not execute.
  const added = [...cohort, "e2e/regression/visual/visual-regression-print.spec.ts"];
  const withNewSpec = reconcileVisualWorkflow(source, added, [...candidate.VISUAL_SUITES, "print"]);
  assert.deepEqual(withNewSpec.missingFromWorkflow, [
    "e2e/regression/visual/visual-regression-print.spec.ts",
  ]);
  assert.ok(withNewSpec.suiteMismatches.some((entry) => entry.startsWith("print:")));
  assert.ok(withNewSpec.suiteMismatches.some((entry) => entry.startsWith("all:")));

  // 2. The workflow referencing a spec that left the cohort.
  const shrunk = cohort.filter((spec) => !spec.endsWith("visual-regression-stress.spec.ts"));
  const withRetiredSpec = reconcileVisualWorkflow(
    source,
    shrunk,
    candidate.VISUAL_SUITES.filter((suite) => suite !== "stress"),
  );
  assert.deepEqual(withRetiredSpec.unknownInWorkflow, [
    "e2e/regression/visual/visual-regression-stress.spec.ts",
  ]);

  // 3. The workflow referencing a spec that does not exist at all.
  const withGhostSpec = reconcileVisualWorkflow(
    source.replaceAll(
      "e2e/regression/visual/visual-regression-public.spec.ts",
      "e2e/regression/visual/visual-regression-ghost.spec.ts",
    ),
  );
  assert.ok(
    withGhostSpec.unknownInWorkflow.includes(
      "e2e/regression/visual/visual-regression-ghost.spec.ts",
    ),
  );
  assert.ok(
    withGhostSpec.missingFromWorkflow.includes(
      "e2e/regression/visual/visual-regression-public.spec.ts",
    ),
  );

  // 4. A duplicate inside one suite branch.
  const duplicatedLine = '                "e2e/regression/visual/visual-regression-public.spec.ts"\n';
  assert.ok(source.includes(duplicatedLine), "fixture precondition: the all branch list is present");
  const withDuplicate = reconcileVisualWorkflow(
    source.replace(duplicatedLine, duplicatedLine.repeat(2)),
  );
  assert.deepEqual(withDuplicate.duplicatedInWorkflow, [
    "e2e/regression/visual/visual-regression-public.spec.ts",
  ]);

  // 5. A suite branch silently pointed at the wrong cataloged spec.
  const swapped = source.replace(
    'public)\n              specs=("e2e/regression/visual/visual-regression-public.spec.ts")',
    'public)\n              specs=("e2e/regression/visual/visual-regression-stress.spec.ts")',
  );
  assert.notEqual(swapped, source, "fixture precondition: the single-suite branch is present");
  const withSwap = reconcileVisualWorkflow(swapped);
  assert.ok(withSwap.suiteMismatches.some((entry) => entry.startsWith("public:")));
  assert.deepEqual(withSwap.missingFromWorkflow, []);

  // 6. The dev runner losing its list entirely.
  const gutted = reconcileVisualWorkflow(
    source.replace(
      /^[ ]{10,}[a-z]+\)\n[\s\S]*?\n[ ]*;;/gm,
      "            noop)\n              :\n              ;;",
    ),
  );
  assert.deepEqual([...gutted.missingFromWorkflow].sort(), [...cohort].sort());
});
