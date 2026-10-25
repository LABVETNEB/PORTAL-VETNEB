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
const C19_CARDS = [
  "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx",
  "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx",
  "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx",
] as const;
// C20 (Precios, Mantenimiento, Estado del sistema): non-tabular collections; Resumen has none.
const C20_C01_FILES = [
  "frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx",
  "frontend/src/app/dashboard/admin/AdminMobilePricingModule.tsx",
  "frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx",
  "frontend/src/app/dashboard/admin/AdminMobileMaintenanceModule.tsx",
  "frontend/src/app/dashboard/admin/AdminSchemaHealthStatusCard.tsx",
  "frontend/src/app/dashboard/admin/AdminMobileHealthModule.tsx",
] as const;
// C21 (clinic Informes): module surface and full route.
const C21_INFORMES_MODULE = "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx";
const C21_INFORMES_LIST = "frontend/src/app/dashboard/informes/InformesReportsList.tsx";
const C21_FILES = [C21_INFORMES_MODULE, C21_INFORMES_LIST] as const;
// C22 (clinic Tokens, Logística module/hub/three routes, Operaciones); Perfil has no collection.
const C22_TOKENS = "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx";
const C22_LOGISTICS_MODULE = "frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx";
const C22_LOGISTICS_RECENT = "frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx";
const C22_LOGISTICS_HUB = "frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx";
const C22_OPERATIONS = "frontend/src/app/dashboard/ClinicCommandCenter.tsx";
const C22_LOGISTICS_ROUTES = [
  "frontend/src/app/dashboard/logistica/metricas/page.tsx",
  "frontend/src/app/dashboard/logistica/rutas/page.tsx",
  "frontend/src/app/dashboard/logistica/visitas/page.tsx",
] as const;
const C22_C01_FILES = [C22_TOKENS, C22_LOGISTICS_MODULE, C22_LOGISTICS_RECENT, C22_OPERATIONS, ...C22_LOGISTICS_ROUTES] as const;
const C22_C03_FILES = [C22_TOKENS, C22_LOGISTICS_MODULE, C22_LOGISTICS_HUB, C22_OPERATIONS] as const;
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

  // C17 adds Informes, C18 Tokens and Clínicas, C19 Usuarios, Sesiones and Intentos fallidos, C20 Precios, Mantenimiento and Estado, C21 clinic Informes, C22 the rest of the clinic surface; the three Auditoría consumers remain exact.
  const consumers = sourceFiles("frontend/src").filter(
    (path) => path !== C01_TABLE && /<(CollectionWorkspace|CollectionHeader|ContentList|ContentListItem)\b/.test(read(path)),
  );
  assert.deepEqual(consumers.sort(), [C01_AUDIT_CARD, C01_AUDIT_TABLE, C01_AUDIT_MOBILE, "frontend/src/app/dashboard/admin/AdminReportsCard.tsx", "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx", "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx", ...C19_CARDS, ...C20_C01_FILES, ...C21_FILES, ...C22_C01_FILES].sort());
  for (const path of sourceFiles("frontend/src")) {
    const source = read(path);
    // C02 landed CollectionPager, C04 aria-sort, C06 useCollectionSelection and C07 SelectionToolbar; their fences live in their blocks below.
    for (const later of ["CollectionEmptyState"]) {
      assert.equal(source.includes(later), false, `${path}: ${later} belongs to C03+`);
    }
  }
});

const C02_OWNER = "frontend/src/components/dashboard/DashboardPager.tsx";
const C02_COMPACT_ADAPTER = "frontend/src/components/dashboard/CompactPager.tsx";
const C02_NAVIGATION_BARREL = "frontend/src/features/dashboard/presentation/navigation/index.ts";
// C22 moved the last two centered consumers to the owner; the adapter stays for the legacy surface.
const C02_CENTERED_CONSUMERS = [] as const;
// C20 moved the last two compact consumers to the owner; the adapter stays for the legacy surface.
const C02_COMPACT_CONSUMERS = [] as const;
const C20_C02_CONSUMERS = [
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
  assert.deepEqual(
    census(/<CollectionPager\b/),
    [
      C02_COMPACT_ADAPTER,
      C02_OWNER,
      "frontend/src/app/dashboard/admin/AdminReportsCard.tsx",
      ...C20_C02_CONSUMERS,
      C21_INFORMES_LIST,
      C22_LOGISTICS_MODULE,
      C22_LOGISTICS_RECENT,
      ...C22_LOGISTICS_ROUTES,
    ].sort(),
    "C17 (Informes), C20 (Precios, Mantenimiento), C21 (clinic Informes full route) and C22 (logistics) are the migrated product consumers",
  );
  // C22: the client lists keep the centered variant the adapter pinned; the URL-paged routes keep their pinned controls in its slots.
  for (const path of [C22_LOGISTICS_MODULE, C22_LOGISTICS_RECENT]) {
    assert.match(read(path), /<CollectionPager\n\s+variant="centered"/, path);
    assert.ok(read(path).includes("usePagedRows"), `${path}: client pagination stays with usePagedRows`);
  }
  for (const path of C22_LOGISTICS_ROUTES) {
    const source = read(path);
    assert.match(source, /<CollectionPager\n\s+variant="centered"\n\s+aria-label="Paginación de [^"]+"\n\s+className="shrink-0 border-t border-vetneb-line\/70"\n\s+prevControl=\{/, path);
    assert.ok(source.includes('className="dashboard-pagination-context inline-block"'), `${path}: the page state keeps its 4.5rem box`);
    assert.equal(/<nav\b|DASHBOARD_TOUCH_PAGER_RESERVATION|usePagedRows/.test(source), false, `${path}: the owner holds the region; paging stays in the URL`);
  }
  for (const path of C20_C02_CONSUMERS) {
    assert.match(read(path), /<CollectionPager\n\s+variant="compact"/, `${path}: C20 keeps the variant the adapter pinned`);
  }
  // C21: the server-adaptive full route keeps its pinned controls in the centered slots; the module pager is not migrated (CMP-12).
  assert.match(read(C21_INFORMES_LIST), /<CollectionPager\n\s+variant="centered"\n\s+aria-label="Paginación de informes"/);
  assert.equal(read(C21_INFORMES_MODULE).includes("<CollectionPager"), false);
  for (const path of [...C02_CENTERED_CONSUMERS, ...C02_COMPACT_CONSUMERS, ...C20_C02_CONSUMERS]) {
    assert.ok(read(path).includes("usePagedRows"), `${path}: client pagination stays with usePagedRows`);
  }
  assert.ok(read("frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx").includes(
    "useDashboardCanvasCapacity({\n    canvasNode,\n    fallbackItems: 3,\n    minItems: 1,\n    maxItems: 12,\n  });",
  ));

  for (const path of sourceFiles("frontend/src")) {
    const source = read(path);
    // aria-sort is fenced to its C04 adopter in the C04 block below, BulkActionMenu to its owner in the C09 block.
    for (const later of ["CollectionEmptyState"]) {
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
    "--dash-row-pitch-compact: 40px;",
    "--dash-row-pitch-regular: 44px;",
    "--dash-table-head-h: 32px;",
  ]) {
    assert.ok(css.includes(frozen), `${frozen} stays at its C05 value`);
  }
  assert.equal(/--dash-collection-pager|--dash-collection-row/.test(css), false, "C02 adds no geometry token");
});

