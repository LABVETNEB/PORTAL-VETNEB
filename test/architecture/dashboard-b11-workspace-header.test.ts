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
  // C06 adds the selection state marker to the same item; the C01 form is unchanged.
  assert.match(table, /<ContentListItem\s+as="tr"\s+key=\{row\.id\}[\s>]/);
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
    // C02 landed CollectionPager and C06 useCollectionSelection; their fences live in their blocks below.
    for (const later of ["CollectionEmptyState", "SelectionToolbar", "aria-sort"]) {
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
    for (const later of ["CollectionEmptyState", "SelectionToolbar", "BulkActionMenu", "aria-sort"]) {
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

const C03_OWNER = "frontend/src/components/dashboard/EmptyState.tsx";
const C03_ERROR_ADAPTER = "frontend/src/components/dashboard/ErrorState.tsx";
const C03_LOADING_ADAPTER = "frontend/src/components/dashboard/LoadingState.tsx";
const C03_EMPTY_CONSUMERS = [
  "frontend/src/app/dashboard/ClinicCommandCenter.tsx",
  "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx",
  "frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx",
  "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx",
  "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx",
  "frontend/src/app/dashboard/informes/InformesReportsList.tsx",
  "frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx",
  "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx",
] as const;
const C03_ERROR_CONSUMERS = ["frontend/src/app/dashboard/informes/InformesReportsList.tsx"] as const;
const C03_LOADING_CONSUMERS = [
  "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx",
  "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx",
] as const;

test("C03 · CollectionState is the single runtime owner and the legacy state names are thin adapters", () => {
  const owner = read(C03_OWNER);
  const errorAdapter = stripComments(read(C03_ERROR_ADAPTER));
  const loadingAdapter = stripComments(read(C03_LOADING_ADAPTER));

  assert.equal((owner.match(/export function CollectionState\(/g) ?? []).length, 1);
  for (const renderer of ["renderEmptyState", "renderErrorState", "renderLoadingState"]) {
    assert.equal((owner.match(new RegExp(`function ${renderer}\\(`, "g")) ?? []).length, 1, renderer);
  }
  const runtimeOwners = sourceFiles("frontend/src").filter((path) =>
    /data-collection-state=|function CollectionState\(|getRows\(rows\)|"No se pudo completar la acción"/.test(read(path)),
  );
  assert.deepEqual(runtimeOwners, [C03_OWNER], "one state implementation, no duplicate under a legacy name");
  assert.equal((owner.match(/role="alert"/g) ?? []).length, 1, "one alert root");
  assert.equal((owner.match(/aria-busy="true"/g) ?? []).length, 1, "one loading status root for the five skeletons");

  assert.match(exportedFunctionBody(owner, "EmptyState"), /return <CollectionState \{\.\.\.props\} variant="empty" \/>;/);
  assert.match(errorAdapter, /return <CollectionState \{\.\.\.props\} variant="error" \/>;/);
  assert.match(loadingAdapter, /return <CollectionState \{\.\.\.props\} variant="loading" skeleton=\{variant\} \/>;/);
  assert.ok(errorAdapter.startsWith('"use client";'), "ErrorState keeps its client boundary");
  for (const adapter of [exportedFunctionBody(owner, "EmptyState"), errorAdapter, loadingAdapter]) {
    for (const markup of ["<div", "<h2", "<p", "<span", "<Button", "<Skeleton", "role=", "aria-", "className", "Reintentar", "Cargando"]) {
      assert.equal(adapter.includes(markup), false, `a legacy state adapter must not render ${markup} itself`);
    }
  }
  for (const adapter of [errorAdapter, loadingAdapter]) {
    assert.ok(adapter.includes('} from "@/components/dashboard/EmptyState";'));
  }

  const surfaces = read(C01_SURFACES_BARREL);
  assert.ok(surfaces.includes("  CollectionState,\n  type CollectionStateProps,"));
  assert.ok(surfaces.includes('} from "@/components/dashboard/EmptyState";'));
});

test("C03 · CollectionState owns presentation only: no data, retry policy, paging, sorting, selection or observers", () => {
  const code = stripComments(read(C03_OWNER));
  for (const forbidden of [
    "fetch(", "@/lib/api", "@/app/", "next/navigation", "useState", "useEffect", "useLayoutEffect", "useMemo",
    "useCallback", "useRef", "useTransition", "ResizeObserver", "MutationObserver", "useDashboardCanvasCapacity",
    "computeCapacity", "usePagedRows", "Pager", "aria-sort", "onSort", "sortBy", "aria-selected", "onSelect",
    "checkbox", "useCollectionSelection", "SelectionToolbar", "BulkActionMenu", "tabIndex", 'aria-live="assertive"',
    "setTimeout", "style=",
  ]) {
    assert.equal(code.includes(forbidden), false, `CollectionState must not own ${forbidden}`);
  }
  assert.doesNotMatch(code, /\b(?:limit|offset|pageSize)\b\s*[:=?]/, "a state never sizes or offsets a request");
  assert.equal((code.match(/onClick=\{onRetry\}/g) ?? []).length, 1, "retry calls the consumer callback as given");
  assert.equal(/"use client"/.test(code), false, "the owner adds no client boundary to server consumers");
});

test("C03 · consumers keep the legacy adapters; C01/C02 owners, capacity and C04+ stay untouched", () => {
  const census = (pattern: RegExp) =>
    sourceFiles("frontend/src").filter((path) => pattern.test(read(path))).sort();
  assert.deepEqual(census(/<EmptyState\b/), [...C03_EMPTY_CONSUMERS].sort());
  assert.deepEqual(census(/<ErrorState\b/), [...C03_ERROR_CONSUMERS].sort());
  assert.deepEqual(census(/<LoadingState\b/), [...C03_LOADING_CONSUMERS].sort());
  assert.deepEqual(
    census(/<CollectionState\b/),
    [C03_ERROR_ADAPTER, C03_LOADING_ADAPTER, C03_OWNER].sort(),
    "C03 is not the C17+ migration",
  );
  for (const owner of [C01_TABLE, C02_OWNER]) {
    assert.equal(/CollectionState|EmptyState|ErrorState|LoadingState/.test(stripComments(read(owner))), false, owner);
  }

  for (const path of sourceFiles("frontend/src")) {
    const source = read(path);
    for (const later of ["CollectionEmptyState", "SelectionToolbar", "BulkActionMenu", "aria-sort"]) {
      assert.equal(source.includes(later), false, `${path}: ${later} is outside C03`);
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
  assert.equal(/--dash-collection-state|--dash-collection-row|data-collection-state/.test(css), false, "C03 adds no geometry token or state CSS");
});

const C06_OWNER = "frontend/src/features/dashboard/presentation/surfaces/useCollectionSelection.ts";

/** Selection wiring the Auditoría table must keep: identity by ID, native checkboxes, no row takeover. */
function c06AdopterViolations(table: string): string[] {
  const code = stripComments(table);
  const violations: string[] = [];
  for (const required of [
    "selection: CollectionSelection<number>;",
    'type="checkbox"',
    'aria-label="Seleccionar los eventos de esta página"',
    "checked={selection.allVisibleSelected}",
    "node.indeterminate = selection.someVisibleSelected;",
    "onChange={selection.toggleVisiblePage}",
    "aria-label={`Seleccionar evento ${row.id}`}",
    "checked={selection.isSelected(row.id)}",
    "onChange={() => selection.toggle(row.id)}",
    'data-state={selection.isSelected(row.id) ? "selected" : undefined}',
    "<AdminAuditDetailDialog row={row} />",
  ]) {
    if (!code.includes(required)) violations.push(`missing ${required}`);
  }
  if (/selection\.\w+\(\s*(?!row\.id\b)[^)]+\)/.test(code)) violations.push("selection is keyed by something other than row.id");
  for (const forbidden of [
    "index", "aria-selected", "aria-checked", "tabIndex", "onKeyDown", "onKeyUp", "stopPropagation",
    "preventDefault", "selectedIds", "selectedCount", "clearSelection", "aria-sort", "onSort",
  ]) {
    if (code.includes(forbidden)) violations.push(`owns ${forbidden}`);
  }
  if (/role="(?!alert")/.test(code)) violations.push("selection adds an ARIA role");
  if ((code.match(/onClick=/g) ?? []).length > 0) violations.push("rows or selectors gained a click handler");
  return violations;
}

test("C06 · useCollectionSelection is the single selection owner and publishes through surfaces", () => {
  const owner = read(C06_OWNER);
  assert.ok(owner.startsWith('"use client";\n'), "the hook module is a client boundary of its own");
  assert.equal((owner.match(/export function useCollectionSelection</g) ?? []).length, 1);
  const owners = sourceFiles("frontend/src").filter((path) => /function use\w*Selection\b/.test(read(path)));
  assert.deepEqual(owners, [C06_OWNER], "one selection hook, no per-module duplicate");

  const surfaces = read(C01_SURFACES_BARREL);
  assert.ok(surfaces.includes("  useCollectionSelection,\n  type CollectionSelection,"));
  assert.ok(surfaces.includes('} from "./useCollectionSelection";'));
  for (const name of ["CollectionSelection", "CollectionSelectionId", "CollectionSelectionOptions"]) {
    assert.ok(owner.includes(`export type ${name}<`) || owner.includes(`export type ${name} =`), name);
  }
});

test("C06 · the owner keeps selection state only: no data, effects, paging, sorting, actions or DOM", () => {
  const code = stripComments(read(C06_OWNER));
  const imports = [...code.matchAll(/^import .* from "([^"]+)";$/gm)].map((match) => match[1]);
  assert.deepEqual(imports, ["react"]);
  for (const forbidden of [
    "fetch(", "@/lib/api", "@/app/", "next/navigation", "useEffect", "useLayoutEffect", "useRef", "useReducer",
    "ResizeObserver", "MutationObserver", "setTimeout", "useDashboardCanvasCapacity", "computeCapacity",
    "usePagedRows", "Pager", ".sort(", "aria-sort", "onSort", "sortBy", "document", "window", "addEventListener",
    "key ===", "indexOf", "SelectionToolbar", "BulkActionMenu", "OverflowMenu", "ContextMenu", "ActionMenu",
    "SubMenu", "isSelectable",
  ]) {
    assert.equal(code.includes(forbidden), false, `useCollectionSelection must not own ${forbidden}`);
  }
  assert.doesNotMatch(code, /\b(?:limit|offset|pageSize)\b\s*[:=?]/, "selection never sizes or offsets a request");
  assert.ok(code.includes("useState<ReadonlySet<Id>>"), "selected identities are kept as a set of IDs");
});

test("C06 · Auditoría adopts selection on its table by event ID without touching actions, paging or capacity", () => {
  const card = read(C01_AUDIT_CARD);
  const table = read(C01_AUDIT_TABLE);
  assert.ok(card.includes("const visibleIds = useMemo(() => (loadError ? [] : rows.map((row) => row.id)), [loadError, rows]);"),
    "the visible page is exactly the rendered rows, by ID");
  assert.ok(card.includes("const selection = useCollectionSelection({ visibleIds });"));
  assert.equal((card.match(/selection=\{selection\}/g) ?? []).length, 2, "desktop table and mobile list share the one selection owner");
  for (const frozen of [
    "const effectiveLimit = rowsPerPage;", "limit: effectiveLimit,", "offset,", "maxItems: ADMIN_AUDIT_FALLBACK_ROWS,",
    "maxItems: ADMIN_AUDIT_LIMIT_CAP,", "setOffset(offset + effectiveLimit);", "setOffset(Math.max(0, offset - effectiveLimit));",
  ]) {
    assert.ok(card.includes(frozen), `paging and capacity stay as they were: ${frozen}`);
  }
  assert.deepEqual(c06AdopterViolations(table), []);

  // In-memory mutations of the adopter must be rejected by the same check.
  for (const [anchor, replacement] of [
    ["onChange={() => selection.toggle(row.id)}", "onChange={() => selection.toggle(rows.indexOf(row))}"],
    ["checked={selection.isSelected(row.id)}", 'checked={selection.isSelected(row.id)} aria-checked="true"'],
    ["onChange={selection.toggleVisiblePage}", "onChange={selection.clearSelection}"],
    ["node.indeterminate = selection.someVisibleSelected;", "node.indeterminate = false;"],
    ['data-collection-selection="item"', 'data-collection-selection="item" onClick={(event) => event.stopPropagation()}'],
  ] as const) {
    assert.equal(table.split(anchor).length, 2, `unique adopter anchor: ${anchor}`);
    assert.notDeepEqual(c06AdopterViolations(table.replace(anchor, () => replacement)), [], `mutation must be rejected: ${replacement}`);
  }

  const consumers = sourceFiles("frontend/src").filter(
    (path) => path !== C06_OWNER && path !== C01_SURFACES_BARREL && read(path).includes("useCollectionSelection"),
  );
  assert.deepEqual(consumers, [C01_AUDIT_CARD], "C06 is not the C17+ migration");
  const selectionProps = sourceFiles("frontend/src").filter((path) => read(path).includes("CollectionSelection<"));
  assert.deepEqual(selectionProps.sort(), [C01_AUDIT_MOBILE, C01_AUDIT_TABLE, C06_OWNER].sort());

  // Mobile list: per-item native checkbox on the shared owner, by event ID.
  const mobile = stripComments(read(C01_AUDIT_MOBILE));
  for (const required of [
    "selection: CollectionSelection<number>;",
    'type="checkbox"',
    "aria-label={`Seleccionar evento ${row.id}`}",
    "checked={selection.isSelected(row.id)}",
    "onChange={() => selection.toggle(row.id)}",
    'data-state={selection.isSelected(row.id) ? "selected" : undefined}',
    "<AdminAuditDetailDialog row={row} />",
    'aria-label="Seleccionar los eventos de esta página"',
    'data-collection-selection="page"',
    "checked={selection.allVisibleSelected}",
    "node.indeterminate = selection.someVisibleSelected;",
    "onChange={selection.toggleVisiblePage}",
    "leadingSlot={",
  ]) {
    assert.ok(mobile.includes(required), `mobile list keeps ${required}`);
  }
  for (const forbidden of ["index", "aria-selected", "aria-checked", "onKeyDown", "stopPropagation", "clearSelection"]) {
    assert.equal(mobile.includes(forbidden), false, `mobile list must not own ${forbidden}`);
  }

  // The mobile page checkbox is hosted by the existing strip as a presentational
  // slot, outside the S1 form and with no selection logic inside S1.
  const filterBar = stripComments(read("frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx"));
  const strip = filterBar.slice(filterBar.indexOf("export function AdminAuditFilterBar("));
  assert.ok(strip.indexOf("<FilterForm {...props} />") < strip.indexOf("{props.leadingSlot}"), "the slot renders after, not inside, the S1 form");
  assert.equal((filterBar.match(/\{props\.leadingSlot\}/g) ?? []).length, 1);
  for (const forbidden of ["selection", "checkbox", "toggleVisiblePage", "indeterminate"]) {
    assert.equal(filterBar.includes(forbidden), false, `S1 never owns ${forbidden}`);
  }
  assert.equal(read("frontend/src/app/dashboard/admin/AdminMobileOpsPager.tsx").includes("selection"), false, "the shared pager never hosts selection");
});

test("C06 · C04, C05 and C07+ stay unstarted around the selection owner", () => {
  for (const path of sourceFiles("frontend/src")) {
    const source = read(path);
    for (const later of ["SelectionToolbar", "BulkActionMenu", "OverflowMenu", "ContextMenu", "SubMenu", "aria-sort"]) {
      assert.equal(source.includes(later), false, `${path}: ${later} is outside C06`);
    }
  }
  const css = readDashboardCssSource();
  for (const frozen of [
    "--dash-row-pitch-compact: 36px;",
    "--dash-row-pitch-regular: 44px;",
    "--dash-table-head-h: 32px;",
    "--dash-pagination-h: clamp(2.25rem, 4vh, 2.75rem);",
  ]) {
    assert.ok(css.includes(frozen), `${frozen} stays frozen until C05/A07`);
  }
  assert.equal(/data-collection-selection|\[data-state="?selected|--dash-selection|--dash-collection-row/.test(css), false,
    "C06 adds no CSS: the row skin already styles data-state=selected");
  assert.ok(read(C01_TABLE).includes("data-[state=selected]:bg-vetneb-teal/10"), "the existing TableRow skin is the selected affordance");
});
