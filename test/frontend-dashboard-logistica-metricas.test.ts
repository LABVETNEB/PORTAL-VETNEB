import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const METRICAS_PAGE_PATH = "frontend/src/app/dashboard/logistica/metricas/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard logistica metricas defines non-indexable metadata and dependencies", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('title: "Métricas de logística — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  assert.ok(source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'));
  assert.ok(source.includes('import { Badge } from "@/components/ui/badge";'));
  assert.ok(source.includes('import { getRoutePlanMetrics, getRoutePlans } from "@/lib/api";'));
});

test("dashboard logistica metricas forwards cookies and disables cache for live reads", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("async function getLogisticsRequestOptions(): Promise<RequestInit>"));
  assert.ok(source.includes("const cookieHeader = (await cookies()).toString();"));
  assert.ok(source.includes('cache: "no-store"'));
  assert.ok(source.includes("headers: cookieHeader ? { Cookie: cookieHeader } : {},"));
  assert.ok(source.includes("const requestOptions = await getLogisticsRequestOptions();"));
});

test("dashboard logistica metricas reads route plans and plan metrics", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("let routePlans: Awaited<ReturnType<typeof getRoutePlans>> = [];"));
  assert.ok(source.includes("let routePlansLoadError = false;"));
  assert.ok(source.includes("routePlans = await getRoutePlans(requestOptions, {"));
  assert.ok(source.includes("throwOnError: true,"));
  assert.ok(source.includes("let routeMetrics: Awaited<ReturnType<typeof getRoutePlanMetrics>> = [];"));
  assert.ok(source.includes("await Promise.all("));
  assert.ok(source.includes("let routeMetricsLoadError = false;"));
  assert.ok(source.includes("routePlans.map((plan) =>"));
  assert.ok(source.includes("getRoutePlanMetrics(plan.id, requestOptions, {"));
  assert.ok(source.includes(").flat();"));
});

test("dashboard logistica metricas computes aggregate operational metrics", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("const totalStops = routeMetrics.reduce("));
  assert.ok(source.includes("const completedStops = routeMetrics.reduce("));
  assert.ok(source.includes("const avgCompliance ="));
  assert.ok(source.includes("metric.complianceRate"));
  assert.ok(source.includes("const metricsWithDuration = routeMetrics.filter("));
  assert.ok(source.includes("metric.averageDurationMinutes !== null"));
  assert.ok(source.includes("const avgDuration ="));
});

test("dashboard logistica metricas renders summary cards without technical source copy", () => {
  const source = read(METRICAS_PAGE_PATH);
  const removedMetricsEndpoint = "GET " + "/api/logistics/route-plans/:id/metrics";

  assert.ok(source.includes('title="Métricas de logística"'));
  assert.ok(source.includes('subtitle="Cumplimiento, SLA y reportes operativos"'));
  assert.ok(source.includes("Cumplimiento promedio"));
  assert.ok(source.includes("Paradas completadas"));
  assert.ok(source.includes("Duración promedio"));
  assert.ok(source.includes("Planes analizados"));
  assert.equal(source.includes(removedMetricsEndpoint), false);
});

test("dashboard logistica metricas renders per-route metric detail", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("Métricas por plan de ruta"));
  assert.ok(source.includes("Detalle de cumplimiento por cada plan ejecutado"));
  assert.ok(source.includes("routeMetrics.map((metric) =>"));
  assert.ok(source.includes("routePlans.find("));
  assert.ok(source.includes("plan?.name ?? `Plan #${metric.routePlanId}`"));
  assert.ok(source.includes("Total paradas"));
  assert.ok(source.includes("Completadas"));
  assert.ok(source.includes("Omitidas"));
  assert.ok(source.includes("Sin presencia"));
});

test("dashboard logistica metricas keeps compliance badge thresholds and progress accessibility", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("metric.complianceRate >= 90"));
  assert.ok(source.includes("? \"default\""));
  assert.ok(source.includes("metric.complianceRate >= 60"));
  assert.ok(source.includes("? \"secondary\""));
  assert.ok(source.includes(": \"destructive\""));
  assert.ok(source.includes("style={{ width: `${metric.complianceRate}%` }}"));
  assert.ok(source.includes('role="progressbar"'));
  assert.ok(source.includes("aria-valuenow={metric.complianceRate}"));
  assert.ok(source.includes("aria-valuemin={0}"));
  assert.ok(source.includes("aria-valuemax={100}"));
  assert.ok(source.includes("aria-label={`Cumplimiento: ${metric.complianceRate}%`}"));
});

test("dashboard logistica metricas separates fetch failures from empty metrics", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("routePlansLoadError ?"));
  assert.ok(source.includes("routeMetricsLoadError ?"));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("No se pudieron cargar los planes de ruta para métricas. Intente nuevamente."));
  assert.ok(source.includes("No se pudieron cargar las métricas de ruta. Intente nuevamente."));
  assert.ok(source.includes("No hay métricas de ruta disponibles."));
  assert.equal(source.includes("fetch("), false);
});
