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
  assert.ok(source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'));
  assert.ok(source.includes('import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";'));
  assert.ok(
    source.includes('ClinicDashboardWorkspaceController') &&
      source.includes('@/components/dashboard/ClinicDashboardWorkspaceController'),
  );
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
  assert.ok(source.includes("getReports(requestOptions, { limit: 3, offset: 0 }, {"));
  assert.ok(source.includes("getLogisticsFieldVisits(requestOptions, {"));
  assert.ok(source.includes("throwOnError: true,"));
  assert.ok(source.includes("const recentReports = reports.slice(0, 3);"));
  assert.ok(source.includes("const recentVisits = visits.slice(0, 3);"));
});

test("dashboard home renders module hub structure with header, cards, and clinic sections", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes('title="Dashboard Clínica"'));
  assert.ok(source.includes('subtitle="Portal operativo clínica"'));
  assert.ok(source.includes('notifications="clinic"'));
  assert.ok(source.includes('<DashboardPageHeader'));
  // PR5B: hub cards and DashboardModuleHub are inside ClinicDashboardWorkspaceController.
  assert.ok(source.includes('<ClinicDashboardWorkspaceController'));
  assert.ok(source.includes('<ClinicCommandCenter'));
  assert.ok(source.includes('stats={stats}'));
  assert.ok(source.includes('statsLoadError={statsLoadError}'));
  assert.ok(source.includes('recentReports={recentReports}'));
  assert.ok(source.includes('recentVisits={recentVisits}'));
  assert.ok(source.includes('reportsLoadError={reportsLoadError}'));
  assert.ok(source.includes('visitsLoadError={visitsLoadError}'));
  assert.ok(source.includes('<ClinicPublicProfileCard />'));
  assert.ok(source.includes('<ClinicParticularTokensCard />'));
  assert.equal(
    source.includes("Lectura conectada a datos operativos clinic-" + "scoped"),
    false,
  );
});

test("dashboard home page layout order: header before workspace controller before command center", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  const mainIndex = source.indexOf('<main className="dashboard-main">');
  const pageHeaderIndex = source.indexOf('<DashboardPageHeader');
  // PR5B: DashboardModuleHub is managed by ClinicDashboardWorkspaceController.
  const workspaceControllerIndex = source.indexOf('<ClinicDashboardWorkspaceController');
  const commandCenterIndex = source.indexOf('<ClinicCommandCenter');
  const clinicPublicIndex = source.indexOf('<ClinicPublicProfileCard />');

  assert.ok(mainIndex >= 0);
  assert.ok(pageHeaderIndex >= 0);
  assert.ok(workspaceControllerIndex >= 0);
  assert.ok(commandCenterIndex >= 0);
  assert.ok(clinicPublicIndex >= 0);
  assert.ok(mainIndex < workspaceControllerIndex);
  // App Shell: the page header is now passed as a prop to the controller and
  // rendered hub-only (to reclaim height in modules), so it appears after the
  // controller opening tag but before the workspace slot contents.
  assert.ok(workspaceControllerIndex < pageHeaderIndex);
  assert.ok(pageHeaderIndex < commandCenterIndex);
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
  assert.ok(source.includes('import { useAdaptiveRowsPerPage } from "@/hooks/useAdaptiveRowsPerPage";'));
  assert.ok(source.includes("const REPORTS_PAGE_SIZE = 3;"));
  assert.ok(source.includes("const { rowsPerPage } = useAdaptiveRowsPerPage({"));
  assert.ok(source.includes("containerNode: reportsListBodyNode,"));
  assert.ok(source.includes("fallbackRows: REPORTS_PAGE_SIZE,"));
  assert.ok(source.includes("rowHeightPx,"));
  assert.ok(source.includes("headerHeightPx: tableHeaderHeightPx,"));
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
