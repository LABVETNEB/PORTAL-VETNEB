import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { readDashboardCssSource } from "../helpers/read-dashboard-css-source.ts";

const REPO_ROOT = process.cwd();
const SURFACES_CSS = "frontend/src/styles/dashboard/surfaces.css";
const CARD = "frontend/src/components/ui/card.tsx";
const RUNTIME_SPEC = "frontend/e2e/regression/dashboard-b12-module-card-removal.spec.ts";
const CATALOG = "frontend/e2e/suites/catalog.ts";
const SOURCE_ROOT = "frontend/src";
const OWNER_ATTRIBUTE = 'data-dashboard-b12-module-card="true"';
const EXPECTED_OWNER_PATHS = [
  "frontend/src/app/dashboard/admin/AdminReportsCard.tsx",
  "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx",
  "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx",
  "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx",
  "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx",
  "frontend/src/app/dashboard/admin/AdminAuditCard.tsx",
] as const;
const OWNER = `.dashboard-app-shell
  [data-dashboard-module-workspace]
  [data-dashboard-b12-module-card="true"]`;
const INTERNAL_ESCAPE = ["data-dashboard-b12", "internal-surface"].join("-");
const NEGATIVE_OWNER = [":not([", INTERNAL_ESCAPE].join("");

function read(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), "utf8").replace(/\r\n/g, "\n");
}

function rule(source: string, selector: string): string {
  const start = source.indexOf(selector);
  assert.ok(start >= 0, `missing B12 owner ${selector}`);
  const end = source.indexOf("}", start);
  assert.ok(end >= 0, "B12 owner rule must close");
  return source.slice(start, end + 1);
}

function b12OwnerRule(): string {
  assert.ok(existsSync(resolve(REPO_ROOT, SURFACES_CSS)));
  const css = read(SURFACES_CSS);
  return rule(css, OWNER);
}

function sourceFiles(path = SOURCE_ROOT): string[] {
  const absolutePath = resolve(REPO_ROOT, path);
  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const child = `${path}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(child) : [child];
  });
}

function occurrenceCount(source: string, value: string): number {
  return source.split(value).length - 1;
}

test("B12 · source census is exactly the six explicit owners", () => {
  const markedPaths = sourceFiles().filter(
    (path) => path.endsWith(".tsx") && read(path).includes(OWNER_ATTRIBUTE),
  );
  assert.deepEqual(markedPaths.sort(), [...EXPECTED_OWNER_PATHS].sort());
  assert.equal(markedPaths.length, 6);
  assert.equal(
    markedPaths.reduce((count, path) => count + occurrenceCount(read(path), OWNER_ATTRIBUTE), 0),
    6,
  );
});

test("B12 · every expected owner has exactly one marker", () => {
  for (const path of EXPECTED_OWNER_PATHS) {
    assert.equal(occurrenceCount(read(path), OWNER_ATTRIBUTE), 1, `${path} must have one B12 owner`);
  }
});

test("B12 · no internal escape survives in source or B12 artifacts", () => {
  for (const path of [...sourceFiles(), SURFACES_CSS, RUNTIME_SPEC, CATALOG]) {
    assert.equal(read(path).includes(INTERNAL_ESCAPE), false, `${path} must not use an internal escape`);
  }
});

test("B12 · the canonical owner is positive and scoped to the workspace", () => {
  const ownerRule = b12OwnerRule();
  assert.ok(ownerRule.includes("[data-dashboard-module-workspace]"));
  assert.ok(ownerRule.includes(OWNER_ATTRIBUTE));
  assert.equal(ownerRule.includes(".dashboard-surface"), false);
  assert.equal(ownerRule.includes(NEGATIVE_OWNER), false);
});

test("B12 · the module card background is transparent", () => {
  const ownerRule = b12OwnerRule();
  assert.ok(ownerRule.includes("background: transparent;"));
  assert.equal(ownerRule.includes("background-color:"), false);
});

test("B12 · the module card border paint is transparent", () => {
  assert.ok(b12OwnerRule().includes("border-color: transparent;"));
});

test("B12 · the module card has no radius or elevation", () => {
  const ownerRule = b12OwnerRule();
  assert.ok(ownerRule.includes("border-radius: 0;"));
  assert.ok(ownerRule.includes("box-shadow: none;"));
});

test("B12 · the one-pixel box geometry stays intact", () => {
  const ownerRule = b12OwnerRule();
  assert.equal(/border-width\s*:\s*0/.test(ownerRule), false);
  assert.equal(ownerRule.includes("!important"), false);
});

test("B12 · only the intermediate module card is neutralized", () => {
  const css = readDashboardCssSource();
  assert.equal(css.includes(NEGATIVE_OWNER), false);
  assert.ok(read(CARD).includes('"rounded-lg border bg-card text-card-foreground shadow-sm"'));
});

test("B12 · the later roadmap phases remain out of scope", () => {
  const spec = read(RUNTIME_SPEC);
  for (const phase of ["B13", "B14", "B15", "B16"]) {
    assert.ok(spec.includes(phase), `${phase} must remain explicitly out of scope`);
  }
});

test("B12 · the runtime contract is catalogued without escapes", () => {
  for (const path of [RUNTIME_SPEC, CATALOG]) {
    assert.ok(existsSync(resolve(REPO_ROOT, path)), `${path} must exist`);
  }
  const spec = read(RUNTIME_SPEC);
  const catalog = read(CATALOG);
  for (const escape of ["test.skip", "test.fixme", "test.fail", ".slow()"] as const) {
    assert.equal(spec.includes(escape), false, `B12 must not use ${escape}`);
  }
  assert.ok(
    catalog.includes(
      'entry("e2e/regression/dashboard-b12-module-card-removal.spec.ts", "regression", "dashboard", "module card removal", ["visual-contract"], ci',
    ),
  );
});
