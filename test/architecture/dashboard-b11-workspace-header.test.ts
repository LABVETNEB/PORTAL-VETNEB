import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { readDashboardCssSource } from "../helpers/read-dashboard-css-source.ts";

const REPO_ROOT = process.cwd();
const HEADER_PATH =
  "frontend/src/components/dashboard/WorkspaceHeader.tsx";
const WORKSPACE_BARREL =
  "frontend/src/features/dashboard/presentation/layout/index.ts";
const FORBIDDEN_WORKSPACE_BOUNDARY =
  "frontend/src/features/dashboard/presentation/workspace";
const MODULE_WORKSPACE =
  "frontend/src/components/dashboard/DashboardModuleWorkspace.tsx";
const PAGE_HEADER =
  "frontend/src/components/dashboard/DashboardPageHeader.tsx";
const CLINIC_SHELL =
  "frontend/src/components/dashboard/ClinicDashboardShell.tsx";
const MOBILE_NAV =
  "frontend/src/components/dashboard/DashboardMobileNav.tsx";
const TOKENS_CSS = "frontend/src/styles/dashboard/tokens.css";
const NAVIGATION_CSS = "frontend/src/styles/dashboard/navigation.css";
const RUNTIME_SPEC =
  "frontend/e2e/regression/dashboard-b11-workspace-header.spec.ts";
const CATALOG = "frontend/e2e/suites/catalog.ts";

const EXPECTED_CONSUMERS = [
  "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx",
  "frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx",
] as const;

function read(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), "utf8").replace(/\r\n/g, "\n");
}

/** Comments name neighbouring owners on purpose; fences read code only. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function sourceFiles(path: string): string[] {
  const absolute = resolve(REPO_ROOT, path);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(child);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [child] : [];
  });
}

test("B11 · WorkspaceHeader exists at components/dashboard and publishes through layout", () => {
  for (const path of [HEADER_PATH, WORKSPACE_BARREL]) {
    assert.ok(existsSync(resolve(REPO_ROOT, path)), `${path} must exist`);
  }

  const header = read(HEADER_PATH);
  const barrel = read(WORKSPACE_BARREL);
  assert.ok(header.includes("export function WorkspaceHeader({"));
  assert.ok(header.includes("export type WorkspaceHeaderProps = {"));
  assert.ok(header.includes('data-workspace-header="true"'));
  assert.ok(header.includes("<header"), "the primitive owns header semantics");
  assert.ok(header.includes("<h2 id={titleId}"), "the title keeps heading semantics");
  assert.ok(header.includes('className="sr-only"'));
  assert.ok(header.includes('data-workspace-header-description="true"'));
  assert.ok(
    barrel.includes('} from "@/components/dashboard/WorkspaceHeader";'),
    "presentation/layout must publish the compatibility implementation",
  );
  assert.equal(
    existsSync(resolve(REPO_ROOT, FORBIDDEN_WORKSPACE_BOUNDARY)),
    false,
    "presentation/workspace must not exist",
  );
  for (const forbidden of ["@/app/", "@/lib/api", "next/link", "<a "]) {
    assert.equal(header.includes(forbidden), false, `WorkspaceHeader must not contain ${forbidden}`);
  }
});

test("B11 · DashboardModuleWorkspace delegates one header and owns no ad hoc duplicate", () => {
  const workspace = read(MODULE_WORKSPACE);
  assert.ok(
    workspace.includes(
      'import { WorkspaceHeader } from "@/features/dashboard/presentation/layout";',
    ),
  );
  assert.equal([...workspace.matchAll(/<WorkspaceHeader\b/g)].length, 1);
  assert.equal(workspace.includes("<h2"), false);
  assert.equal(workspace.includes("dashboard-section-description"), false);
  assert.equal(workspace.includes("dashboard-workspace-header flex"), false);
  assert.ok(workspace.includes("aria-labelledby={titleId}"));
  assert.ok(workspace.includes("aria-describedby={description ? descriptionId : undefined}"));
  assert.ok(workspace.includes("descriptionId={description ? descriptionId : undefined}"));
  assert.ok(workspace.includes("data-dashboard-module-workspace={moduleId}"));
  assert.ok(workspace.includes("data-dashboard-module-viewport={moduleId}"));
});

test("B11 · the two shared controllers are the complete consumer census", () => {
  const consumers = sourceFiles("frontend/src")
    .filter((path) => path !== MODULE_WORKSPACE)
    .filter((path) => read(path).includes("<DashboardModuleWorkspace"))
    .sort();

  assert.deepEqual(consumers, [...EXPECTED_CONSUMERS].sort());
  for (const path of consumers) {
    const source = read(path);
    assert.equal(
      source.includes("WorkspaceHeader"),
      false,
      `${path} must converge through DashboardModuleWorkspace instead of composing a second header`,
    );
  }
});

test("B11 · geometry has one 40px token owner and the specified flat band", () => {
  const tokens = read(TOKENS_CSS);
  const navigation = read(NAVIGATION_CSS);
  const css = readDashboardCssSource();

  assert.equal([...css.matchAll(/--dash-workspace-header-h\s*:/g)].length, 1);
  assert.ok(tokens.includes("--dash-workspace-header-h: 40px;"));
  assert.ok(tokens.includes("--dash-workspace-header-band: 2px;"));
  assert.ok(tokens.includes("--dash-workspace-header-title-size: 0.875rem;"));
  assert.ok(tokens.includes("--dash-workspace-header-title-weight: 600;"));
  assert.ok(tokens.includes("--dash-workspace-header-title-leading: 1.25rem;"));

  const start = navigation.indexOf(".dashboard-workspace-header {");
  const rule = navigation.slice(start, navigation.indexOf("}", start));
  assert.ok(start >= 0);
  assert.ok(rule.includes("inline-size: 100%;"));
  assert.ok(rule.includes("block-size: var(--dash-workspace-header-h);"));
  assert.ok(rule.includes("padding-inline: var(--dash-space-4);"));
  assert.ok(rule.includes("border: 0;"));
  assert.ok(rule.includes("border-radius: var(--dash-shape-none);"));
  assert.ok(rule.includes("box-shadow: var(--dash-elevation-none);"));
});

test("B11 · description is programmatic and does not own permanent layout height", () => {
  const header = read(HEADER_PATH);
  assert.ok(header.includes("description && descriptionId ?"));
  assert.ok(header.includes("id={descriptionId}"));
  assert.ok(header.includes("{description}"));
  assert.equal(header.includes("dashboard-section-description"), false);
  assert.equal(header.includes("display: none"), false);
  assert.equal(header.includes("hidden"), false);
});

/**
 * B09/B10/B15 fence, source-backed on purpose. A working-tree `git status` is
 * empty in any clean CI checkout, so it cannot witness a committed scope
 * violation — it only ever sees leftover local edits. These invariants are read
 * from the checked-out commit itself and hold in CI and locally alike: B11 must
 * not leak its primitive into the surfaces it does not own, and must not absorb
 * them either.
 */
