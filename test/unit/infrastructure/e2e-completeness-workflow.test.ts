import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  E2E_COHORT_SPECS,
  E2E_SUITE_CATALOG,
  type E2eExecutionCohort,
} from "../../../frontend/e2e/suites/catalog.ts";
import { evaluateWorkflowSecurity } from "../../../scripts/governance/workflow-security-validator.mjs";

const require = createRequire(import.meta.url);
const { CORE_SCHEMA, load, mergeTag } = require("js-yaml") as {
  CORE_SCHEMA: { withTags: (tag: unknown) => unknown };
  load: (source: string, options: Record<string, unknown>) => unknown;
  mergeTag: unknown;
};

const REPO_ROOT = process.cwd();
const FRONTEND_WORKFLOW = ".github/workflows/frontend-ci.yml";
const COMPLETENESS_WORKFLOW = ".github/workflows/e2e-completeness.yml";
const AUTOMATIC_EVENTS = new Set(["pull_request", "push", "schedule"]);
const STATIC_COHORTS = [
  "ci",
  "extended",
  "evidence",
  "visual-linux",
  "full",
] as const satisfies readonly E2eExecutionCohort[];
const PARTITION_COHORTS = [
  "ci",
  "extended",
  "evidence",
  "visual-linux",
] as const satisfies readonly E2eExecutionCohort[];
const REQUIRED_PULL_REQUEST_PATHS = [
  ".github/workflows/e2e-completeness.yml",
  ".github/workflows/frontend-ci.yml",
  "frontend/e2e/**",
  "frontend/playwright.config.ts",
  "frontend/package.json",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "scripts/governance/**",
  "test/architecture/e2e-suite-catalog-completeness.test.ts",
  "test/unit/infrastructure/e2e-completeness-workflow.test.ts",
  "test/unit/infrastructure/frontend-ci-workflow.test.ts",
  "test/unit/infrastructure/frontend-playwright-production-runner.test.ts",
  "test/unit/infrastructure/workflow-security-policy-contract.test.ts",
  "test/unit/infrastructure/workflow-security-validator-contract.test.ts",
] as const;

type Mapping = Record<string, unknown>;
type WorkflowInput = Readonly<Record<string, string>>;
type CohortSpecs = Readonly<Record<string, readonly string[]>>;

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

function readWorkflow(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), "utf8").replace(/\r\n/g, "\n");
}

function workflowSources(): WorkflowInput {
  return {
    [FRONTEND_WORKFLOW]: readWorkflow(FRONTEND_WORKFLOW),
    [COMPLETENESS_WORKFLOW]: readWorkflow(COMPLETENESS_WORKFLOW),
  };
}

function eventNames(document: Mapping): string[] {
  const events = document.on;
  if (typeof events === "string") return [events];
  if (Array.isArray(events)) return events.filter((event): event is string => typeof event === "string");
  return Object.keys(mapping(events, "on"));
}

function runCommands(document: Mapping): string[] {
  const commands: string[] = [];
  const jobs = mapping(document.jobs, "jobs");

  for (const [jobName, jobValue] of Object.entries(jobs)) {
    const job = mapping(jobValue, `jobs.${jobName}`);
    const steps = sequence(job.steps, `jobs.${jobName}.steps`);
    for (const [index, stepValue] of steps.entries()) {
      const step = mapping(stepValue, `jobs.${jobName}.steps[${index}]`);
      if (typeof step.run === "string") commands.push(step.run);
    }
  }

  return commands;
}

function routedCohorts(document: Mapping): E2eExecutionCohort[] {
  const cohorts = new Set<E2eExecutionCohort>();
  const commandPattern = /(?:^|\s)pnpm\s+--dir\s+frontend\s+e2e:(ci|extended|evidence|visual-linux|full)(?=\s|$)/gm;

  for (const command of runCommands(document)) {
    for (const match of command.matchAll(commandPattern)) {
      cohorts.add(match[1] as E2eExecutionCohort);
    }
  }

  return [...cohorts];
}

