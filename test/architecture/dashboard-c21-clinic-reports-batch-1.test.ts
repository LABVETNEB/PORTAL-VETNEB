import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile } from "../helpers/tracked-source-files.ts";

const PATHS = {
  module: "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx",
  list: "frontend/src/app/dashboard/informes/InformesReportsList.tsx",
  page: "frontend/src/app/dashboard/informes/page.tsx",
  table: "frontend/src/components/ui/table.tsx",
} as const;
type Sources = Record<keyof typeof PATHS, string>;

const read = (): Sources =>
  Object.fromEntries(Object.entries(PATHS).map(([key, path]) => [key, readSourceFile(path)])) as Sources;

const LATER_PRIMITIVES =
  /<(?:SuperSearchField|FilterChip|ActiveFilterChips|AdvancedFilterSheet|SelectionToolbar|BulkActionMenu|DocumentViewer)\b|useCollectionSelection|aria-sort/;
const ADMIN_BOUNDARY = /@\/app\/dashboard\/admin|admin_session_id|scope="admin"|\/api\/admin/;

function c21Violations(s: Sources): string[] {
  const violations: string[] = [];
  const need = (key: keyof Sources, pattern: RegExp | string, why: string) => {
    const ok = typeof pattern === "string" ? s[key].includes(pattern) : pattern.test(s[key]);
    if (!ok) violations.push(`${key}: ${why}`);
  };
  const forbid = (key: keyof Sources, pattern: RegExp | string, why: string) => {
    const hit = typeof pattern === "string" ? s[key].includes(pattern) : pattern.test(s[key]);
    if (hit) violations.push(`${key}: ${why}`);
  };

  for (const key of ["module", "list"] as const) {
    need(key, '} from "@/features/dashboard/presentation/surfaces";', "primitives come through the surfaces boundary");
    forbid(key, /<(?:EmptyState|ErrorState|LoadingState)\b/, "legacy state adapters are replaced by C03");
    forbid(key, LATER_PRIMITIVES, "C21 adds no search pill, chips, sheet, selection, sorting or viewer geometry");
    forbid(key, ADMIN_BOUNDARY, "no admin route, session, scope or endpoint reaches the clinic surface");
    forbid(key, /@\/lib\/api|fetch\(/, "the client surfaces never fetch on their own");
  }

  // Módulo /dashboard?module=informes: the measured canvas is the workspace, the A03 tokens stay on it.
  need("module", /<CollectionWorkspace\s+ref=\{setReportsListBodyNode\}\s+data-clinic-reports-list-body="true"\s+data-dashboard-adaptive-rows-canvas="true"\s+data-dashboard-row-pitch="regular"\s+data-dashboard-canvas-reserve="table-head-above-md"/, "the measured canvas is the CollectionWorkspace with its A03 tokens");
  need("module", /<CollectionHeader\s+className="border-b border-vetneb-line\/65 bg-vetneb-surface-muted\/65[^"]*"\s*>\s*<ContentListItem as="tr">/, "the table head is the C01 header");
  need("module", '<ContentList as="tbody">', "the desktop body remains the C01 list");
  forbid("module", /<ContentList\s+as="tbody"[^>]*divide-y/, "the desktop body must not add dividers over the row borders");
  need("module", /<ContentListItem\s+as="tr"\s+key=\{report\.id\}\s+data-clinic-reports-table-row="true"/, "desktop rows are C01 items with their marker");
  need("table", /case "tbody":\s+return <TableBody\b/, "the C01 body uses TableBody");
  need("table", /case "tr":\s+return <TableRow\b/, "the C01 rows use TableRow");
  need("table", 'className={cn("[&_tr:last-child]:border-0", className)}', "TableBody removes the last row border");
  need("table", '"border-b border-vetneb-line/60 transition-colors', "TableRow paints the row separators");
  need("module", /<ContentList\s+as="div"\s+data-clinic-reports-mobile-list="true"\s+className="flex min-h-0 flex-1 flex-col divide-y divide-vetneb-line\/60 overflow-hidden md:hidden"/, "the mobile list is the C01 list with its separators");
  need("module", /<ContentListItem\s+as="div"\s+key=\{report\.id\}\s+data-clinic-reports-mobile-row="true"\s+data-dashboard-adaptive-row="true"/, "mobile rows are C01 items locked to the pitch");
  need("module", /<CollectionState\s+variant="empty"\s+title="Sin informes para los filtros aplicados"/, "filtered empty through C03");
  need("module", /<CollectionState\s+variant="empty"\s+title="Sin informes recientes"/, "dataset empty through C03");
  need("module", /role="alert"\s+className="clinical-alert-warning[^"]*"/, "the load error keeps its alert");
  need("module", "<DashboardRefreshButton />", "the load error keeps its real refresh");
  need("module", "const pagedReports = usePagedRows(filteredReports, rowsPerPage);", "client paging stays with usePagedRows");
  need("module", "useDashboardCanvasCapacity({\n    canvasNode: reportsListBodyNode,\n    fallbackItems: REPORTS_PAGE_SIZE,\n    minItems: 2,\n  });", "capacity owner unchanged");
  need("module", 'data-clinic-reports-pagination-controls="true"', "the CMP-12 pager keeps its marker");
  need("module", "style={DASHBOARD_TOUCH_PAGER_RESERVATION}", "the module pager keeps its touch reservation");
  forbid("module", "<CollectionPager", "the module pager mirrors AdminMobileOpsPager (CMP-12) and is not migrated");
  // PR-BUG-01: the bar renders before, never inside, the load-error/empty branches.
  need("module", /\{renderAdvancedFilterForm\(\)\}[\s\S]*\{reportsLoadError \? \(/, "the filter bar renders regardless of the collection state");
  forbid("module", /reportsLoadError[^\n]*renderAdvancedFilterForm|recentReports\.length[^\n]*renderAdvancedFilterForm/, "the filter bar is never conditional on the collection");
  need("module", "event.preventDefault();", "Aplicar stays a manual submit");
  need("module", "onClick={clearAdvancedFilters}", "Limpiar keeps its handler");
  if ((s.module.match(/pagedReports\.setPage\(0\);/g) ?? []).length !== 2) {
    violations.push("module: Aplicar and Limpiar both reset the page");
  }
  need("module", /<DetailsPane label=\{`Detalle del informe #\$\{selectedReport\.id\}`\}>/, "the detail dialog composes the C13 pane");
  need("module", /<DetailsMetadata\s+items=\{\[/, "the detail facts are C13 metadata");
  need("module", /<ReportFileActions\s+reportId=\{selectedReport\.id\}\s+hasFile=\{selectedReport\.hasFile\}\s+scope="clinic"/, "file actions keep the clinic scope");
  need("module", "href={`${ROUTES.dashboardInformes}?reportId=${selectedReport.id}`}", "the deep link to the full route stays");

  // Ruta completa /dashboard/informes: server-adaptive limit/offset, recovery and the shared row stay.
  need("list", '<CollectionWorkspace className="flex min-h-0 flex-1 flex-col">', "the empty/error branch is the CollectionWorkspace");
  need("list", /<CollectionWorkspace\s+className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1\.15fr\)\]"\s+data-informes-master-detail-canvas="true"/, "the master-detail canvas is the CollectionWorkspace");
  need("list", /<ContentList\s+as="div"\s+ref=\{setBodyNode\}\s+data-informes-rows-canvas="true"\s+data-dashboard-adaptive-rows-canvas="true"\s+data-dashboard-row-pitch="regular"/, "the measured rows canvas is the C01 list (A02 `:scope > *` reads its rows)");
  need("list", "<CanonicalOperationalRow", "rows stay the shared operational row");
  forbid("list", "<ContentListItem", "an item wrapper would add a box per row and move the pitch");
  need("list", /<CollectionPager\s+variant="centered"\s+aria-label="Paginación de informes"\s+className="shrink-0 border-t border-vetneb-line\/70"/, "the pager is the C02 centered owner");
  need("list", "disabled={page <= 1}", "Anterior disables on the first page");
  need("list", "disabled={page >= reportsTotalPages}", "Siguiente disables on the last page");
  need("list", 'className="dashboard-pagination-context inline-block"', "the page state keeps its 4.5rem box inside the slot");
  forbid("list", /DASHBOARD_TOUCH_PAGER_RESERVATION|<nav\b/, "the region and its reservation belong to the owner");
  need("list", /<CollectionState\s+variant="error"\s+title="No se pudieron cargar los informes"/, "load error through C03");
  need("list", /<CollectionState\s+variant="empty"\s+title="No hay informes disponibles\."/, "empty through C03");
  need("list", "<PageRequestRecovery", "failed page requests keep their recovery");
  need("list", "setRequestWindow(satisfiedWindowRef.current);", "a failed request returns the pager to the rows on screen");
  need("list", "const result = await getInformesPage({", "pages come from the server action");
  need("list", "maxItems: INFORMES_LIMIT_CAP,", "the limit cap stays");
  need("list", "<StudyTimeline", "the timeline stays on its C14 adapter");
  need("list", "<ReportFileActions", "file actions stay");

  // B10 shell and the GET filter bar of the server page.
  need("page", /<ClinicDashboardShell\s+title="Informes"\s+subtitle="[^"]+"\s+module="informes"\s*>/, "the B10 clinic shell owns the route");
  need("page", '<ClinicFullRouteModuleStage moduleId="informes-full">', "the full-route stage stays");
  need("page", /<FilterBar\s+method="get"\s+role="search"/, "the GET filter bar stays");
  forbid("page", /reportsLoadError \?|reports\.length \?/, "the page never conditions the filter bar on the collection");
  if ((s.page.match(/href="\/dashboard\/informes"/g) ?? []).length !== 2) {
    violations.push("page: both Limpiar controls reset to the bare route");
  }
  need("page", "redirectToLoginOnUnauthorized(error);", "unauthorized loads redirect to login");
  need("page", 'cache: "no-store"', "private reports are never cached");
  forbid("page", "@/features/dashboard/presentation/surfaces", "the server page keeps the client surfaces barrel out");
  return violations;
}

test("C21 adopts the applicable primitives in the clinic Informes module and full route", () => {
  assert.deepEqual(c21Violations(read()), []);
});

test("C21 guard rejects reverting each surface to its pre-C21 grammar or moving a contract", () => {
  const sources = read();
  const mutants: ReadonlyArray<readonly [keyof Sources, string, string]> = [
    ["module", "<CollectionWorkspace\n            ref={setReportsListBodyNode}", "<div\n            ref={setReportsListBodyNode}"],
    ["module", '<ContentList as="tbody">', '<ContentList as="tbody" className="divide-y divide-vetneb-line/60">'],
    ["table", 'className={cn("[&_tr:last-child]:border-0", className)}', 'className={cn("", className)}'],
    ["table", '"border-b border-vetneb-line/60 transition-colors', '"transition-colors'],
    ["module", 'data-dashboard-canvas-reserve="table-head-above-md"', 'data-dashboard-canvas-reserve="table-head"'],
    ["module", '<CollectionState\n          variant="empty"\n          title="Sin informes recientes"', '<EmptyState\n          title="Sin informes recientes"'],
    ["module", 'scope="clinic"', 'scope="admin"'],
    ["module", "{renderAdvancedFilterForm()}", "{reportsLoadError ? null : renderAdvancedFilterForm()}"],
    ["list", "<ContentList\n              as=\"div\"\n              ref={setBodyNode}", "<div\n              ref={setBodyNode}"],
    ["list", '<CollectionPager\n              variant="centered"', "<DashboardPager"],
    ["list", "disabled={page <= 1}", "disabled={false}"],
    ["list", 'className="dashboard-pagination-context inline-block"', 'className="dashboard-pagination-context"'],
    ["list", "setRequestWindow(satisfiedWindowRef.current);", ""],
    ["page", 'module="informes"', ""],
  ];
  for (const [key, anchor, replacement] of mutants) {
    const at = sources[key].indexOf(anchor);
    assert.ok(at >= 0 && at === sources[key].lastIndexOf(anchor), `unique ${key} anchor: ${anchor}`);
    const mutated = sources[key].replace(anchor, () => replacement);
    assert.notEqual(mutated, sources[key]);
    assert.notDeepEqual(c21Violations({ ...sources, [key]: mutated }), [], `mutation must be rejected: ${key} ${anchor}`);
  }
});
