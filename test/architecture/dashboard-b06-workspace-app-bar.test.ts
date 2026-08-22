import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// B06 · WorkspaceAppBar static contract.
//
// Owns the STRUCTURE of the app-bar band: where it lives, what it may import,
// what it renders, and where its geometry is declared. The runtime band itself
// is frozen by `frontend/e2e/regression/dashboard-b06-workspace-app-bar.spec.ts`
// over the canonical 21 × 13 matrix; this file guarantees the source that spec
// measures cannot drift silently.
//
// The single most expensive invariant here is the A03 one: the app bar is the
// first region of the shell height ledger, so the band MUST be expressed as
// min/max block-size and never as a pinned height. A pinned 56px moves `main`
// on every viewport and re-pages the 15 adaptive consumers A03 froze — that is
// the exact regression (`admin-clinics @1280x720`: 10 → 9) this contract exists
// to make unrepeatable.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = process.cwd();

const APP_BAR_TSX = "frontend/src/components/dashboard/WorkspaceAppBar.tsx";
const TOPBAR_TSX = "frontend/src/components/dashboard/DashboardTopbar.tsx";
const SHELL_BARREL = "frontend/src/features/dashboard/presentation/shell/index.ts";
const MODULE_CATALOG = "frontend/src/features/dashboard/config/dashboardModules.ts";
const TOKENS_CSS = "frontend/src/styles/dashboard/tokens.css";
const LAYOUT_CSS = "frontend/src/styles/dashboard/layout.css";
const RUNTIME_SPEC = "frontend/e2e/regression/dashboard-b06-workspace-app-bar.spec.ts";
const FRONTEND_SRC = "frontend/src";

const DASHBOARD_CSS_FILES = [
  "index.css",
  "interactions.css",
  "layout.css",
  "mobile-admin.css",
  "mobile-clinic.css",
  "navigation.css",
  "responsive.css",
  "shell.css",
  "surfaces.css",
  "tables.css",
  "tokens.css",
  "zero-scroll.css",
].map((name) => `frontend/src/styles/dashboard/${name}`);

const B06_CSS_START = "/* dashboard-b06-workspace-app-bar:start */";
const B06_CSS_END = "/* dashboard-b06-workspace-app-bar:end */";
const TOKEN_BLOCK_START = "/* dashboard-app-bar-geometry:start";
const TOKEN_BLOCK_END = "dashboard-app-bar-geometry:end */";

/** Layers the app bar must never reach, directly or transitively. */
const FORBIDDEN_PRESENTATION_IMPORTS = ["@/lib/api", "@/app/", "@/app"] as const;

function read(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8").replace(/\r\n/g, "\n");
}

/**
 * Executable source only. Every "must NOT contain" assertion below runs against
 * this projection: a doc comment that NAMES the forbidden construct (which the
 * app bar deliberately does, to explain why it is forbidden) is documentation,
 * not a violation, and failing on it would push the contract towards
 * undocumented code.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function sliceBlock(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end);
  assert.ok(from !== -1, `missing block start ${start}`);
  assert.ok(to > from, `missing block end ${end}`);
  return source.slice(from, to + end.length);
}

/** Resolves an alias/relative import to a repo-relative first-party file. */
function resolveImport(fromFile: string, specifier: string): string | null {
  let candidateBase: string;
  if (specifier.startsWith("@/")) {
    candidateBase = join(FRONTEND_SRC, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    candidateBase = join(dirname(fromFile), specifier);
  } else {
    return null;
  }

  for (const suffix of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = `${candidateBase}${suffix}`.split("\\").join("/");
    if (existsSync(resolve(REPO_ROOT, candidate))) {
      return candidate;
    }
  }
  return null;
}

function importSpecifiers(source: string): readonly string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/from\s+"([^"]+)"/g)) {
    found.push(match[1]);
  }
  for (const match of source.matchAll(/import\("([^"]+)"\)/g)) {
    found.push(match[1]);
  }
  return found;
}

/** Whole first-party import closure of a file, repo-relative. */
function importClosure(entry: string): {
  readonly files: ReadonlySet<string>;
  readonly rawSpecifiers: ReadonlyMap<string, readonly string[]>;
} {
  const files = new Set<string>();
  const rawSpecifiers = new Map<string, readonly string[]>();
  const queue = [entry];

  while (queue.length > 0) {
    const current = queue.pop() as string;
    if (files.has(current)) continue;
    files.add(current);

    const source = read(current);
    const specifiers = importSpecifiers(source);
    rawSpecifiers.set(current, specifiers);

    for (const specifier of specifiers) {
      const resolved = resolveImport(current, specifier);
      if (resolved && !files.has(resolved)) {
        queue.push(resolved);
      }
    }
  }

  return { files, rawSpecifiers };
}

