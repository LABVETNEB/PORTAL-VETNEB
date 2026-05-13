import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const LOGISTICA_PAGE_PATH = "frontend/src/app/dashboard/logistica/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard logistica defines non-indexable metadata and dependencies", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('import Link from "next/link";'));
  assert.ok(source.includes('title: "Logística — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  assert.ok(source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
});

test("dashboard logistica forwards cookies and disables cache for live reads", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes("async function getLogisticsRequestOptions(): Promise<RequestInit>"));
  assert.ok(source.includes("const cookieHeader = (await cookies()).toString();"));
  assert.ok(source.includes('cache: "no-store"'));
  assert.ok(source.includes("headers: cookieHeader ? { Cookie: cookieHeader } : {},"));
});

test("dashboard logistica reads field visits and route plans through API helpers", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes("export default async function LogisticaPage()"));
  assert.ok(source.includes("const requestOptions = await getLogisticsRequestOptions();"));
  assert.ok(source.includes("let fieldVisits: Awaited<ReturnType<typeof getLogisticsFieldVisits>> = [];"));
  assert.ok(source.includes("let fieldVisitsLoadError = false;"));
  assert.ok(source.includes("let routePlans: Awaited<ReturnType<typeof getRoutePlans>> = [];"));
  assert.ok(source.includes("let routePlansLoadError = false;"));
  assert.ok(source.includes("await Promise.all(["));
  assert.ok(source.includes("getLogisticsFieldVisits(requestOptions, {"));
  assert.ok(source.includes("getRoutePlans(requestOptions, {"));
});

test("dashboard logistica computes active visits and active route plans explicitly", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes("const activeVisits = fieldVisits.filter("));
  assert.ok(source.includes('v.status === "in_progress" || v.status === "scheduled"'));
  assert.ok(source.includes("const activePlans = routePlans.filter("));
  assert.ok(source.includes('p.status === "in_progress" || p.status === "released"'));
  assert.ok(source.includes("Visitas activas"));
  assert.ok(source.includes("Planes activos"));
  assert.ok(source.includes("Visitas totales"));
});

test("dashboard logistica exposes module cards through route registry", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes('title: "Visitas de campo"'));
  assert.ok(source.includes("href: ROUTES.dashboardLogisticaVisitas"));
  assert.ok(source.includes('title: "Planes de ruta"'));
  assert.ok(source.includes("href: ROUTES.dashboardLogisticaRutas"));
  assert.ok(source.includes('title: "Métricas"'));
  assert.ok(source.includes("href: ROUTES.dashboardLogisticaMetricas"));
  assert.ok(source.includes("Ver módulo"));
});

test("dashboard logistica renders recent visits with status badges dates and empty state", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes("Visitas recientes"));
  assert.ok(source.includes("fieldVisits.slice(0, 4).map((visit) =>"));
  assert.ok(source.includes("visit.clinicName ?? `Clínica #${visit.clinicId}`"));
  assert.ok(source.includes('visit.address ?? "Sin dirección"'));
  assert.ok(source.includes("formatDate(visit.scheduledAt)"));
  assert.ok(source.includes("getFieldVisitStatusVariant(visit.status)"));
  assert.ok(source.includes("getFieldVisitStatusLabel(visit.status)"));
  assert.ok(source.includes("fieldVisitsLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar las visitas recientes. Intente nuevamente."));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("No hay visitas recientes disponibles."));
});

test("dashboard logistica renders route plans with status badges dates and empty state", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes("Planes de ruta"));
  assert.ok(source.includes("routePlans.map((plan) =>"));
  assert.ok(source.includes("{plan.name}"));
  assert.ok(source.includes("{plan.completedStops}/{plan.totalStops} paradas"));
  assert.ok(source.includes("formatDate(plan.plannedDate)"));
  assert.ok(source.includes("getRoutePlanStatusVariant(plan.status)"));
  assert.ok(source.includes("getRoutePlanStatusLabel(plan.status)"));
  assert.ok(source.includes("routePlansLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar los planes de ruta recientes. Intente nuevamente."));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("No hay planes de ruta disponibles."));
});

test("dashboard logistica avoids direct client-side fetch literals", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes('"/api"'), false);
});
