import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DASHBOARD_PAGE_PATH = "frontend/src/app/dashboard/page.tsx";
const CLINIC_COMMAND_CENTER_PATH = "frontend/src/app/dashboard/ClinicCommandCenter.tsx";
const CLINIC_INFORMES_SUMMARY_PATH =
  "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx";
const CLINIC_LOGISTICA_SUMMARY_PATH =
  "frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);

  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);

  return source.slice(startIndex, endIndex);
}

test("dashboard home defines non-indexable clinic metadata and imports live dependencies", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('title: "Dashboard Clínica — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  // B10: the shell chrome (topbar + navigation frame + main) has one owner for
  // all six clinic routes, so the route imports the shell, not the topbar.
  assert.ok(source.includes('import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";'));
  assert.equal(
    source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'),
    false,
  );
  // No home/hub: the clinic dashboard no longer imports the landing
  // DashboardPageHeader band; it opens straight into the workspace controller.
  assert.equal(
    source.includes('import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";'),
    false,
  );
  assert.ok(
    source.includes('ClinicDashboardWorkspaceController') &&
      source.includes('@/components/dashboard/ClinicDashboardWorkspaceController'),
  );
  // The default operational module is resolved on the server render.
  assert.ok(source.includes('DEFAULT_CLINIC_MODULE'));
  assert.ok(source.includes('import { ClinicCommandCenter } from "./ClinicCommandCenter";'));
  assert.ok(source.includes('import { ClinicParticularTokensCard } from "@/components/dashboard/ClinicParticularTokensCard";'));
});

test("dashboard home forwards cookies and disables cache for backend reads", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes("async function getDashboardRequestOptions(): Promise<RequestInit>"));
  assert.ok(source.includes("const cookieHeader = (await cookies()).toString();"));
  assert.ok(source.includes('cache: "no-store"'));
  assert.ok(source.includes("headers: cookieHeader ? { Cookie: cookieHeader } : {},"));
});

test("dashboard home reads stats reports and field visits through API helpers", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes("export default async function DashboardPage("));
  assert.ok(source.includes("const requestOptions = await getDashboardRequestOptions();"));
  assert.ok(source.includes("let stats: Awaited<ReturnType<typeof getDashboardStats>> | null = null;"));
  assert.ok(source.includes("let statsLoadError = false;"));
  assert.ok(source.includes("stats = await getDashboardStats(requestOptions);"));
  assert.ok(source.includes("statsLoadError = true;"));
  assert.ok(source.includes("let reports: Awaited<ReturnType<typeof getReports>> = [];"));
  assert.ok(source.includes("let reportsLoadError = false;"));
  assert.ok(source.includes("let visits: Awaited<ReturnType<typeof getLogisticsFieldVisits>> = [];"));
  assert.ok(source.includes("let visitsLoadError = false;"));
  assert.ok(source.includes("await Promise.all(["));
  // Zero-scroll adaptive density (A03): the workspace summaries paginate a
  // hermetic superset client-side. The fetch window is a NAMED constant and is
  // never a page size; the previous window of 24 sat below the largest measured
  // canvas and truncated the second page on tall viewports (audit §20.4).
  assert.ok(
    source.includes("const CLINIC_DASHBOARD_ADAPTIVE_SUPERSET_LIMIT = 100;"),
    "the fetch window must be a named constant, not an inline literal",
  );
  assert.ok(
    source.includes("limit: CLINIC_DASHBOARD_ADAPTIVE_SUPERSET_LIMIT,"),
    "getReports must fetch through the named superset constant",
  );
  assert.ok(source.includes("getLogisticsFieldVisits(requestOptions, {"));
  assert.ok(source.includes("throwOnError: true,"));

  // The adaptive consumers receive their collections whole: any pre-pagination
  // cap here competes with `useAdaptiveRowsPerPage`, which owns the page size.
  assert.ok(source.includes("const recentReports = reports;"));
  assert.ok(source.includes("const recentVisits = visits;"));
  assert.ok(
    !/const recentReports = reports\.slice\(/.test(source),
    "recentReports must not be truncated before the adaptive summary pages it",
  );
  assert.ok(
    !/const recentVisits = visits\.slice\(/.test(source),
    "recentVisits must not be truncated before the adaptive summary pages it",
  );
  assert.ok(
    !/\.slice\(0,\s*24\)/.test(source),
    "the 24-item cap must not reappear anywhere in the clinic dashboard page",
  );
  assert.ok(
    !/limit:\s*24\b/.test(source),
    "the 24-item fetch window must not reappear",
  );

  // The compact operational summary of ClinicCommandCenter is a DIFFERENT,
  // non-normative surface for §20 rows 11 and 12: its 3-row slices stay.
  assert.ok(source.includes("recentReports={recentReports.slice(0, 3)}"));
  assert.ok(source.includes("recentVisits={recentVisits.slice(0, 3)}"));
});

