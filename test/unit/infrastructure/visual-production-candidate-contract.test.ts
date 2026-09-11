import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { E2E_COHORT_SPECS } from "../../../frontend/e2e/suites/catalog.ts";
import { evaluateWorkflowSecurity } from "../../../scripts/governance/workflow-security-validator.mjs";

// E2E-GLOBAL-05A contract: the production visual candidate is built, served by
// `next start` through playwright.config.ts's own production runner, captured
// into an isolated tree outside the repository and compared exactly against
// the canonical baselines — which it can never update. The pipeline is
// exercised with injected process/git seams over fabricated PNGs; the overlay
// config is loaded in a child process so each case evaluates the base config
// under its own environment.

type Env = Record<string, string>;

interface Deps {
  platform: string;
  cwd: string;
  repoRoot: string;
  now: () => number;
  evidenceContext: { environment: Record<string, string>; actor: string };
  git: (args: string[]) => string;
  runPnpm: (args: string[], env: Env) => number;
  runNode: (args: string[]) => number;
  readBuildId: (startedAtMs: number) => string;
  restoreNextEnv: () => Promise<void> | void;
  log: (text: string) => void;
  error: (text: string) => void;
}

interface CandidateModule {
  EXIT: Record<
    | "PASS"
    | "CONTRACT_FAILED"
    | "INFRASTRUCTURE"
    | "BUILD_FAILED"
    | "PLAYWRIGHT_FAILED"
    | "PLATFORM_INCOMPATIBLE"
    | "CANONICAL_MUTATED"
    | "TEARDOWN_FAILED",
    number
  >;
  VISUAL_SUITES: readonly string[];
  CANDIDATE_CONFIG: string;
  CANDIDATE_DIR_ENV: string;
  PLAYWRIGHT_OUTPUT_DIR_ENV: string;
  PRODUCTION_APPLICATION_COMMAND: string;
  PRODUCTION_BUILD_ENV: Readonly<Env>;
  PRODUCTION_RUNNER_ENV: Readonly<Env>;
  EVIDENCE_LAYOUT: Readonly<Record<"baseline" | "candidate" | "comparison" | "playwright" | "manifest", string>>;
  parseArgs: (argv: string[]) => { suite: string; evidenceDir: string | null; help: boolean };
  selectSuiteSpecs: (suite: string) => string[];
  readProductionBuildId: (startedAtMs: number, frontendRoot: string) => string;
  runProductionCandidate: (options: { suite: string; evidenceDir: string }, deps: Deps) => Promise<number>;
}

interface PngImage {
  width: number;
  height: number;
  data: Buffer;
}

interface PngStatic {
  new (options: { width: number; height: number }): PngImage;
  sync: { write: (png: PngImage) => Buffer };
}

type Mapping = Record<string, unknown>;

const TEST_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(TEST_FILE), "..", "..", "..");
const FRONTEND_ROOT = resolve(REPO_ROOT, "frontend");
const SCRIPT_PATH = resolve(FRONTEND_ROOT, "e2e/scripts/visual-production-candidate.mjs");
const CONFIG_PATH = resolve(FRONTEND_ROOT, "e2e/scripts/visual-production-candidate.config.mjs");
const MANUAL_WORKFLOW = ".github/workflows/visual-regression-manual.yml";
const FRONTEND_WORKFLOW = ".github/workflows/frontend-ci.yml";

const exitCodeBeforeImport = process.exitCode;
// Non-literal specifiers keep the .mjs modules off the TS module graph.
const candidate = (await import(pathToFileURL(SCRIPT_PATH).href)) as CandidateModule;
const PngConstructor = ((await import("pngjs" as string)) as { PNG: PngStatic }).PNG;

const require = createRequire(import.meta.url);
const { CORE_SCHEMA, load, mergeTag } = require("js-yaml") as {
  CORE_SCHEMA: { withTags: (tag: unknown) => unknown };
  load: (source: string, options: Record<string, unknown>) => unknown;
  mergeTag: unknown;
};

const { EXIT } = candidate;
const SUITE_ROOT = mkdtempSync(join(tmpdir(), "visual-production-candidate-"));
after(() => rmSync(SUITE_ROOT, { recursive: true, force: true }));

const PUBLIC_SPEC = candidate.selectSuiteSpecs("public")[0];
const SNAPSHOT_DIR = `frontend/${PUBLIC_SPEC}-snapshots`;
const BASELINE_NAMES = ["public-home-320-chromium-linux.png", "public-login-320-chromium-linux.png"];
const HEAD = "0123456789abcdef0123456789abcdef01234567";

