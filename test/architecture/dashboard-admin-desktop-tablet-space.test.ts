import assert from "node:assert/strict";
import test from "node:test";
import { readDashboardCssSource } from "../helpers/read-dashboard-css-source.ts";
import { readSourceFile as read } from "../helpers/tracked-source-files.ts";

// ── ADMIN-DT · admin desktop/tablet space pass (Nico, administrador.zip) ─────
// From 768px up the admin dashboard gives its chrome back to the collections:
// the hub ("Inicio") and every module header/summary marked on the reference
// captures are RETIRED, the controls marked to move are MOVED (one instance,
// same handler), and every remaining pager paints Anterior/Siguiente only,
// centered. limit/offset, C04, C06/C07 and the C05 row geometry are frozen;
// below 768px the result of pre-C05 (#1826) is untouched.

const ADMIN = "frontend/src/app/dashboard/admin";
const CONTROLLER = `${ADMIN}/AdminDashboardWorkspaceController.tsx`;
const PAGE = `${ADMIN}/page.tsx`;
const REPORTS = `${ADMIN}/AdminReportsCard.tsx`;
const CLINICS = `${ADMIN}/AdminClinicsManagementCard.tsx`;
const AUDIT = `${ADMIN}/AdminAuditCard.tsx`;
const AUDIT_TABLE = `${ADMIN}/AdminAuditDenseTable.tsx`;
const SESSIONS = `${ADMIN}/AdminSessionsReadOnlyCard.tsx`;
const USERS = `${ADMIN}/AdminUsersRolesReadOnlyCard.tsx`;
const TOKENS = `${ADMIN}/AdminParticularTokensCard.tsx`;
const PRICING = `${ADMIN}/AdminPricingEditorCard.tsx`;
const SCHEMA = `${ADMIN}/AdminSchemaHealthStatusCard.tsx`;
const FAILED_LOGINS = `${ADMIN}/AdminFailedLoginAlertsReadOnlyCard.tsx`;
const MODULE_TABS = "frontend/src/components/dashboard/ModuleTabs.tsx";
const PAGER = "frontend/src/components/dashboard/DashboardPager.tsx";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  assert.ok(from !== -1, `missing ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to !== -1, `missing ${end} after ${start}`);
  return source.slice(from, to);
}

/** A pager element: from its opening tag (attributes in any order) to its close. */
function pagerRegion(source: string, marker: string, end: string): string {
  const at = source.indexOf(marker);
  assert.ok(at !== -1, `missing ${marker}`);
  const open = Math.max(source.lastIndexOf("<nav", at), source.lastIndexOf("<footer", at), source.lastIndexOf("<div", at));
  const close = source.indexOf(end, at);
  assert.ok(open !== -1 && close !== -1, `unbounded pager region for ${marker}`);
  return source.slice(open, close);
}

/** A desktop pager region paints exactly Anterior + Siguiente and nothing numeric. */
function assertPrevNextOnly(region: string, label: string): void {
  const code = stripComments(region);
  assert.ok(code.indexOf("Anterior") !== -1 && code.indexOf("Siguiente") > code.indexOf("Anterior"), `${label}: Anterior then Siguiente`);
  for (const painted of ["Pág.", "Página {", "Página ${", " por página", "en página", "dashboard-pagination-context", "<ChevronLeft", "<ChevronRight", "Ir a la página"]) {
    assert.equal(code.includes(painted), false, `${label}: paints ${painted}`);
  }
  assert.ok(/justify-center/.test(code), `${label}: the controls are centered`);
}

test("ADMIN-DT · the module header band is reclaimed from 768px up, admin only", () => {
  const css = readDashboardCssSource();
  const block = between(css, "/* admin-desktop-tablet-module-header-reclaim:start */", "/* admin-desktop-tablet-module-header-reclaim:end */");
  assert.ok(block.includes("@media (min-width: 768px)"), "scoped to the desktop/tablet regime");
  assert.ok(block.includes('[data-vetneb-app-shell-surface="admin"]'), "admin only: Clínica keeps its header");
  assert.match(block, /\.dashboard-workspace-header\s*\{\s*display: none !important;/);
  assert.match(block, /\[data-dashboard-module-viewport\]\s*\{\s*padding-top: 0 !important;/);
  assert.equal(block.includes("max-width"), false, "below 768px stays owned by mobile-chrome.css");
  assert.equal(read(CONTROLLER).includes("onBack="), false, "no Vista general back control");
});

test("ADMIN-DT · Informes: actions own the band, filters follow, summary and page text retired", () => {
  const card = read(REPORTS);
  const header = between(card, "<CardHeader", "</CardHeader>");
  assert.ok(header.includes("md:justify-end"), "Actualizar · Subir informe right-aligned at the top");
  assert.equal(card.indexOf("{renderAdvancedFilterForm()}") > card.indexOf("</CardHeader>"), true, "filters right below the actions");
  for (const retired of ["data-admin-reports-toolbar", "entregados", "con tinción", "por página", "Cola administrativa, trazabilidad"]) {
    assert.equal(card.includes(retired), false, `retired: ${retired}`);
  }
  assertPrevNextOnly(pagerRegion(card, 'aria-label="Paginación de informes admin"', "</nav>"), "Informes desktop pager");
  // Mobile (pre-C05) keeps its own touch pager with the page state.
  assert.ok(between(card, 'data-admin-mobile-core-pager="true"', "</div>").includes("Pág. {page}"), "the mobile pager is untouched");
});

test("ADMIN-DT · Clínicas: [search] [Nueva clínica] [Actualizar] in one row, pager at the foot", () => {
  const card = read(CLINICS);
  const row = between(card, 'data-admin-clinics-desktop-toolbar="true"', "</div>\n\n");
  const search = row.indexOf('placeholder="Buscar clínica por nombre, email o usuario..."');
  const create = row.indexOf("onClick={() => setIsCreateOpen(true)}");
  const refresh = row.indexOf("onClick={() => loadClinics()}");
  assert.ok(search !== -1 && create > search && refresh > create, "search, then Nueva clínica, then Actualizar");
  assert.equal((card.match(/onClick=\{\(\) => setIsCreateOpen\(true\)\}/g) ?? []).length, 2, "one trigger per regime (mobile header, desktop row)");
  assert.equal(card.includes("{totalClinics}\n"), false);
  assert.equal(/de \{totalClinics\}/.test(card), false, "no range text");
  assert.equal(card.includes("DASHBOARD_INLINE_PAGER_RESERVATION"), false, "the pager left the toolbar row");
  const footer = pagerRegion(card, 'aria-label="Paginación de clínicas"', "</nav>");
  assertPrevNextOnly(footer, "Clínicas desktop pager");
  assert.ok(card.indexOf('aria-label="Paginación de clínicas"') > card.indexOf("ref={setDesktopBodyNode}"), "the pager sits under the table");
  // C04 unchanged.
  assert.ok(card.includes('<TableHead aria-sort={clinicsAriaSort(appliedSort, "name")}>'));
  assert.ok(card.includes('<TableHead aria-sort={clinicsAriaSort(appliedSort, "createdAt")}>'));
  assert.ok(between(card, 'data-admin-mobile-core-pager="true"', "</div>").includes("Pág. {page} / {pageCount}"), "the mobile pager is untouched");
});

test("ADMIN-DT · Auditoría: header and summary retired, C07 beside the page selector, pager centered", () => {
  const card = read(AUDIT);
  const table = read(AUDIT_TABLE);
  const desktop = card.slice(card.indexOf('aria-label="Registro operativo"'));
  assert.equal(/<header\b/.test(desktop), false);
  assert.equal(desktop.includes("coincidencias"), false);
  assert.ok(desktop.indexOf("<AdminAuditFilterBar") < desktop.indexOf("<CollectionWorkspace"), "filters open the section");
  const selectorCell = between(table, '<TableHead className="w-9">', "</TableHead>");
  assert.ok(selectorCell.includes('data-collection-selection="page"') && selectorCell.includes("{selectionToolbar}"),
    "the selection toolbar paints in the page selector's header row");
  assertPrevNextOnly(pagerRegion(card, 'aria-label="Paginación de auditoría"', "</footer>"), "Auditoría desktop pager");
  for (const frozen of ["setOffset(offset + effectiveLimit);", "setOffset(Math.max(0, offset - effectiveLimit));", "const selection = useCollectionSelection({ visibleIds });"]) {
    assert.ok(card.includes(frozen), `frozen: ${frozen}`);
  }
});

test("ADMIN-DT · Sesiones: header retired, actions and a visible announced error in the filter band", () => {
  const card = read(SESSIONS);
  const band = between(card, 'aria-label="Filtros de sesiones"', "data-admin-sesiones-list-body");
  const tipo = band.indexOf("Tipo de sesión");
  const estado = band.indexOf("Estado\n");
  const error = band.indexOf('data-admin-sesiones-desktop-error="true"');
  const actions = band.indexOf("{desktopActions}");
  const refresh = band.indexOf("onClick={loadSessions}");
  assert.ok(tipo !== -1 && estado > tipo && error > estado && actions > error && refresh > actions,
    "[Tipo] [Estado] [error] ... [Cambiar contraseña] [Actualizar]");
  const errorLine = between(band, "data-admin-sesiones-desktop-error", "</p>");
  assert.ok(errorLine.includes('role="alert"') && !errorLine.includes("sr-only"), "the desktop error is visible AND announced");
  assert.equal(card.includes("por página"), false);
  assertPrevNextOnly(pagerRegion(card, "data-admin-sesiones-pagination", "</footer>"), "Sesiones desktop pager");
  // Pre-C05 P2 (mobile) is untouched: sr-only alert + visible out-of-flow line.
  const mobile = card.slice(card.indexOf('data-admin-mobile-ops-module="sessions"'));
  assert.ok(mobile.includes('<p className="sr-only" role="alert">'));
  assert.ok(mobile.includes('data-admin-sesiones-mobile-error="true"'));
  assert.ok(mobile.includes("absolute inset-x-0 bottom-0"));
  assert.ok(read(PAGE).includes("<AdminSessionsReadOnlyCard desktopActions={adminPasswordChangeAction} />"));
});

test("ADMIN-DT · Usuarios: header retired, Actualizar ends the filter band, jump-to-page retired", () => {
  const card = read(USERS);
  const band = between(card, 'aria-label="Filtros de usuarios y roles"', "Measured rows region");
  assert.ok(band.indexOf("Buscar") < band.indexOf("Tipo usuario") && band.indexOf("Tipo usuario") < band.indexOf("onClick={loadUsersRoles}"));
  assert.ok(band.includes("md:max-w-md"), "the search yields width so the selects sit next to it");
  assert.equal(card.includes("handleJumpToPage"), false);
  assertPrevNextOnly(pagerRegion(card, 'aria-label="Paginación de usuarios y roles"', "</footer>"), "Usuarios desktop pager");
});

test("ADMIN-DT · Tokens: header and metric strip retired, pager centered, Cargar más kept", () => {
  const card = read(TOKENS);
  assert.equal(/<CardHeader\b/.test(card), false);
  assert.equal(card.includes("ParticularTokensMetricStrip"), false);
  const pager = between(card, 'data-dashboard-adaptive-reserved-region="pager"\n            className="mt-2 hidden', "</section>");
  assertPrevNextOnly(pager, "Tokens desktop pager");
  assert.ok(pager.includes("Cargar más"), "the server window still extends through the Siguiente slot");
  // Nico: the reclaimed height must not outgrow the frozen two-page initial
  // window (limit 2 × 18), so the desktop page is capped at 18 rows.
  const desktopCapacity = between(card, "const desktopCapacity = useDashboardCanvasCapacity({", "});");
  assert.ok(desktopCapacity.includes("maxItems: TOKENS_MAX_OBSERVED_ADAPTIVE_ROWS,"), "desktop rows capped at the observed maximum");
  assert.ok(card.includes("const TOKENS_INITIAL_ADAPTIVE_WINDOW_SIZE =\n  TOKENS_MAX_OBSERVED_ADAPTIVE_ROWS * 2;"), "the request limit stays frozen");
});

test("ADMIN-DT · Precios: every study in one view per category tab, actions on the tab bar", () => {
  const card = read(PRICING);
  assert.ok(card.includes('ariaLabel="Categorías de precios"'), "Citología and Histopatología stay separate tabs");
  assert.ok(card.includes("actions={pricingActions}"));
  assert.ok(card.includes("const fitsInOneView = !measured || items.length <= capacity;"));
  assert.ok(card.includes("{fitsInOneView ? null : ("), "no pager while the category fits");
  assert.ok(card.includes("getAdminPricing()"), "same single GET, no paging parameters");
  const tabs = read(MODULE_TABS);
  assert.ok(tabs.includes("export function ModuleTabsActions"));
  assert.ok(tabs.includes("withActionsSlot = false"), "the action region is opt-in: other tab hosts are unchanged");
});

test("ADMIN-DT · Mantenimiento: Reintentar rides the tab bar; Estado keeps its schema header", () => {
  const page = read(PAGE);
  const schema = read(SCHEMA);
  assert.ok(between(page, 'ariaLabel="Mantenimiento del sistema"', "]}").includes("<AdminSchemaHealthStatusCard actionsInTabs />"));
  assert.ok(page.includes("withActionsSlot"));
  assert.ok(between(page, 'ariaLabel="Estado y mantenimiento"', "]}").includes("<AdminSchemaHealthStatusCard />"), "Estado is not marked: default header");
  assert.ok(schema.includes("<ModuleTabsActions>{retryButton}</ModuleTabsActions>"));
  assert.ok(schema.includes("Estado de esquema"), "the default variant keeps its header");
});

test("ADMIN-DT · compact pager and the Alertas pager paint Anterior/Siguiente only", () => {
  const pager = stripComments(read(PAGER));
  const compact = between(pager, 'if (props.variant === "compact") {', "\n  const {");
  assert.ok(compact.includes('<span className="sr-only" aria-live="polite" aria-atomic="true">'), "the range is announced only");
  assert.equal(compact.includes("pageState"), false, "no painted page state");
  assert.ok(compact.includes('renderPagerControl("prev"') && compact.includes('renderPagerControl("next"'));
  const failed = read(FAILED_LOGINS);
  assertPrevNextOnly(between(failed, 'data-dashboard-adaptive-reserved-region="pager"', "</CardContent>"), "Alertas desktop pager");
  assert.equal(failed.includes("visibles"), false);
});

test("ADMIN-DT · C05 row geometry is frozen", () => {
  const css = readDashboardCssSource();
  for (const frozen of ["--dash-row-pitch-compact: 36px;", "--dash-row-pitch-regular: 44px;", "--dash-table-head-h: 32px;"]) {
    assert.ok(css.includes(frozen), `${frozen} stays frozen until C05`);
  }
  for (const [path, rowClasses] of [
    [AUDIT_TABLE, "[&_td]:h-9 [&_td]:px-2 [&_td]:py-1 [&_th]:h-8"],
    [SESSIONS, "[&_td]:h-9 [&_td]:px-2 [&_td]:py-1 [&_th]:h-8"],
    [CLINICS, "[&_th]:h-9 [&_th]:px-3 [&_td]:px-3"],
    [REPORTS, "[&_th]:h-7 [&_th]:px-2 [&_td]:px-2"],
  ] as const) {
    assert.ok(read(path).includes(rowClasses), `${path}: row classes unchanged`);
  }
});
