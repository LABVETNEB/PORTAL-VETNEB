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

test("dashboard home defines non-indexable metadata and imports live dependencies", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('import Link from "next/link";'));
  assert.ok(source.includes('title: "Dashboard — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  assert.ok(source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'));
  assert.ok(source.includes('import { StatsCards } from "@/components/dashboard/StatsCards";'));
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
  assert.ok(source.includes("const [stats, reports, visits] = await Promise.all(["));
  assert.ok(source.includes("getDashboardStats(requestOptions),"));
  assert.ok(source.includes("getReports(requestOptions),"));
  assert.ok(source.includes("getLogisticsFieldVisits(requestOptions),"));
  assert.ok(source.includes("const recentReports = reports.slice(0, 3);"));
  assert.ok(source.includes("const recentVisits = visits.slice(0, 3);"));
});

test("dashboard home renders operational summary, stats, reports, and field visits", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes('<DashboardTopbar title="Dashboard" subtitle="Resumen operativo" />'));
  assert.ok(source.includes("Lectura conectada a datos operativos del backend."));
  assert.ok(source.includes("<StatsCards stats={stats} />"));
  assert.ok(source.includes("Informes recientes"));
  assert.ok(source.includes("Visitas de campo"));
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

test("dashboard home exposes route-registry quick links only", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes("Accesos rápidos"));
  assert.ok(source.includes('label: "Informes", href: ROUTES.dashboardInformes'));
  assert.ok(source.includes('label: "Visitas"'));
  assert.ok(source.includes("href: ROUTES.dashboardLogisticaVisitas"));
  assert.ok(source.includes('label: "Rutas"'));
  assert.ok(source.includes("href: ROUTES.dashboardLogisticaRutas"));
  assert.ok(source.includes('label: "Admin", href: ROUTES.dashboardAdmin'));
  assert.equal(source.includes('"/api"'), false);
});
