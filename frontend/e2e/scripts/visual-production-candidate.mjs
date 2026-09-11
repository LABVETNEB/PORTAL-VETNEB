#!/usr/bin/env node
// E2E-GLOBAL-05A — reproducible production visual candidate.
//
//   next build -> next start (selected by playwright.config.ts's own
//   CI=true + VETNEB_E2E_PRODUCTION_RUNNER=1 runner) -> Playwright captures into
//   an isolated candidate tree outside the repository -> teardown and canonical
//   integrity checks -> exact comparison (compare-visual-artifacts.mjs) against
//   a staged copy of the canonical Chromium Linux baselines.
//
// It never writes, replaces or approves a canonical snapshot. Promoting a
// candidate to baseline belongs to E2E-GLOBAL-05B and stays a reviewed step.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { restoreNextEnvHygiene } from "../helpers/restore-next-env-hygiene.mjs";
import { E2E_COHORT_SPECS } from "../suites/catalog.ts";
import { compareDirectories, formatHumanReport, sha256Hex, writeReports } from "./compare-visual-artifacts.mjs";
import { pnpmInvocation, validatePlatformCompatibility } from "./run-cohort.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
export const FRONTEND_ROOT = resolve(dirname(SCRIPT_PATH), "..", "..");
export const REPO_ROOT = resolve(FRONTEND_ROOT, "..");

export const SCHEMA_VERSION = 1;
export const VISUAL_SUITES = Object.freeze(["all", "public", "authenticated", "stress"]);
export const CANDIDATE_CONFIG = "e2e/scripts/visual-production-candidate.config.mjs";
export const CANDIDATE_DIR_ENV = "VETNEB_E2E_VISUAL_CANDIDATE_DIR";
export const PLAYWRIGHT_OUTPUT_DIR_ENV = "VETNEB_E2E_VISUAL_PLAYWRIGHT_DIR";
export const PRODUCTION_APPLICATION_COMMAND = "pnpm start --hostname 127.0.0.1";

// Same build-time values Frontend CI uses for the bundle its production runner
// serves (NEXT_PUBLIC_API_URL is inlined by next build).
export const PRODUCTION_BUILD_ENV = Object.freeze({
  NEXT_PUBLIC_API_URL: "http://127.0.0.1:3107",
  VETNEB_E2E_ALLOW_LOCAL_API: "1",
  VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS: "1",
});

// The only signal playwright.config.ts accepts to serve `next start`.
export const PRODUCTION_RUNNER_ENV = Object.freeze({
  CI: "true",
  VETNEB_E2E_PRODUCTION_RUNNER: "1",
});

// Exit codes (documented contract). 0/1/2 keep the comparator's meaning.
export const EXIT = Object.freeze({
  PASS: 0,
  CONTRACT_FAILED: 1,
  INFRASTRUCTURE: 2,
  BUILD_FAILED: 3,
  PLAYWRIGHT_FAILED: 4,
  PLATFORM_INCOMPATIBLE: 5,
  CANONICAL_MUTATED: 6,
  TEARDOWN_FAILED: 7,
});

export const EVIDENCE_LAYOUT = Object.freeze({
  baseline: "baseline-dev",
  candidate: "candidate-prod",
  comparison: "comparison",
  playwright: "playwright",
  manifest: "visual-production-candidate.json",
});

const CANONICAL_E2E_ROOT = "frontend/e2e";
const VERIFY_TEARDOWN = "e2e/helpers/verify-teardown.mjs";
const BUILD_ID_CLOCK_SKEW_MS = 2_000;

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

export class CandidateError extends Error {
  constructor(message, exitCode = EXIT.INFRASTRUCTURE) {
    super(message);
    this.name = "CandidateError";
    this.exitCode = exitCode;
  }
}

function toPosix(path) {
  return path.split(sep).join("/");
}