const C03_OWNER = "frontend/src/components/dashboard/EmptyState.tsx";
const C03_ERROR_ADAPTER = "frontend/src/components/dashboard/ErrorState.tsx";
const C03_LOADING_ADAPTER = "frontend/src/components/dashboard/LoadingState.tsx";
// C22 moved the last product consumers to the owner.
const C03_EMPTY_CONSUMERS = [
  // C13: DetailsEmptyState reuses the C03 empty grammar inside the details pane.
  "frontend/src/features/dashboard/presentation/details/DetailsEmptyState.tsx",
] as const;
// C21 moved the last product consumer to the owner; the adapter stays for the legacy surface.
const C03_ERROR_CONSUMERS = [] as const;
const C03_LOADING_CONSUMERS = [
  // Pending destination while a full route waits for the `/dashboard` commit.
  "frontend/src/components/dashboard/ClinicFullRouteModuleStage.tsx",
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
    [
      C03_ERROR_ADAPTER,
      C03_LOADING_ADAPTER,
      C03_OWNER,
      "frontend/src/app/dashboard/admin/AdminReportsCard.tsx",
      "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx",
      "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx",
      C01_AUDIT_TABLE,
      C01_AUDIT_MOBILE,
      ...C19_CARDS,
      ...C20_C01_FILES,
      ...C21_FILES,
      ...C22_C03_FILES,
    ].sort(),
    "C17 (Informes), C18 (Tokens, Clínicas, Auditoría), C19 (Usuarios, Sesiones, Intentos fallidos), C20 (Precios, Mantenimiento, Estado) and C21 (clinic Informes) are the migrated product consumers",
  );
  for (const owner of [C01_TABLE, C02_OWNER]) {
    assert.equal(/CollectionState|EmptyState|ErrorState|LoadingState/.test(stripComments(read(owner))), false, owner);
  }

  for (const path of sourceFiles("frontend/src")) {
    const source = read(path);
    // aria-sort is fenced to its C04 adopter in the C04 block below, BulkActionMenu to its owner in the C09 block.
    for (const later of ["CollectionEmptyState"]) {
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
    "--dash-row-pitch-compact: 40px;",
    "--dash-row-pitch-regular: 44px;",
    "--dash-table-head-h: 32px;",
  ]) {
    assert.ok(css.includes(frozen), `${frozen} stays at its C05 value`);
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

  // The C09 bulk menu imports the ID type from the owner module and never calls the hook: pinned in the C09 block.
  const consumers = sourceFiles("frontend/src").filter(
    (path) => path !== C06_OWNER && path !== C01_SURFACES_BARREL && path !== C09_OWNER && read(path).includes("useCollectionSelection"),
  );
  assert.deepEqual(consumers, [C01_AUDIT_CARD, "frontend/src/app/dashboard/admin/AdminReportsCard.tsx"], "C17 adds only the reports selection owner");
  const selectionProps = sourceFiles("frontend/src").filter((path) => read(path).includes("CollectionSelection<"));
  assert.deepEqual(selectionProps.sort(), [C01_AUDIT_MOBILE, C01_AUDIT_TABLE, C06_OWNER, "frontend/src/app/dashboard/admin/AdminReportsCard.tsx"].sort());

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
  for (const forbidden of ["index", "aria-selected", "aria-checked", "onKeyDown", "stopPropagation"]) {
    assert.equal(mobile.includes(forbidden), false, `mobile list must not own ${forbidden}`);
  }
  // C07 hands clearSelection to the SelectionToolbar only; its wiring is pinned by the C07 block.
  assert.equal((mobile.match(/clearSelection/g) ?? []).length, 1, "the mobile list never clears the selection itself");

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

test("C06 · row geometry stays at its C05 value around the selection owner; C04, C08 and C09 are fenced in their own blocks", () => {
  // aria-sort is fenced to its C04 adopter, the menu primitives to their C08 owner and
  // BulkActionMenu to its C09 owner, each in its block below.
  const css = readDashboardCssSource();
  for (const frozen of [
    "--dash-row-pitch-compact: 40px;",
    "--dash-row-pitch-regular: 44px;",
    "--dash-table-head-h: 32px;",
    "--dash-pagination-h: clamp(2.25rem, 4vh, 2.75rem);",
  ]) {
    assert.ok(css.includes(frozen), `${frozen} stays at its C05 value`);
  }
  assert.equal(/data-collection-selection|\[data-state="?selected|--dash-selection|--dash-collection-row/.test(css), false,
    "C06 adds no CSS: the row skin already styles data-state=selected");
  assert.ok(read(C01_TABLE).includes("data-[state=selected]:bg-vetneb-teal/10"), "the existing TableRow skin is the selected affordance");
});

const C07_OWNER = "frontend/src/features/dashboard/presentation/surfaces/SelectionToolbar.tsx";
const C07_FILTER_BAR = "frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx";
const C07_WIRING = "<SelectionToolbar selectedCount={selection.selectedCount} onClearSelection={selection.clearSelection}>";
const C07_STRIP_SLOT = "{props.renderToolbar ? props.renderToolbar(defaultToolbar) : defaultToolbar}";

/**
 * Swap wiring Auditoría must keep, on the C06 owner. Mobile: inside the strip,
 * after the page selector and Filtros. Desktop/tablet (space pass): the
 * "Registro operativo" header is retired, so the card hands the toolbar to the
 * table header row, where it paints beside the page selector.
 */
function c07AdopterViolations(card: string, mobile: string, filterBar: string, table: string): string[] {
  const violations: string[] = [];
  const desktop = stripComments(card);
  if ((desktop.match(/<SelectionToolbar\b/g) ?? []).length !== 1 || !desktop.includes(C07_WIRING)) violations.push("desktop wiring");
  const slot = desktop.slice(desktop.indexOf("selectionToolbar={"), desktop.indexOf("</SelectionToolbar>"));
  if (!desktop.includes("selectionToolbar={") || !slot.includes('data-audit-selection-toolbar-host="true"')
    || !slot.includes(`${C07_WIRING}\n                {null}`)) {
    violations.push("desktop toolbar is not handed to the table header slot");
  }
  if (!slot.includes("absolute inset-y-0 left-9 right-0")) violations.push("the desktop host must overlay the header row, not reserve height");
  for (const retired of ["admin-audit-register-title", 'data-dashboard-b14-metrics="admin-audit"', "coincidencias"]) {
    if (desktop.includes(retired)) violations.push(`retired desktop header element is back: ${retired}`);
  }
  const headerRow = stripComments(table);
  const selectorCell = headerRow.slice(headerRow.indexOf('<TableHead className="w-9">'), headerRow.indexOf("</TableHead>"));
  if (!selectorCell.includes('data-collection-selection="page"') || !selectorCell.includes("{selectionToolbar}")) {
    violations.push("the table must paint the toolbar inside the page selector header cell");
  }

  const list = stripComments(mobile);
  if ((list.match(/<SelectionToolbar\b/g) ?? []).length !== 1
    || !list.includes(`renderToolbar={(defaultToolbar) => (\n          ${C07_WIRING}\n            {defaultToolbar}\n          </SelectionToolbar>`)) {
    violations.push("mobile wiring");
  }

  const bar = stripComments(filterBar);
  const strip = bar.slice(bar.indexOf("export function AdminAuditFilterBar("));
  if ((bar.match(/props\.renderToolbar\b/g) ?? []).length !== 2 || !strip.includes(C07_STRIP_SLOT)) violations.push("strip slot");
  if (strip.indexOf("<FilterForm {...props} />") > strip.indexOf(C07_STRIP_SLOT)) violations.push("the slot must render after, not inside, the S1 form");
  // Pre-C05 mobile space: the strip summary is retired and Filtros sits next to
  // the page selector, so the swap slot now follows both.
  // C18: Filtros is the trigger of the controlled S1 AdvancedFilterSheet.
  const filtros = strip.indexOf("onClick={() => setIsFilterSheetOpen(true)}");
  if (filtros < 0 || strip.indexOf("{props.leadingSlot}") > filtros || filtros > strip.indexOf(C07_STRIP_SLOT)) {
    violations.push("the swap follows the page selector and Filtros in the strip");
  }
  for (const forbidden of ["selection", "SelectionToolbar"]) {
    if (bar.includes(forbidden)) violations.push(`S1 owns ${forbidden}`);
  }
  return violations;
}

test("C07 · SelectionToolbar is the single contextual toolbar owner and publishes through surfaces", () => {
  const owner = read(C07_OWNER);
  assert.ok(owner.startsWith('"use client";\n'), "the toolbar handles clicks: a client boundary of its own");
  assert.equal((owner.match(/export function SelectionToolbar\(/g) ?? []).length, 1);
  const owners = sourceFiles("frontend/src").filter((path) => /function SelectionToolbar\b|\bSelectionToolbar\s*=/.test(read(path)));
  assert.deepEqual(owners, [C07_OWNER], "one contextual toolbar, no per-module duplicate");
  const consumers = sourceFiles("frontend/src").filter((path) => /<SelectionToolbar\b/.test(read(path))).sort();
  assert.deepEqual(consumers, [C01_AUDIT_CARD, C01_AUDIT_MOBILE, "frontend/src/app/dashboard/admin/AdminReportsCard.tsx"].sort(), "C17 adds only the reports toolbar");
  assert.ok(read(C01_SURFACES_BARREL).includes('export { SelectionToolbar, type SelectionToolbarProps } from "./SelectionToolbar";'));
  assert.ok(owner.includes("export type SelectionToolbarProps = {"));
});

test("C07 · the toolbar reads selectedCount and clearSelection only: no state, data, paging, geometry or menus", () => {
  const code = stripComments(read(C07_OWNER));
  const imports = [...code.matchAll(/^import (?:type )?.* from "([^"]+)";$/gm)].map((match) => match[1]);
  assert.deepEqual(imports, ["react", "lucide-react", "@/components/ui/button"]);
  for (const forbidden of [
    "useState", "useEffect", "useReducer", "useMemo", "useCallback", "useCollectionSelection",
    "CollectionSelection", "selectedIds", "fetch(", "@/lib/api", "@/app/", "next/navigation", "Pager", "limit", "offset",
    "aria-sort", "onSort", "BulkActionMenu", "OverflowMenu", "ContextMenu", "ActionMenu", "SubMenu", "aria-haspopup",
    'role="menu', 'role="toolbar"', "tabIndex", "onKeyDown", "style=", "setTimeout", "h-12",
  ]) {
    assert.equal(code.includes(forbidden), false, `SelectionToolbar must not own ${forbidden}`);
  }
  assert.equal((code.match(/\{selectedCount === 0 \? \(\s*children\s*\) : \(/g) ?? []).length, 1, "DefaultToolbar renders unchanged at 0");
  assert.equal((code.match(/onClearSelection\(\);/g) ?? []).length, 1, "the clear control calls the C06 owner as given");
  assert.equal((code.match(/role="group"/g) ?? []).length, 1);
  assert.equal((code.match(/aria-live="polite"/g) ?? []).length, 1, "one persistent live region, never a second one");
  assert.ok(code.includes('{selectedCount === 0 ? "" : count}'), "the live region is mounted at 0 and only its text changes");
  assert.ok(code.indexOf('aria-live="polite"') > code.indexOf("</div>\n      )}"), "the live region sits outside the swapped branch");
  assert.ok(code.includes("-my-0.5 h-11 min-h-11 min-w-11"), "44px touch target below md without growing the host");
  assert.ok(code.includes("if (toolbar?.contains(target)) continue;") && code.includes('if (target.matches(":focus")) break;'),
    "focus falls back to a control that really takes it, never to the toolbar's own button");
  assert.ok(code.includes("onFocusCapture=") && code.includes("onBlurCapture=") &&
    code.includes("document.activeElement === document.body") &&
    code.includes("focusHandoff.current = null") &&
    code.includes("focusCollectionControl(collection, null)"),
  "a host-driven empty selection restores focus only when the removed toolbar held it");
  assert.deepEqual([...code.matchAll(/\b(useLayoutEffect|useRef)\b/g)].map((match) => match[1]),
    ["useLayoutEffect", "useRef", "useRef", "useLayoutEffect"], "only the focus handoff may use hooks");
  assert.ok(code.includes('aria-label="Limpiar selección"') && code.includes('type="button"'));
  assert.equal(/data-selection-toolbar/.test(readDashboardCssSource()), false, "C07 adds no CSS or geometry token");
});

test("C07 · Auditoría swaps its DefaultToolbar in place on the C06 owner, desktop and mobile", () => {
  const card = read(C01_AUDIT_CARD);
  const mobile = read(C01_AUDIT_MOBILE);
  const filterBar = read(C07_FILTER_BAR);
  const table = read(C01_AUDIT_TABLE);
  assert.deepEqual(c07AdopterViolations(card, mobile, filterBar, table), []);

  // In-memory mutations of the adopters must be rejected by the same check.
  const closing = "              </SelectionToolbar>\n            </div>";
  for (const [target, anchor, replacement] of [
    ["card", "selectedCount={selection.selectedCount}", "selectedCount={0}"],
    ["card", "onClearSelection={selection.clearSelection}", "onClearSelection={() => undefined}"],
    ["card", closing, `${closing}\n            <SelectionToolbar selectedCount={0} onClearSelection={() => undefined}>{null}</SelectionToolbar>`],
    ["card", "absolute inset-y-0 left-9 right-0", "flex-none"],
    ["card", 'aria-label="Registro operativo"', 'aria-label="Registro operativo" data-dashboard-b14-metrics="admin-audit"'],
    ["table", "                  {selectionToolbar}\n", ""],
    ["mobile", "selectedCount={selection.selectedCount}", "selectedCount={useCollectionSelection({ visibleIds: [] }).selectedCount}"],
    ["mobile", "            {defaultToolbar}\n", "            {null}\n"],
    ["filterBar", C07_STRIP_SLOT, "{defaultToolbar}"],
  ] as const) {
    const sources: Record<"card" | "mobile" | "filterBar" | "table", string> = { card, mobile, filterBar, table };
    assert.equal(sources[target].split(anchor).length, 2, `unique ${target} anchor: ${anchor}`);
    sources[target] = sources[target].replace(anchor, () => replacement);
    assert.notDeepEqual(
      c07AdopterViolations(sources.card, sources.mobile, sources.filterBar, sources.table),
      [],
      `mutation must be rejected: ${replacement}`,
    );
  }

  // Reverting the pre-C05 order (slot back between the selector and Filtros) is rejected.
  const strip = filterBar.slice(filterBar.indexOf("export function AdminAuditFilterBar("));
  const head = filterBar.slice(0, filterBar.length - strip.length);
  const slotLine = `        ${C07_STRIP_SLOT}\n`;
  const leadingLine = "        {props.leadingSlot}\n";
  assert.equal(strip.split(slotLine).length, 2, "unique strip slot line");
  assert.equal(strip.split(leadingLine).length, 2, "unique leading slot line");
  const reverted = head + strip
    .replace(slotLine, () => "")
    .replace(leadingLine, () => `${leadingLine}${slotLine}`);
  assert.notDeepEqual(c07AdopterViolations(card, mobile, reverted, table), [], "mutation must be rejected: slot before Filtros");
});

const C04_ADOPTER = "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx";
const C04_API = "frontend/src/lib/api.ts";

// C24: the sort has exactly two activation points, one per presentation — the
// TableHead of the list and the grid head of the C24 grid — each asking for
// name then createdAt. Any other call site, key, count or order is a violation.
function c04SortControlPlacement(card: string) {
  const keysIn = (region: string) => [...region.matchAll(/toggleColumnSort\("(\w+)"\)/g)].map((match) => match[1]);
  const headStart = card.indexOf("<CollectionHeader>");
  const headEnd = card.indexOf("</CollectionHeader>", headStart);
  const gridStart = card.indexOf('data-collection-grid-head="true"');
  const gridEnd = card.indexOf("<ContentGrid", gridStart);
  if ([headStart, headEnd, gridStart, gridEnd].includes(-1)) return null;
  return {
    tableHead: keysIn(card.slice(headStart, headEnd)),
    gridHead: keysIn(card.slice(gridStart, gridEnd)),
    elsewhere: keysIn(card.slice(0, Math.min(headStart, gridStart)) + card.slice(Math.max(headEnd, gridEnd))
      + card.slice(Math.min(headEnd, gridEnd), Math.max(headStart, gridStart))),
  };
}

const C04_EXPECTED_PLACEMENT = { tableHead: ["name", "createdAt"], gridHead: ["name", "createdAt"], elsewhere: [] };

test("C04 · aria-sort exists only on the Clínicas admin headers the server sorts, through native buttons", () => {
  const census = sourceFiles("frontend/src").filter((path) => read(path).includes("aria-sort")).sort();
  assert.deepEqual(census, [C04_ADOPTER], "C04 has one adopter; no other surface claims an order (§7.8)");

  const card = stripComments(read(C04_ADOPTER));
  assert.deepEqual(
    [...card.matchAll(/aria-sort=\{([^}]*)\}/g)].map((match) => match[1]),
    ['clinicsAriaSort(appliedSort, "name")', 'clinicsAriaSort(appliedSort, "createdAt")'],
    "aria-sort sits on the two sortable TableHead elements only, derived from the order the rendered rows have",
  );
  assert.equal(/clinicsAriaSort\(requestedSort/.test(card), false, "aria-sort never runs ahead of the rows");
  for (const key of ["name", "createdAt"]) {
    assert.ok(card.includes(`<TableHead aria-sort={clinicsAriaSort(appliedSort, "${key}")}>`), `${key}: aria-sort on the th`);
  }
  assert.deepEqual(c04SortControlPlacement(card), C04_EXPECTED_PLACEMENT,
    "one header control per key in the TableHead and one in the C24 grid head, in name→createdAt order, nowhere else");
  const gridHead = card.slice(card.indexOf('data-collection-grid-head="true"'), card.indexOf("<ContentGrid"));
  assert.deepEqual(
    [...gridHead.matchAll(/ariaSort=\{([^}]*)\}/g)].map((match) => match[1]),
    ['clinicsAriaSort(appliedSort, "name")', 'clinicsAriaSort(appliedSort, "createdAt")'],
    "the grid head reports the applied order, never the requested one",
  );
  assert.deepEqual(gridHead.match(/\bannounceState\b/g), ["announceState", "announceState"], "without a th the grid controls speak their state");
  for (const plain of ["Contacto", "Usuario"]) {
    assert.ok(card.includes(`<TableHead>${plain}</TableHead>`), `${plain} stays a plain header`);
  }
  assert.ok(card.includes('<TableHead className="text-right">Acciones</TableHead>'));
  assert.ok(card.includes('    <button\n      type="button"\n      title={title}\n      onClick={onToggle}'), "native button control");
  assert.equal(/role="button"|tabIndex|onKeyDown/.test(card), false, "keyboard comes from the native button");

  // The sort travels to the server; nothing reorders rows in the client.
  assert.equal(/\.sort\(|toSorted\(|\.reverse\(|toReversed\(|localeCompare/.test(card), false);
  const api = read(C04_API);
  assert.equal((api.match(/query\.set\("sort", /g) ?? []).length, 1, "only the clinics client sends an order");
  assert.equal((api.match(/query\.set\("direction", /g) ?? []).length, 1);

  // C05 geometry and the A03 capacity owner stay frozen.
  assert.ok(card.includes('<Table className="text-[0.8125rem] [&_th]:h-9 [&_th]:px-3 [&_td]:px-3">'));
  assert.ok(card.includes("const CLINICS_TABLE_HEADER_PX = 36;"));
  assert.ok(card.includes("const effectiveLimit = rowsPerPage;"));
  assert.equal(/sort/i.test(card.slice(card.indexOf("const mobileCapacity ="), card.indexOf("const effectiveLimit ="))), false,
    "the capacity owner never reads the order");
});

test("C04 · the sort placement check rejects a third call, a wrong key, a removal and a reorder (in-memory mutation proof)", () => {
  const card = stripComments(read(C04_ADOPTER));
  assert.deepEqual(c04SortControlPlacement(card), C04_EXPECTED_PLACEMENT, "baseline");
  const tableName = '<TableHead aria-sort={clinicsAriaSort(appliedSort, "name")}>\n                  <ClinicsSortHeaderButton\n                    label="Clínica"\n                    title="Ordenar por nombre de clínica"\n                    ariaSort={clinicsAriaSort(appliedSort, "name")}\n                    onToggle={() => toggleColumnSort("name")}';
  const gridHeadStart = card.indexOf('data-collection-grid-head="true"');
  const gridName = card.indexOf('onToggle={() => toggleColumnSort("name")}', gridHeadStart);
  const gridCreated = card.indexOf('onToggle={() => toggleColumnSort("createdAt")}', gridHeadStart);
  assert.ok(card.split(tableName).length === 2 && gridName > gridHeadStart && gridCreated > gridName, "unique mutation anchors");
  const at = (index: number, from: string, to: string) => card.slice(0, index) + to + card.slice(index + from.length);
  const mutants: readonly [string, string][] = [
    ["third call outside both heads", card.replace("const effectiveLimit = rowsPerPage;", 'const effectiveLimit = rowsPerPage; void (() => toggleColumnSort("name"));')],
    ["third call inside the grid head", at(gridCreated, 'onToggle={() => toggleColumnSort("createdAt")}', 'onToggle={() => { toggleColumnSort("createdAt"); toggleColumnSort("name"); }}')],
    ["wrong key in the table head", card.replace(tableName, tableName.replace('toggleColumnSort("name")', 'toggleColumnSort("createdAt")'))],
    ["wrong key in the grid head", at(gridName, 'onToggle={() => toggleColumnSort("name")}', 'onToggle={() => toggleColumnSort("createdAt")}')],
    ["grid head control removed", at(gridCreated, 'onToggle={() => toggleColumnSort("createdAt")}', "onToggle={() => undefined}")],
    ["table head control removed", card.replace(tableName, tableName.replace('toggleColumnSort("name")', "undefined"))],
    ["grid head order reversed", at(gridName, 'onToggle={() => toggleColumnSort("name")}', 'onToggle={() => toggleColumnSort("createdAt")}')
      .replace(/(data-collection-grid-head="true"[\s\S]*?)onToggle=\{\(\) => toggleColumnSort\("createdAt"\)\}([\s\S]*?)onToggle=\{\(\) => toggleColumnSort\("createdAt"\)\}/,
        '$1onToggle={() => toggleColumnSort("createdAt")}$2onToggle={() => toggleColumnSort("name")}')],
    ["grid head removed", card.replace('data-collection-grid-head="true"', 'data-collection-grid-strip="true"')],
  ];
  for (const [name, mutated] of mutants) {
    assert.notEqual(mutated, card, `${name}: the mutation applies`);
    assert.notDeepEqual(c04SortControlPlacement(mutated), C04_EXPECTED_PLACEMENT, `${name} must be rejected`);
  }
});

// ── PRE-C05 · mobile space (Nico, pre-C05) ───────────────────────────────────
// Below md the admin modules give their internal descriptors/summaries back to
// the collection; elements marked to move are MOVED (one instance, same
// handler). Row pitch stays frozen above ("stays frozen until C05/A07").

const PRE_C05_REPORTS = "frontend/src/app/dashboard/admin/AdminReportsCard.tsx";
const PRE_C05_CLINICS = "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx";
const PRE_C05_SESSIONS = "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx";

function preC05Between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  assert.ok(from !== -1, `missing ${start}`);
  const to = source.indexOf(end, from);
  assert.ok(to !== -1, `missing ${end}`);
  return source.slice(from, to);
}

test("PRE-C05 · Informes: page count retired everywhere, descriptor retired, Filtros moved into the header", () => {
  const card = stripComments(read(PRE_C05_REPORTS));
  assert.equal(/en página/.test(card), false, '"N en página" is retired at every breakpoint');

  const header = preC05Between(card, "<CardHeader", "</CardHeader>");
  // Desktop/tablet space pass: the descriptor is retired from md up too, and
  // the actions own the band there (right-aligned above the filters).
  assert.equal(card.includes("Cola administrativa, trazabilidad y documentos en una sola vista."), false, "the descriptor is retired at every width");
  assert.equal(card.includes("<CardTitle"), false, "no internal Informes title survives");
  assert.ok(header.startsWith('<CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-vetneb-line/70 px-4 py-3 md:py-0">'),
    "the desktop search occupies the leading band and actions stay trailing");
  assert.equal((card.match(/title="Filtrar informes"/g) ?? []).length, 1, "one controlled mobile filter sheet");
  assert.ok(
    header.includes('<div className="min-w-0 md:hidden">') && header.includes('onClick={() => setIsFilterSheetOpen(true)}'),
    "Filtros takes the freed header slot below md and opens the sheet",
  );
  const filtros = header.indexOf('onClick={() => setIsFilterSheetOpen(true)}');
  const refresh = header.indexOf("onClick={() => void loadReports()}");
  const upload = header.indexOf("onClick={() => setIsUploadOpen(true)}");
  assert.ok(filtros !== -1 && refresh > filtros && upload > refresh, "Filtros | Actualizar | Subir informe: the upload keeps the trailing slot");
  assert.ok(card.includes('<AdvancedFilterSheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen} title="Filtrar informes">') && card.includes("{renderAdvancedFilterForm(true)}"), "the mobile sheet still hosts the same filter form");
  assert.equal(card.includes("data-admin-reports-toolbar"), false, "the entregados · con tinción · página strip is retired at every width");
  assert.equal(/entregados|con tinción|Página \$\{page\}|por página/.test(card), false, "no summary or page-state text is painted");
});

test("PRE-C05 · Clínicas: descriptor retired, actions above the mobile search, search right below them", () => {
  const card = stripComments(read(PRE_C05_CLINICS));
  const header = preC05Between(card, "<CardHeader", "</CardHeader>");
  // Desktop/tablet space pass: the descriptor is retired from md up too and the
  // whole header band is mobile-only; >=md actions live in the search row.
  assert.equal(card.includes("Administración de clínicas registradas · alto volumen."), false, "the descriptor is retired at every width");
  assert.equal(card.includes("<CardTitle"), false, "no internal Clínicas title survives");
  assert.ok(card.includes('<CardHeader className="shrink-0 flex flex-col gap-2 border-b border-vetneb-line/70 px-4 py-2 md:hidden">'),
    "the header band (actions + mobile search) only paints below md");
  const create = header.indexOf("onClick={() => setIsCreateOpen(true)}");
  const refresh = header.indexOf("onClick={() => loadClinics()}");
  const search = header.indexOf('placeholder="Buscar clínica..."');
  assert.ok(create !== -1 && refresh > create && search > refresh, "Nueva clínica and Actualizar stay above the mobile search");
  assert.equal((card.match(/placeholder="Buscar clínica\.\.\."/g) ?? []).length, 1, "the mobile search moved, not duplicated");
  assert.ok(header.includes('<div className="relative max-w-xs shrink-0 md:hidden" role="search" aria-label="Buscar clínicas">'), "the named mobile search sits in the header below md only");
  assert.ok(
    header.includes('<div className="mb-0 flex flex-wrap items-center gap-2">'),
    "the actions row cancels the header space-y margin",
  );
});

test("PRE-C05 · Sesiones mobile: summary retired, Tipo and Estado left of Actualizar in one band", () => {
  const card = stripComments(read(PRE_C05_SESSIONS));
  // The desktop/tablet half is pinned by dashboard-admin-desktop-tablet-space.test.ts.
  assert.equal(card.includes("Sesiones activas y expiradas"), false, "the desktop header is retired by the space pass");
  const mobile = card.slice(card.indexOf('data-admin-mobile-ops-module="sessions"'));
  assert.equal(mobile.includes("Activas y expiradas"), false, "the mobile summary subtitle is retired");
  assert.equal(/\$\{snapshot\.total\} sesiones/.test(mobile), false, 'the mobile "N sesiones" count is retired');
  assert.equal(mobile.includes("grid min-h-12 shrink-0 grid-cols-2"), false, "the separate filter band is gone");

  const header = preC05Between(mobile, "<header", "</header>");
  const tipo = header.indexOf("Tipo\n            <select");
  const estado = header.indexOf("Estado\n            <select");
  const refresh = header.indexOf("onClick={loadSessions}");
  assert.ok(tipo !== -1 && estado > tipo && refresh > estado, "[Tipo] [Estado] [Actualizar]");
  assert.ok(header.includes('<p className="sr-only" role="alert">'), "a load error is still announced");
  for (const handler of [
    'setSessionType(event.target.value as AdminSessionType | "all");',
    'setStatus(event.target.value as AdminSessionStatus | "all");',
  ]) {
    assert.equal(header.split(handler).length, 2, `${handler} moved with its select`);
  }
});

const C08_OWNER = "frontend/src/features/dashboard/presentation/surfaces/ActionMenu.tsx";
const C08_PRIMITIVES = ["OverflowMenu", "ContextMenu", "ActionMenu", "SubMenu"] as const;
/** C11 overflow of active filters: composes ActionMenu only; the other three names stay out of it. */
const C11_OVERFLOW = "frontend/src/features/dashboard/presentation/filters/FilterOverflow.tsx";
const C08_BARREL_EXPORT = [
  "export {",
  "  ActionMenu,",
  "  ActionMenuItem,",
  "  ContextMenu,",
  "  OverflowMenu,",
  "  SubMenu,",
  "  type ActionMenuItemProps,",
  "  type ActionMenuProps,",
  "  type ContextMenuProps,",
  "  type ContextMenuRegionProps,",
  "  type OverflowMenuProps,",
  "  type SubMenuProps,",
  '} from "./ActionMenu";',
].join("\n");

/** Behaviour the menu owner must keep; each entry is removed by a mutation below. */
function c08OwnerViolations(source: string): string[] {
  const code = stripComments(source);
  const violations: string[] = [];
  const count = (needle: string) => code.split(needle).length - 1;
  for (const [needle, expected, claim] of [
    ['role="menu"', 1, "one menu surface implementation"],
    ['role="menuitem"', 2, "one action item and one submenu item"],
    ['aria-orientation="vertical"', 1, "vertical menu"],
    ['aria-haspopup="menu"', 2, "the trigger and the submenu item announce their popup"],
    ["aria-expanded={open}", 2, "the trigger and the submenu item expose their state"],
    ['aria-disabled={disabled ? "true" : undefined}', 2, "disabled items stay focusable and announced"],
    ["if (disabled) return;", 2, "a disabled item never runs its action or opens its submenu"],
    ["onFocus={() => level.setOpenChild((current) => (current === id ? current : null))}", 1, "focusing a submenu item closes its siblings, never itself"],
    ["onFocus={() => level.setOpenChild(null)}", 1, "focusing an action item closes any open submenu"],
    ["root.closeAll(true);\n    onSelect();", 1, "selecting closes every level, restores focus, then acts once"],
    ['document.addEventListener("pointerdown", dismissOutside, true);', 1, "one outside-click listener per open root"],
    ['document.removeEventListener("pointerdown", dismissOutside, true);', 1, "the outside-click listener is released"],
    ['case "Escape":', 1, "Escape closes the current level"],
    ['case "ArrowDown":', 2, "ArrowDown moves in the menu and opens it from the trigger"],
    ['case "ArrowUp":', 2, "ArrowUp moves in the menu and opens it from the trigger"],
    ['case "Home":', 1, "Home"],
    ['case "End":', 1, "End"],
    ['case "Tab":', 1, "Tab closes the menu without trapping focus"],
    ['event.key === "ArrowRight"', 1, "ArrowRight opens a submenu"],
    ['case "ArrowLeft":', 1, "ArrowLeft closes a submenu"],
    ['event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")', 1, "the context menu opens from the keyboard"],
    ["restoreTarget.current?.focus({ preventScroll: true });", 1, "focus returns to where the menu was opened from"],
    ["h-12 md:h-8", 1, "item: 48px touch below md, 32px from md (audit §46)"],
    ["min-w-[200px] max-w-[calc(100vw-1rem)]", 1, "surface: min 200px, never wider than the viewport"],
    ["fixed left-0 top-0 z-50 transition-none ", 1, "surface: fixed, with no transition that could delay placement"],
    ["visibility", 0, "the surface is never hidden: a hidden ancestor makes its items unfocusable while they transition"],
    ["invisible", 0, "the surface is never hidden"],
    ["shadow-[var(--clinical-shadow-md)]", 1, "surface: elevation 2, the recipe --dash-elevation-menu aliases"],
    ["if (!enabled || keepsNativeMenu(event.target)) return;", 2, "pointer and keyboard both yield to the browser menu"],
    ["return Boolean(element && (selectionCovers(element) || element.closest(NATIVE_MENU_TARGETS)));", 1, "selected text and editable fields keep the browser menu"],
    ["function selectionCovers(element: Element) {\n  const selection = window.getSelection();\n  if (!selection?.toString()) return false;\n  for (let index = 0; index < selection.rangeCount; index += 1) {\n    if (selection.getRangeAt(index).intersectsNode(element)) return true;\n  }\n  return false;\n}", 1, "only a selection that reaches the target keeps the browser menu, never one elsewhere in the document"],
    [`const NATIVE_MENU_TARGETS = 'input, textarea, select, [contenteditable="true"]';`, 1, "editable targets"],
    ["Math.max(VIEWPORT_MARGIN, Math.min(", 2, "the surface is clamped inside the viewport on both axes"],
    // The onContextMenu exemption in frontend-visual-consistency covers this whole file, so the
    // exempted surface is pinned here: three sites, eight cancellations, no native listener.
    ["onContextMenu", 3, "the region type, the region handler and the surface: no other context menu site"],
    ["onContextMenu={(event) => event.stopPropagation()}", 1, "the surface keeps the browser menu on itself"],
    ["onContextMenu(event) {\n      if (!enabled || keepsNativeMenu(event.target)) return;\n      event.preventDefault();", 1, "the region yields before it cancels"],
    ["function keepsNativeMenu(target: EventTarget | null) {\n  const element = target instanceof Element ? target : null;\n  return Boolean(", 1, "the yield rule has no earlier exit"],
    ["preventDefault(", 8, "no cancellation beyond the menu keys and the two region openers"],
    ["contextmenu", 0, "no native contextmenu listener or property"],
    ["addEventListener(", 3, "pointerdown, resize and scroll only"],
  ] as const) {
    if (count(needle) !== expected) violations.push(`${claim}: ${needle} ×${count(needle)}, expected ×${expected}`);
  }
  return violations;
}

test("C08 · ActionMenu.tsx is the single menu owner and publishes the four primitives through surfaces", () => {
  const owner = read(C08_OWNER);
  assert.ok(owner.startsWith('"use client";\n'), "menus handle input: a client boundary of their own");
  for (const name of [...C08_PRIMITIVES, "ActionMenuItem"]) {
    assert.equal((owner.match(new RegExp(`export function ${name}\\(`, "g")) ?? []).length, 1, name);
    assert.ok(owner.includes(`export type ${name}Props = `), `${name}Props`);
  }
  const files = sourceFiles("frontend/src");
  const owners = files.filter((path) => /function (?:OverflowMenu|ContextMenu|ActionMenu|SubMenu|ActionMenuItem)\b|role="menu(?:item)?"/.test(read(path)));
  assert.deepEqual(owners, [C08_OWNER], "one menu implementation, no per-module duplicate");
  assert.ok(read(C01_SURFACES_BARREL).includes(C08_BARREL_EXPORT), "published through presentation/surfaces");
  // frontend-visual-consistency exempts this one file from its onContextMenu ban; nothing else may take the browser menu.
  assert.deepEqual(files.filter((path) => /oncontextmenu/i.test(read(path))), [C08_OWNER], "one context menu owner");

  // C17 adopts ActionMenu in Informes; all other product modules remain fenced.
  for (const path of files) {
    const source = read(path);
    if (path === C08_OWNER || path === C01_SURFACES_BARREL || path === C09_OWNER) continue;
    for (const name of C08_PRIMITIVES) {
      if (path === C11_OVERFLOW && name === "ActionMenu") continue;
      if (path === "frontend/src/app/dashboard/admin/AdminReportsCard.tsx" && name === "ActionMenu") continue;
      assert.equal(new RegExp(`\\b${name}\\b`).test(source), false, `${path}: ${name} is not adopted before C17+`);
    }
  }
});

test("C08 · the menu owner is presentation only: no data, navigation, selection, paging, capacity or CSS", () => {
  const source = read(C08_OWNER);
  const code = stripComments(source);
  const imports = [...code.matchAll(/^import (?:type )?(?:[\s\S]*?) from "([^"]+)";$/gm)].map((match) => match[1]);
  assert.deepEqual(imports, ["react", "react-dom", "lucide-react", "@/components/ui/button", "@/lib/utils"]);
  for (const forbidden of [
    "fetch(", "@/lib/api", "@/app/", "next/", "<a ", "router", "history.", "location.", "useCollectionSelection",
    "CollectionSelection", "selectedIds", "selectedCount", "SelectionToolbar", "Pager", "limit", "offset", "aria-sort",
    "onSort", "ResizeObserver", "MutationObserver", "useDashboardCanvasCapacity", "computeCapacity", "setTimeout",
    "setInterval", "localStorage", "sessionStorage", "overflow-auto", "overflow-y-auto", "overflow-scroll", "style={",
    "dangerouslySetInnerHTML", 'role="dialog"', "aria-modal",
  ]) {
    assert.equal(code.includes(forbidden), false, `the menu owner must not own ${forbidden}`);
  }
  assert.deepEqual(c08OwnerViolations(source), []);

  const css = readDashboardCssSource();
  assert.equal(/data-action-menu|data-context-menu|role="?menu/.test(css), false, "C08 adds no CSS or geometry token");
  for (const frozen of [
    "--dash-row-pitch-compact: 40px;",
    "--dash-row-pitch-regular: 44px;",
    "--dash-table-head-h: 32px;",
    "--dash-pagination-h: clamp(2.25rem, 4vh, 2.75rem);",
    "--dash-elevation-menu: var(--clinical-shadow-md);",
  ]) {
    assert.ok(css.includes(frozen), `${frozen} stays frozen`);
  }
  for (const neighbour of [C06_OWNER, C07_OWNER, C02_OWNER, C03_OWNER, C01_TABLE]) {
    assert.equal(/\b(?:OverflowMenu|ContextMenu|ActionMenu|SubMenu)\b/.test(stripComments(read(neighbour))), false, `${neighbour} owns no menu`);
  }
});

test("C08 · mutations of the menu owner are rejected", () => {
  const source = read(C08_OWNER);
  for (const [anchor, replacement] of [
    ["h-12 md:h-8", "h-10"],
    ["min-w-[200px] max-w-[calc(100vw-1rem)]", "min-w-[200px]"],
    ["z-50 transition-none ", "z-50 "],
    ["(current) => (current === id ? current : null)", "null"],
    ["root.closeAll(true);\n    onSelect();", "onSelect();\n    onSelect();"],
    ['aria-orientation="vertical"', ""],
    ['      case "Escape":', '      case "F24":'],
    ['      case "Tab":', '      case "F23":'],
    ['      case "ArrowLeft":', '      case "F22":'],
    ['event.key === "ArrowRight"', 'event.key === "F21"'],
    ['event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")', 'event.key === "ContextMenu"'],
    ['document.removeEventListener("pointerdown", dismissOutside, true);', ""],
    ["restoreTarget.current?.focus({ preventScroll: true });", ""],
    ["shadow-[var(--clinical-shadow-md)]", "shadow-lg"],
    ["selectionCovers(element) || ", ""],
    ["if (selection.getRangeAt(index).intersectsNode(element)) return true;", "return true;"],
    ["  if (!selection?.toString()) return false;\n", ""],
    ['input, textarea, select, [contenteditable="true"]', "input"],
    ['data-action-menu-trigger="true"', 'data-action-menu-trigger="true" onContextMenu={(event) => event.preventDefault()}'],
    ["onContextMenu={(event) => event.stopPropagation()}", "onContextMenu={(event) => event.preventDefault()}"],
    ["  return Boolean(element", "  if (element) return false;\n  return Boolean(element"],
    ["onContextMenu(event) {\n", "onContextMenu(event) {\n      event.preventDefault();\n"],
    ["const VIEWPORT_MARGIN = 8;", 'document.addEventListener("contextmenu", (event) => event.preventDefault());'],
    ["const TRIGGER_GAP = 4;", "document.oncontextmenu = () => false;"],
    ["const SURFACE_PADDING = 8;", 'document.addEventListener("copy", (event) => event.stopPropagation());'],
  ] as const) {
    assert.equal(source.split(anchor).length, 2, `unique owner anchor: ${anchor}`);
    assert.notDeepEqual(c08OwnerViolations(source.replace(anchor, () => replacement)), [], `mutation must be rejected: ${replacement || `without ${anchor}`}`);
  }
  for (const anchor of ["if (disabled) return;", 'aria-disabled={disabled ? "true" : undefined}', " || keepsNativeMenu(event.target)"]) {
    assert.equal(source.split(anchor).length, 3, `item and submenu both keep: ${anchor}`);
    assert.notDeepEqual(c08OwnerViolations(source.replace(anchor, () => "")), [], `mutation must be rejected: without ${anchor}`);
  }
});

const C09_OWNER = "frontend/src/features/dashboard/presentation/surfaces/BulkActionMenu.tsx";
const C09_BARREL_EXPORT = 'export { BulkActionMenu, type BulkAction, type BulkActionMenuProps } from "./BulkActionMenu";';
const C09_TOOLBAR_SLOT = '<span className="hidden sm:inline">Limpiar</span>\n          </Button>\n          {actions}\n        </div>';

/** Behaviour the bulk menu must keep; each entry is removed by a mutation below. */
function c09OwnerViolations(source: string): string[] {
  const code = stripComments(source);
  const violations: string[] = [];
  const count = (needle: string) => code.split(needle).length - 1;
  for (const [needle, expected, claim] of [
    ["if (selectedIds.length === 0 || actions.length === 0) return null;", 1, "no menu without a selection or without actions"],
    ["<ActionMenu\n", 1, "one C08 menu, never a second surface"],
    ["<ActionMenuItem\n", 1, "one C08 item per action"],
    ["unavailableReason(action, selectedIds.length, pending)", 1, "availability reads the whole selection, on and off the page"],
    ["disabled={reason !== null}", 1, "an unavailable action is a disabled, announced item"],
    ["if (reason === null) action.onSelect([...selectedIds]);", 1, "an unavailable action never runs; an available one gets a copy of every selected ID"],
    ["onSelect(", 1, "the host callback has one call site"],
    ['if (pending) return "Acción en curso";', 1, "nothing runs while the host reports a bulk action in flight"],
    ['if (action.destructive && !action.confirmsBeforeRunning) return "Requiere confirmación";', 1, "a destructive action without a host confirmation stays disabled"],
    ["confirmsBeforeRunning: boolean;", 1, "a destructive action has to declare its confirmation"],
    ['if (action.requires === "single" && selectedCount !== 1) return "Sólo un elemento";', 1, "single-item actions are disabled on a multiple selection"],
    ["return action.disabledReason || null;", 1, "the host reason disables the action"],
    ['{reason === null ? null : <span data-bulk-action-reason="true"> · {reason}</span>}', 1, "the reason is visible and part of the item name"],
    ["label={label}", 1, "the trigger keeps its name when it is icon-only"],
    ['<span className="hidden sm:inline">{label}</span>', 1, "icon-only trigger below sm, like the clear control"],
    ['triggerClassName="-my-0.5 shrink-0 px-2.5 md:my-0"', 1, "the trigger never grows the host band"],
  ] as const) {
    if (count(needle) !== expected) violations.push(`${claim}: ${needle} ×${count(needle)}, expected ×${expected}`);
  }
  return violations;
}

test("C09 · BulkActionMenu.tsx is the single bulk menu owner, on the C08 menu, published through surfaces", () => {
  const owner = read(C09_OWNER);
  assert.ok(owner.startsWith('"use client";\n'), "it composes client menus: a client boundary of its own");
  for (const declared of ["export function BulkActionMenu<", "export type BulkAction<", "export type BulkActionMenuProps<"]) {
    assert.ok(owner.includes(declared) && owner.indexOf(declared) === owner.lastIndexOf(declared), `declared once: ${declared}`);
  }
  const files = sourceFiles("frontend/src");
  assert.deepEqual(files.filter((path) => /function BulkActionMenu\b|\bBulkActionMenu\s*=/.test(read(path))), [C09_OWNER], "one bulk menu, no per-module duplicate");
  assert.deepEqual(
    files.filter((path) => read(path).includes("BulkAction")).sort(),
    [C09_OWNER, C01_SURFACES_BARREL].sort(),
    "C09 adopts no module: Auditoría is read-only and the real bulk actions arrive with C17+",
  );
  assert.ok(read(C01_SURFACES_BARREL).includes(C09_BARREL_EXPORT), "published through presentation/surfaces");
  assert.ok(read(C01_SURFACES_BARREL).includes(C08_BARREL_EXPORT), "the C08 export is untouched");
});

test("C09 · the bulk menu is presentation only: no selection owner, state, data, surface or keyboard of its own", () => {
  const source = read(C09_OWNER);
  const code = stripComments(source);
  const imports = [...code.matchAll(/^import (?:type )?(?:[\s\S]*?) from "([^"]+)";$/gm)].map((match) => match[1]);
  assert.deepEqual(imports, ["react", "lucide-react", "./ActionMenu", "./useCollectionSelection"]);
  assert.ok(code.includes('import { ActionMenu, ActionMenuItem } from "./ActionMenu";'), "the C08 primitives, not a copy");
  assert.ok(code.includes('import type { CollectionSelectionId } from "./useCollectionSelection";'), "the C06 ID type only, never the hook");
  for (const forbidden of [
    "useState", "useEffect", "useLayoutEffect", "useRef", "useReducer", "useMemo", "useCallback", "useCollectionSelection(",
    "clearSelection", "deselect", "toggle", "selectVisiblePage", "fetch(", "@/lib/api", "@/app/", "next/", "router",
    "Pager", "limit", "offset", "aria-sort", "SelectionToolbar", "OverflowMenu", "ContextMenu", "SubMenu", "createPortal",
    "role=", "tabIndex", "aria-haspopup", "aria-expanded", "onKeyDown", "onClick", "onContextMenu", "addEventListener",
    "document", "window", "confirm(", "Promise", "async ", "await ", "setTimeout", "style=", "overflow-",
  ]) {
    assert.equal(code.includes(forbidden), false, `BulkActionMenu must not own ${forbidden}`);
  }
  assert.deepEqual(c09OwnerViolations(source), []);
  assert.equal(/data-bulk-action/.test(readDashboardCssSource()), false, "C09 adds no CSS or geometry token");
  for (const neighbour of [C06_OWNER, C08_OWNER]) {
    assert.equal(stripComments(read(neighbour)).includes("Bulk"), false, `${neighbour} does not know the bulk menu`);
  }
});

test("C09 · SelectionToolbar hosts the bulk menu through one slot of its existing group; Auditoría is not an adopter", () => {
  const toolbar = stripComments(read(C07_OWNER));
  assert.equal(toolbar.indexOf("{actions}"), toolbar.lastIndexOf("{actions}"), "one slot");
  assert.ok(toolbar.includes(C09_TOOLBAR_SLOT), "the slot closes the selection group, after the clear control: no new band or wrapper");
  assert.ok(toolbar.includes("  actions?: ReactNode;\n"), "an optional node: the toolbar never learns what a bulk action is");
  assert.ok(
    toolbar.includes("export function SelectionToolbar({ selectedCount, onClearSelection, actions, children }: SelectionToolbarProps) {"),
  );
  assert.ok(toolbar.indexOf("{actions}") > toolbar.indexOf("{selectedCount === 0 ? ("), "never rendered beside the DefaultToolbar");
  assert.ok(toolbar.indexOf("{actions}") < toolbar.indexOf('aria-live="polite"'), "inside the swapped branch");
  for (const adopter of [C01_AUDIT_CARD, C01_AUDIT_MOBILE]) {
    assert.equal(/<SelectionToolbar\b[^>]*\bactions=/.test(read(adopter)), false, `${adopter}: read-only collection, no bulk action`);
  }
});

test("C09 · mutations of the bulk menu are rejected", () => {
  const source = read(C09_OWNER);
  for (const [anchor, replacement] of [
    ["if (selectedIds.length === 0 || actions.length === 0) return null;", ""],
    ["selectedIds.length === 0 || ", ""],
    ["unavailableReason(action, selectedIds.length, pending)", "unavailableReason(action, 1, pending)"],
    ["unavailableReason(action, selectedIds.length, pending)", "unavailableReason(action, selectedIds.length, false)"],
    ["disabled={reason !== null}", "disabled={false}"],
    ["if (reason === null) action.onSelect([...selectedIds]);", "action.onSelect([...selectedIds]);"],
    ["action.onSelect([...selectedIds]);", "action.onSelect(selectedIds);"],
    ["action.onSelect([...selectedIds]);", "action.onSelect([...selectedIds]);\n              action.onSelect([...selectedIds]);"],
    ['  if (pending) return "Acción en curso";\n', ""],
    ["action.destructive && !action.confirmsBeforeRunning", "action.destructive && false"],
    ["confirmsBeforeRunning: boolean;", "confirmsBeforeRunning?: boolean;"],
    ['action.requires === "single" && selectedCount !== 1', 'action.requires === "single" && selectedCount === 0'],
    ["return action.disabledReason || null;", "return null;"],
    ['{reason === null ? null : <span data-bulk-action-reason="true"> · {reason}</span>}', ""],
    ["      label={label}\n", ""],
    ['<span className="hidden sm:inline">{label}</span>', "<span>{label}</span>"],
    ['triggerClassName="-my-0.5 shrink-0 px-2.5 md:my-0"', 'triggerClassName="h-12"'],
  ] as const) {
    const mutated = source.replace(anchor, () => replacement);
    assert.notEqual(mutated, source, `the mutation must change the owner: ${anchor}`);
    assert.notDeepEqual(c09OwnerViolations(mutated), [], `mutation must be rejected: ${replacement || `without ${anchor}`}`);
  }
});

// ── C24 · list/grid alternation ──────────────────────────────────────────────
// C24 guard: list/grid alternation only where it adds value (Informes clínica,
// Informes admin, Clínicas admin). The grid is presentation over the SAME
// measured canvas, dataset, limit and pager; Documentos has no collection owner
// and the phone lists stay lists.

const C24_SURFACES = "frontend/src/features/dashboard/presentation/surfaces";
const C24_PATHS = {
  view: `${C24_SURFACES}/collection-view.ts`,
  toggle: `${C24_SURFACES}/CollectionViewToggle.tsx`,
  barrel: `${C24_SURFACES}/index.ts`,
  grid: `${C24_SURFACES}/ContentGrid.tsx`,
  table: "frontend/src/components/ui/table.tsx",
  informes: "frontend/src/app/dashboard/informes/InformesReportsList.tsx",
  adminReports: "frontend/src/app/dashboard/admin/AdminReportsCard.tsx",
  adminClinics: "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx",
  clinicSummary: "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx",
  spec: "frontend/e2e/regression/dashboard-c24-list-grid-toggle.spec.ts",
  catalog: "frontend/e2e/suites/catalog.ts",
} as const;

const c24StripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const c24Count = (source: string, needle: string) => source.split(needle).length - 1;
const c24GridBlocks = (source: string) => [...source.matchAll(/<ContentGrid\b[\s\S]*?<\/ContentGrid>/g)].map((match) => match[0]);
const C24_PERSISTENCE = /localStorage|sessionStorage|document\.cookie|useSearchParams|useRouter|router\.(?:push|replace)|history\.(?:push|replace)State/;

test("C24 · the view owner is pure: two views, the shell phone boundary, rows derived from limit", () => {
  const view = c24StripComments(read(C24_PATHS.view));
  assert.equal(/^import /m.test(view), false, "collection-view.ts imports nothing");
  assert.ok(view.includes('export const COLLECTION_GRID_REGIME = "(min-width: 768px)";'));
  assert.ok(view.includes("Math.ceil(Math.max(0, limit) / columns)"), "rows = ceil(limit / columns)");
});

test("C24 · the toggle is an accessible in-memory control with no persistence or I/O", () => {
  const toggle = c24StripComments(read(C24_PATHS.toggle));
  assert.ok(toggle.startsWith('"use client";'));
  const imports = [...toggle.matchAll(/^import [^;]+ from "([^"]+)";$/gm)].map((match) => match[1]).sort();
  assert.deepEqual(imports, ["./collection-view", "@/lib/utils", "lucide-react", "react"]);
  assert.equal(C24_PERSISTENCE.test(toggle), false, "no URL, storage or cookie persistence");
  assert.equal(/fetch\(|@\/lib\/api/.test(toggle), false, "no request");
  assert.ok(toggle.includes('role="group"'), "a named group");
  assert.ok(toggle.includes("aria-pressed={view === option.id}"), "state is announced by aria-pressed");
  assert.ok(toggle.includes('type="button"'), "native buttons: Tab, Enter and Space");
  assert.ok(toggle.includes("focus-visible:ring-2"), "visible focus");
  assert.ok(toggle.includes("hidden") && toggle.includes("md:inline-flex"), "the control only exists in the grid regime");
  assert.ok(toggle.includes("useSyncExternalStore(subscribeGridRegime, readGridRegime, () => false)"), "SSR renders the list");
  assert.ok(toggle.includes('useState<CollectionView>("list")'), "the list is the default view");
});

test("C24 · ContentGrid/ContentGridItem live beside the C01 list, outside ui/table, and the barrel exposes them", () => {
  const grid = read(C24_PATHS.grid);
  const barrel = read(C24_PATHS.barrel);
  assert.equal(read(C24_PATHS.table).includes("ContentGrid"), false, "C01 ui/table stays geometry-free");
  assert.ok(grid.includes('data-content-grid="true"') && grid.includes('data-content-grid-item="true"'));
  assert.ok(grid.includes("gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`"), "rows are an input, never measured");
  assert.equal(/useState|useEffect|ResizeObserver|fetch\(|@\/lib\/api/.test(grid), false, "the grid measures and fetches nothing");
  for (const name of ["ContentGrid", "ContentGridItem", "CollectionViewToggle", "useCollectionView", "collectionGridRows"]) {
    assert.ok(new RegExp(`\\b${name}\\b`).test(barrel), `barrel exports ${name}`);
  }
});

const C24_ADOPTERS = [
  { path: C24_PATHS.informes, columns: 2, canvasRef: "ref={setBodyNode}", canvasRefs: 2, label: 'label="informes"' },
  { path: C24_PATHS.adminReports, columns: 3, canvasRef: "ref={setDesktopBodyNode}", canvasRefs: 1, label: 'label="informes"' },
  { path: C24_PATHS.adminClinics, columns: 3, canvasRef: "ref={setDesktopBodyNode}", canvasRefs: 1, label: 'label="clínicas"' },
] as const;

test("C24 · each adopter lays one page out on its own measured canvas with an unchanged limit", () => {
  for (const { path, columns, canvasRef, canvasRefs, label } of C24_ADOPTERS) {
    const source = c24StripComments(read(path));
    assert.equal(c24Count(source, "useCollectionView()"), 1, `${path}: one view owner`);
    assert.ok(source.includes(`collectionGridRows(effectiveLimit, ${columns})`), `${path}: rows from the measured limit`);
    assert.ok(source.includes("const effectiveLimit = rowsPerPage;"), `${path}: limit derivation untouched`);
    // Informes keeps its two mutually exclusive branches (empty/error and populated) of HEAD.
    assert.equal(c24Count(source, canvasRef), canvasRefs, `${path}: list and grid share the measured canvas, none added`);
    assert.equal(c24Count(source, "useDashboardCanvasCapacity({"), path === C24_PATHS.informes ? 1 : 2, `${path}: no capacity owner added`);
    assert.ok(source.includes("<CollectionViewToggle") && source.includes(label), `${path}: named toggle`);
    // Switching only flips the view: no wrapper may reset filters, search, sort, selection or the page window.
    assert.ok(source.includes("view={collectionView.preferred} onViewChange={collectionView.setView}")
      || /view=\{collectionView\.preferred\}\s*onViewChange=\{collectionView\.setView\}/.test(source), `${path}: the toggle writes the view only`);
    assert.equal(/collectionView\.(?:view|preferred)[^\n]*(?:setOffset|setRequestWindow|setAppliedFilters|setColumnSort|clearSelection|setSearchQuery)/.test(source), false,
      `${path}: no state reset keyed on the view`);
    assert.equal(C24_PERSISTENCE.test(source.replace(/router\.push\(`\/dashboard\/informes[^`]*`\)/g, "")), false, `${path}: no view persistence`);
    const [grid, ...extraGrids] = c24GridBlocks(source);
    assert.deepEqual(extraGrids, [], `${path}: one grid`);
    assert.ok(grid, `${path}: one grid`);
    for (const block of [grid]) {
      assert.equal(block.includes("data-dashboard-adaptive-row"), false, `${path}: cards are not pitch-locked rows`);
      assert.equal(/fetch\(|getAdmin|getInformesPage|<img|thumbnail/i.test(block), false, `${path}: no per-card request or preview`);
      assert.ok(block.includes("<ContentGridItem"), `${path}: grid items`);
    }
  }
});

test("C24 · the informes hint beside the toggle stays one line, so A02 chrome and the A03 limit cannot move", () => {
  const informes = c24StripComments(read(C24_PATHS.informes));
  // Measured at 1024x768 without it: the hint wrapped, +20px chrome, limit 5 -> 4.
  assert.match(
    informes,
    /className="dashboard-section-description truncate md:mt-0 md:min-w-0"\s*title="Click en un informe para abrir su detalle operativo\."\s*>\s*Click en un informe para abrir su detalle operativo\./,
  );
});

test("C24 · admin grids keep the table head contract inside the same reserve", () => {
  for (const path of [C24_PATHS.adminReports, C24_PATHS.adminClinics]) {
    const source = c24StripComments(read(path));
    assert.ok(source.includes('data-collection-grid-head="true"'), `${path}: grid head`);
    assert.ok(source.includes('style={{ blockSize: "var(--dash-canvas-reserved)" }}'), `${path}: head equals the A03 reserve`);
    assert.equal(c24Count(source, 'data-dashboard-canvas-reserve="table-head-dense"'), 1, `${path}: reserve unchanged`);
  }
  const reports = c24StripComments(read(C24_PATHS.adminReports));
  assert.equal(c24Count(reports, 'aria-label="Seleccionar página de informes"'), 3, "page selection in table, grid and phone pager");
  const reportsGrid = c24GridBlocks(reports)[0] ?? "";
  for (const call of ["selection.isSelected(report.id)", "selection.toggle(report.id)"]) {
    assert.ok(reportsGrid.includes(call), `the grid cards use the same C06 owner: ${call}`);
  }
  assert.ok(reportsGrid.includes("{filteredReports.map((report) =>"), "the grid renders the same client-filtered page");
  assert.ok(reportsGrid.includes("onClick={(event) => openReportDetail(report.id, event.currentTarget)}"), "Ver keeps the detail handler");
  assert.ok(/className="hidden lg:inline"> · \{formatDate\(/.test(reportsGrid), "Fecha keeps the list breakpoint (lg)");
  assert.ok(/className="hidden xl:inline"> · \{report\.fileName/.test(reportsGrid), "Archivo keeps the list breakpoint (xl)");
  assert.ok(reportsGrid.includes('triggerClassName="hidden xl:inline-flex h-7 w-7 p-0"'), "the action menu keeps the list breakpoint (xl)");
  const clinics = c24StripComments(read(C24_PATHS.adminClinics));
  assert.equal(c24Count(clinics, 'onToggle={() => toggleColumnSort("name")}'), 2, "name sort in table head and grid head");
  assert.equal(c24Count(clinics, 'onToggle={() => toggleColumnSort("createdAt")}'), 2, "date sort in table head and grid head");
});

test("C24 · phone lists, the clinic hub summary and documents are not adopted", () => {
  const reports = c24StripComments(read(C24_PATHS.adminReports));
  const clinics = c24StripComments(read(C24_PATHS.adminClinics));
  const mobileReports = reports.slice(reports.indexOf('data-admin-mobile-core-module="reports"'));
  assert.equal(mobileReports.includes("<ContentGrid"), false, "admin reports phone list stays a list");
  const mobileClinics = clinics.slice(clinics.lastIndexOf("md:hidden"));
  assert.equal(mobileClinics.includes("<ContentGrid"), false, "admin clinics phone list stays a list");
  assert.equal(read(C24_PATHS.clinicSummary).includes("ContentGrid"), false, "clinic hub summary is not a collection owner");
});

test("C24 · the runtime contract walks the 13 A02 viewports and is catalogued", () => {
  const spec = read(C24_PATHS.spec);
  const catalog = read(C24_PATHS.catalog);
  assert.ok(spec.includes("for (const viewport of DASHBOARD_GEOMETRY_VIEWPORTS)"), "the matrix is the canonical one, imported");
  for (const escape of ["test.skip", "test.fixme", "test.fail"]) assert.equal(spec.includes(escape), false, escape);
  assert.equal(/\b(?:test|describe)\.only\b/.test(spec), false, "no focused case");
  assert.match(catalog, /entry\("e2e\/regression\/dashboard-c24-list-grid-toggle\.spec\.ts", "regression", "dashboard\/collection", [^\n]*\["visual-contract"\], ci, /);
});

// ── C25 · microgeometry: focus outline and control line-height ──

const C25_INTERACTIONS_CSS = "frontend/src/styles/dashboard/interactions.css";
const C25_FOCUS_START = "/* dashboard-c25-focus-outline:start */";
const C25_FOCUS_END = "/* dashboard-c25-focus-outline:end */";

/** Violations of the C25 focus block: empty means forced-colors keeps a real outline. */
function c25FocusBlockViolations(css: string): string[] {
  const start = css.indexOf(C25_FOCUS_START);
  const end = css.indexOf(C25_FOCUS_END);
  if (start < 0 || end < start) return ["block delimiters"];
  const violations: string[] = [];
  if (start !== css.lastIndexOf(C25_FOCUS_START)) violations.push("block declared once");
  const before = stripComments(css.slice(0, start));
  if (before.split("{").length !== before.split("}").length) violations.push("unlayered (no open @layer/@media)");
  const block = stripComments(css.slice(start, end));
  if (!/^\s*\.dashboard-app-shell\s+:where\(/.test(block)) violations.push("scoped to the shell through :where");
  if (!block.includes('[tabindex]:not([tabindex="-1"])')) violations.push("programmatic focus targets excluded");
  // Menu items and options are <button>s (C08 owns no menu CSS), so `button` covers them.
  for (const control of ["a[href]", "button", "input", "select", "textarea", '[role="tab"]', '[role="checkbox"]']) {
    if (!block.includes(control)) violations.push(`covers ${control}`);
  }
  if (!/\):focus-visible\s*\{/.test(block)) violations.push(":focus-visible only");
  if (!block.includes("outline: 2px solid var(--dash-color-focus-ring);")) violations.push("2px token outline");
  if (!block.includes("outline-offset: 2px;")) violations.push("2px offset");
  if (/outline:\s*(?:none|0)\b|box-shadow|margin|padding|border|width|height/.test(block)) violations.push("outline only, never layout");
  return violations;
}

/** `:focus-visible` rules that suppress the outline; forced colors would leave them without indicator. */
function c25SuppressedFocusRules(css: string): string[] {
  const rules = stripComments(css).match(/[^{}]*:focus-visible[^{}]*\{[^{}]*\}/g) ?? [];
  return rules.filter((rule) => /outline(?:-style)?:\s*(?:none|0)\s*;/.test(rule)).map((rule) => rule.trim().split("{")[0].trim());
}

test("C25 · the shell restores a real 2px focus outline, unlayered and layout-neutral", () => {
  const css = read(C25_INTERACTIONS_CSS);
  assert.deepEqual(c25FocusBlockViolations(css), []);
  assert.ok(readDashboardCssSource().includes(C25_FOCUS_START), "the block is composed into the dashboard CSS");

  const block = css.slice(css.indexOf(C25_FOCUS_START));
  const mutants = [
    css.replace(C25_FOCUS_START, `@layer components {\n${C25_FOCUS_START}`),
    css.replace(block, block.replace(":where(", ":is(")),
    css.replace(block, block.replace("outline: 2px solid var(--dash-color-focus-ring);", "outline: none;")),
    css.replace(block, block.replace("outline-offset: 2px;", "outline-offset: 2px;\n  box-shadow: none;")),
    css.replace(block, block.replace('[tabindex]:not([tabindex="-1"])', "[tabindex]")),
    css.replace(block, block.replace("    select,\n", "")),
  ];
  for (const mutant of mutants) {
    assert.notEqual(mutant, css, "mutation applies");
    assert.notDeepEqual(c25FocusBlockViolations(mutant), [], "mutation is rejected");
  }
});

test("C25 · no dashboard :focus-visible rule suppresses the outline (P3-06)", () => {
  const css = readDashboardCssSource();
  assert.deepEqual(c25SuppressedFocusRules(css), []);
  const navigation = read(NAVIGATION_CSS);
  assert.ok(navigation.includes("outline: 2px solid transparent;\n    outline-offset: -2px;"), "mobile nav keeps an inset forced-colors outline");
  assert.ok(navigation.includes("inset 0 0 0 2px hsl(var(--ring) / 0.85)"), "and its two-ring focus shadow");
  assert.notDeepEqual(
    c25SuppressedFocusRules(".dashboard-app-shell .dashboard-mobile-nav-item:focus-visible {\n  outline: none;\n}"),
    [],
    "a suppressed focus outline is detected",
  );
});

const C25_USERS_ROLES = "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx";

test("C25 · PR-BUG-02: the users and roles search inputs keep line-height >= 1.25 x 12px inside their fixed height", () => {
  const source = read(C25_USERS_ROLES);
  assert.ok(source.includes('className="h-8 pl-7 text-xs leading-4 md:h-7"'), "desktop search: 12/16 in a 28-32px box");
  assert.ok(source.includes('className="h-9 pl-7 text-xs leading-4"'), "mobile search: 12/16 in a 36px box");
  assert.equal(/<Input[^>]*leading-none/.test(source), false, "no degenerate 12/12 input");
});

// ── PR-DRV-03 · forced-colors focus inside body-portaled overlays (C25 §8) ──

const DRV03_START = "/* dashboard-drv03-forced-colors-overlay-focus:start */";
const DRV03_END = "/* dashboard-drv03-forced-colors-overlay-focus:end */";
const DRV03_OVERLAY_ANCHORS = [
  ["frontend/src/components/dashboard/ModuleDialog.tsx", '[data-module-dialog="true"]'],
  ["frontend/src/app/dashboard/admin/ClinicEditDrawer.tsx", '[data-clinic-edit-drawer="true"]'],
  ["frontend/src/features/dashboard/presentation/filters/AdvancedFilterSheet.tsx", '[data-advanced-filter-sheet="true"]'],
  ["frontend/src/components/dashboard/DashboardNotificationsBell.tsx", '[data-dashboard-notifications-mobile-panel="true"]'],
] as const;

/** Violations of the PR-DRV-03 block: empty means forced-colors keeps a real outline in the portaled overlays. */
function drv03BlockViolations(css: string): string[] {
  const start = css.indexOf(DRV03_START);
  const end = css.indexOf(DRV03_END);
  if (start < 0 || end < start) return ["block delimiters"];
  const violations: string[] = [];
  if (start !== css.lastIndexOf(DRV03_START)) violations.push("block declared once");
  const before = stripComments(css.slice(0, start));
  if (before.split("{").length !== before.split("}").length) violations.push("unlayered (no open @layer/@media)");
  const block = stripComments(css.slice(start, end));
  if (!/^\s*@media \(forced-colors: active\) \{\s*:where\(/.test(block)) violations.push("forced-colors only, scoped through :where");
  if (/@layer/.test(block)) violations.push("unlayered");
  for (const [, anchor] of DRV03_OVERLAY_ANCHORS) {
    if (!block.includes(anchor)) violations.push(`covers ${anchor}`);
  }
  if (!block.includes('[tabindex]:not([tabindex="-1"])')) violations.push("programmatic focus targets excluded");
  for (const control of ["a[href]", "button", "input", "select", "textarea", '[role="tab"]', '[role="checkbox"]']) {
    if (!block.includes(control)) violations.push(`covers ${control}`);
  }
  if (!/\):focus-visible\s*\{/.test(block)) violations.push(":focus-visible only");
  if (!block.includes("outline: 2px solid CanvasText;")) violations.push("2px system-color outline");
  if (!block.includes("outline-offset: 2px;")) violations.push("2px offset");
  if (/outline:\s*(?:none|0)\b|box-shadow|margin|padding|border|width|height/.test(block)) violations.push("outline only, never layout");
  return violations;
}

test("PR-DRV-03 · body-portaled overlays keep a real focus outline in forced-colors only", () => {
  const css = read(C25_INTERACTIONS_CSS);
  assert.deepEqual(drv03BlockViolations(css), []);
  assert.ok(readDashboardCssSource().includes(DRV03_START), "the block is composed into the dashboard CSS");
  for (const [file, anchor] of DRV03_OVERLAY_ANCHORS) {
    const attribute = anchor.slice(1, -1);
    assert.ok(read(file).includes(attribute), `${file} renders the overlay anchor ${attribute}`);
  }

  const block = css.slice(css.indexOf(DRV03_START), css.indexOf(DRV03_END));
  const mutants = [
    css.replace(DRV03_START, `@layer components {\n${DRV03_START}`),
    css.replace(block, block.replace("@media (forced-colors: active) {", "@media all {")),
    css.replace(block, block.replace("outline: 2px solid CanvasText;", "outline: none;")),
    css.replace(block, block.replace("outline-offset: 2px;", "outline-offset: 2px;\n    box-shadow: none;")),
    css.replace(block, block.replace('      [data-clinic-edit-drawer="true"],\n', "")),
    css.replace(block, block.replace('[tabindex]:not([tabindex="-1"])', "[tabindex]")),
  ];
  for (const mutant of mutants) {
    assert.notEqual(mutant, css, "mutation applies");
    assert.notDeepEqual(drv03BlockViolations(mutant), [], "mutation is rejected");
  }
});
