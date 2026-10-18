import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile } from "../helpers/tracked-source-files.ts";

const PATHS = {
  tokens: "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx",
  logisticsModule: "frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx",
  logisticsHub: "frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx",
  logisticsRecent: "frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx",
  logisticsPage: "frontend/src/app/dashboard/logistica/page.tsx",
  metricas: "frontend/src/app/dashboard/logistica/metricas/page.tsx",
  rutas: "frontend/src/app/dashboard/logistica/rutas/page.tsx",
  visitas: "frontend/src/app/dashboard/logistica/visitas/page.tsx",
  boundedCanvas: "frontend/src/app/dashboard/logistica/LogisticsBoundedCanvas.tsx",
  operations: "frontend/src/app/dashboard/ClinicCommandCenter.tsx",
  profile: "frontend/src/components/dashboard/ClinicPublicProfileCard.tsx",
} as const;
type Sources = Record<keyof typeof PATHS, string>;

const read = (): Sources =>
  Object.fromEntries(Object.entries(PATHS).map(([key, path]) => [key, readSourceFile(path)])) as Sources;

const SURFACES_BARREL = '} from "@/features/dashboard/presentation/surfaces";';
const LATER_PRIMITIVES =
  /<(?:SuperSearchField|FilterChip|ActiveFilterChips|AdvancedFilterSheet|SelectionToolbar|BulkActionMenu|DocumentViewer|DetailsMetadata)\b|useCollectionSelection|aria-sort/;
const ADMIN_BOUNDARY = /@\/app\/dashboard\/admin|admin_session_id|scope="admin"|\/api\/admin/;
type RouteKey = "metricas" | "rutas" | "visitas";
const PAGER_LABELS: Record<RouteKey, string> = {
  metricas: "Paginación de métricas de ruta",
  rutas: "Paginación de planes de ruta",
  visitas: "Paginación de visitas",
};
const isRouteKey = (value: string): value is RouteKey => value === "metricas" || value === "rutas" || value === "visitas";

// The three routes are the variants of the bounded canvas they compose, read from its owner.
function boundedCanvasRoutes(boundedCanvas: string): string[] {
  const union = /canvas:\s*((?:"[a-z]+"\s*\|?\s*)+);/.exec(boundedCanvas);
  return union ? [...union[1].matchAll(/"([a-z]+)"/g)].map((match) => match[1]).sort() : [];
}

