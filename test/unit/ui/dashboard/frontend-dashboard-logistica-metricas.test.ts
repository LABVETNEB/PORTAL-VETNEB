import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import {
  descendants,
  elementText,
  exportedFunction,
  failureFlagViolations,
  type JsxNode,
  parseTsx,
  renderedUnder,
  staticAttribute,
  truth,
} from "./dashboard-source-oracle.ts";

const METRICAS_PAGE_PATH = "frontend/src/app/dashboard/logistica/metricas/page.tsx";
const PLANS_ALERT = "No se pudieron cargar los planes de ruta para métricas. Intente nuevamente.";
const METRICS_EMPTY = "No hay métricas de ruta disponibles.";

// TEST-GLOBAL-07 (G06-D08): the catch of the route-plan fetch raises
// `routePlansLoadError`, which then renders the alert instead of the empty
// metrics and disables both pager directions. The literal
// `routePlansLoadError = true;` stays present under `if (false)` (C.15.1 M-D06).
function routePlansFailure(source: string) {
  const file = parseTsx(source, METRICAS_PAGE_PATH);
  const page = exportedFunction(file, "MetricasPage");
  const failed = new Map([["routePlansLoadError", true]]);
  const set = renderedUnder(page, failed);
  const isAlert = (element: JsxNode) =>
    staticAttribute(element, "role") === "alert" && elementText(element).includes(PLANS_ALERT);
  const pager = ["canGoPrevious", "canGoNext"].map((name) => {
    const [declaration] = descendants(page.body, ts.isVariableDeclaration).filter(
      (candidate) => candidate.name.getText() === name,
    );
    return declaration?.initializer ? truth(declaration.initializer, failed) : "undeclared";
  });

  return {
    violations: failureFlagViolations(
      source,
      METRICAS_PAGE_PATH,
      "MetricasPage",
      ["getRoutePlans"],
      "routePlansLoadError",
    ),
    alertWhenSet: set.some((rendered) => rendered.must && isAlert(rendered.element)),
    emptyWhenSet: set.some((rendered) => elementText(rendered.element).includes(METRICS_EMPTY)),
    pagerWhenSet: pager,
    alertWhenClear: renderedUnder(page, new Map([["routePlansLoadError", false]])).some(
      (rendered) => isAlert(rendered.element),
    ),
  };
}

test("dashboard logistica metricas defines non-indexable metadata and dependencies", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('title: "Métricas de logística — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  // B10: the shell chrome (topbar + navigation frame + main) has one owner for
  // all six clinic routes, so the route imports the shell, not the topbar.
  assert.ok(source.includes('import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";'));
  assert.equal(
    source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'),
    false,
  );
  assert.ok(source.includes('import { PublicRouteControl } from "@/components/public/PublicRouteControl";'));
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

test("dashboard logistica metricas sends explicit limit/offset with a metrics-specific fan-out cap (R-14)", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("const METRICAS_DEFAULT_LIMIT = 12;"));
  assert.ok(source.includes("const METRICAS_MAX_LIMIT = 24;"));
  assert.ok(source.includes("function normalizeOffset(value: string | string[] | undefined): number {"));
  assert.ok(source.includes("function normalizeLimit(value: string | string[] | undefined): number {"));
  assert.ok(source.includes("searchParams?: Promise<MetricasPageSearchParams>;"));
  assert.ok(
    source.includes(
      "getRoutePlans(requestOptions, { throwOnError: true }, {\n      limit,\n      offset,\n    });",
    ),
  );
  // Metrics fan-out must never inherit the rutas/visitas backend default (50).
  assert.equal(source.includes("RUTAS_DEFAULT_LIMIT"), false);
  assert.equal(source.includes("= 50;"), false);
});

test("dashboard logistica metricas reads route plans and plan metrics scoped to the visible page", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("let routePlans: Awaited<ReturnType<typeof getRoutePlans>> = [];"));
  assert.ok(source.includes("let routePlansLoadError = false;"));
  assert.ok(source.includes("routePlans = await getRoutePlans("));
  assert.ok(source.includes("throwOnError: true,"));
  assert.ok(source.includes("let routeMetrics: Awaited<ReturnType<typeof getRoutePlanMetrics>> = [];"));
  assert.ok(source.includes("await Promise.all("));
  assert.ok(source.includes("let routeMetricsLoadError = false;"));
  assert.ok(source.includes("routePlans.map((plan) =>"));
  assert.ok(source.includes("getRoutePlanMetrics(plan.id, requestOptions, {"));
  assert.ok(source.includes(").flat();"));
});

test("dashboard logistica metricas computes canGoNext/canGoPrevious without a backend total (R-14)", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("const canGoPrevious = !routePlansLoadError && offset > 0;"));
  assert.ok(source.includes("const canGoNext = !routePlansLoadError && routePlans.length === limit;"));
  assert.equal(source.includes("pageCount"), false);
  assert.equal(source.includes("matchMedia"), false);
  assert.equal(source.includes("ResizeObserver"), false);
});

test("dashboard logistica metricas renders a pager and page-scope disclosure (R-14)", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes('aria-label="Paginación de métricas de ruta"'));
  assert.ok(source.includes('aria-label="Página anterior"'));
  assert.ok(source.includes('aria-label="Página siguiente"'));
  assert.ok(source.includes("disabled={!canGoPrevious}"));
  assert.ok(source.includes("disabled={!canGoNext}"));
  assert.ok(source.includes("Mostrando {routeMetrics.length} métricas de ruta · página {currentPage}"));
  assert.ok(
    source.includes(
      "Métricas calculadas sobre la página visible (máximo {limit} planes),",
    ),
  );
  assert.ok(source.includes("no sobre el total general de rutas."));
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
  assert.ok(source.includes('<ClinicDashboardShell'));
  // B10: the clinic notification role is declared once, by the shared shell.
  assert.equal(source.includes('notifications="clinic"'), false);
  assert.ok(source.includes("<ModuleMetricRun"));
  assert.ok(source.includes('surfaceId="clinic-logistica-metricas"'));
  assert.ok(source.includes('label: "Cumplimiento"'));
  assert.ok(source.includes("Paradas completadas"));
  assert.ok(source.includes("Duración promedio"));
  assert.ok(source.includes('label: "Planes"'));
  assert.equal(source.includes('className="dashboard-metric-card p-0"'), false);
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
  assert.ok(source.includes('className="surface-soft space-y-3"'));
  assert.ok(source.includes("<ModuleCard"));
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
  assert.ok(source.includes('className="clinical-progress h-2 w-full"'));
  assert.equal(source.includes("bg-gray-100"), false);
  assert.equal(source.includes("border-gray-100"), false);
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

  const separated = {
    violations: [],
    alertWhenSet: true,
    emptyWhenSet: false,
    pagerWhenSet: [false, false],
    alertWhenClear: false,
  };
  assert.deepEqual(routePlansFailure(source), separated);

  const neverRaised = source.replace("routePlansLoadError = true;", () => "if (false)\nroutePlansLoadError = true;");
  assert.notEqual(neverRaised, source);
  assert.deepEqual(routePlansFailure(neverRaised), {
    ...separated,
    violations: ["routePlansLoadError = true is not an unconditional statement of a catch block"],
  });
});