test("dashboard home opens the unified module workspace (no hub header/cards)", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes('<ClinicDashboardShell'));
  assert.ok(source.includes('title="Dashboard Clínica"'));
  assert.ok(source.includes('subtitle="Portal operativo clínica"'));
  // B10: the clinic notification role is declared once, by the shared shell.
  assert.equal(source.includes('notifications="clinic"'), false);
  // No home/hub: no landing page-header band and no "Módulos clínicos" grid.
  assert.equal(source.includes('<DashboardPageHeader'), false);
  assert.equal(source.includes('Módulos clínicos'), false);
  assert.equal(source.includes('Resumen operativo'), false);
  // The unified workspace controller mounts directly and receives every module
  // slot (operaciones/informes/logística/perfil/tokens) it can activate.
  assert.ok(source.includes('<ClinicDashboardWorkspaceController'));
  assert.ok(source.includes('initialModule={initialModule}'));
  assert.ok(source.includes('<ClinicCommandCenter'));
  assert.ok(source.includes('stats={stats}'));
  assert.ok(source.includes('statsLoadError={statsLoadError}'));
  assert.ok(source.includes('recentReports={recentReports}'));
  assert.ok(source.includes('recentVisits={recentVisits}'));
  assert.ok(source.includes('reportsLoadError={reportsLoadError}'));
  assert.ok(source.includes('visitsLoadError={visitsLoadError}'));
  assert.ok(source.includes('<ClinicInformesWorkspaceSummary'));
  assert.ok(source.includes('<ClinicLogisticaWorkspaceSummary'));
  assert.ok(source.includes('<ClinicPublicProfileCard />'));
  assert.ok(source.includes('<ClinicParticularTokensCard />'));
  assert.equal(
    source.includes("Lectura conectada a datos operativos clinic-" + "scoped"),
    false,
  );
});

test("dashboard home page layout order: main before workspace controller before module slots", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  // B10: `main` is owned by ClinicDashboardShell, so the route's ordering
  // anchor is the shell mount — the element that now opens the main region.
  const mainIndex = source.indexOf('<ClinicDashboardShell');
  const workspaceControllerIndex = source.indexOf('<ClinicDashboardWorkspaceController');
  const commandCenterIndex = source.indexOf('<ClinicCommandCenter');
  const clinicPublicIndex = source.indexOf('<ClinicPublicProfileCard />');

  assert.ok(mainIndex >= 0);
  assert.ok(workspaceControllerIndex >= 0);
  assert.ok(commandCenterIndex >= 0);
  assert.ok(clinicPublicIndex >= 0);
  // No home/hub: the controller mounts right inside <main>, and the module
  // slots (operaciones command center, then profile) follow it. There is no
  // intermediate DashboardPageHeader band.
  assert.equal(source.includes('<DashboardPageHeader'), false);
  assert.ok(mainIndex < workspaceControllerIndex);
  assert.ok(workspaceControllerIndex < commandCenterIndex);
  assert.ok(commandCenterIndex < clinicPublicIndex);
});

test("dashboard home clinic command center receives all required data props", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes('import { ClinicCommandCenter } from "./ClinicCommandCenter";'));
  assert.ok(source.includes('<ClinicCommandCenter'));
  assert.ok(source.includes('stats={stats}'));
  assert.ok(source.includes('statsLoadError={statsLoadError}'));
  assert.ok(source.includes('recentReports={recentReports}'));
  assert.ok(source.includes('recentVisits={recentVisits}'));
  assert.ok(source.includes('reportsLoadError={reportsLoadError}'));
  assert.ok(source.includes('visitsLoadError={visitsLoadError}'));
});

test("dashboard home clinic command center presentational props contain operational section strings", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes("ModuleSurface"));
  assert.ok(source.includes("ModuleTabs"));
  assert.ok(source.includes("Estado operativo clínica"));
  assert.ok(source.includes("Priorice informes pendientes y visitas activas"));
  assert.ok(source.includes("<StatsCards stats={stats} />"));
  assert.ok(source.includes("Informes recientes"));
  assert.ok(source.includes("Visitas de campo"));
  assert.ok(source.includes("reportsLoadError ?"));
  assert.ok(source.includes("visitsLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar los informes recientes. Intente nuevamente."));
  assert.ok(source.includes("No se pudieron cargar las visitas de campo recientes. Intente nuevamente."));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("No hay informes recientes disponibles."));
  assert.ok(source.includes("No hay visitas de campo recientes disponibles."));
});

test("clinic informes summary uses table/list row actions with controlled detail dialog", () => {
  const source = read(CLINIC_INFORMES_SUMMARY_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("ModuleSurface"));
  assert.ok(source.includes("useState"));
  assert.ok(source.includes('data-clinic-reports-table="true"'));
  assert.ok(source.includes('data-clinic-reports-mobile-list="true"'));
  assert.ok(source.includes('data-clinic-reports-detail-dialog="true"'));
  assert.ok(source.includes("ReportFileActions"));
  assert.ok(source.includes("Ver"));
  assert.ok(source.includes("Abrir módulo completo"));
  assert.equal(source.includes("dashboard-inline-list"), false);
  assert.equal(source.includes("dashboard-inline-scroll"), false);
  assert.equal(source.includes("dashboard-inline-detail"), false);
  assert.equal(source.includes("aria-expanded={isSelected}"), false);
  assert.equal(source.includes('data-detail-state="selected"'), false);
  assert.equal(source.includes("isMobileDetailOpen"), false);
  assert.equal(source.includes("Volver a la lista"), false);
  assert.equal(source.includes('xl:grid-cols-[0.85fr_1.15fr]'), false);
  assert.equal(source.includes("space-y-4"), false);
});

