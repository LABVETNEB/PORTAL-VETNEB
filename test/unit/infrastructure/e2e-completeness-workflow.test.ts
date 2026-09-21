import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

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
// E2E-GLOBAL-06: every pull request against main runs `full`, so no P1 spec
// outside `ci` depends on the weekly schedule. Any change filter reopens that gap.
const FORBIDDEN_PULL_REQUEST_FILTERS = ["paths", "paths-ignore", "types"] as const;

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

const FULL_STEP = "Run complete cataloged E2E suite";
const BUILD_STEP = "Build frontend";
const PRODUCTION_APPLICATION_COMMAND = "pnpm start --hostname 127.0.0.1";
let configImportSequence = 0;

type ApplicationServer = { command?: string; url?: string; env?: Record<string, string> };

// Resolves the application server playwright.config.ts selects for an env.
// GitHub-hosted runners always export CI=true, so the step env is layered on it.
async function applicationServerFor(stepEnv: Record<string, string>): Promise<ApplicationServer> {
  const env: Record<string, string | undefined> = { CI: "true", ...stepEnv };
  const names = ["CI", "E2E_REUSE_SERVER", "VETNEB_E2E_PRODUCTION_RUNNER"];
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  for (const name of names) {
    if (env[name] === undefined) delete process.env[name];
    else process.env[name] = env[name];
  }
  try {
    const configUrl = pathToFileURL(resolve(REPO_ROOT, "frontend/playwright.config.ts"));
    configUrl.searchParams.set("completenessRunner", String(configImportSequence++));
    const config = (await import(configUrl.href)).default as { webServer?: ApplicationServer | ApplicationServer[] };
    const servers = Array.isArray(config.webServer) ? config.webServer : config.webServer ? [config.webServer] : [];
    const server = servers.find((candidate) => candidate.url === "http://127.0.0.1:3000");
    assert.ok(server, "playwright.config.ts must declare the application server on 127.0.0.1:3000");
    return server;
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

// E2E-GLOBAL-05B contract: e2e:full serves the bundle built earlier in the same
// job through `next start`, because the Chromium Linux baselines are production
// captures. Returns the violations instead of asserting so mutations are provable.
async function evaluateFullProductionRunner(source: string): Promise<string[]> {
  const failures: string[] = [];
  const workflowJob = job(parseWorkflow(source), "e2e-full-completeness");
  const steps = sequence(workflowJob.steps, "steps").map((value, index) => mapping(value, `steps[${index}]`));
  const fullIndex = steps.findIndex((step) => step.name === FULL_STEP);
  const buildIndex = steps.findIndex((step) => step.name === BUILD_STEP);
  if (fullIndex === -1) return [`missing step ${FULL_STEP}`];

  const buildStep = buildIndex === -1 ? null : steps[buildIndex];
  if (!buildStep || buildIndex > fullIndex || buildStep.run !== "pnpm --dir frontend build") {
    failures.push("the production bundle must be built by `pnpm --dir frontend build` before e2e:full");
  }

  const fullEnv = isMapping(steps[fullIndex].env) ? (steps[fullIndex].env as Record<string, string>) : {};
  if (fullEnv.VETNEB_E2E_PRODUCTION_RUNNER !== "1") {
    failures.push("e2e:full must set VETNEB_E2E_PRODUCTION_RUNNER=\"1\" on its own step");
  }
  if ((source.match(/VETNEB_E2E_PRODUCTION_RUNNER/g) ?? []).length !== 1) {
    failures.push("VETNEB_E2E_PRODUCTION_RUNNER must be scoped to the e2e:full step only");
  }

  const server = await applicationServerFor(fullEnv);
  if (server.command !== PRODUCTION_APPLICATION_COMMAND) {
    failures.push(`e2e:full must run against next start, playwright.config.ts selected: ${server.command}`);
  }
  if (server.env?.VETNEB_E2E_ALLOW_LOCAL_API !== "1" || server.env?.VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS !== "1") {
    failures.push("next start must receive the production-runner hermeticity exceptions");
  }
  return failures;
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
  // +1: B14 metrics-strip relocation (regression/dashboard).
  // +3: CMP-04 module-card, CMP-05 metric-run and CMP-06 full-route contracts.
  // +3: E2E-GLOBAL-03 simulated auth boundary specs (platform/auth),
  // LIMPIEZA E2E P0-1/R-01/B-3.
  // +1: E2E-GLOBAL-09 P2 follow-up, responsive cold-load sentinel
  // (regression/dashboard-responsive-cold-load-sentinel.spec.ts).
  // -1: E2E-GLOBAL-10 removed the assertion-free evidence generator
  // (regression/evidence/remove-home-unified-workspace-screenshots.spec.ts, R-16).
  // +1: public professional dynamic detail E2E.
  // +1: served PWA surface E2E (public/pwa/public-pwa-served-surface.spec.ts).
  assert.equal(E2E_SUITE_CATALOG.length, 100);

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

  // extended 27 (E2E-GLOBAL-06 moved two P1 specs to ci) + evidence 1
  // (E2E-GLOBAL-10 removed the assertion-free generator) + visual-linux 3.
  assert.equal(result.missingSpecs.length, 31);
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

test("completeness workflow runs on every pull request to main, keeps durable triggers and no literal spec list", () => {
  const source = readWorkflow(COMPLETENESS_WORKFLOW);
  const document = parseWorkflow(source);
  const events = mapping(document.on, "on");
  const pullRequest = mapping(events.pull_request, "on.pull_request");

  assert.deepEqual(mapping(pullRequest, "pull_request").branches, ["main"]);
  for (const filter of FORBIDDEN_PULL_REQUEST_FILTERS) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(pullRequest, filter),
      false,
      `on.pull_request must not declare ${filter}: E2E Completeness gates every PR against main`,
    );
  }
  assert.deepEqual(Object.keys(pullRequest), ["branches"]);
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
  assert.equal(workflowJob["timeout-minutes"], 60);
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
    { E2E_GLOBAL_TIMEOUT_MS: "2700000", VETNEB_E2E_PRODUCTION_RUNNER: "1" },
    "the full catalog exceeds Playwright's 30m default, so this step — and only this step — must carry the 45m budget and the production runner",
  );
  const jobTimeoutMs = Number(workflowJob["timeout-minutes"]) * 60_000;
  const playwrightBudgetMs = Number(mapping(runFull.env, "runFull.env").E2E_GLOBAL_TIMEOUT_MS);
  assert.ok(
    jobTimeoutMs - playwrightBudgetMs >= 15 * 60_000,
    "the job cap must reserve at least 15m outside Playwright's own budget for checkout, install, " +
      "build, browser install and — on timeout — diagnostics, teardown and hygiene; otherwise setup " +
      "overhead can cancel the job before a healthy suite finishes",
  );
  // The production runner keeps trace: retain-on-failure even with --retries=2;
  // diagnostics are uploaded only from the sanitized staging copy, and only
  // when sanitization passed.
  const sanitize = stepByName(workflowJob, "Sanitize Playwright diagnostics");
  const upload = stepByName(workflowJob, "Upload Playwright diagnostics");
  assert.equal(sanitize.id, "sanitize-playwright-artifacts");
  assert.equal(sanitize.if, "failure()");
  assert.equal(
    sanitize.run,
    'node scripts/security/playwright-artifact-sanitizer.mjs --output "${RUNNER_TEMP}/playwright-sanitized" --input frontend/playwright-report --input frontend/test-results',
  );
  assert.equal(upload.if, "failure() && steps.sanitize-playwright-artifacts.outcome == 'success'");
  assert.equal(
    mapping(upload.with, "upload.with").path,
    "${{ runner.temp }}/playwright-sanitized/playwright-report/\n${{ runner.temp }}/playwright-sanitized/test-results/\n",
  );
  assert.ok(stepNames.indexOf("Run complete cataloged E2E suite") < stepNames.indexOf("Sanitize Playwright diagnostics"));
  assert.ok(stepNames.indexOf("Sanitize Playwright diagnostics") < stepNames.indexOf("Upload Playwright diagnostics"));
  assert.ok(stepNames.indexOf("Upload Playwright diagnostics") < stepNames.indexOf("Verify source hygiene and clean generated artifacts"));
  assert.equal(stepByName(workflowJob, "Verify E2E teardown").if, "always()");
  assert.equal(stepByName(workflowJob, "Verify source hygiene and clean generated artifacts").if, "always()");
  assert.equal(source.includes("continue-on-error"), false);
});