function evaluateAutomaticCoverage(
  sources: WorkflowInput,
  cohortSpecs: CohortSpecs = E2E_COHORT_SPECS,
) {
  const automaticRoutes = new Map<string, E2eExecutionCohort[]>();
  const coveredSpecs = new Set<string>();

  for (const [path, source] of Object.entries(sources)) {
    const document = parseWorkflow(source);
    if (!eventNames(document).some((event) => AUTOMATIC_EVENTS.has(event))) continue;

    const cohorts = routedCohorts(document);
    if (cohorts.length === 0) continue;
    automaticRoutes.set(path, cohorts);
    for (const cohort of cohorts) {
      for (const spec of cohortSpecs[cohort] ?? []) coveredSpecs.add(spec);
    }
  }

  const fullSpecs = cohortSpecs.full ?? [];
  return {
    automaticRoutes,
    coveredSpecs: [...coveredSpecs].sort(),
    missingSpecs: fullSpecs.filter((spec) => !coveredSpecs.has(spec)).sort(),
  };
}

function job(document: Mapping, jobName: string): Mapping {
  return mapping(mapping(document.jobs, "jobs")[jobName], `jobs.${jobName}`);
}

function stepByName(workflowJob: Mapping, name: string): Mapping {
  const step = sequence(workflowJob.steps, "steps")
    .map((value, index) => mapping(value, `steps[${index}]`))
    .find((candidate) => candidate.name === name);
  assert.ok(step, `missing step ${name}`);
  return step;
}

test("automatic workflow coverage is derived from catalog cohorts and equals full", () => {
  const result = evaluateAutomaticCoverage(workflowSources());

  assert.deepEqual(result.missingSpecs, []);
  assert.deepEqual(result.coveredSpecs, [...E2E_COHORT_SPECS.full].sort());
  assert.deepEqual(result.automaticRoutes.get(FRONTEND_WORKFLOW), ["ci"]);
  assert.deepEqual(result.automaticRoutes.get(COMPLETENESS_WORKFLOW), ["full"]);
  // +1: B10 clinic app-shell unification (regression/dashboard-shell).
  // +1: PR-TRUNC detail text integrity (platform/app-shell).
  // +1: B11 canonical WorkspaceHeader (regression/dashboard).
  // +1: B12 module-card removal and B13 durable admin entry.
  assert.equal(E2E_SUITE_CATALOG.length, 90);

  const partitionUnion = new Set(PARTITION_COHORTS.flatMap((cohort) => E2E_COHORT_SPECS[cohort]));
  assert.deepEqual([...partitionUnion].sort(), [...E2E_COHORT_SPECS.full].sort());
});

test("coverage fails closed when the full route or any partition contribution is removed", () => {
  const sources = workflowSources();
  const withoutFull = {
    ...sources,
    [COMPLETENESS_WORKFLOW]: sources[COMPLETENESS_WORKFLOW].replace(
      "pnpm --dir frontend e2e:full",
      "pnpm --dir frontend e2e:ci",
    ),
  };
  const result = evaluateAutomaticCoverage(withoutFull);

  assert.equal(result.missingSpecs.length, 34);
  for (const cohort of ["extended", "evidence", "visual-linux"] as const) {
    assert.ok(
      E2E_COHORT_SPECS[cohort].every((spec) => result.missingSpecs.includes(spec)),
      `${cohort} must become uncovered without the full route`,
    );
  }

  for (const removedCohort of ["extended", "evidence", "visual-linux"] as const) {
    const mutatedSpecs = Object.fromEntries(
      STATIC_COHORTS.map((cohort) => [
        cohort,
        cohort === "full"
          ? E2E_COHORT_SPECS.full.filter((spec) => !E2E_COHORT_SPECS[removedCohort].includes(spec))
          : E2E_COHORT_SPECS[cohort],
      ]),
    );
    const expectedFull = new Set(PARTITION_COHORTS.flatMap((cohort) => E2E_COHORT_SPECS[cohort]));
    assert.notDeepEqual(
      [...new Set(mutatedSpecs.full)].sort(),
      [...expectedFull].sort(),
      `removing ${removedCohort} from full must violate the catalog partition`,
    );
  }
});

test("a cataloged spec without an automatic route is reported deterministically", () => {
  const fixtureSpec = "e2e/platform/fixture/cataloged-without-route.spec.ts";
  const mutatedSpecs = {
    ...E2E_COHORT_SPECS,
    extended: [...E2E_COHORT_SPECS.extended, fixtureSpec],
    full: [...E2E_COHORT_SPECS.full, fixtureSpec],
  };
  const ciOnlySources = {
    [FRONTEND_WORKFLOW]: readWorkflow(FRONTEND_WORKFLOW),
  };
  const result = evaluateAutomaticCoverage(ciOnlySources, mutatedSpecs);

  assert.ok(result.missingSpecs.includes(fixtureSpec));
});

