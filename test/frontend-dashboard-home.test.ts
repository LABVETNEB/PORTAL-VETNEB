import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DASHBOARD_PAGE_PATH = "frontend/src/app/dashboard/page.tsx";

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
  assert.ok(source.includes('import Link from "next/link";'));
  assert.ok(source.includes('title: "Dashboard Clínica — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  assert.ok(source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'));
  assert.ok(source.includes('import { StatsCards } from "@/components/dashboard/StatsCards";'));
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

test("dashboard home renders clinic operational summary, stats, reports, and field visits", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes('title="Dashboard Clínica"'));
  assert.ok(source.includes('subtitle="Resumen operativo clínica"'));
  assert.ok(source.includes("Lectura conectada a datos operativos clinic-scoped del backend."));
  assert.ok(source.includes("Esta"));
  assert.ok(source.includes("Esta superficie usa solo sesión clínica."));
  assert.ok(source.includes("statsLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar las métricas operativas. Intente nuevamente."));
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

test("dashboard home keeps status badges and date formatting wired", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes("getReportStatusVariant(report.status)"));
  assert.ok(source.includes("getReportStatusLabel(report.status)"));
  assert.ok(source.includes("getFieldVisitStatusVariant(visit.status)"));
  assert.ok(source.includes("getFieldVisitStatusLabel(visit.status)"));
  assert.ok(source.includes("formatDate(report.uploadDate)"));
  assert.ok(source.includes("formatDate(visit.scheduledAt)"));
});

test("dashboard home removes horizontal quick actions and preserves clinic sections", () => {
  const source = read(DASHBOARD_PAGE_PATH);
  const quickActionsTitle = ["Accesos", "rápidos"].join(" ");
  const quickActionsDescription = [
    "Acciones frecuentes",
    "para operación clínica diaria.",
  ].join(" ");
  const removedSnippets = [
    quickActionsTitle,
    quickActionsDescription,
    'label: "Informes", href: ROUTES.dashboardInformes',
    'label: "Visitas"',
    'label: "Rutas"',
    'label: "Tokens"',
    'label: "Perfil"',
    `xl:grid-cols-${5}`,
  ];

  for (const snippet of removedSnippets) {
    assert.equal(source.includes(snippet), false);
  }

  assert.ok(source.includes("Estado operativo clínica"));
  assert.ok(source.includes("Métricas operativas"));
  assert.ok(source.includes("Informes recientes"));
  assert.ok(source.includes("Visitas de campo"));

  const mainIndex = source.indexOf('<main className="dashboard-main">');
  const operationalStatusIndex = source.indexOf("Estado operativo clínica");
  const metricsIndex = source.indexOf("Métricas operativas");

  assert.ok(mainIndex >= 0);
  assert.ok(operationalStatusIndex >= 0);
  assert.ok(metricsIndex >= 0);
  assert.ok(mainIndex < operationalStatusIndex);
  assert.ok(operationalStatusIndex < metricsIndex);
  assert.equal(
    source.slice(mainIndex, operationalStatusIndex).includes(quickActionsTitle),
    false,
  );
  assert.equal(
    source.slice(mainIndex, operationalStatusIndex).includes("dashboard-surface"),
    false,
  );
});