// ---------------------------------------------------------------------------
// Arguments. Nothing is forwarded to Playwright: snapshot updates, alternate
// configs and spec filters cannot be injected.
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const parsed = { suite: "all", evidenceDir: null, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    // pnpm forwards the `--` separator verbatim.
    if (token === "--") continue;
    if (token === "--help" || token === "-h") {
      parsed.help = true;
      continue;
    }

    const equalsIndex = token.startsWith("--") ? token.indexOf("=") : -1;
    const flag = equalsIndex === -1 ? token : token.slice(0, equalsIndex);
    if (flag !== "--suite" && flag !== "--evidence-dir") {
      throw new UsageError(`unknown argument: ${token} (no Playwright argument is forwarded)`);
    }

    let value;
    if (equalsIndex === -1) {
      index += 1;
      value = argv[index];
    } else {
      value = token.slice(equalsIndex + 1);
    }
    if (value === undefined || value === "" || value.startsWith("-")) {
      throw new UsageError(`flag ${flag} requires a value`);
    }

    if (flag === "--suite") parsed.suite = value;
    else parsed.evidenceDir = value;
  }

  if (parsed.help) return parsed;
  if (!VISUAL_SUITES.includes(parsed.suite)) {
    throw new UsageError(`--suite must be one of ${VISUAL_SUITES.join(", ")}, received: ${parsed.suite}`);
  }
  if (parsed.evidenceDir === null) throw new UsageError("--evidence-dir is required");
  return parsed;
}