test("completeness workflow has focused durable triggers and no literal spec list", () => {
  const source = readWorkflow(COMPLETENESS_WORKFLOW);
  const document = parseWorkflow(source);
  const events = mapping(document.on, "on");
  const pullRequest = mapping(events.pull_request, "on.pull_request");

  assert.deepEqual(mapping(pullRequest, "pull_request").branches, ["main"]);
  assert.deepEqual(pullRequest.paths, [...REQUIRED_PULL_REQUEST_PATHS]);
  assert.equal(Object.prototype.hasOwnProperty.call(events, "workflow_dispatch"), true);
  assert.deepEqual(events.schedule, [{ cron: "17 3 * * 2" }]);
  assert.equal(
    runCommands(document).some((command) => command.includes(".spec.ts")),
    false,
    "workflow commands must not contain literal Playwright spec paths",
  );
  assert.deepEqual(routedCohorts(document), ["full"]);
});

test("completeness job preserves Linux baseline compatibility, build ordering and hygiene", () => {
  const source = readWorkflow(COMPLETENESS_WORKFLOW);
  const document = parseWorkflow(source);
  const workflowJob = job(document, "e2e-full-completeness");
  const steps = sequence(workflowJob.steps, "steps").map((value, index) => mapping(value, `steps[${index}]`));
  const stepNames = steps.map((step) => String(step.name ?? ""));

  assert.equal(workflowJob["runs-on"], "ubuntu-latest");
  assert.equal(workflowJob["timeout-minutes"], 55);
  assert.deepEqual(document.permissions, { contents: "read" });
  assert.equal(mapping(document.concurrency, "concurrency")["cancel-in-progress"], true);
  assert.ok(stepNames.indexOf("Build frontend") < stepNames.indexOf("Run complete cataloged E2E suite"));
  assert.ok(stepNames.indexOf("Audit built public surface") < stepNames.indexOf("Run complete cataloged E2E suite"));
  assert.ok(stepNames.indexOf("Install Playwright Chromium") < stepNames.indexOf("Run complete cataloged E2E suite"));

  const build = stepByName(workflowJob, "Build frontend");
  const runFull = stepByName(workflowJob, "Run complete cataloged E2E suite");
  assert.deepEqual(build.env, {
    NEXT_PUBLIC_API_URL: "http://127.0.0.1:3107",
    VETNEB_E2E_ALLOW_LOCAL_API: "1",
    VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS: "1",
  });
  assert.equal(runFull.run, "pnpm --dir frontend e2e:full -- --workers=2 --retries=2");
  assert.deepEqual(
    runFull.env,
    { E2E_GLOBAL_TIMEOUT_MS: "2400000" },
    "the full catalog exceeds Playwright's 30m default, so this step — and only this step — must carry the 40m budget",
  );
  const jobTimeoutMs = Number(workflowJob["timeout-minutes"]) * 60_000;
  const playwrightBudgetMs = Number(mapping(runFull.env, "runFull.env").E2E_GLOBAL_TIMEOUT_MS);
  assert.ok(
    jobTimeoutMs - playwrightBudgetMs >= 15 * 60_000,
    "the job cap must reserve at least 15m outside Playwright's own budget for checkout, install, " +
      "build, browser install and — on timeout — diagnostics, teardown and hygiene; otherwise setup " +
      "overhead can cancel the job before a healthy suite finishes",
  );
  assert.equal(
    source.includes("VETNEB_E2E_PRODUCTION_RUNNER"),
    false,
    "full must use next dev because the immutable Linux baselines include the Next.js development indicator",
  );
  assert.equal(stepByName(workflowJob, "Upload Playwright diagnostics").if, "failure()");
  assert.equal(stepByName(workflowJob, "Verify E2E teardown").if, "always()");
  assert.equal(stepByName(workflowJob, "Verify source hygiene and clean generated artifacts").if, "always()");
  assert.equal(source.includes("continue-on-error"), false);
});

test("completeness workflow passes the parser-backed workflow security policy", () => {
  const report = evaluateWorkflowSecurity({
    rootDir: REPO_ROOT,
    workflowPaths: [COMPLETENESS_WORKFLOW],
  });

  assert.equal(report.passed, true, JSON.stringify(report.failures, null, 2));
  assert.deepEqual(report.permissions.map((entry) => entry.permissions), [{ contents: "read" }]);
  assert.ok(report.externalActions.every((action) => /^[0-9a-f]{40}$/.test(action.ref)));
});
