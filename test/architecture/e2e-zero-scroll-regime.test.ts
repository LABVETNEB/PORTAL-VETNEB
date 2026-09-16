import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../../frontend/e2e/helpers/zero-scroll-contract.ts";

// ─────────────────────────────────────────────────────────────────────────────
// E2E-GLOBAL-10 · zero-scroll régime guard (LIMPIEZA E2E P2-2 / R-12).
//
// The audit found ONE invariant asserted at two thresholds: A08 froze the
// document scroll delta at exactly 0 px while the shell contracts allowed 1-2
// px, so a 1-2 px regression passed in one place and failed in the other.
//
// Convergence alone does not stay converged: the next spec to measure
// `documentElement.scrollHeight` can reintroduce a local `+ TOLERANCE` and
// nothing would notice. This guard is the fail-closed half — it scans every
// E2E source for a DOCUMENT scroll assertion carrying an allowance that is not
// the régime owner, and names the file and line.
//
// It deliberately does NOT police box geometry or internal containers; the
// owner module documents why those keep their own allowance.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(TEST_FILE), "..", "..");
const E2E_ROOT = resolve(REPO_ROOT, "frontend/e2e");
const OWNER_MODULE = "frontend/e2e/helpers/zero-scroll-contract.ts";
const OWNER_SYMBOL = "MAX_DOCUMENT_SCROLL_DELTA_PX";

// The walk is filesystem-based, not `git ls-files`, so an unstaged new spec is
// covered the moment it is written.
const EXCLUDED_DIRECTORIES = new Set(["node_modules", "test-results", "playwright-report"]);
const SOURCE_EXTENSIONS = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];

/**
 * A reading of `document.documentElement` or `document.body` — the two
 * elements `AGENTS.md` §10 names — however the spec happens to destructure it.
 * `main.dashboard-main` is intentionally absent: its metric is stored under
 * many different names and A08 already freezes it exactly.
 */
const DOCUMENT_METRIC =
  /(documentElement|\bhtml\.client(?:Height|Width)|\bbody\.client(?:Height|Width)|docClient[HW]|htmlClient(?:Height|Width)|bodyClient(?:Height|Width)|documentScroll[XY])/;
const ALLOWANCE = /\+\s*([A-Za-z_$][\w$]*)/;

type Violation = { readonly file: string; readonly line: number; readonly source: string };

function sourceFiles(): string[] {
  const files: string[] = [];

  function visit(directory: string): void {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      if (item.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(item.name)) visit(join(directory, item.name));
        continue;
      }
      if (!item.isFile()) continue;
      if (!SOURCE_EXTENSIONS.some((extension) => item.name.endsWith(extension))) continue;
      files.push(join(directory, item.name));
    }
  }

  visit(E2E_ROOT);
  return files.sort((a, b) => a.localeCompare(b));
}

/** Returns the violations instead of asserting, so mutations are provable. */
export function findDocumentAllowanceViolations(
  sources: ReadonlyMap<string, string>,
): Violation[] {
  const violations: Violation[] = [];

  for (const [file, source] of sources) {
    source.split("\n").forEach((line, index) => {
      if (!DOCUMENT_METRIC.test(line)) return;
      const allowance = line.match(ALLOWANCE);
      if (!allowance || allowance[1] === OWNER_SYMBOL) return;
      violations.push({ file, line: index + 1, source: line.trim() });
    });
  }

  return violations;
}

function readSources(): Map<string, string> {
  const sources = new Map<string, string>();
  for (const file of sourceFiles()) {
    sources.set(
      relative(REPO_ROOT, file).split(sep).join("/"),
      readFileSync(file, "utf8").replace(/\r\n/g, "\n"),
    );
  }
  return sources;
}

test("the document zero-scroll régime is exactly zero and has one owner", () => {
  assert.equal(
    MAX_DOCUMENT_SCROLL_DELTA_PX,
    0,
    "AGENTS.md §10 states SCROLL_VERTICAL/HORIZONTAL_DEL_DOCUMENTO = 0; the régime " +
      "must freeze zero, and a positive delta is a runtime defect to report rather " +
      "than a threshold to re-tune",
  );

  const owner = readFileSync(resolve(REPO_ROOT, OWNER_MODULE), "utf8");
  assert.match(
    owner,
    new RegExp(`export const ${OWNER_SYMBOL} = 0;`),
    "the régime owner must declare the threshold literally, not derive it",
  );
});

test("no E2E source asserts a document scroll metric against a non-régime allowance", () => {
  const violations = findDocumentAllowanceViolations(readSources());

  assert.deepEqual(
    violations,
    [],
    `document zero-scroll assertions must use ${OWNER_SYMBOL} (E2E-GLOBAL-10 / R-12):\n` +
      violations.map((v) => `  ${v.file}:${v.line}: ${v.source}`).join("\n"),
  );
});

test("every converged source imports the régime owner instead of restating zero", () => {
  const sources = readSources();
  const consumers = [...sources.entries()].filter(([, source]) => source.includes(OWNER_SYMBOL));

  assert.ok(consumers.length > 0, "the régime must have consumers");

  for (const [file, source] of consumers) {
    if (file === OWNER_MODULE) continue;
    assert.match(
      source,
      /import \{[^}]*MAX_DOCUMENT_SCROLL_DELTA_PX[^}]*\} from "[^"]*zero-scroll-contract";/,
      `${file} uses the régime symbol but does not import it from the owner`,
    );
    assert.equal(
      /const\s+MAX_DOCUMENT_SCROLL_DELTA_PX\s*=/.test(source),
      false,
      `${file} must not shadow the régime owner with a local declaration`,
    );
  }
});

test("the guard fails closed on a reintroduced local allowance", () => {
  const reintroduced = new Map([
    [
      "frontend/e2e/platform/app-shell/regression.spec.ts",
      "expect(m.htmlScrollHeight).toBeLessThanOrEqual(m.htmlClientHeight + TOLERANCE);",
    ],
  ]);
  const violations = findDocumentAllowanceViolations(reintroduced);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 1);
  assert.match(violations[0].file, /regression\.spec\.ts$/);

  const converged = new Map([
    [
      "frontend/e2e/platform/app-shell/regression.spec.ts",
      "expect(m.htmlScrollHeight).toBeLessThanOrEqual(m.htmlClientHeight + MAX_DOCUMENT_SCROLL_DELTA_PX);",
    ],
  ]);
  assert.deepEqual(findDocumentAllowanceViolations(converged), []);
});