test("clinic informes summary exposes advanced filters over visible report fields", () => {
  const source = read(CLINIC_INFORMES_SUMMARY_PATH);
  const filterForm = sectionBetween(
    source,
    "data-clinic-report-filter-bar",
    "</FilterBar>",
  );

  assert.ok(source.includes("type ClinicReportsFilterState = {"));
  assert.ok(source.includes("report: string;"));
  assert.ok(source.includes("patient: string;"));
  assert.ok(source.includes('status: "" | Report["status"];'));
  assert.ok(source.includes("study: string;"));
  assert.ok(source.includes("file: string;"));
  assert.ok(source.includes("from: string;"));
  assert.ok(source.includes("to: string;"));
  assert.ok(source.includes("matchesClinicReportFilters(report, appliedFilters)"));
  assert.ok(source.includes("matchesUploadDateRange(report, filters.from, filters.to)"));
  assert.ok(source.includes("const filteredReports = recentReports.filter((report) =>"));
  assert.ok(source.includes('import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";'));
  assert.ok(source.includes("const REPORTS_PAGE_SIZE = 3;"));
  assert.ok(source.includes("const { capacity: rowsPerPage } = useDashboardCanvasCapacity({"));
  assert.ok(source.includes("canvasNode: reportsListBodyNode,"));
  assert.ok(source.includes("fallbackItems: REPORTS_PAGE_SIZE,"));
  assert.equal(source.includes("rowHeightPx"), false);
  assert.ok(source.includes('data-dashboard-canvas-reserve="table-head"'));
  assert.ok(source.includes("usePagedRows(filteredReports, rowsPerPage)"));
  assert.equal(source.includes("usePagedRows(filteredReports, REPORTS_PAGE_SIZE)"), false);
  assert.equal(source.includes("matchMedia"), false);
  assert.ok(source.includes('data-clinic-report-filter-bar={mobile ? "advanced-mobile" : "advanced"}'));
  assert.ok(source.includes('data-clinic-reports-list-body="true"'));
  assert.ok(source.includes("FilterBar,"));
  assert.ok(source.includes("FilterField,"));
  assert.ok(source.includes("dashboardFilterControlClassName(density)"));
  assert.ok(source.includes("dashboardFilterActionClassName(density)"));
  assert.ok(source.includes('title="Filtrar informes"'));
  assert.ok(source.includes("Sin informes para los filtros aplicados"));

  for (const label of [
    "Informe",
    "Paciente",
    "Estado",
    "Estudio",
    "Archivo",
    "Desde",
    "Hasta",
    "Aplicar",
    "Limpiar",
  ]) {
    assert.ok(filterForm.includes(label), `missing ${label} filter control`);
  }
});

test("clinic logistica summary uses compact list with controlled detail dialog", () => {
  const source = read(CLINIC_LOGISTICA_SUMMARY_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("ModuleSurface"));
  assert.ok(source.includes("ModuleDialog"));
  assert.ok(source.includes("useState"));
  assert.ok(source.includes('data-clinic-logistics-list-panel="true"'));
  assert.ok(source.includes('data-clinic-logistics-list-body="true"'));
  assert.ok(source.includes('data-clinic-logistics-row="true"'));
  assert.ok(source.includes('data-clinic-logistics-detail-dialog="true"'));
  assert.equal(source.includes("dashboard-inline-scroll"), false);
  assert.equal(source.includes("dashboard-inline-detail"), false);
  assert.equal(source.includes("aria-expanded={isSelected}"), false);
  assert.equal(source.includes('data-detail-state="selected"'), false);
});

test("dashboard home keeps status badge and date formatting in clinic command center", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes('import { StatusBadge } from "@/components/dashboard/StatusBadge";'));
  assert.ok(source.includes("status={report.status}"));
  assert.ok(source.includes("status={visit.status}"));
  assert.ok(source.includes('import { formatDate } from "@/lib/utils";'));
  assert.ok(source.includes("formatDate(report.uploadDate)"));
  assert.ok(source.includes("formatDate(visit.scheduledAt)"));
});

test("dashboard home no longer contains quick action tiles or horizontal nav removed in prior PR", () => {
  const source = read(DASHBOARD_PAGE_PATH);
  const quickActionsTitle = ["Accesos", "rápidos"].join(" ");
  const removedSnippets = [
    quickActionsTitle,
    'label: "Informes", href: ROUTES.dashboardInformes',
    `xl:grid-cols-${5}`,
  ];

  for (const snippet of removedSnippets) {
    assert.equal(source.includes(snippet), false);
  }
});