function c22Violations(s: Sources): string[] {
  const violations: string[] = [];
  const need = (key: keyof Sources, pattern: RegExp | string, why: string) => {
    const ok = typeof pattern === "string" ? s[key].includes(pattern) : pattern.test(s[key]);
    if (!ok) violations.push(`${key}: ${why}`);
  };
  const forbid = (key: keyof Sources, pattern: RegExp | string, why: string) => {
    const hit = typeof pattern === "string" ? s[key].includes(pattern) : pattern.test(s[key]);
    if (hit) violations.push(`${key}: ${why}`);
  };
  const count = (key: keyof Sources, literal: string, expected: number, why: string) => {
    if (s[key].split(literal).length - 1 !== expected) violations.push(`${key}: ${why}`);
  };

  for (const key of Object.keys(PATHS) as (keyof Sources)[]) {
    forbid(key, /<(?:EmptyState|ErrorState|LoadingState|DashboardPager|CompactPager)\b/, "legacy state and pager adapters are replaced by C02/C03");
    forbid(key, LATER_PRIMITIVES, "C22 adds no search pill, chips, sheet, selection, sorting, viewer or metadata geometry");
    forbid(key, ADMIN_BOUNDARY, "no admin route, session, scope or endpoint reaches the clinic surface");
  }
  for (const key of ["tokens", "logisticsModule", "logisticsRecent"] as const) {
    need(key, SURFACES_BARREL, "client surfaces take the primitives through the surfaces boundary");
  }
  // Server components keep the client barrel out and import each owner directly.
  for (const key of ["logisticsHub", "logisticsPage", "metricas", "rutas", "visitas", "operations", "profile"] as const) {
    forbid(key, "@/features/dashboard/presentation/surfaces", "server surfaces keep the client surfaces barrel out");
  }
  for (const key of ["logisticsModule", "logisticsHub", "logisticsRecent", "operations"] as const) {
    forbid(key, /@\/lib\/api|fetch\(/, "presentation never fetches on its own");
  }

  // Etapa A · Tokens (S7): the shared panel body stays the measured canvas; the table and list are C01.
  need("tokens", /<ParticularTokensPanelBody\s+ref=\{setPanelBodyNode\}\s+data-clinic-access-list-body="true"\s+data-dashboard-adaptive-rows-canvas="true"\s+data-dashboard-row-pitch="regular"\s+data-dashboard-canvas-reserve="table-head-above-md"/, "the measured canvas keeps its A03 tokens");
  need("tokens", /<CollectionHeader\s+className="border-b border-vetneb-line\/65 bg-vetneb-surface-muted\/65 text-xs font-semibold uppercase text-muted-foreground"\s*>\s*<ContentListItem as="tr">/, "the table head is the C01 header");
  need("tokens", '<ContentList as="tbody" className="divide-y divide-vetneb-line/60">', "the body keeps its 1px separators as the C01 list");
  need("tokens", /<ContentListItem\s+as="tr"\s+key=\{token\.id\}\s+data-clinic-access-table-row="true"/, "desktop rows are C01 items with their marker");
  need("tokens", /<ContentList\s+as="div"\s+data-clinic-access-mobile-list="true"\s+className="flex min-h-0 shrink-0 flex-col divide-y divide-vetneb-line\/60 overflow-hidden md:hidden"/, "the mobile list is the C01 list with its separators");
  need("tokens", /<ContentListItem\s+as="div"\s+key=\{token\.id\}\s+id=\{`clinic-particular-token-\$\{token\.id\}`\}\s+data-clinic-access-mobile-row="true"\s+data-dashboard-adaptive-row="true"/, "mobile rows are C01 items locked to the pitch, with their notification anchor");
  need("tokens", /<CollectionState\s+variant="empty"\s+title="Sin tokens para los filtros aplicados"/, "filtered empty through C03");
  need("tokens", /<CollectionState\s+variant="empty"\s+title=\{\s+isLoadingTokens\s+\? "Cargando tokens particulares\.\.\."\s+: "Sin tokens particulares"/, "the dataset empty keeps its loading copy through C03 empty (same geometry)");
  forbid("tokens", "<CollectionPager", "the pager keeps its own markers and the plain reservation (C02 would move the region)");
  need("tokens", "style={DASHBOARD_PAGER_RESERVATION}", "the pager keeps its plain reservation");
  need("tokens", 'data-clinic-access-pagination-controls="true"', "the pager keeps its marker");
  need("tokens", "disabled={!pagedTokens.hasPrev || isLoadingTokens}", "Anterior keeps its guard");
  need("tokens", "disabled={!pagedTokens.hasNext || isLoadingTokens}", "Siguiente keeps its guard");
  // PR-BUG-01: the bar renders in the toolbar, before and outside the collection branches.
  need("tokens", /data-clinic-access-toolbar="true"[\s\S]*?\{renderAdvancedFilterForm\(\)\}[\s\S]*?\{tokens\.length \? \(/, "the filter bar renders regardless of the collection state");
  forbid("tokens", /tokens\.length[^\n]*renderAdvancedFilterForm|loadErrorMessage[^\n]*renderAdvancedFilterForm/, "the filter bar is never conditional on the collection");
  need("tokens", "onSubmit={applyAdvancedFilters}", "Aplicar stays a manual submit");
  count("tokens", "pagedTokens.setPage(0);", 2, "Aplicar and Limpiar both reset the page");
  count("tokens", "setErrorMessage(loadErrorMessage);", 2, "Aplicar and Limpiar never clear a load error");
  need("tokens", "onClick={() => void loadTokens(effectiveFetchLimit)}", "Actualizar keeps its real reload");
  need("tokens", "onClick={() => setIsCreateDialogOpen(true)}", "Generar keeps its dialog");
  count("tokens", "onClick={() => openTokenDetail(token.id)}", 2, "both row grammars open the token detail");
  count("tokens", "****{token.tokenLast4}", 2, "both row grammars show the token masked");
  forbid("tokens", /[^*]\{token\.tokenLast4\}/, "a row never shows the last four unmasked");
  need("tokens", "await getClinicParticularTokens({ limit, offset: 0 });", "tokens are read through the clinic endpoint");

  // Etapa B · Logística módulo (/dashboard?module=logistica).
  need("logisticsModule", /<CollectionWorkspace\s+data-clinic-logistics-list-panel="true"/, "the list panel is the CollectionWorkspace");
  need("logisticsModule", /<ContentList\s+as="div"\s+ref=\{setVisitsListBodyNode\}\s+data-clinic-logistics-list-body="true"\s+data-dashboard-adaptive-rows-canvas="true"[\s\S]{0,420}data-dashboard-row-pitch="tall"\s+className="flex min-h-0 flex-1 flex-col divide-y divide-vetneb-line\/60 overflow-hidden"/, "the measured canvas is the C01 list with its A03 tokens");
  need("logisticsModule", /<button\s+key=\{visit\.id\}\s+type="button"\s+data-clinic-logistics-row="true"\s+data-dashboard-adaptive-row="true"/, "rows stay buttons locked to the pitch");
  need("logisticsModule", /<CollectionPager\s+variant="centered"\s+className="w-full border-t border-vetneb-line\/65"\s+aria-label="Paginación de visitas recientes"\s+pageStateRegime="phone-only"/, "the pager is the C02 owner with the variant the adapter pinned");
  need("logisticsModule", /<CollectionState\s+variant="empty"\s+title="Sin visitas recientes"/, "empty through C03");
  need("logisticsModule", /role="alert"\s+className="clinical-alert-warning[^"]*"/, "the load error keeps its alert");
  need("logisticsModule", "<DashboardRefreshButton />", "the load error keeps its real refresh");
  need("logisticsModule", "useDashboardCanvasCapacity({\n    canvasNode: visitsListBodyNode,\n    fallbackItems: VISITS_PAGE_SIZE,\n    minItems: 2,\n  });", "capacity owner unchanged");
  need("logisticsModule", "const pagedVisits = usePagedRows(recentVisits, rowsPerPage);", "client paging stays with usePagedRows");
  need("logisticsModule", "href={ROUTES.dashboardLogisticaVisitas}", "the detail keeps its deep link to the full route");

  // Etapa B · /dashboard/logistica (hub).
  need("logisticsRecent", /<CollectionWorkspace\s+data-dashboard-adaptive-reservation="true"/, "the reservation root is the CollectionWorkspace");
  need("logisticsRecent", /<ContentList\s+as="div"\s+ref=\{setCanvasNode\}\s+data-logistics-recent-list-canvas="true"\s+data-dashboard-adaptive-rows-canvas="true"\s+data-dashboard-row-pitch="regular"\s+data-dashboard-row-gap="spaced"/, "the measured canvas is the C01 list (rows stay direct children)");
  need("logisticsRecent", /<CollectionPager\s+variant="centered"\s+aria-label=\{pagerAriaLabel\}/, "the pager is the C02 owner");
  need("logisticsRecent", "useDashboardCanvasCapacity({\n    canvasNode,\n    fallbackItems: 3,\n    minItems: 1,\n    maxItems: 12,\n  });", "capacity owner unchanged");
  need("logisticsHub", 'import { CollectionState } from "@/components/dashboard/EmptyState";', "the server hub imports the C03 owner directly");
  need("logisticsHub", /<CollectionState\s+variant="empty"\s+title="Sin visitas activas"/, "visits empty through C03");
  need("logisticsHub", /<CollectionState\s+variant="empty"\s+title="Sin planes de ruta"/, "plans empty through C03");
  count("logisticsHub", '<p role="alert" className="clinical-alert-warning">', 2, "both load errors keep their alert");
  count("logisticsHub", "<LogisticsRecentListCanvas", 2, "both lists keep the bounded canvas");
  need("logisticsPage", /<ClinicDashboardShell\s+title="Logística"\s+subtitle="[^"]+"\s+module="logistica"/, "the B10 clinic shell owns the hub");
  need("logisticsPage", '<ClinicFullRouteModuleStage moduleId="logistica-full">', "the hub stage stays");

  // Etapa B · las tres rutas: URL limit/offset, recovery and B10 stay; the pager region moves to its owner.
  const routes = boundedCanvasRoutes(s.boundedCanvas);
  if (routes.join() !== "metricas,rutas,visitas") violations.push(`boundedCanvas: the three routes are its variants (${routes.join()})`);
  for (const canvas of routes) {
    if (!isRouteKey(canvas)) continue;
    const key = canvas;
    const stage = `logistica-${canvas}`;
    need(key, 'import { CollectionPager } from "@/components/dashboard/DashboardPager";', "the server route imports the C02 owner directly");
    need(key, new RegExp(`<CollectionPager\\s+variant="centered"\\s+aria-label="${PAGER_LABELS[key]}"\\s+className="shrink-0 border-t border-vetneb-line\\/70"\\s+prevControl=\\{`), "the pager is the C02 centered owner in slot mode");
    need(key, /prevControl=\{\s+<PublicRouteControl\s+href=\{previousHref\}\s+variant="bare"\s+disabled=\{!canGoPrevious\}/, "Anterior keeps its URL control and guard");
    need(key, /nextControl=\{\s+<PublicRouteControl\s+href=\{nextHref\}\s+variant="bare"\s+disabled=\{!canGoNext\}/, "Siguiente keeps its URL control and guard");
    need(key, /stateControl=\{\s+<span className="dashboard-pagination-context inline-block">\s+Página \{currentPage\}/, "the page state keeps its 4.5rem box inside the slot");
    forbid(key, /<nav\b|DASHBOARD_TOUCH_PAGER_RESERVATION|data-dashboard-adaptive-reserved-region/, "the region and its reservation belong to the owner");
    need(key, new RegExp(`<ClinicDashboardShell\\s+title="[^"]+"\\s+subtitle="[^"]+"\\s+module="logistica"\\s*>`), "the B10 clinic shell owns the route");
    need(key, `<ClinicFullRouteModuleStage moduleId="${stage}">`, "the full-route stage stays");
    need(key, new RegExp(`<LogisticsBoundedCanvas\\s+canvas="${canvas}"\\s+basePath="/dashboard/logistica/${canvas}"\\s+hasExplicitLimit=\\{hasExplicitLimit\\}\\s+currentLimit=\\{limit\\}`), "the bounded canvas keeps the adaptive URL limit");
    need(key, new RegExp(`<ContentList\\s+as="div"\\s+className="flex min-h-0 w-full min-w-0 flex-1 flex-col divide-y divide-vetneb-line\\/60 overflow-hidden"\\s+data-logistics-mobile-list="${canvas}"`), "the mobile list is the C01 list");
    need(key, "redirectToLoginOnUnauthorized(error);", "unauthorized loads redirect to login");
    need(key, 'cache: "no-store"', "private logistics data is never cached");
    need(key, 'role="alert"', "the load error keeps its alert");
    forbid(key, "<CollectionState", "inline table/list states keep their geometry (C03 would add a card per state)");
  }
  for (const key of ["rutas", "visitas"] as const) {
    need(key, /<CollectionHeader>\s*<ContentListItem as="tr">/, "the desktop head is the C01 header inside the table-head reserve");
    need(key, '<ContentList as="tbody">', "the desktop body is the C01 list");
    need(key, new RegExp(`<ContentListItem as="tr" key=\\{${key === "rutas" ? "plan" : "visit"}\\.id\\}>`), "desktop rows are C01 items");
    forbid(key, /<TableHeader\b|<TableBody\b/, "no second header or body grammar");
  }
  forbid("metricas", "<ContentListItem", "desktop metric blocks stay direct children of the measured canvas");
  need("metricas", /data-logistics-metric-block="true"\s+data-dashboard-adaptive-row="true"/, "desktop metric blocks stay locked rows");
  need("boundedCanvas", 'data-dashboard-row-pitch={canvas === "metricas" ? "block" : "tall"}', "the bounded canvas keeps its desktop pitch");
  need("boundedCanvas", "router.replace(`${basePath}?offset=0&limit=${itemsPerPage}`, {", "the adaptive limit stays a URL replace");

  // Etapa D · Operaciones: the recent lists are C01 without a new box; empties are C03.
  count("operations", '<ContentList as="div" className="contents space-y-1.5">', 2, "both recent lists are C01 lists that keep their row spacing");
  count("operations", '<ContentListItem\n                          as="div"', 2, "recent rows are C01 items");
  count("operations", 'className="dashboard-list-row"', 2, "rows keep their list-row grammar");
  need("operations", 'import { CollectionState } from "@/components/dashboard/EmptyState";', "the server surface imports the C03 owner directly");
  need("operations", /<CollectionState\s+variant="empty"\s+title="Sin informes recientes"/, "reports empty through C03");
  need("operations", /<CollectionState\s+variant="empty"\s+title="Sin visitas recientes"/, "visits empty through C03");
  count("operations", "<DashboardRefreshButton />", 3, "the three load errors keep their real refresh");

  // Etapa C · Perfil: a form with sections, not a collection; nothing is adopted.
  forbid("profile", /<(?:CollectionWorkspace|CollectionHeader|ContentList|ContentListItem|CollectionPager|CollectionState|DetailsPane)\b/, "Perfil has no collection to migrate");
  need("profile", '<form id={PROFILE_FORM_ID} className="contents" onSubmit={handleSubmit}>', "the profile form keeps its submit");
  need("profile", "onClick={() => void loadProfile()}", "the load error keeps its real retry");
  need("profile", '<p className="clinical-alert-error px-3 py-1.5" role="alert">', "save errors stay announced");
  need("profile", '<p className="clinical-alert-success px-3 py-1.5" role="status">', "save feedback stays announced");
  need("profile", '<PasswordChangePanel variant="clinic"', "the password section keeps the clinic panel");
  return violations;
}

test("C22 adopts the applicable primitives in clinic Tokens, Logística and Operaciones and leaves Perfil as is", () => {
  assert.deepEqual(c22Violations(read()), []);
});

test("C22 guard rejects reverting each surface to its pre-C22 grammar or moving a contract", () => {
  const sources = read();
  const mutants: ReadonlyArray<readonly [keyof Sources, string, string]> = [
    ["tokens", '<ContentList as="tbody" className="divide-y divide-vetneb-line/60">', "<tbody className=\"divide-y divide-vetneb-line/60\">"],
    ["tokens", 'data-dashboard-canvas-reserve="table-head-above-md"', 'data-dashboard-canvas-reserve="table-head"'],
    ["tokens", '<CollectionState\n                        variant="empty"\n                        title="Sin tokens para los filtros aplicados"', '<EmptyState\n                        title="Sin tokens para los filtros aplicados"'],
    ["tokens", "            {renderAdvancedFilterForm()}", "            {tokens.length ? renderAdvancedFilterForm() : null}"],
    ["tokens", "****{token.tokenLast4}\n", "{token.tokenLast4}\n"],
    ["logisticsModule", '<CollectionPager\n              variant="centered"', "<DashboardPager"],
    ["logisticsModule", 'data-dashboard-row-pitch="tall"', 'data-dashboard-row-pitch="regular"'],
    ["logisticsRecent", "<ContentList\n        as=\"div\"\n        ref={setCanvasNode}", "<div\n        ref={setCanvasNode}"],
    ["logisticsHub", '<CollectionState\n                variant="empty"\n                title="Sin planes de ruta"', '<EmptyState\n                title="Sin planes de ruta"'],
    ["rutas", "disabled={!canGoNext}", "disabled={false}"],
    ["visitas", 'className="dashboard-pagination-context inline-block"', 'className="dashboard-pagination-context"'],
    ["metricas", 'cache: "no-store"', 'cache: "force-cache"'],
    ["rutas", '<ContentListItem as="tr" key={plan.id}>', "<TableRow key={plan.id}>"],
    ["operations", "<ContentList as=\"div\" className=\"contents space-y-1.5\">\n                      {recentVisits", "<ContentList as=\"div\">\n                      {recentVisits"],
    ["profile", "onClick={() => void loadProfile()}", "onClick={() => undefined}"],
  ];
  for (const [key, anchor, replacement] of mutants) {
    const at = sources[key].indexOf(anchor);
    assert.ok(at >= 0 && at === sources[key].lastIndexOf(anchor), `unique ${key} anchor: ${anchor}`);
    const mutated = sources[key].replace(anchor, () => replacement);
    assert.notEqual(mutated, sources[key]);
    assert.notDeepEqual(c22Violations({ ...sources, [key]: mutated }), [], `mutation must be rejected: ${key} ${anchor}`);
  }
});