test("e2e:full runs the built bundle under next start (E2E-GLOBAL-05B)", async () => {
  assert.deepEqual(await evaluateFullProductionRunner(readWorkflow(COMPLETENESS_WORKFLOW)), []);
});

test("production runner contract fails closed on flag, scope and build mutations", async () => {
  const source = readWorkflow(COMPLETENESS_WORKFLOW);
  const flagLine = '          VETNEB_E2E_PRODUCTION_RUNNER: "1"\n';
  assert.ok(source.includes(flagLine), "fixture precondition: flag line present");

  const withoutFlag = await evaluateFullProductionRunner(source.replace(flagLine, ""));
  assert.ok(withoutFlag.some((failure) => failure.includes('VETNEB_E2E_PRODUCTION_RUNNER="1"')));
  assert.ok(withoutFlag.some((failure) => failure.includes("selected: pnpm dev --hostname 127.0.0.1")));

  const wrongValue = await evaluateFullProductionRunner(source.replace(flagLine, flagLine.replace('"1"', '"true"')));
  assert.ok(wrongValue.some((failure) => failure.includes("selected: pnpm dev --hostname 127.0.0.1")));

  const buildEnvAnchor = '          VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS: "1"\n';
  const flagOnBuild = await evaluateFullProductionRunner(
    source.replace(flagLine, "").replace(buildEnvAnchor, `${buildEnvAnchor}${flagLine}`),
  );
  assert.ok(flagOnBuild.some((failure) => failure.includes("on its own step")));

  const withoutBuild = await evaluateFullProductionRunner(
    source.replace("        run: pnpm --dir frontend build\n", "        run: pnpm --dir frontend lint\n"),
  );
  assert.ok(withoutBuild.some((failure) => failure.includes("built by `pnpm --dir frontend build`")));
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

test("system dependency install sanitizes only Google Chrome APT sources and stays fail-closed", () => {
  const source = readWorkflow(COMPLETENESS_WORKFLOW);
  const document = parseWorkflow(source);
  const workflowJob = job(document, "e2e-full-completeness");
  const step = stepByName(workflowJob, "Install Playwright system dependencies");
  const script = String(step.run);

  assert.equal(step.shell, "bash");
  assert.equal(step["timeout-minutes"], 5);
  assert.ok(script.startsWith("set -euo pipefail\n"), "the step must abort on the first failing command");

  // The remediated failure was an out-of-scope APT source, not a Playwright one:
  // `install-deps` itself must survive verbatim. `install --with-deps` is not a
  // substitute — it runs the same apt-get update and would hit the same source.
  assert.match(script, /\n\s*pnpm --dir frontend exec playwright install-deps chromium\n?$/);
  assert.equal(script.includes("--with-deps"), false);

  // Both APT source formats the runner image can carry must be swept; the image
  // ships the Deb822 `/etc/apt/sources.list.d/google-chrome.sources`, and a sweep
  // that only understands one-line `deb` entries leaves the gate broken.
  for (const glob of ["/etc/apt/sources.list.d/*.list", "/etc/apt/sources.list.d/*.sources"]) {
    assert.ok(script.includes(glob), `the sweep must cover ${glob}`);
  }
  assert.ok(
    script.includes('BEGIN { RS = ""; FS = "\\n" }'),
    "Deb822 stanzas must be read record-wise with newline as the only field separator",
  );
  assert.ok(script.includes('print "Enabled: no"'), "a matched Deb822 stanza must be disabled, not deleted");
  assert.equal(
    /Unsupported Deb822/.test(script),
    false,
    "Deb822 sources must be handled, never rejected as unsupported",
  );

  // Targeted at Google Chrome and nothing else, so the Ubuntu archive that
  // actually provides Chromium's libraries is never disabled.
  assert.ok(script.includes("readonly target_fragment='dl.google.com/linux/chrome'"));
  assert.equal(/(archive\.ubuntu\.com|ubuntu\.sources|rm -rf? \/etc\/apt)/.test(script), false);

  // Fail-closed: a target that survives the rewrite stops the job.
  assert.ok(script.includes("Targeted APT source remains active after rewrite"));
  assert.match(script, /if has_active_target "\$source_file"; then\n\s+echo[^\n]*\n\s+exit 1\n/);
  for (const escape of ["|| true", "continue-on-error", "set +e", "apt-get update || "]) {
    assert.equal(script.includes(escape), false, `the step must not neutralize failures with: ${escape}`);
  }
});