function png(width: number, height: number, red: number): Buffer {
  const image = new PngConstructor({ width, height });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = red;
    image.data[offset + 1] = 20;
    image.data[offset + 2] = 40;
    image.data[offset + 3] = 255;
  }
  return PngConstructor.sync.write(image);
}

function mapping(value: unknown, label: string): Mapping {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be a mapping`);
  return value as Mapping;
}

function readWorkflow(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), "utf8").replace(/\r\n/g, "\n");
}

function parseWorkflow(source: string): Mapping {
  return mapping(
    load(source, { schema: CORE_SCHEMA.withTags(mergeTag), maxDepth: 100, maxTotalMergeKeys: 20, maxAliases: 0 }),
    "workflow",
  );
}

function workflowSteps(document: Mapping, jobName: string): Mapping[] {
  const job = mapping(mapping(document.jobs, "jobs")[jobName], `jobs.${jobName}`);
  assert.ok(Array.isArray(job.steps), `jobs.${jobName}.steps must be a sequence`);
  return job.steps.map((step, index) => mapping(step, `steps[${index}]`));
}

function stepNamed(steps: Mapping[], name: string): Mapping {
  const step = steps.find((candidateStep) => candidateStep.name === name);
  assert.ok(step, `missing step ${name}`);
  return step;
}

// ---------------------------------------------------------------------------
// Pipeline harness.
// ---------------------------------------------------------------------------

type Call = { kind: "node" | "build" | "build-id" | "playwright" | "restore"; args: string[]; env?: Env };

type PlaywrightContext = { candidateDir: string; baselineDir: string; repoSnapshotDir: string; env: Env };

type Scenario = {
  platform?: string;
  statusBefore?: string;
  statusAfter?: string;
  preflightStatus?: number;
  buildStatus?: number;
  buildIdError?: boolean;
  playwright?: (context: PlaywrightContext) => number;
  teardownStatus?: number;
  evidenceDir?: (paths: { caseRoot: string; repoRoot: string }) => string;
};

let caseCounter = 0;

function copyBaselines(context: PlaywrightContext): number {
  cpSync(context.baselineDir, context.candidateDir, { recursive: true });
  return 0;
}

// Candidate paths are relative to frontend/e2e, like the staged baselines.
function candidatePath(context: PlaywrightContext, name: string): string {
  return join(context.candidateDir, ...`${PUBLIC_SPEC.slice("e2e/".length)}-snapshots`.split("/"), name);
}

async function runScenario(scenario: Scenario = {}) {
  caseCounter += 1;
  const caseRoot = join(SUITE_ROOT, `case-${caseCounter}`);
  const repoRoot = join(caseRoot, "repo");
  const repoSnapshotDir = join(repoRoot, ...SNAPSHOT_DIR.split("/"));
  mkdirSync(repoSnapshotDir, { recursive: true });
  const tracked = BASELINE_NAMES.map((name, index) => {
    writeFileSync(join(repoSnapshotDir, name), png(4, 3, 60 + index));
    return `${SNAPSHOT_DIR}/${name}`;
  });
  const canonicalBytes = tracked.map((path) => readFileSync(join(repoRoot, ...path.split("/"))));

  const evidenceDir = scenario.evidenceDir?.({ caseRoot, repoRoot }) ?? join(caseRoot, "evidence");
  const calls: Call[] = [];
  let phase: "before" | "after" = "before";
  let nodeCalls = 0;
  const errors: string[] = [];

  const deps: Deps = {
    platform: scenario.platform ?? "linux",
    cwd: caseRoot,
    repoRoot,
    now: () => Date.UTC(2026, 8, 11, 12, 34, 56),
    evidenceContext: {
      environment: { execution: "github-actions", runner: "github-hosted-linux" },
      actor: "github-actions-workflow",
    },
    git: (args) => {
      if (args[0] === "rev-parse") return `${HEAD}\n`;
      if (args[0] === "ls-files") return args.at(-1) === `${SNAPSHOT_DIR}/` ? tracked.map((path) => `${path}\0`).join("") : "";
      if (args[0] === "status") return (phase === "before" ? scenario.statusBefore : scenario.statusAfter) ?? "";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    runNode: (args) => {
      calls.push({ kind: "node", args });
      nodeCalls += 1;
      return nodeCalls === 1 ? (scenario.preflightStatus ?? 0) : (scenario.teardownStatus ?? 0);
    },
    runPnpm: (args, env) => {
      if (args[0] === "run" && args[1] === "build") {
        calls.push({ kind: "build", args, env });
        return scenario.buildStatus ?? 0;
      }
      calls.push({ kind: "playwright", args, env });
      const status = (scenario.playwright ?? copyBaselines)({
        candidateDir: env[candidate.CANDIDATE_DIR_ENV],
        baselineDir: join(evidenceDir, candidate.EVIDENCE_LAYOUT.baseline),
        repoSnapshotDir,
        env,
      });
      phase = "after";
      return status;
    },
    readBuildId: () => {
      calls.push({ kind: "build-id", args: [] });
      if (scenario.buildIdError) throw new Error(".next/BUILD_ID predates this build");
      return "fixture-build-id";
    },
    restoreNextEnv: () => {
      calls.push({ kind: "restore", args: [] });
    },
    log: () => {},
    error: (text) => errors.push(text),
  };

  const exitCode = await candidate.runProductionCandidate({ suite: "public", evidenceDir }, deps);
  const comparisonJson = join(evidenceDir, candidate.EVIDENCE_LAYOUT.comparison, "visual-artifact-comparison.json");
  const manifestPath = join(evidenceDir, candidate.EVIDENCE_LAYOUT.manifest);

  return {
    exitCode,
    calls,
    errors,
    evidenceDir,
    repoRoot,
    kinds: calls.map((call) => call.kind),
    comparison: existsSync(comparisonJson) ? JSON.parse(readFileSync(comparisonJson, "utf8")) : null,
    manifest: existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null,
    canonicalUnchanged: () =>
      tracked.every((path, index) => readFileSync(join(repoRoot, ...path.split("/"))).equals(canonicalBytes[index])),
  };
}

// ---------------------------------------------------------------------------
// Module surface and arguments.
// ---------------------------------------------------------------------------

test("importing the candidate orchestrator does not execute its CLI", () => {
  assert.equal(process.exitCode, exitCodeBeforeImport);
});

test("frontend exposes the candidate as an explicit script and leaves e2e:full untouched", () => {
  const scripts = (JSON.parse(readFileSync(resolve(FRONTEND_ROOT, "package.json"), "utf8")) as { scripts: Env }).scripts;

  assert.equal(scripts["e2e:visual-production-candidate"], "node e2e/scripts/visual-production-candidate.mjs");
  assert.equal(scripts["e2e:full"], "node e2e/scripts/run-cohort.mjs full");
});

test("arguments cannot forward snapshot updates, configs or spec filters", () => {
  for (const forbidden of [
    ["--update-snapshots"],
    ["--update-snapshots=all"],
    ["-u"],
    ["--config", "playwright.config.ts"],
    ["e2e/regression/visual/visual-regression-public.spec.ts"],
  ]) {
    assert.throws(() => candidate.parseArgs(["--evidence-dir", "/tmp/evidence", ...forbidden]), /unknown argument/);
  }

  assert.throws(() => candidate.parseArgs([]), /--evidence-dir is required/);
  assert.throws(() => candidate.parseArgs(["--evidence-dir", "/tmp/e", "--suite", "dev"]), /--suite must be one of/);
  assert.throws(() => candidate.parseArgs(["--evidence-dir", "--suite"]), /requires a value/);
  assert.deepEqual(candidate.parseArgs(["--", "--suite=stress", "--evidence-dir", "/tmp/e"]), {
    suite: "stress",
    evidenceDir: "/tmp/e",
    help: false,
  });

  const cli = spawnSync(process.execPath, [SCRIPT_PATH, "--evidence-dir", "/tmp/e", "--update-snapshots"], {
    cwd: FRONTEND_ROOT,
    encoding: "utf8",
  });
  assert.equal(cli.status, EXIT.INFRASTRUCTURE);
  assert.match(cli.stderr, /unknown argument: --update-snapshots/);
});

test("suites resolve from the catalog visual-linux cohort, never from a literal list", () => {
  assert.deepEqual(candidate.VISUAL_SUITES, ["all", "public", "authenticated", "stress"]);
  assert.deepEqual(candidate.selectSuiteSpecs("all"), [...E2E_COHORT_SPECS["visual-linux"]]);
  for (const suite of ["public", "authenticated", "stress"]) {
    assert.deepEqual(candidate.selectSuiteSpecs(suite), [`e2e/regression/visual/visual-regression-${suite}.spec.ts`]);
  }
  assert.throws(() => candidate.selectSuiteSpecs("unknown"), /exactly one cataloged visual-linux spec/);
});

test("the candidate build uses exactly the bundle environment Frontend CI serves with next start", () => {
  const build = stepNamed(workflowSteps(parseWorkflow(readWorkflow(FRONTEND_WORKFLOW)), "validate-frontend"), "Build frontend");

  assert.deepEqual({ ...candidate.PRODUCTION_BUILD_ENV }, build.env);
  assert.deepEqual({ ...candidate.PRODUCTION_RUNNER_ENV }, { CI: "true", VETNEB_E2E_PRODUCTION_RUNNER: "1" });
  assert.equal(candidate.PRODUCTION_APPLICATION_COMMAND, "pnpm start --hostname 127.0.0.1");
});

test("a stale or missing BUILD_ID is rejected as a failed build", () => {
  const frontendRoot = join(SUITE_ROOT, "build-id");
  mkdirSync(join(frontendRoot, ".next"), { recursive: true });
  assert.throws(() => candidate.readProductionBuildId(Date.now(), frontendRoot), /did not produce/);

  const buildIdPath = join(frontendRoot, ".next", "BUILD_ID");
  writeFileSync(buildIdPath, "fresh-id\n");
  assert.equal(candidate.readProductionBuildId(Date.now() - 60_000, frontendRoot), "fresh-id");

  const anHourAgo = new Date(Date.now() - 3_600_000);
  utimesSync(buildIdPath, anHourAgo, anHourAgo);
  assert.throws(() => candidate.readProductionBuildId(Date.now(), frontendRoot), /predates this build/);
});

// ---------------------------------------------------------------------------
// Pipeline ordering and fail-closed outcomes.
// ---------------------------------------------------------------------------

test("build precedes next start, teardown and integrity precede comparison, and the candidate passes when identical", async () => {
  const run = await runScenario();

  assert.equal(run.exitCode, EXIT.PASS, run.errors.join("\n"));
  assert.deepEqual(run.kinds, ["node", "build", "build-id", "playwright", "restore", "node"]);

  const build = run.calls.find((call) => call.kind === "build");
  assert.deepEqual(build?.env, { ...candidate.PRODUCTION_BUILD_ENV });

  const playwright = run.calls.find((call) => call.kind === "playwright");
  assert.ok(playwright?.env);
  assert.equal(playwright.env.CI, "true");
  assert.equal(playwright.env.VETNEB_E2E_PRODUCTION_RUNNER, "1");
  assert.equal(playwright.env[candidate.CANDIDATE_DIR_ENV], join(run.evidenceDir, candidate.EVIDENCE_LAYOUT.candidate));
  assert.equal(playwright.env[candidate.PLAYWRIGHT_OUTPUT_DIR_ENV], join(run.evidenceDir, candidate.EVIDENCE_LAYOUT.playwright));
  assert.deepEqual(playwright.args, [
    "exec",
    "playwright",
    "test",
    PUBLIC_SPEC,
    "--config",
    candidate.CANDIDATE_CONFIG,
    "--project=chromium",
  ]);
  assert.equal(playwright.args.some((arg) => /update-snapshots|^-u$/.test(arg)), false);

  assert.equal(run.comparison.summary.passed, true);
  assert.equal(run.comparison.requiredCount, BASELINE_NAMES.length);
  assert.equal(run.manifest.exitCode, EXIT.PASS);
  assert.equal(run.manifest.headCommit, HEAD);
  assert.equal(run.manifest.build.buildId, "fixture-build-id");
  assert.equal(run.manifest.runner.applicationServerCommand, "pnpm start --hostname 127.0.0.1");
  assert.equal(run.manifest.canonicalBaselines.length, BASELINE_NAMES.length);
  assert.match(run.manifest.promotion, /E2E-GLOBAL-05B/);
  assert.deepEqual(run.manifest.evidence.environment, { execution: "github-actions", runner: "github-hosted-linux" });
  assert.equal(run.manifest.evidence.surface, "visual-regression-manual/production-candidate");
  assert.equal(run.manifest.evidence.actor, "github-actions-workflow");
  assert.equal(run.manifest.evidence.timestampUtc, "2026-09-11T12:34:56.000Z");
  assert.deepEqual(run.manifest.evidence.steps, [
    "validate platform",
    "prepare isolated evidence",
    "stage canonical baselines",
    "verify ports",
    "production build",
    "Playwright under next start",
    "restore next-env hygiene",
    "verify teardown",
    "verify canonical integrity",
    "compare dev-vs-prod",
    "write evidence",
  ]);
  assert.deepEqual(run.manifest.evidence.result, { status: "passed", exitCode: EXIT.PASS, approved: false });
  assert.deepEqual(run.manifest.evidence.artifactInventory.baselineDev, run.manifest.canonicalBaselines.map(({ path }: { path: string }) => path.replace(/^frontend\/e2e\//, "baseline-dev/")));
  assert.equal(run.manifest.evidence.artifactInventory.manifest, "visual-production-candidate.json");
  assert.ok(run.manifest.evidence.artifactInventory.comparison.includes("comparison/visual-artifact-comparison.json"));
  assert.ok(run.manifest.evidence.residualRisks.every((risk: string) => /baseline|E2E-GLOBAL-05B|pixel|suite=all/.test(risk)));
  assert.equal(JSON.stringify(run.manifest.evidence.artifactInventory).includes(run.evidenceDir), false);
  assert.equal(/token|cookie|secret|authorization/i.test(JSON.stringify(run.manifest.evidence.artifactInventory)), false);
  assert.ok(run.canonicalUnchanged());
});

test("dev-vs-prod differences are reported per file and fail the contract without being normalized", async () => {
  const pixel = await runScenario({
    playwright: (context) => {
      copyBaselines(context);
      writeFileSync(candidatePath(context, BASELINE_NAMES[0]), png(4, 3, 200));
      return 0;
    },
  });
  assert.equal(pixel.exitCode, EXIT.CONTRACT_FAILED);
  assert.equal(pixel.comparison.summary.pixelDifferentCount, 1);

  const dimensions = await runScenario({
    playwright: (context) => {
      copyBaselines(context);
      writeFileSync(candidatePath(context, BASELINE_NAMES[1]), png(5, 3, 61));
      return 0;
    },
  });
  assert.equal(dimensions.exitCode, EXIT.CONTRACT_FAILED);
  assert.equal(dimensions.comparison.summary.dimensionDifferentCount, 1);

  const missing = await runScenario({
    playwright: (context) => {
      copyBaselines(context);
      rmSync(candidatePath(context, BASELINE_NAMES[0]));
      return 0;
    },
  });
  assert.equal(missing.exitCode, EXIT.CONTRACT_FAILED);
  assert.deepEqual(missing.comparison.missingRight, [
    `${PUBLIC_SPEC.slice("e2e/".length)}-snapshots/${BASELINE_NAMES[0]}`,
  ]);

  for (const run of [pixel, dimensions, missing]) assert.ok(run.canonicalUnchanged());
  assert.deepEqual(pixel.manifest.evidence.result, { status: "different", exitCode: EXIT.CONTRACT_FAILED, approved: false });
});

test("a failed or stale build never reaches Playwright", async () => {
  for (const scenario of [{ buildStatus: 1 }, { buildIdError: true }]) {
    const run = await runScenario(scenario);
    assert.equal(run.exitCode, EXIT.BUILD_FAILED);
    assert.equal(run.kinds.includes("playwright"), false);
    assert.equal(run.comparison, null);
    assert.equal(run.manifest.exitCode, EXIT.BUILD_FAILED);
  }
});

test("a failed Playwright run is not compared but still restores hygiene and verifies teardown", async () => {
  const run = await runScenario({ playwright: () => 1 });

  assert.equal(run.exitCode, EXIT.PLAYWRIGHT_FAILED);
  assert.deepEqual(run.kinds, ["node", "build", "build-id", "playwright", "restore", "node"]);
  assert.equal(run.comparison, null);
});

test("teardown leftovers and mutations of canonical baselines fail closed before comparison", async () => {
  const teardown = await runScenario({ teardownStatus: 1 });
  assert.equal(teardown.exitCode, EXIT.TEARDOWN_FAILED);
  assert.equal(teardown.comparison, null);

  const overwritten = await runScenario({
    playwright: (context) => {
      copyBaselines(context);
      writeFileSync(join(context.repoSnapshotDir, BASELINE_NAMES[0]), png(4, 3, 250));
      return 0;
    },
  });
  assert.equal(overwritten.exitCode, EXIT.CANONICAL_MUTATED);
  assert.equal(overwritten.comparison, null);

  const e2eTreeChanged = await runScenario({ statusAfter: `?? ${SNAPSHOT_DIR}/stray-chromium-linux.png\0` });
  assert.equal(e2eTreeChanged.exitCode, EXIT.CANONICAL_MUTATED);
});

test("busy ports, local baseline edits, unsafe evidence directories and non-Linux hosts stop before the build", async () => {
  const busy = await runScenario({ preflightStatus: 1 });
  assert.equal(busy.exitCode, EXIT.INFRASTRUCTURE);
  assert.deepEqual(busy.kinds, ["node"]);

  const dirty = await runScenario({ statusBefore: ` M ${SNAPSHOT_DIR}/${BASELINE_NAMES[0]}\0` });
  assert.equal(dirty.exitCode, EXIT.INFRASTRUCTURE);
  assert.deepEqual(dirty.kinds, []);

  const inside = await runScenario({ evidenceDir: ({ repoRoot }) => join(repoRoot, "evidence") });
  assert.equal(inside.exitCode, EXIT.INFRASTRUCTURE);
  assert.deepEqual(inside.kinds, []);
  assert.equal(existsSync(inside.evidenceDir), false, "nothing may be created inside the repository");

  for (const evidenceDir of [
    ({ caseRoot, repoRoot }: { caseRoot: string; repoRoot: string }) => {
      const target = join(repoRoot, "symlink-target");
      const outsideLooking = join(caseRoot, "outside-looking");
      mkdirSync(target, { recursive: true });
      symlinkSync(target, outsideLooking, process.platform === "win32" ? "junction" : "dir");
      return outsideLooking;
    },
    ({ caseRoot, repoRoot }: { caseRoot: string; repoRoot: string }) => {
      const target = join(repoRoot, "ancestor-symlink-target");
      const outsideLooking = join(caseRoot, "outside-looking-ancestor");
      mkdirSync(target, { recursive: true });
      symlinkSync(target, outsideLooking, process.platform === "win32" ? "junction" : "dir");
      return join(outsideLooking, "new", "evidence");
    },
  ]) {
    const symlinked = await runScenario({ evidenceDir });
    assert.equal(symlinked.exitCode, EXIT.INFRASTRUCTURE);
    assert.deepEqual(symlinked.kinds, []);
    assert.equal(existsSync(join(symlinked.repoRoot, "symlink-target", candidate.EVIDENCE_LAYOUT.baseline)), false);
    assert.equal(existsSync(join(symlinked.repoRoot, "ancestor-symlink-target", "new")), false);
    assert.ok(symlinked.canonicalUnchanged());
  }

  const reused = await runScenario({
    evidenceDir: ({ caseRoot }) => {
      const directory = join(caseRoot, "previous-run");
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "stale.png"), "stale");
      return directory;
    },
  });
  assert.equal(reused.exitCode, EXIT.INFRASTRUCTURE);
  assert.deepEqual(reused.kinds, []);
  assert.equal(readFileSync(join(reused.evidenceDir, "stale.png"), "utf8"), "stale");

  const windows = await runScenario({ platform: "win32" });
  assert.equal(windows.exitCode, EXIT.PLATFORM_INCOMPATIBLE);
  assert.deepEqual(windows.kinds, []);
  assert.equal(existsSync(windows.evidenceDir), false);

  for (const run of [busy, dirty, inside, reused, windows]) assert.ok(run.canonicalUnchanged());
});

// ---------------------------------------------------------------------------
// Playwright overlay config.
// ---------------------------------------------------------------------------

function loadCandidateConfig(overrides: Env) {
  const script = [
    `const { default: config } = await import(${JSON.stringify(pathToFileURL(CONFIG_PATH).href)});`,
    'const app = config.webServer.find((server) => server.url === "http://127.0.0.1:3000");',
    "console.log(JSON.stringify({",
    "  testDir: config.testDir, globalTeardown: config.globalTeardown, outputDir: config.outputDir,",
    "  reporter: config.reporter, snapshotPathTemplate: config.snapshotPathTemplate,",
    "  screenshotPathTemplate: config.expect.toHaveScreenshot.pathTemplate, updateSnapshots: config.updateSnapshots,",
    "  webServer: config.webServer.map((server) => ({ command: server.command, cwd: server.cwd, reuse: server.reuseExistingServer })),",
    "  appEnv: app.env, projects: config.projects.map((project) => project.name),",
    "}));",
  ].join("\n");

  const env: Record<string, string | undefined> = { ...process.env };
  for (const name of ["CI", "VETNEB_E2E_PRODUCTION_RUNNER", "E2E_REUSE_SERVER", candidate.CANDIDATE_DIR_ENV, candidate.PLAYWRIGHT_OUTPUT_DIR_ENV]) {
    delete env[name];
  }
  Object.assign(env, overrides);

  return spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], {
    cwd: REPO_ROOT,
    env,
    encoding: "utf8",
  });
}

test("the overlay config refuses to load outside the explicit production runner or with unsafe outputs", () => {
  const candidateDir = join(SUITE_ROOT, "config", "candidate");
  const playwrightDir = join(SUITE_ROOT, "config", "playwright");
  const outputs = { [candidate.CANDIDATE_DIR_ENV]: candidateDir, [candidate.PLAYWRIGHT_OUTPUT_DIR_ENV]: playwrightDir };

  const cases: Array<[Env, RegExp]> = [
    [outputs, /CI=true/],
    [{ ...outputs, VETNEB_E2E_PRODUCTION_RUNNER: "1" }, /CI=true/],
    [{ ...outputs, CI: "true" }, /VETNEB_E2E_PRODUCTION_RUNNER=1/],
    [{ CI: "true", VETNEB_E2E_PRODUCTION_RUNNER: "1", [candidate.PLAYWRIGHT_OUTPUT_DIR_ENV]: playwrightDir }, /VETNEB_E2E_VISUAL_CANDIDATE_DIR must be an absolute path/],
    [{ CI: "true", VETNEB_E2E_PRODUCTION_RUNNER: "1", ...outputs, [candidate.CANDIDATE_DIR_ENV]: resolve(FRONTEND_ROOT, "e2e") }, /outside the repository/],
    [{ CI: "true", VETNEB_E2E_PRODUCTION_RUNNER: "1", ...outputs, [candidate.PLAYWRIGHT_OUTPUT_DIR_ENV]: FRONTEND_ROOT }, /outside the repository/],
    [{ CI: "true", VETNEB_E2E_PRODUCTION_RUNNER: "1", ...outputs, [candidate.CANDIDATE_DIR_ENV]: "relative/candidate" }, /absolute path/],
  ];

  for (const [env, message] of cases) {
    const result = loadCandidateConfig(env);
    assert.notEqual(result.status, 0, `config must refuse ${JSON.stringify(Object.keys(env))}`);
    assert.match(result.stderr, message);
  }
});

test("the overlay config serves next start and redirects every capture and output outside the repository", () => {
  const candidateDir = join(SUITE_ROOT, "config", "candidate");
  const playwrightDir = join(SUITE_ROOT, "config", "playwright");
  const result = loadCandidateConfig({
    CI: "true",
    VETNEB_E2E_PRODUCTION_RUNNER: "1",
    E2E_REUSE_SERVER: "1",
    [candidate.CANDIDATE_DIR_ENV]: candidateDir,
    [candidate.PLAYWRIGHT_OUTPUT_DIR_ENV]: playwrightDir,
  });
  assert.equal(result.status, 0, result.stderr);

  const config = JSON.parse(result.stdout) as {
    testDir: string;
    globalTeardown: string;
    outputDir: string;
    reporter: Array<[string, { outputFolder?: string }?]>;
    snapshotPathTemplate: string;
    screenshotPathTemplate: string;
    updateSnapshots: string;
    webServer: Array<{ command: string; cwd: string; reuse: boolean }>;
    appEnv: Env;
    projects: string[];
  };
  const expectedTemplate = `${candidateDir.split(sep).join("/")}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{-snapshotSuffix}{ext}`;

  assert.equal(config.webServer.find((server) => server.command.startsWith("pnpm "))?.command, "pnpm start --hostname 127.0.0.1");
  assert.ok(config.webServer.every((server) => server.reuse === false && server.cwd === FRONTEND_ROOT));
  assert.equal(config.appEnv.VETNEB_E2E_ALLOW_LOCAL_API, "1");
  assert.equal(config.appEnv.VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS, "1");
  assert.equal(config.snapshotPathTemplate, expectedTemplate);
  assert.equal(config.screenshotPathTemplate, expectedTemplate);
  assert.equal(/\{(snapshotDir|testDir)\}/.test(config.snapshotPathTemplate), false);
  assert.equal(config.updateSnapshots, "all");
  assert.equal(config.testDir, resolve(FRONTEND_ROOT, "e2e"));
  assert.equal(config.globalTeardown, resolve(FRONTEND_ROOT, "e2e/helpers/restore-next-env-hygiene.mjs"));
  assert.equal(config.outputDir, join(playwrightDir, "test-results"));
  assert.equal(config.reporter.find((entry) => entry[0] === "html")?.[1]?.outputFolder, join(playwrightDir, "playwright-report"));
  assert.deepEqual(config.projects, ["chromium"]);
});

// ---------------------------------------------------------------------------
// Manual visual workflow.
// ---------------------------------------------------------------------------

test("visual-regression-manual keeps the dev route and adds an isolated, non-updating production-candidate route", () => {
  const source = readWorkflow(MANUAL_WORKFLOW);
  const document = parseWorkflow(source);
  const inputs = mapping(mapping(mapping(document.on, "on").workflow_dispatch, "workflow_dispatch").inputs, "inputs");
  const runner = mapping(inputs.runner, "inputs.runner");

  assert.equal(runner.type, "choice");
  assert.equal(runner.default, "dev");
  assert.deepEqual(runner.options, ["dev", "production-candidate"]);

  const steps = workflowSteps(document, "visual-regression");
  const names = steps.map((step) => String(step.name));

  const reject = stepNamed(steps, "Reject snapshot updates for the production candidate");
  assert.equal(names.indexOf(String(reject.name)), 0, "the update rejection must run before any checkout or install");
  assert.equal(reject.if, "${{ inputs.runner == 'production-candidate' && inputs.update_snapshots }}");
  assert.match(String(reject.run), /\n?exit 1\n?$/);

  const devRun = stepNamed(steps, "Run selected visual regression suite");
  assert.equal(devRun.if, "${{ inputs.runner == 'dev' }}");

  const candidateRun = stepNamed(steps, "Produce production visual candidate");
  const script = String(candidateRun.run);
  assert.equal(candidateRun.if, "${{ inputs.runner == 'production-candidate' }}");
  const job = mapping(mapping(document.jobs, "jobs")["visual-regression"], "jobs.visual-regression");
  const outerJobTimeoutMs = Number(job["timeout-minutes"]) * 60_000;
  const candidateTimeoutMs = Number(mapping(candidateRun.env, "candidate environment").E2E_GLOBAL_TIMEOUT_MS);
  const requiredHeadroomMs = 25 * 60_000;
  assert.equal(outerJobTimeoutMs, 45 * 60_000);
  assert.equal(candidateTimeoutMs, 20 * 60_000);
  assert.ok(
    outerJobTimeoutMs - candidateTimeoutMs >= requiredHeadroomMs,
    `candidate requires ${requiredHeadroomMs}ms headroom after its ${candidateTimeoutMs}ms Playwright limit`,
  );
  assert.ok(names.indexOf("Install Playwright Chromium") < names.indexOf(String(candidateRun.name)));
  assert.ok(script.startsWith("set -euo pipefail\n"));
  assert.ok(script.includes("corepack pnpm --dir frontend e2e:visual-production-candidate -- "));
  assert.ok(script.includes('--suite "${VISUAL_SUITE}"'));
  assert.ok(script.includes('--evidence-dir "${RUNNER_TEMP}/visual-production-candidate"'));
  for (const forbidden of ["--update-snapshots", "UPDATE_SNAPSHOTS", "playwright test", "pnpm dev", "e2e:full", "|| true"]) {
    assert.equal(script.includes(forbidden), false, `production candidate step must not contain ${forbidden}`);
  }

  const snapshotUpload = stepNamed(steps, "Upload snapshot PNGs");
  assert.ok(
    String(snapshotUpload.if).includes("inputs.runner == 'dev'"),
    "tracked snapshot PNGs must never be uploaded as production candidate evidence",
  );

  const evidenceUpload = stepNamed(steps, "Upload production visual candidate evidence");
  assert.equal(evidenceUpload.if, "${{ always() && inputs.upload_artifacts && inputs.runner == 'production-candidate' }}");
  assert.equal(mapping(evidenceUpload.with, "with").path, "${{ runner.temp }}/visual-production-candidate/");

  assert.equal(source.includes("continue-on-error"), false);
  const report = evaluateWorkflowSecurity({ rootDir: REPO_ROOT, workflowPaths: [MANUAL_WORKFLOW] });
  assert.equal(report.passed, true, JSON.stringify(report.failures, null, 2));
});
