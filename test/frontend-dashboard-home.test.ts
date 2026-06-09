import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DASHBOARD_PAGE_PATH = "frontend/src/app/dashboard/page.tsx";
const CLINIC_COMMAND_CENTER_PATH = "frontend/src/app/dashboard/ClinicCommandCenter.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard home defines non-indexable clinic metadata and imports live dependencies", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('title: "Dashboard Clínica — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  assert.ok(source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'));
  assert.ok(source.includes('import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";'));
  assert.ok(source.includes('DashboardModuleHub') && source.includes('@/components/dashboard/DashboardModuleHub'));
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

  assert.ok(source.includes("export default async function DashboardPage()"));
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
  assert.ok(source.includes("getReports(requestOptions, undefined, {"));
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
  assert.ok(source.includes('title: "Centro de operaciones"'));
  assert.ok(source.includes('<DashboardPageHeader'));
  assert.ok(source.includes('<DashboardModuleHub'));
  assert.ok(source.includes('heading="Módulos operativos"'));
  assert.ok(source.includes('href: ROUTES.dashboardInformes'));
  assert.ok(source.includes('href: ROUTES.dashboardLogistica'));
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

test("dashboard home page layout order: header before module hub before command center", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  const mainIndex = source.indexOf('<main className="dashboard-main">');
  const pageHeaderIndex = source.indexOf('<DashboardPageHeader');
  const moduleHubIndex = source.indexOf('<DashboardModuleHub');
  const commandCenterIndex = source.indexOf('<ClinicCommandCenter');
  const clinicPublicIndex = source.indexOf('<ClinicPublicProfileCard />');

  assert.ok(mainIndex >= 0);
  assert.ok(pageHeaderIndex >= 0);
  assert.ok(moduleHubIndex >= 0);
  assert.ok(commandCenterIndex >= 0);
  assert.ok(clinicPublicIndex >= 0);
  assert.ok(mainIndex < pageHeaderIndex);
  assert.ok(pageHeaderIndex < moduleHubIndex);
  assert.ok(moduleHubIndex < commandCenterIndex);
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
