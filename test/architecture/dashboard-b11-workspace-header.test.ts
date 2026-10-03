import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { readDashboardCssSource } from "../helpers/read-dashboard-css-source.ts";
import { readSourceFile as read, listSourceFiles } from "../helpers/tracked-source-files.ts";

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

/** Comments name neighbouring owners on purpose; fences read code only. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function sourceFiles(path: string): string[] {
  return listSourceFiles(resolve(REPO_ROOT, path), { extensions: [".ts", ".tsx"] })
    .map((file) => `${path}/${file}`);
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
  const scaffold = read("frontend/src/components/dashboard/ModuleSurface.tsx");
  assert.ok(
    workspace.includes(
      'import { WorkspaceScaffold } from "@/features/dashboard/presentation/layout";',
    ),
  );
  assert.equal([...workspace.matchAll(/<WorkspaceScaffold\b/g)].length, 1);
  assert.equal([...scaffold.matchAll(/<WorkspaceHeader\b/g)].length, 1);
  assert.equal(workspace.includes("<h2"), false);
  assert.equal(workspace.includes("dashboard-section-description"), false);
  assert.equal(workspace.includes("dashboard-workspace-header flex"), false);
  assert.ok(scaffold.includes("aria-labelledby={props.titleId}"));
  assert.ok(scaffold.includes("aria-describedby={props.description ? props.descriptionId : undefined}"));
  assert.ok(workspace.includes("descriptionId={description ? descriptionId : undefined}"));
  assert.ok(scaffold.includes("data-dashboard-module-workspace={props.moduleId}"));
  assert.ok(scaffold.includes("data-dashboard-module-viewport={props.moduleId}"));
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

  // B15 realigns the old future-work fence: exactly one primitive owns the header composition.
  const scaffoldOwners = sourceFiles("frontend/src").filter((path) =>
    stripComments(read(path)).includes("export function WorkspaceScaffold"),
  );
  assert.deepEqual(scaffoldOwners, ["frontend/src/components/dashboard/ModuleSurface.tsx"]);
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

test("B15 · one presentation scaffold owns ordered workspace slots", () => {
  const scaffoldPath = "frontend/src/components/dashboard/ModuleSurface.tsx";
  const source = read(scaffoldPath);
  const barrel = read(WORKSPACE_BARREL);
  assert.equal((source.match(/export function WorkspaceScaffold\b/g) ?? []).length, 1);
  assert.ok(barrel.includes('export { WorkspaceScaffold'));
  assert.ok(source.includes("WorkspaceHeader"));
  for (const slot of ["toolbar", "filters", "collection", "details", "footer"]) {
    assert.ok(source.includes(slot), `missing ${slot} slot`);
  }
  assert.ok(source.indexOf("{toolbar}") < source.indexOf("{filters}"));
  assert.ok(source.indexOf("{filters}") < source.indexOf("{collection}"));
  assert.ok(source.indexOf("{collection}") < source.indexOf("{details}"));
  assert.ok(source.indexOf("{details}") < source.indexOf("{footer}"));
  for (const forbidden of ["@/app/", "@/lib/api", "next/navigation", "DetailsPane", "CollectionWorkspace", "window.", "document.", "fetch("]) {
    assert.equal(source.includes(forbidden), false, `scaffold must not own ${forbidden}`);
  }
});

test("B16 · one controlled utility panel is published and composed by the B15 scaffold", () => {
  const source = read("frontend/src/components/dashboard/ModuleSurface.tsx");
  const barrel = read(WORKSPACE_BARREL);
  const css = readDashboardCssSource();
  assert.equal((source.match(/export function UtilitySidePanel\b/g) ?? []).length, 1);
  assert.ok(barrel.includes("UtilitySidePanel"));
  assert.ok(source.includes("onExpandedChange"));
  assert.ok(source.includes("aria-expanded={expanded}"));
  assert.ok(source.includes("aria-controls={contentId}"));
  assert.ok(source.includes("hidden={!expanded}"));
  assert.ok(source.includes("<aside className=\"dashboard-utility-side-panel\""));
  assert.ok(source.includes("<UtilitySidePanel"));
  assert.ok(source.includes("details={" ) || source.includes("props.details"));
  assert.ok(css.includes("--dash-utility-panel-w: 336px;"));
  assert.ok(css.includes('.dashboard-utility-side-panel[data-expanded="true"]'));
  assert.ok(css.includes("inline-size: var(--dash-utility-panel-w);"));
  for (const forbidden of ["DetailsPane", "DocumentViewer", "fetch(", "@/lib/api", "@/app/"]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("B15 · legacy composition adapters converge through the scaffold", () => {
  const adapters = [
    MODULE_WORKSPACE,
    PAGE_HEADER,
    "frontend/src/components/dashboard/ModuleSurface.tsx",
    "frontend/src/components/dashboard/ClinicMobileModuleFrame.tsx",
    "frontend/src/components/dashboard/ClinicFullRouteModuleStage.tsx",
  ];
  const owners = sourceFiles("frontend/src").filter((path) =>
    read(path).includes("export function WorkspaceScaffold"),
  );
  assert.deepEqual(owners, ["frontend/src/components/dashboard/ModuleSurface.tsx"]);
  for (const path of adapters) {
    assert.equal((read(path).match(/<WorkspaceScaffold\b/g) ?? []).length, 1, path);
  }
  const scaffold = read(adapters[2]);
  for (const marker of ["data-dashboard-module-workspace", "data-dashboard-module-viewport", "data-dashboard-module-surface", "data-workspace-scaffold"]) {
    assert.ok(scaffold.includes(marker), marker);
  }
});

const C01_TABLE = "frontend/src/components/ui/table.tsx";
const C01_SURFACES_BARREL = "frontend/src/features/dashboard/presentation/surfaces/index.ts";
const C01_AUDIT_CARD = "frontend/src/app/dashboard/admin/AdminAuditCard.tsx";
const C01_AUDIT_TABLE = "frontend/src/app/dashboard/admin/AdminAuditDenseTable.tsx";
const C01_AUDIT_MOBILE = "frontend/src/app/dashboard/admin/AdminMobileAuditModule.tsx";
const C01_PRIMITIVES = ["CollectionWorkspace", "CollectionHeader", "ContentList", "ContentListItem"] as const;

function cssRule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `missing rule ${selector}`);
  return stripComments(css.slice(start, css.indexOf("}", start) + 1));
}

function c01PrimitiveCode(): string {
  const source = read(C01_TABLE);
  const start = source.indexOf("// C01");
  assert.ok(start >= 0, "C01 block must stay identifiable in ui/table");
  return stripComments(source.slice(start, source.lastIndexOf("export {")));
}

test("C01 · collection primitives extend the ui/table base and publish through surfaces", () => {
  const code = c01PrimitiveCode();
  const barrel = read(C01_SURFACES_BARREL);
  assert.equal((code.match(/const CollectionWorkspace = React\.forwardRef</g) ?? []).length, 1);
  assert.equal((code.match(/const CollectionHeader = React\.forwardRef</g) ?? []).length, 1);
  assert.equal((code.match(/function ContentList\(/g) ?? []).length, 1);
  assert.equal((code.match(/function ContentListItem\(/g) ?? []).length, 1);
  assert.ok(code.includes("<TableHeader"), "the header reuses the table header skin");
  assert.ok(code.includes("<TableBody"), "the tbody form reuses the table body skin");
  assert.ok(code.includes("<TableRow"), "the tr form reuses the table row skin");
  for (const name of C01_PRIMITIVES) {
    assert.ok(barrel.includes(`  ${name},`), `surfaces must publish ${name}`);
  }
  assert.ok(barrel.includes('} from "@/components/ui/table";'));
  const owners = sourceFiles("frontend/src").filter((path) =>
    /const CollectionWorkspace\b|function ContentList\(/.test(read(path)),
  );
  assert.deepEqual(owners, [C01_TABLE], "one owner per primitive, no duplicate under another name");
});

test("C01 · primitives own structure only: no data, paging, sorting, selection or geometry in TSX", () => {
  const code = c01PrimitiveCode();
  for (const forbidden of [
    "fetch(", "@/lib/api", "@/app/", "next/navigation", "useState", "useEffect", "useDashboardCanvasCapacity",
    "limit", "offset", "Pager", "aria-sort", "onSort", "sortBy", "aria-selected", "onSelect", "checkbox",
    "role=", "tabIndex", "onClick", "style=", "overflow", "position",
  ]) {
    assert.equal(code.includes(forbidden), false, `C01 primitives must not own ${forbidden}`);
  }
  // The B15 scaffold keeps composing slots without absorbing the collection.
  assert.equal(read("frontend/src/components/dashboard/ModuleSurface.tsx").includes("CollectionWorkspace"), false);
});

test("C01 · CollectionHeader is sticky against the collection frame with a 36px ledger bound to the A03 reserve", () => {
  const css = readDashboardCssSource();
  assert.equal([...css.matchAll(/--dash-collection-header-h:\s*36px;/g)].length, 1);
  assert.equal([...css.matchAll(/--dash-collection-header-h\s*:/g)].length, 2);
  assert.match(
    css,
    /\.dashboard-app-shell \[data-dashboard-canvas-reserve\^="table-head"\] \{\s*--dash-collection-header-h: var\(--dash-table-head-h\);\s*\}/,
    "inside a capacity canvas the head reserve owns the header height",
  );

  const header = cssRule(css, ".dashboard-collection-header");
  assert.ok(header.includes("position: sticky;"));
  assert.ok(header.includes("inset-block-start: 0;"));
  assert.ok(header.includes("background-color: var(--dash-color-surface);"));
  assert.equal(/fixed|overflow/.test(header), false);
  assert.ok(css.includes("  block-size: var(--dash-collection-header-h);"));

  const workspace = cssRule(css, "  .dashboard-collection-workspace");
  assert.ok(workspace.includes("display: flex;"));
  assert.ok(workspace.includes("min-block-size: 0;"));
  assert.equal(/overflow|position|block-size:\s*\d/.test(workspace.replace("min-block-size: 0;", "")), false,
    "the workspace bounds the collection frame; it is never a second scroll owner");

  // Frozen neighbours: A03 reserve, B11 header, B16 panel.
  assert.ok(css.includes("--dash-table-head-h: 44px;"));
  assert.ok(css.includes("--dash-table-head-h: 32px;"));
  assert.ok(css.includes('[data-dashboard-canvas-reserve^="table-head"] table thead > tr > th {'));
  assert.ok(css.includes("--dash-workspace-header-h: 40px;"));
  assert.ok(css.includes("--dash-utility-panel-w: 336px;"));
});

test("C01 · Auditoría adopts the table and list forms without moving capacity, actions or the pager", () => {
  const card = read(C01_AUDIT_CARD);
  const table = read(C01_AUDIT_TABLE);
  const mobile = read(C01_AUDIT_MOBILE);

  const workspaceStart = card.indexOf("<CollectionWorkspace");
  const workspace = card.slice(workspaceStart, card.indexOf(">", workspaceStart));
  assert.ok(workspaceStart >= 0, "the measured desktop canvas is the CollectionWorkspace");
  for (const attribute of [
    "ref={setDesktopBodyNode}",
    'data-dashboard-adaptive-rows-canvas="true"',
    'data-dashboard-row-pitch="compact"',
    'data-dashboard-canvas-reserve="table-head-dense"',
    'className="min-h-0 flex-1"',
  ]) {
    assert.ok(workspace.includes(attribute), `canvas keeps ${attribute}`);
  }
  for (const capacity of ["useDashboardCanvasCapacity", "canvasNode: desktopBodyNode,", "canvasNode: mobileBodyNode,", "DASHBOARD_PAGER_RESERVATION", "goToNextPage", "goToPreviousPage"]) {
    assert.ok(card.includes(capacity), capacity);
  }

  assert.ok(table.includes("<Table className=\"table-fixed"), "the Table frame stays the scroll owner");
  assert.ok(table.includes("<CollectionHeader>"));
  assert.ok(table.includes('<ContentList as="tbody">'));
  assert.ok(table.includes('<ContentListItem as="tr" key={row.id}>'));
  assert.ok(table.includes("<AdminAuditDetailDialog row={row} />"));
  assert.equal(/<TableHeader\b|<TableBody\b/.test(table), false);

  assert.match(mobile, /<ContentList\s+as="div"\s+ref=\{bodyRef\}/);
  assert.match(mobile, /<ContentListItem\s+as="article"\s+key=\{row\.id\}\s+data-admin-mobile-ops-item="true"\s+data-dashboard-adaptive-row="true"/);
  for (const operation of ["<AdminAuditDetailDialog row={row} />", "<AdminMobileOpsPager", "onPrevious={onPrevious}", "onNext={onNext}"]) {
    assert.ok(mobile.includes(operation), operation);
  }

  // Minimal adoption fence: C01 is not the C17+ migration.
  const consumers = sourceFiles("frontend/src").filter(
    (path) => path !== C01_TABLE && /<(CollectionWorkspace|CollectionHeader|ContentList|ContentListItem)\b/.test(read(path)),
  );
  assert.deepEqual(consumers.sort(), [C01_AUDIT_CARD, C01_AUDIT_TABLE, C01_AUDIT_MOBILE].sort());
  for (const path of sourceFiles("frontend/src")) {
    const source = read(path);
    // C02 landed CollectionPager; its own fence lives in the C02 block below.
    for (const later of ["CollectionEmptyState", "useCollectionSelection", "SelectionToolbar", "aria-sort"]) {
      assert.equal(source.includes(later), false, `${path}: ${later} belongs to C03+`);
    }
  }
});

const C02_OWNER = "frontend/src/components/dashboard/DashboardPager.tsx";
const C02_COMPACT_ADAPTER = "frontend/src/components/dashboard/CompactPager.tsx";
const C02_NAVIGATION_BARREL = "frontend/src/features/dashboard/presentation/navigation/index.ts";
const C02_CENTERED_CONSUMERS = [
  "frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx",
  "frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx",
] as const;
const C02_COMPACT_CONSUMERS = [
  "frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx",
  "frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx",
] as const;

function exportedFunctionBody(source: string, name: string): string {
  const start = source.indexOf(`export function ${name}(`);
  assert.ok(start >= 0, `missing export function ${name}`);
  const next = source.indexOf("\nexport ", start + 1);
  return stripComments(source.slice(start, next < 0 ? undefined : next));
}

test("C02 · CollectionPager is the single runtime owner and the legacy names are thin adapters", () => {
  const owner = read(C02_OWNER);
  const compact = stripComments(read(C02_COMPACT_ADAPTER));

  assert.equal((owner.match(/export function CollectionPager\(/g) ?? []).length, 1);
  const runtimeOwners = sourceFiles("frontend/src").filter((path) =>
    /function CollectionPager\(|data-dashboard-compact-pager=|className=\{cn\("dashboard-pager min-h-10"/.test(read(path)),
  );
  assert.deepEqual(runtimeOwners, [C02_OWNER], "one pager implementation, no duplicate under a legacy name");

  const dashboardAdapter = exportedFunctionBody(owner, "DashboardPager");
  assert.match(dashboardAdapter, /return <CollectionPager \{\.\.\.props\} variant="centered" \/>;/);
  assert.match(compact, /return <CollectionPager \{\.\.\.props\} variant="compact" \/>;/);
  assert.ok(compact.includes('} from "@/components/dashboard/DashboardPager";'));
  for (const adapter of [dashboardAdapter, compact]) {
    for (const markup of ["<button", "<nav", "<div", "<span", "aria-live", "Pág.", "style=", "Reservation", "RESERVATION"]) {
      assert.equal(adapter.includes(markup), false, `a legacy adapter must not render ${markup} itself`);
    }
  }

  // The three A05 reservations keep a single ledger in the owner module.
  const declarations = sourceFiles("frontend/src").flatMap((path) =>
    [...read(path).matchAll(/"--dash-adaptive-pager-reserved-block-size":/g)].map(() => path),
  );
  assert.deepEqual(declarations, [C02_OWNER, C02_OWNER, C02_OWNER]);
  for (const reservation of [
    'export const DASHBOARD_PAGER_RESERVATION = {\n  "--dash-adaptive-pager-reserved-block-size": "var(--dash-pagination-h, 2.5rem)",',
    'export const DASHBOARD_TOUCH_PAGER_RESERVATION = {\n  "--dash-adaptive-pager-reserved-block-size":\n    "max(var(--dash-pagination-h, 2.5rem), 2.5rem)",',
    'export const DASHBOARD_INLINE_PAGER_RESERVATION = {\n  "--dash-adaptive-pager-reserved-block-size": "var(--dash-control-h, 2rem)",',
  ]) {
    assert.ok(owner.includes(reservation), reservation.split(" = ")[0]);
  }
  assert.match(owner, /<nav[\s\S]*?style=\{DASHBOARD_TOUCH_PAGER_RESERVATION\}/, "centered keeps the touch reservation");
  assert.match(owner, /<div[\s\S]*?style=\{DASHBOARD_PAGER_RESERVATION\}/, "compact keeps the standard reservation");

  const surfaces = read(C01_SURFACES_BARREL);
  assert.ok(surfaces.includes("  CollectionPager,\n  type CollectionPagerProps,"));
  assert.ok(surfaces.includes('} from "@/components/dashboard/DashboardPager";'));
  const navigation = read(C02_NAVIGATION_BARREL);
  for (const legacy of ["DashboardPager,", "type DashboardPagerProps,", "CompactPager,", "type CompactPagerProps,", "DASHBOARD_TOUCH_PAGER_RESERVATION,"]) {
    assert.ok(navigation.includes(legacy), `the legacy navigation surface keeps ${legacy}`);
  }
});

test("C02 · CollectionPager owns presentation only: no data, capacity, sorting, selection, states or observers", () => {
  const code = stripComments(read(C02_OWNER));
  for (const forbidden of [
    "fetch(", "@/lib/api", "@/app/", "next/navigation", "useState", "useEffect", "useLayoutEffect", "useMemo",
    "useCallback", "useRef", "ResizeObserver", "MutationObserver", "useDashboardCanvasCapacity", "computeCapacity",
    "usePagedRows", "aria-sort", "onSort", "sortBy", "aria-selected", "onSelect", "checkbox",
    "EmptyState", "ErrorState", "LoadingState", "SelectionToolbar", "BulkActionMenu", "role=", "tabIndex",
  ]) {
    assert.equal(code.includes(forbidden), false, `CollectionPager must not own ${forbidden}`);
  }
  assert.doesNotMatch(code, /\b(?:limit|offset|pageSize)\b\s*[:=?]/, "the pager never sizes or offsets a request");
});

test("C02 · consumers keep their adapters and capacity owners; C03+ and C05 geometry are not started", () => {
  const census = (pattern: RegExp) =>
    sourceFiles("frontend/src").filter((path) => pattern.test(read(path))).sort();
  assert.deepEqual(census(/<DashboardPager\b/), [...C02_CENTERED_CONSUMERS].sort());
  assert.deepEqual(census(/<CompactPager\b/), [...C02_COMPACT_CONSUMERS].sort());
  assert.deepEqual(census(/<CollectionPager\b/), [C02_COMPACT_ADAPTER, C02_OWNER].sort(), "C02 is not the C17+ migration");
  for (const path of [...C02_CENTERED_CONSUMERS, ...C02_COMPACT_CONSUMERS]) {
    assert.ok(read(path).includes("usePagedRows"), `${path}: client pagination stays with usePagedRows`);
  }
  assert.ok(read("frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx").includes(
    "useDashboardCanvasCapacity({\n    canvasNode,\n    fallbackItems: 3,\n    minItems: 1,\n    maxItems: 12,\n  });",
  ));

  for (const path of sourceFiles("frontend/src")) {
    const source = read(path);
    for (const later of ["CollectionEmptyState", "useCollectionSelection", "SelectionToolbar", "BulkActionMenu", "aria-sort"]) {
      assert.equal(source.includes(later), false, `${path}: ${later} is outside C02`);
    }
  }
  assert.deepEqual(
    sourceFiles("frontend/src/hooks").filter((path) => /useAdaptive|Capacity/.test(path)),
    ["frontend/src/hooks/useDashboardCanvasCapacity.ts"],
    "one capacity owner; no adaptive hook reintroduced",
  );
  const css = readDashboardCssSource();
  for (const frozen of [
    "--dash-pagination-h: clamp(2.25rem, 4vh, 2.75rem);",
    "--dash-row-pitch-compact: 36px;",
    "--dash-row-pitch-regular: 44px;",
    "--dash-table-head-h: 32px;",
  ]) {
    assert.ok(css.includes(frozen), `${frozen} stays frozen until C05/A07`);
  }
  assert.equal(/--dash-collection-pager|--dash-collection-row/.test(css), false, "C02 adds no geometry token");
});