// ── T1 · Existence and canonical ownership ───────────────────────────────────

test("B06 · WorkspaceAppBar exists at its canonical path and exports the band", () => {
  assert.ok(
    existsSync(resolve(REPO_ROOT, APP_BAR_TSX)),
    `${APP_BAR_TSX} must exist — B06 has no alternative location`,
  );

  const source = read(APP_BAR_TSX);
  assert.ok(source.startsWith('"use client";'), "the app bar is a client component");
  assert.ok(source.includes("export function WorkspaceAppBar({"));
  assert.ok(source.includes("export type WorkspaceAppBarProps = {"));
  assert.ok(
    source.includes('data-workspace-app-bar="true"'),
    "the band must carry the contract attribute the runtime spec measures",
  );
});

test("B06 · the presentation shell barrel re-exports the app bar", () => {
  const barrel = read(SHELL_BARREL);

  assert.ok(
    barrel.includes(
      'export {\n  WorkspaceAppBar,\n  type WorkspaceAppBarProps,\n} from "@/components/dashboard/WorkspaceAppBar";',
    ),
    "presentation/shell must re-export WorkspaceAppBar from components/dashboard",
  );
  assert.equal(
    barrel.includes("DashboardTopbar"),
    true,
    "the barrel keeps documenting why the orchestrator stays out",
  );
  assert.equal(
    barrel.includes('from "@/components/dashboard/DashboardTopbar"'),
    false,
    "the orchestrator still imports @/lib/api and must NOT be re-exported",
  );
});

// ── T2 · Presentation purity ─────────────────────────────────────────────────

