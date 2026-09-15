import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// ─────────────────────────────────────────────────────────────────────────────
// E2E-GLOBAL-08 (LIMPIEZA E2E P2-6) — residual determinism.
//
// E2E synchronisation waits for an observable state (a URL, a locator, a
// request's terminal event, a drained adaptive render, committed frames), never
// for elapsed time. This guard keeps the three time-based idioms GLOBAL-08
// removed from coming back anywhere under frontend/e2e:
// - `waitForTimeout(...)`;
// - a timer used as a sleep (`setTimeout(resolve, N)` and equivalents);
// - a silenced wait (`.catch(() => {})` / `.catch(() => undefined)`), which
//   turns a readiness condition the test needs into a silent pass.
//
// Deliberate exceptions, each pinned to its exact occurrence count so it cannot
// grow (or be removed) silently:
// - the canonical measurement helpers keep the inter-sample interval of their
//   three-identical-reads stability loop; readiness is owned by their callers,
//   and changing the sampling window changes the measurement itself, which is
//   E2E-GLOBAL-09 (evidence of measurement equivalence);
// - the Linux-only visual regression specs keep their best-effort idle and
//   image-load caps; they only run on Linux Chromium, so their readiness can
//   only change together with a Linux baseline run.
//
// The walk is filesystem-based, not `git ls-files`, so an unstaged new spec is
// caught before it is ever committed.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(TEST_FILE), "..", "..");

const E2E_ROOT = "frontend/e2e";
const GEOMETRY_MATRIX = "frontend/e2e/helpers/dashboard-geometry-matrix.ts";
const PARITY_MATRIX = "frontend/e2e/helpers/mobile-parity-matrix.ts";
const VISUAL_AUTHENTICATED = "frontend/e2e/regression/visual/visual-regression-authenticated.spec.ts";
const VISUAL_PUBLIC = "frontend/e2e/regression/visual/visual-regression-public.spec.ts";
const VISUAL_STRESS = "frontend/e2e/regression/visual/visual-regression-stress.spec.ts";

const EXCLUDED_DIRECTORIES = new Set(["node_modules", "test-results", "playwright-report"]);
const SOURCE_EXTENSIONS = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];

type Rule = {
  readonly id: string;
  readonly pattern: RegExp;
  /** Exact occurrence count per allowed path; every other path must have 0. */
  readonly allowed: Readonly<Record<string, number>>;
};

const RULES: readonly Rule[] = [
  {
    id: "wait-for-timeout",
    pattern: /\bwaitForTimeout\s*\(/g,
    allowed: { [GEOMETRY_MATRIX]: 1, [PARITY_MATRIX]: 1 },
  },
  {
    // A timer whose callback is a bare reference (`resolve`, `r`, `done`): the
    // shape of a sleep. `window.`, `globalThis.` and `self.` are the same
    // global timer under different qualifiers and are all covered explicitly;
    // any OTHER dotted prefix (`socket.setTimeout(...)`) is an instance method,
    // excluded by the leading negative lookbehind. Timers with an inline
    // callback are not sleeps and are not matched either way.
    id: "timer-sleep",
    pattern: /(?<![\w$.])(?:window\.|globalThis\.|self\.)?setTimeout\s*\(\s*[A-Za-z_$][\w$]*\s*,/g,
    allowed: { [VISUAL_AUTHENTICATED]: 1, [VISUAL_PUBLIC]: 1, [VISUAL_STRESS]: 1 },
  },
  {
    id: "silenced-wait",
    pattern: /\.catch\(\s*\(\s*\w*\s*\)\s*=>\s*(?:\{\s*\}|undefined|null|void 0)\s*\)/g,
    allowed: { [VISUAL_AUTHENTICATED]: 1, [VISUAL_STRESS]: 1 },
  },
];

function toRepoPath(absolutePath: string): string {
  return relative(REPO_ROOT, absolutePath).split(sep).join("/");
}

function listE2eSources(): Map<string, string> {
  const sources = new Map<string, string>();

  function visit(directory: string): void {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, item.name);
      if (item.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(item.name)) visit(absolutePath);
        continue;
      }
      if (!item.isFile() || !SOURCE_EXTENSIONS.some((ext) => item.name.endsWith(ext))) continue;
      sources.set(toRepoPath(absolutePath), readFileSync(absolutePath, "utf8"));
    }
  }

  visit(resolve(REPO_ROOT, E2E_ROOT));
  return new Map([...sources].sort(([a], [b]) => a.localeCompare(b)));
}

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(new RegExp(pattern.source, pattern.flags))].length;
}