export function selectSuiteSpecs(suite, visualSpecs = E2E_COHORT_SPECS["visual-linux"]) {
  if (visualSpecs.length === 0) throw new CandidateError("the catalog visual-linux cohort is empty");
  if (suite === "all") return [...visualSpecs];

  const matches = visualSpecs.filter((spec) => spec.endsWith(`/visual-regression-${suite}.spec.ts`));
  if (matches.length !== 1) {
    throw new CandidateError(
      `suite ${suite} must map to exactly one cataloged visual-linux spec, found ${matches.length}`,
    );
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Isolation: candidates and Playwright outputs never live inside the repository.
// ---------------------------------------------------------------------------

export function isInsideDirectory(parent, child) {
  const rel = relative(parent, child);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

export function assertOutsideRepository(path, repoRoot, label) {
  if (!path || !isAbsolute(path)) {
    throw new CandidateError(`${label} must be an absolute path, received: ${path || "(empty)"}`);
  }
  if (isInsideDirectory(repoRoot, path)) {
    throw new CandidateError(
      `${label} must live outside the repository so candidates never mix with tracked baselines: ${toPosix(path)}`,
    );
  }
  return path;
}

// Used by the Playwright overlay config; throws unless the production runner is
// explicitly selected and both output roots are isolated.
export function resolveCandidateEnvironment(env, repoRoot = REPO_ROOT) {
  for (const [name, value] of Object.entries(PRODUCTION_RUNNER_ENV)) {
    if (env[name] !== value) {
      throw new CandidateError(
        `the production visual candidate requires ${name}=${value} (playwright.config.ts production runner)`,
      );
    }
  }

  return {
    candidateDir: assertOutsideRepository(env[CANDIDATE_DIR_ENV], repoRoot, CANDIDATE_DIR_ENV),
    playwrightDir: assertOutsideRepository(env[PLAYWRIGHT_OUTPUT_DIR_ENV], repoRoot, PLAYWRIGHT_OUTPUT_DIR_ENV),
  };
}

// Playwright's default screenshot template with the candidate tree in place of
// {snapshotDir}, so candidate and staged baseline share relative paths.
export function buildCandidateSnapshotTemplate(candidateDir) {
  return `${toPosix(candidateDir)}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{-snapshotSuffix}{ext}`;
}

export function prepareEvidenceLayout(rawDir, { cwd, repoRoot }) {
  const root = assertOutsideRepository(resolve(cwd, rawDir), repoRoot, "--evidence-dir");

  if (existsSync(root)) {
    if (!statSync(root).isDirectory()) {
      throw new CandidateError(`--evidence-dir is not a directory: ${toPosix(root)}`);
    }
    if (readdirSync(root).length > 0) {
      throw new CandidateError(
        `--evidence-dir must be empty or absent; refusing to mix evidence from different runs: ${toPosix(root)}`,
      );
    }
  }

  const layout = {
    root,
    baselineDir: join(root, EVIDENCE_LAYOUT.baseline),
    candidateDir: join(root, EVIDENCE_LAYOUT.candidate),
    comparisonDir: join(root, EVIDENCE_LAYOUT.comparison),
    playwrightDir: join(root, EVIDENCE_LAYOUT.playwright),
  };
  for (const directory of [layout.baselineDir, layout.candidateDir, layout.comparisonDir, layout.playwrightDir]) {
    mkdirSync(directory, { recursive: true });
  }
  return layout;
}

// ---------------------------------------------------------------------------
// Canonical baselines: tracked inventory, integrity state and staging.
// ---------------------------------------------------------------------------

export function snapshotDirectory(spec) {
  return `frontend/${spec}-snapshots`;
}

export function listCanonicalBaselines(specs, deps) {
  const baselines = [];
  for (const spec of specs) {
    const tracked = deps
      .git(["ls-files", "-z", "--", `${snapshotDirectory(spec)}/`])
      .split("\0")
      .filter((path) => path.toLowerCase().endsWith(".png"));
    if (tracked.length === 0) {
      throw new CandidateError(`no tracked canonical baseline PNG for ${spec}`);
    }
    baselines.push(...tracked);
  }
  return baselines.sort();
}

function readRepositoryFile(deps, path) {
  try {
    return readFileSync(join(deps.repoRoot, ...path.split("/")));
  } catch (error) {
    throw new CandidateError(`unable to read canonical baseline ${path}: ${error.message}`);
  }
}

export function captureCanonicalState(baselines, deps) {
  return {
    status: deps.git(["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", CANONICAL_E2E_ROOT]),
    hashes: baselines.map((path) => ({ path, sha256: sha256Hex(readRepositoryFile(deps, path)) })),
  };
}

export function dirtySnapshotEntries(status, specs) {
  const directories = specs.map((spec) => `${snapshotDirectory(spec)}/`);
  return status
    .split("\0")
    .filter((entry) => directories.some((directory) => entry.includes(directory)));
}

function sameCanonicalState(before, after) {
  return before.status === after.status && JSON.stringify(before.hashes) === JSON.stringify(after.hashes);
}

function stageBaselines(state, layout, deps) {
  for (const { path, sha256 } of state.hashes) {
    const bytes = readRepositoryFile(deps, path);
    if (sha256Hex(bytes) !== sha256) {
      throw new CandidateError(`canonical baseline changed while staging: ${path}`);
    }
    const target = join(layout.baselineDir, ...path.slice(`${CANONICAL_E2E_ROOT}/`.length).split("/"));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
}

// next build rewrites .next/BUILD_ID on every run; an older marker means the
// build did not produce the bundle next start is about to serve.
export function readProductionBuildId(startedAtMs, frontendRoot = FRONTEND_ROOT) {
  const buildIdPath = join(frontendRoot, ".next", "BUILD_ID");
  if (!existsSync(buildIdPath)) {
    throw new CandidateError("next build did not produce .next/BUILD_ID", EXIT.BUILD_FAILED);
  }
  if (statSync(buildIdPath).mtimeMs < startedAtMs - BUILD_ID_CLOCK_SKEW_MS) {
    throw new CandidateError(".next/BUILD_ID predates this build; refusing a stale production bundle", EXIT.BUILD_FAILED);
  }
  const buildId = readFileSync(buildIdPath, "utf8").trim();
  if (!buildId) throw new CandidateError(".next/BUILD_ID is empty", EXIT.BUILD_FAILED);
  return buildId;
}

// ---------------------------------------------------------------------------
// Pipeline.
// ---------------------------------------------------------------------------

async function executePipeline(options, deps, record, onLayout) {
  const specs = selectSuiteSpecs(options.suite);
  record.specs = specs;

  const platform = validatePlatformCompatibility(specs, deps.platform);
  if (!platform.compatible) {
    throw new CandidateError(
      `suite ${options.suite} is versioned only for Chromium Linux; no comparable candidate can be produced on ${deps.platform}`,
      EXIT.PLATFORM_INCOMPATIBLE,
    );
  }

  const layout = prepareEvidenceLayout(options.evidenceDir, deps);
  onLayout(layout);
  record.headCommit = deps.git(["rev-parse", "HEAD"]).trim();

  const baselines = listCanonicalBaselines(specs, deps);
  const before = captureCanonicalState(baselines, deps);
  const dirty = dirtySnapshotEntries(before.status, specs);
  if (dirty.length > 0) {
    throw new CandidateError(`canonical baselines differ from HEAD; refusing to compare against them: ${dirty.join(", ")}`);
  }
  stageBaselines(before, layout, deps);
  record.canonicalBaselines = before.hashes;

  deps.log("[visual-candidate] verifying E2E ports are free");
  if (deps.runNode([VERIFY_TEARDOWN]) !== 0) {
    throw new CandidateError("E2E ports 3000/3107 are already in use; the candidate never reuses a foreign server");
  }

  deps.log("[visual-candidate] next build");
  const buildStartedAt = deps.now();
  if (deps.runPnpm(["run", "build"], PRODUCTION_BUILD_ENV) !== 0) {
    throw new CandidateError("next build failed", EXIT.BUILD_FAILED);
  }
  try {
    record.build = { buildId: deps.readBuildId(buildStartedAt) };
  } catch (error) {
    throw new CandidateError(error instanceof Error ? error.message : String(error), EXIT.BUILD_FAILED);
  }

  record.runner = {
    ...PRODUCTION_RUNNER_ENV,
    applicationServerCommand: PRODUCTION_APPLICATION_COMMAND,
    config: CANDIDATE_CONFIG,
  };
  deps.log("[visual-candidate] Playwright under next start");
  let playwrightStatus;
  try {
    playwrightStatus = deps.runPnpm(
      ["exec", "playwright", "test", ...specs, "--config", CANDIDATE_CONFIG, "--project=chromium"],
      {
        ...PRODUCTION_RUNNER_ENV,
        [CANDIDATE_DIR_ENV]: layout.candidateDir,
        [PLAYWRIGHT_OUTPUT_DIR_ENV]: layout.playwrightDir,
      },
    );
  } finally {
    await deps.restoreNextEnv();
  }

  const teardownStatus = deps.runNode([VERIFY_TEARDOWN]);
  record.stages = { playwrightExit: playwrightStatus, teardownExit: teardownStatus };

  const after = captureCanonicalState(baselines, deps);
  if (!sameCanonicalState(before, after)) {
    throw new CandidateError(
      "frontend/e2e or a canonical baseline changed during the candidate run",
      EXIT.CANONICAL_MUTATED,
    );
  }
  if (teardownStatus !== 0) {
    throw new CandidateError("E2E servers were still listening after Playwright exited", EXIT.TEARDOWN_FAILED);
  }
  if (playwrightStatus !== 0) {
    throw new CandidateError(
      `Playwright exited with ${playwrightStatus}; the candidate is incomplete and was not compared`,
      EXIT.PLAYWRIGHT_FAILED,
    );
  }

  const comparison = compareDirectories(layout.baselineDir, layout.candidateDir, {
    requireCount: baselines.length,
  });
  writeReports(comparison, layout.comparisonDir);
  deps.log(formatHumanReport(comparison));
  record.comparison = comparison.summary;
  return comparison.summary.passed ? EXIT.PASS : EXIT.CONTRACT_FAILED;
}

export async function runProductionCandidate(options, deps = createDefaultDeps()) {
  const record = {
    schemaVersion: SCHEMA_VERSION,
    task: "E2E-GLOBAL-05A",
    suite: options.suite,
    promotion: "not performed; replacing canonical baselines belongs to E2E-GLOBAL-05B",
  };
  let layout = null;

  try {
    record.exitCode = await executePipeline(options, deps, record, (created) => {
      layout = created;
    });
  } catch (error) {
    record.exitCode = error instanceof CandidateError ? error.exitCode : EXIT.INFRASTRUCTURE;
    record.error = error instanceof Error ? error.message : String(error);
    deps.error(`[visual-candidate] ${record.error}`);
  }

  if (layout) {
    writeFileSync(join(layout.root, EVIDENCE_LAYOUT.manifest), `${JSON.stringify(record, null, 2)}\n`);
  }
  deps.log(`[visual-candidate] exit code ${record.exitCode}`);
  return record.exitCode;
}

function spawnStatus(executable, args, envOverrides) {
  const result = spawnSync(executable, args, {
    cwd: FRONTEND_ROOT,
    env: { ...process.env, ...envOverrides },
    stdio: "inherit",
    shell: false,
  });
  if (result.error) {
    console.error(`[visual-candidate] failed to spawn ${executable}: ${result.error.message}`);
    return 1;
  }
  if (result.signal) {
    console.error(`[visual-candidate] ${executable} exited by signal ${result.signal}`);
    return 1;
  }
  return result.status ?? 1;
}

export function createDefaultDeps() {
  const pnpm = pnpmInvocation();
  return {
    platform: process.platform,
    cwd: process.cwd(),
    repoRoot: REPO_ROOT,
    now: () => Date.now(),
    git: (args) =>
      execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }),
    runPnpm: (args, env) => spawnStatus(pnpm.executable, [...pnpm.prefixArgs, ...args], env),
    runNode: (args) => spawnStatus(process.execPath, args, {}),
    readBuildId: (startedAtMs) => readProductionBuildId(startedAtMs),
    restoreNextEnv: () => restoreNextEnvHygiene(),
    log: (text) => console.log(text),
    error: (text) => console.error(text),
  };
}

export function helpText() {
  return [
    "visual-production-candidate — production visual candidate vs canonical baselines (E2E-GLOBAL-05A)",
    "",
    "Usage:",
    "  node e2e/scripts/visual-production-candidate.mjs --evidence-dir <dir> [--suite all|public|authenticated|stress]",
    "",
    "Runs next build, serves it with next start through playwright.config.ts's production runner",
    "(CI=true, VETNEB_E2E_PRODUCTION_RUNNER=1), captures the selected Chromium Linux visual suite into",
    "<dir>/candidate-prod and compares it exactly against <dir>/baseline-dev, a staged copy of the tracked",
    "baselines. <dir> must be outside the repository and empty or absent. Canonical baselines are never",
    "written; no Playwright argument is forwarded.",
    "",
    "Evidence: baseline-dev/, candidate-prod/, comparison/visual-artifact-comparison.{json,csv},",
    "playwright/ (report and test results), visual-production-candidate.json (run manifest).",
    "",
    "Exit codes:",
    "  0 candidate identical to the canonical baselines    4 Playwright failed (not compared)",
    "  1 comparison completed with differences             5 platform is not Linux",
    "  2 usage or infrastructure error                     6 canonical baseline or frontend/e2e mutated",
    "  3 next build failed or produced no fresh bundle     7 E2E servers still listening after the run",
  ].join("\n");
}

export async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`Usage error: ${error.message}`);
    console.error(helpText());
    return EXIT.INFRASTRUCTURE;
  }

  if (options.help) {
    console.log(helpText());
    return EXIT.PASS;
  }
  return runProductionCandidate(options);
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  process.exitCode = await main(process.argv.slice(2));
}
