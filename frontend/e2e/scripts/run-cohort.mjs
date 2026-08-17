#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { restoreNextEnvHygiene } from "../helpers/restore-next-env-hygiene.mjs";
import {
  CURRENT_COHORTS,
  E2E_COHORT_SPECS,
  E2E_CURRENT_COHORT_SPECS,
  E2E_SUITE_CATALOG,
  EXECUTION_COHORTS,
} from "../suites/catalog.ts";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const FRONTEND_ROOT = resolve(dirname(SCRIPT_PATH), "..", "..");
const REPO_ROOT = resolve(FRONTEND_ROOT, "..");
const VALID_COHORTS = [...CURRENT_COHORTS, ...EXECUTION_COHORTS];
const SHARED_FRONTEND_PATHS = new Set([
  "frontend/package.json",
  "frontend/playwright.config.ts",
  "frontend/e2e/scripts/run-cohort.mjs",
  "frontend/e2e/suites/catalog.ts",
]);
const SHARED_E2E_PREFIXES = [
  "frontend/e2e/helpers/",
  "frontend/e2e/fixtures/",
  "frontend/e2e/scripts/",
  "frontend/e2e/suites/",
];

function normalizePath(path) {
  return path.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function git(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function gitLines(args) {
  return git(args).split(/\r?\n/).map(normalizePath).filter(Boolean);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function catalogPathFromRepoPath(path) {
  if (!path.startsWith("frontend/e2e/") || !path.endsWith(".spec.ts")) return null;
  return path.slice("frontend/".length);
}

function collectChangedPaths() {
  const base = process.env.E2E_AFFECTED_BASE;
  const changed = [
    ...gitLines(["diff", "--name-only"]),
    ...gitLines(["diff", "--cached", "--name-only"]),
    ...gitLines(["ls-files", "--others", "--exclude-standard"]),
  ];

  if (base) {
    changed.push(...gitLines(["diff", "--name-only", `${base}...HEAD`]));
  }

  return uniqueSorted(changed);
}

export function classifyAffectedPaths(changedPaths) {
  const catalogPaths = new Set(E2E_SUITE_CATALOG.map((entry) => entry.path));
  const selectedSpecs = new Set();
  const reasons = [];

  for (const path of changedPaths) {
    const catalogPath = catalogPathFromRepoPath(path);
    if (catalogPath) {
      if (!catalogPaths.has(catalogPath)) {
        return {
          specs: E2E_COHORT_SPECS.ci,
          fallback: true,
          reason: `frontend spec not cataloged: ${path}`,
          changedPaths,
        };
      }
      selectedSpecs.add(catalogPath);
      reasons.push(`direct spec change: ${path}`);
      continue;
    }

    if (SHARED_FRONTEND_PATHS.has(path) || SHARED_E2E_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return {
        specs: E2E_COHORT_SPECS.ci,
        fallback: true,
        reason: `shared E2E infrastructure changed: ${path}`,
        changedPaths,
      };
    }

    if (path.startsWith("frontend/src/")) {
      return {
        specs: E2E_COHORT_SPECS.ci,
        fallback: true,
        reason: `frontend source changed without an approved ownership map: ${path}`,
        changedPaths,
      };
    }

    if (path.startsWith("frontend/")) {
      return {
        specs: E2E_COHORT_SPECS.ci,
        fallback: true,
        reason: `unknown frontend path changed: ${path}`,
        changedPaths,
      };
    }
  }

  return {
    specs: uniqueSorted([...selectedSpecs]),
    fallback: false,
    reason: reasons.join("; "),
    changedPaths,
  };
}

function resolveAffectedSelection() {
  return classifyAffectedPaths(collectChangedPaths());
}

export function validatePlatformCompatibility(selectedSpecs, platform) {
  const linuxOnlySpecs = new Set(
    E2E_SUITE_CATALOG.filter((entry) => entry.platform === "linux").map((entry) => entry.path),
  );
  const linuxSelected = selectedSpecs.filter((spec) => linuxOnlySpecs.has(spec));
  const incompatibleSpecs = platform === "linux" ? [] : linuxSelected;
  return {
    compatible: incompatibleSpecs.length === 0,
    platform,
    incompatibleSpecs,
  };
}

export function selectCohortSpecs(cohort) {
  if (cohort === "affected") return resolveAffectedSelection();
  if (!VALID_COHORTS.includes(cohort)) return null;
  const specs = cohort in E2E_CURRENT_COHORT_SPECS ? E2E_CURRENT_COHORT_SPECS[cohort] : E2E_COHORT_SPECS[cohort];
  return {
    specs,
    fallback: false,
    reason: "",
    changedPaths: [],
  };
}

function printSelection(cohort, selection) {
  console.log(`[e2e] cohort: ${cohort}`);
  console.log(`[e2e] specs: ${selection.specs.length}`);
  console.log(`[e2e] fallback conservative: ${selection.fallback ? "yes" : "no"}`);
  if (selection.reason) console.log(`[e2e] reason: ${selection.reason}`);
  if (selection.changedPaths.length > 0) {
    console.log("[e2e] changed paths:");
    for (const path of selection.changedPaths) console.log(`  ${path}`);
  }
  console.log("[e2e] selected specs:");
  for (const spec of selection.specs) console.log(`  ${spec}`);
}

function pnpmInvocation() {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && npmExecPath.toLowerCase().includes("pnpm")) {
    return {
      executable: process.execPath,
      prefixArgs: [npmExecPath],
      label: npmExecPath,
    };
  }

  if (process.platform === "win32") {
    return {
      executable: "cmd.exe",
      prefixArgs: ["/d", "/s", "/c", "pnpm.cmd"],
      label: "pnpm.cmd",
    };
  }

  return {
    executable: "pnpm",
    prefixArgs: [],
    label: "pnpm",
  };
}

function runPlaywright(selection, extraArgs) {
  const pnpm = pnpmInvocation();
  const args = [...pnpm.prefixArgs, "exec", "playwright", "test", ...selection.specs, ...extraArgs];
  const result = spawnSync(pnpm.executable, args, {
    cwd: FRONTEND_ROOT,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(`[e2e] failed to spawn ${pnpm.label}: ${result.error.message}`);
    return 1;
  }

  if (result.signal) {
    console.error(`[e2e] playwright exited by signal ${result.signal}`);
    return 1;
  }

  return result.status ?? 1;
}

async function main() {
  const separatorIndex = process.argv.indexOf("--", 2);
  const args = separatorIndex >= 0 ? process.argv.slice(2, separatorIndex) : process.argv.slice(2, 3);
  const extraArgs = separatorIndex >= 0 ? process.argv.slice(separatorIndex + 1) : process.argv.slice(3);
  const cohort = args[0];

  if (!cohort || args.length !== 1) {
    console.error("Usage: node e2e/scripts/run-cohort.mjs <cohort> [-- <playwright args>]");
    console.error(`Valid cohorts: ${VALID_COHORTS.join(", ")}`);
    return 2;
  }

  const selection = selectCohortSpecs(cohort);
  if (!selection) {
    console.error(`[e2e] unknown cohort: ${cohort}`);
    console.error(`Valid cohorts: ${VALID_COHORTS.join(", ")}`);
    return 2;
  }

  if (selection.specs.length === 0) {
    console.error(`[e2e] cohort ${cohort} selected zero specs.`);
    if (cohort === "affected") {
      console.error("[e2e] affected is local-only and fail-closed; run ci explicitly when no safe selection exists.");
    }
    return 3;
  }

  const compatibility = validatePlatformCompatibility(selection.specs, process.platform);
  if (!compatibility.compatible) {
    console.error(
      `[e2e] cohort ${cohort} includes Linux-only visual specs and cannot run on ${process.platform}.`,
    );
    console.error(
      "[e2e] pixel baselines are versioned for Chromium on Linux; run this cohort on Linux (see .github/workflows/visual-regression-manual.yml).",
    );
    console.error("[e2e] incompatible specs:");
    for (const spec of compatibility.incompatibleSpecs) console.error(`  ${spec}`);
    return 5;
  }

  for (const spec of selection.specs) {
    const specPath = resolve(FRONTEND_ROOT, spec);
    if (!existsSync(specPath)) {
      console.error(`[e2e] cataloged spec does not exist: ${spec}`);
      return 4;
    }
  }

  printSelection(cohort, selection);
  try {
    return runPlaywright(selection, extraArgs);
  } finally {
    // Playwright's own globalTeardown is billed against its globalTimeout: a
    // run that exhausts the budget reports "Timed out waiting for the teardown"
    // and never restores frontend/next-env.d.ts, which the dev server rewrote
    // to the dev route types. The repository source-hygiene gate then fails on
    // a file no commit touched. This restore runs after the Playwright process
    // has exited, so it survives a timeout, a crash and a non-zero exit alike.
    await restoreNextEnvHygiene();
  }
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  process.exitCode = await main();
}