/** Every `rule path: found N, allowed M` breach, in deterministic order. */
function findViolations(sources: ReadonlyMap<string, string>): string[] {
  const violations: string[] = [];

  for (const rule of RULES) {
    for (const [path, source] of sources) {
      const found = countMatches(source, rule.pattern);
      const allowed = rule.allowed[path] ?? 0;
      if (found !== allowed) {
        violations.push(`${rule.id} ${path}: found ${found}, allowed ${allowed}`);
      }
    }
    for (const path of Object.keys(rule.allowed)) {
      if (!sources.has(path)) violations.push(`${rule.id} ${path}: allowlisted path is missing`);
    }
  }

  return violations;
}

test("E2E synchronisation never waits for elapsed time or silences a wait", () => {
  assert.deepEqual(
    findViolations(listE2eSources()),
    [],
    "wait for an observable state (URL, locator, request terminal event, " +
      "waitForAdaptiveConvergence, committed frames) instead of waitForTimeout, a timer sleep " +
      "or a .catch() that swallows a readiness failure",
  );
});

test("the guard rejects each regression it exists to prevent, in memory", () => {
  const baseline = listE2eSources();
  const probePath = "frontend/e2e/platform/app-shell/e2e-global-08-probe.spec.ts";
  const regressions: ReadonlyArray<readonly [string, string]> = [
    ["wait-for-timeout", "await page.waitForTimeout(250);"],
    ["timer-sleep", "await new Promise((resolve) => setTimeout(resolve, 700));"],
    ["timer-sleep", "await page.evaluate(() => new Promise((r) => window.setTimeout(r, 100)));"],
    ["timer-sleep", "await page.evaluate(() => new Promise((r) => globalThis.setTimeout(r, 100)));"],
    ["timer-sleep", "await page.evaluate(() => new Promise((done) => self.setTimeout(done, 100)));"],
    ["silenced-wait", 'await page.waitForLoadState("networkidle").catch(() => {});'],
    ["silenced-wait", "await page.evaluate(() => document.fonts.ready).catch(() => undefined);"],
  ];

  for (const [ruleId, line] of regressions) {
    const mutated = new Map(baseline);
    mutated.set(probePath, `import { test } from "@playwright/test";\n${line}\n`);
    assert.deepEqual(
      findViolations(mutated).filter((violation) => violation.includes(probePath)),
      [`${ruleId} ${probePath}: found 1, allowed 0`],
      `${ruleId} must reject: ${line}`,
    );
  }

  const notSleeps = new Map(baseline);
  notSleeps.set(
    probePath,
    [
      'import { test } from "@playwright/test";',
      "socket.setTimeout(CONNECT_TIMEOUT_MS, () => finish(false));",
      "const timer = setTimeout(() => reject(new Error('idle')), IDLE_TIMEOUT_MS);",
      "",
    ].join("\n"),
  );
  assert.deepEqual(
    findViolations(notSleeps).filter((violation) => violation.includes(probePath)),
    [],
    "a socket timeout and a failure deadline are not sleeps",
  );

  const grownException = new Map(baseline);
  grownException.set(GEOMETRY_MATRIX, `${baseline.get(GEOMETRY_MATRIX)}\nawait page.waitForTimeout(80);\n`);
  assert.deepEqual(
    findViolations(grownException).filter((violation) => violation.includes(GEOMETRY_MATRIX)),
    [`wait-for-timeout ${GEOMETRY_MATRIX}: found 2, allowed 1`],
    "an allowlisted helper cannot grow its exception silently",
  );
});