test("B06 · the app bar import closure never reaches the data or app layer", () => {
  const { files, rawSpecifiers } = importClosure(APP_BAR_TSX);

  assert.ok(files.has(APP_BAR_TSX), "the closure must contain its own entry point");

  const violations: string[] = [];
  for (const [file, specifiers] of rawSpecifiers) {
    for (const specifier of specifiers) {
      for (const forbidden of FORBIDDEN_PRESENTATION_IMPORTS) {
        if (specifier === forbidden || specifier.startsWith(`${forbidden}/`)) {
          violations.push(`${file} imports ${specifier}`);
        }
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    "WorkspaceAppBar is presentation-pure: every data-layer affordance is injected as a slot",
  );

  for (const file of files) {
    assert.ok(
      file.startsWith(FRONTEND_SRC),
      `${file} escaped the frontend source tree while walking the app-bar closure`,
    );
  }
});

// ── T3 · Slots, not behaviour ────────────────────────────────────────────────

test("B06 · the app bar declares the five audit slots and renders them verbatim", () => {
  const source = read(APP_BAR_TSX);

  for (const slot of [
    "readonly identity: ReactNode;",
    "readonly actions?: ReactNode;",
    "readonly notifications?: ReactNode;",
    "readonly account?: ReactNode;",
    "readonly overflow?: ReactNode;",
  ]) {
    assert.ok(source.includes(slot), `missing declared slot: ${slot}`);
  }

  for (const rendered of ["{identity}", "{actions}", "{notifications}", "{account}", "{overflow}"]) {
    assert.ok(source.includes(rendered), `slot is declared but never rendered: ${rendered}`);
  }

  // The behaviours the audit lists as app-bar content stay with the orchestrator.
  const executable = stripComments(source);
  for (const behaviour of ["logoutAdmin", "logout as logoutClinic", "@/lib/api"]) {
    assert.equal(
      executable.includes(behaviour),
      false,
      `${behaviour} must stay in DashboardTopbar, not move into the pure band`,
    );
  }
});

test("B06 · DashboardTopbar stays the orchestrator and feeds every slot", () => {
  const source = read(TOPBAR_TSX);

  assert.ok(
    source.includes('import { WorkspaceAppBar } from "./WorkspaceAppBar";'),
    "the orchestrator composes the band",
  );
  assert.ok(source.includes("<WorkspaceAppBar"));
  for (const wiring of ["identity={", "actions={", "notifications={", "account={", "overflow={"]) {
    assert.ok(source.includes(wiring), `orchestrator does not feed slot: ${wiring}`);
  }

  // Orchestration that must NOT have migrated.
  for (const kept of [
    "logoutAdmin",
    "logout as logoutClinic",
    "clearDashboardLastModules",
    "<ThemeModeToggle />",
    "<AdminMobileKebabMenu />",
  ]) {
    assert.ok(source.includes(kept), `orchestrator lost ${kept}`);
  }

  // B08 retired `DashboardHorizontalNav` and moved module navigation out of the
  // header entirely: the lateral band is mounted BESIDE `main`, not under the
  // bar. The app bar therefore owns exactly one row, and this guard now pins
  // that — a horizontal nav reappearing here would re-add a second band and
  // spend the vertical budget A03 froze.
  assert.equal(
    source.includes("DashboardHorizontalNav"),
    false,
    "the retired horizontal nav must not come back into the app bar header",
  );
  assert.equal(
    [...source.matchAll(/<WorkspaceAppBar/g)].length,
    1,
    "the header composes exactly one band",
  );
});

// ── T4 · Geometry ledger ─────────────────────────────────────────────────────

test("B06 · the 56px target is declared once, in tokens.css, as a band", () => {
  const tokens = read(TOKENS_CSS);
  const block = sliceBlock(tokens, TOKEN_BLOCK_START, TOKEN_BLOCK_END);

  assert.ok(block.includes("--dash-app-bar-h: 56px;"), "the audit target must be declared");
  assert.ok(block.includes("--dash-app-bar-band: 2px;"), "the ±2px tolerance must be declared");

  const declarations = [...tokens.matchAll(/--dash-app-bar-h:\s*[^;]+;/g)];
  assert.equal(declarations.length, 1, "--dash-app-bar-h must be declared exactly once");

  for (const cssFile of DASHBOARD_CSS_FILES) {
    if (cssFile === TOKENS_CSS) continue;
    const source = read(cssFile);
    assert.equal(
      /--dash-app-bar-h:\s/.test(source),
      false,
      `${cssFile} re-declares --dash-app-bar-h; tokens.css is the single owner`,
    );
  }

  // No component may restate the literal the token owns.
  assert.equal(
    stripComments(read(APP_BAR_TSX)).includes("56px"),
    false,
    "the app bar component must not restate the 56px literal",
  );
});

test("B06 · the band is applied as min/max block-size, never as a pinned height", () => {
  const block = sliceBlock(read(LAYOUT_CSS), B06_CSS_START, B06_CSS_END);

  assert.ok(
    block.includes(
      "min-block-size: calc(var(--dash-app-bar-h) - var(--dash-app-bar-band));",
    ),
    "the lower bound must be derived from the token",
  );
  assert.ok(
    block.includes(
      "max-block-size: calc(var(--dash-app-bar-h) + var(--dash-app-bar-band));",
    ),
    "the upper bound must be derived from the token",
  );

  // A03 INVARIANT. A pinned height moves `main` and re-pages 15 consumers.
  for (const pin of [
    /(^|[^-])height:\s/m,
    /(^|[^-])block-size:\s/m,
    /flex-basis:\s/,
  ]) {
    assert.equal(
      pin.test(block),
      false,
      `the B06 block pins the band (${pin}); only min/max block-size are admissible (A03)`,
    );
  }

  assert.ok(block.includes("width: 100%;"), "the band spans the full width");
  assert.ok(
    block.includes("border-radius: var(--dash-shape-none);"),
    "the band carries no radius, stated through the shape scale",
  );
  assert.ok(
    block.includes("box-shadow: var(--dash-elevation-none);"),
    "the band carries no elevation, stated through the elevation scale",
  );

  // Structural regions never animate their height (audit §10 / no-scroll).
  assert.equal(
    /transition[^;]*:(?![^;]*none)[^;]*(height|block-size)/.test(block),
    false,
    "the B06 block must not animate a structural height",
  );
});

test("B06 · the app-bar band keeps exactly one 1px bottom rule", () => {
  const topbar = read(TOPBAR_TSX);

  assert.ok(
    topbar.includes("border-b border-vetneb-line/80"),
    "the chrome band keeps its single 1px bottom rule on the <header>",
  );
  const block = sliceBlock(read(LAYOUT_CSS), B06_CSS_START, B06_CSS_END);
  assert.equal(
    /border-bottom|border-block-end/.test(block),
    false,
    "the B06 block must not add a second divider under the band",
  );
});

// ── T5 · Global module search ────────────────────────────────────────────────

test("B06 · global search reads the canonical catalog and the ?module= grammar", () => {
  const source = read(APP_BAR_TSX);
  const executable = stripComments(source);

  assert.ok(source.includes("ADMIN_MODULE_NAV_LABELS"));
  assert.ok(source.includes("CLINIC_MODULE_NAV_LABELS"));
  assert.ok(source.includes('from "@/features/dashboard/config"'));
  assert.ok(source.includes("buildDashboardModuleHref"));
  assert.ok(source.includes('from "@/features/dashboard/application"'));

  assert.ok(
    source.includes("router.push(buildDashboardModuleHref(basePath, entry.moduleId))"),
    "navigation must go through the existing router control pattern",
  );

  // The repo forbids link-based in-app navigation (AGENTS.md §10, test/unit/ui).
  assert.equal(executable.includes('from "next/link"'), false);
  assert.equal(
    /<a[\s>]/.test(executable),
    false,
    "no anchor element may be used to navigate",
  );

  // No invented backend.
  for (const invented of ["fetch(", "/api/search", "axios", "useSWR"]) {
    assert.equal(
      executable.includes(invented),
      false,
      `global search must not introduce ${invented}: it searches the shipped catalog`,
    );
  }

  // Accessible combobox, keyboard-operable.
  assert.ok(source.includes('role="combobox"'));
  assert.ok(source.includes('role="listbox"'));
  assert.ok(source.includes('role="option"'));
  assert.ok(source.includes("aria-expanded={expanded}"));
  assert.ok(source.includes("aria-controls={listboxId}"));
  assert.ok(source.includes("aria-activedescendant="));
  assert.ok(source.includes('event.key === "ArrowDown"'));
  assert.ok(source.includes('event.key === "ArrowUp"'));
  assert.ok(source.includes('event.key === "Enter"'));
  assert.ok(source.includes('event.key === "Escape"'));
});

test("B06 · the admin label table is single-owned by the module catalog", () => {
  const catalog = read(MODULE_CATALOG);

  assert.ok(catalog.includes("export const ADMIN_MODULE_NAV_LABELS"));
  for (const moduleId of [
    "admin",
    "admin-report-upload",
    "admin-health",
    "admin-clinics",
    "admin-particular-tokens",
    "admin-pricing",
    "admin-sessions",
    "admin-users-roles",
    "audit-log",
    "admin-maintenance",
  ]) {
    assert.ok(
      catalog.includes(`moduleId: "${moduleId}"`),
      `admin label table misses ${moduleId}; the search corpus would be incomplete`,
    );
  }

  // The app bar derives its corpus; it never re-declares module ids.
  const appBar = read(APP_BAR_TSX);
  assert.equal(
    appBar.includes("admin-clinics"),
    false,
    "the app bar must not restate module ids — the catalog owns them",
  );
});

// ── T6 · The runtime contract really covers the canonical matrix ─────────────

test("B06 · the runtime contract walks the canonical 21 x 13 matrix", () => {
  const spec = read(RUNTIME_SPEC);

  assert.ok(spec.includes('from "../helpers/dashboard-geometry-matrix"'));
  assert.ok(spec.includes("DASHBOARD_GEOMETRY_SURFACES"));
  assert.ok(spec.includes("DASHBOARD_GEOMETRY_SURFACE_COUNT"));
  assert.ok(spec.includes("DASHBOARD_GEOMETRY_VIEWPORTS"));
  assert.ok(spec.includes("DASHBOARD_GEOMETRY_VIEWPORT_COUNT"));
  assert.ok(spec.includes("DASHBOARD_GEOMETRY_COMBINATION_COUNT"));

  assert.ok(spec.includes("const WORKSPACE_APP_BAR_TARGET_PX = 56;"));
  assert.ok(spec.includes("const WORKSPACE_APP_BAR_TOLERANCE_PX = 2;"));

  // Fail-closed reporting: no combination may be skipped or soft-failed.
  for (const escape of ["test.skip", "test.fixme", "test.fail", ".slow()"]) {
    assert.equal(
      spec.includes(escape),
      false,
      `the B06 runtime contract must not use ${escape}`,
    );
  }
});

test("B06 · the app-bar contract files stay inside the declared scope", () => {
  for (const file of [APP_BAR_TSX, TOPBAR_TSX, SHELL_BARREL, MODULE_CATALOG, TOKENS_CSS, LAYOUT_CSS, RUNTIME_SPEC]) {
    const absolute = resolve(REPO_ROOT, file);
    assert.ok(existsSync(absolute), `${file} is part of the B06 contract and must exist`);
    assert.equal(
      relative(REPO_ROOT, absolute).split("\\").join("/"),
      file,
      "contract paths are repo-relative and canonical",
    );
  }
});