test("B11 · DashboardPageHeader, B10 shell and B09 mobile nav stay outside B11", () => {
  const B11_SURFACES = [
    "WorkspaceHeader",
    "data-workspace-header",
    "--dash-workspace-header-h",
  ] as const;

  // Directional fence 1: B11 does not reach into B09/B10 surfaces.
  for (const path of [PAGE_HEADER, CLINIC_SHELL, MOBILE_NAV]) {
    assert.ok(existsSync(resolve(REPO_ROOT, path)), `${path} must still exist`);
    const source = stripComments(read(path));
    for (const surface of B11_SURFACES) {
      assert.equal(
        source.includes(surface),
        false,
        `${path} is outside B11: it must not reach into ${surface}`,
      );
    }
  }

  // Directional fence 2: B11 does not absorb them — each keeps its own owner.
  for (const [path, owner] of [
    [PAGE_HEADER, "export function DashboardPageHeader({"],
    [CLINIC_SHELL, "export function ClinicDashboardShell({"],
    [MOBILE_NAV, "export function DashboardMobileNav({"],
  ] as const) {
    assert.ok(read(path).includes(owner), `${path} must keep owning ${owner}`);
  }

  // B15 has not started: no source file names the scaffold.
  const scaffoldOwners = sourceFiles("frontend/src").filter((path) =>
    stripComments(read(path)).includes("WorkspaceScaffold"),
  );
  assert.deepEqual(scaffoldOwners, [], "B15 WorkspaceScaffold is outside B11");
});

test("B11 · runtime contract is catalogued with A02/A03/A08 ownership", () => {
  assert.ok(existsSync(resolve(REPO_ROOT, RUNTIME_SPEC)));
  const spec = read(RUNTIME_SPEC);
  const catalog = read(CATALOG);

  for (const contract of ["A02", "A03", "A08"]) {
    assert.ok(spec.includes(contract), `${contract} must be explicit in the runtime contract`);
  }
  for (const escape of ["test.skip", "test.fixme", "test.fail", ".slow()"] as const) {
    assert.equal(spec.includes(escape), false, `the B11 contract must not use ${escape}`);
  }
  assert.ok(
    catalog.includes(
      'entry("e2e/regression/dashboard-b11-workspace-header.spec.ts", "regression", "dashboard", "workspace header 40px", ["visual-contract"], ci',
    ),
    "B11 must run in visual-contract and its canonical CI execution partition",
  );
});
