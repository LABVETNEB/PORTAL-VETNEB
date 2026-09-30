import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import {
  elementText,
  exportedFunction,
  failureFlagViolations,
  type JsxNode,
  parseTsx,
  renderedUnder,
  staticAttribute,
} from "./dashboard-source-oracle.ts";

const RUTAS_PAGE_PATH = "frontend/src/app/dashboard/logistica/rutas/page.tsx";
const PLANS_ALERT = "No se pudieron cargar los planes de ruta. Intente nuevamente.";
const PLANS_EMPTY = "No hay planes de ruta disponibles.";

// TEST-GLOBAL-07 (G06-D09): the catch of the route-plan fetch raises
// `routePlansLoadError`, which then renders the alert instead of the empty
// state. The literal `routePlansLoadError = true;` stays present under
// `if (false)` (C.15.1 M-D07).
function routePlansFailure(source: string) {
  const page = exportedFunction(parseTsx(source, RUTAS_PAGE_PATH), "RutasPage");
  const set = renderedUnder(page, new Map([["routePlansLoadError", true]]));
  const isAlert = (element: JsxNode) =>
    staticAttribute(element, "role") === "alert" && elementText(element).includes(PLANS_ALERT);

  return {
    violations: failureFlagViolations(
      source,
      RUTAS_PAGE_PATH,
      "RutasPage",
      ["getRoutePlans"],
      "routePlansLoadError",
    ),
    alertWhenSet: set.some((rendered) => rendered.must && isAlert(rendered.element)),
    emptyWhenSet: set.some((rendered) => elementText(rendered.element).includes(PLANS_EMPTY)),
    alertWhenClear: renderedUnder(page, new Map([["routePlansLoadError", false]])).some(
      (rendered) => isAlert(rendered.element),
    ),
  };
}

test("dashboard logistica rutas defines non-indexable metadata and dependencies", () => {
  const source = read(RUTAS_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('title: "Planes de ruta — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  // B10: the shell chrome (topbar + navigation frame + main) has one owner for
  // all six clinic routes, so the route imports the shell, not the topbar.
  assert.ok(source.includes('import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";'));
  assert.equal(
    source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'),
    false,
  );
  assert.ok(source.includes('import { Badge } from "@/components/ui/badge";'));
  assert.ok(source.includes('import { getRoutePlans } from "@/lib/api";'));
});

test("dashboard logistica rutas forwards cookies and disables cache for live reads", () => {
  const source = read(RUTAS_PAGE_PATH);

  assert.ok(source.includes("async function getLogisticsRequestOptions(): Promise<RequestInit>"));
  assert.ok(source.includes("const cookieHeader = (await cookies()).toString();"));
  assert.ok(source.includes('cache: "no-store"'));
  assert.ok(source.includes("headers: cookieHeader ? { Cookie: cookieHeader } : {},"));
  assert.ok(source.includes("let routePlans: Awaited<ReturnType<typeof getRoutePlans>> = [];"));
  assert.ok(source.includes("let routePlansLoadError = false;"));
  assert.ok(source.includes("routePlans = await getRoutePlans("));
  assert.ok(source.includes("await getLogisticsRequestOptions(),"));
  assert.ok(source.includes("{ throwOnError: true },"));
});

test("dashboard logistica rutas sends explicit limit/offset instead of truncating silently (R-13)", () => {
  const source = read(RUTAS_PAGE_PATH);

  assert.ok(source.includes("{ limit, offset },"));
  assert.ok(source.includes("const RUTAS_DEFAULT_LIMIT = 50;"));
  assert.ok(source.includes("const RUTAS_MAX_LIMIT = 100;"));
  assert.ok(source.includes("function normalizeOffset(value: string | string[] | undefined): number {"));
  assert.ok(source.includes("function normalizeLimit(value: string | string[] | undefined): number {"));
  assert.ok(source.includes("searchParams?: Promise<RutasPageSearchParams>;"));
});

test("dashboard logistica rutas computes canGoNext/canGoPrevious without a backend total (R-13)", () => {
  const source = read(RUTAS_PAGE_PATH);

  assert.ok(source.includes("const canGoPrevious = !routePlansLoadError && offset > 0;"));
  assert.ok(source.includes("const canGoNext = !routePlansLoadError && routePlans.length === limit;"));
  assert.equal(source.includes("pageCount"), false);
  assert.equal(source.includes("matchMedia"), false);
  assert.equal(source.includes("ResizeObserver"), false);
});

test("dashboard logistica rutas renders a pager and page-scope disclosure (R-13)", () => {
  const source = read(RUTAS_PAGE_PATH);

  assert.ok(source.includes('aria-label="Paginación de planes de ruta"'));
  assert.ok(source.includes('aria-label="Página anterior"'));
  assert.ok(source.includes('aria-label="Página siguiente"'));
  assert.ok(source.includes("disabled={!canGoPrevious}"));
  assert.ok(source.includes("disabled={!canGoNext}"));
  assert.ok(source.includes("Mostrando {routePlans.length} planes de ruta · página {currentPage}"));
  assert.ok(source.includes("Conteos calculados sobre la página visible, no sobre el total general de planes de ruta."));
});

test("dashboard logistica rutas renders topbar without technical source copy", () => {
  const source = read(RUTAS_PAGE_PATH);
  const removedSourcePrefix = "Lectura conectada " + "a";
  const removedRoutePlansEndpoint = "GET " + "/api/logistics/route-plans";

  assert.ok(source.includes('title="Planes de ruta"'));
  assert.ok(source.includes('subtitle="Planificación y gestión de rutas de entrega"'));
  assert.ok(source.includes('<ClinicDashboardShell'));
  // B10: the clinic notification role is declared once, by the shared shell.
  assert.equal(source.includes('notifications="clinic"'), false);
  assert.equal(source.includes(removedSourcePrefix), false);
  assert.equal(source.includes(removedRoutePlansEndpoint), false);
});

test("dashboard logistica rutas keeps status counters aligned to route plan statuses", () => {
  const source = read(RUTAS_PAGE_PATH);

  assert.ok(source.includes("<ModuleMetricRun"));
  assert.ok(source.includes('surfaceId="clinic-logistica-rutas"'));
  assert.ok(source.includes('label: "Borradores", value: routePlans.filter((plan) => plan.status === "draft").length'));
  assert.ok(source.includes('label: "Liberadas", value: routePlans.filter((plan) => plan.status === "released").length'));
  assert.ok(source.includes('label: "En curso", value: routePlans.filter((plan) => plan.status === "in_progress").length'));
  assert.ok(source.includes('label: "Completadas", value: routePlans.filter((plan) => plan.status === "completed").length'));
  assert.equal(source.includes('className="dashboard-metric-card p-0"'), false);
});

test("dashboard logistica rutas renders table columns", () => {
  const source = read(RUTAS_PAGE_PATH);

  assert.ok(source.includes("<TableHead>ID</TableHead>"));
  assert.ok(source.includes("<TableHead>Nombre</TableHead>"));
  assert.ok(source.includes("<TableHead>Fecha planificada</TableHead>"));
  assert.ok(source.includes("<TableHead>Paradas</TableHead>"));
  assert.ok(source.includes("<TableHead>Progreso</TableHead>"));
  assert.ok(source.includes("<TableHead>Estado</TableHead>"));
});

test("dashboard logistica rutas keeps row rendering progress badges and dates", () => {
  const source = read(RUTAS_PAGE_PATH);

  assert.ok(source.includes("routePlans.map((plan) =>"));
  assert.ok(source.includes("const progress ="));
  assert.ok(source.includes("plan.totalStops > 0"));
  assert.ok(source.includes("Math.round("));
  assert.ok(source.includes("(plan.completedStops / plan.totalStops) * 100"));
  assert.ok(source.includes("formatDate(plan.plannedDate)"));
  assert.ok(source.includes("{plan.completedStops}/{plan.totalStops}"));
  assert.ok(source.includes('role="progressbar"'));
  assert.ok(source.includes("aria-valuenow={progress}"));
  assert.ok(source.includes("aria-valuemin={0}"));
  assert.ok(source.includes("aria-valuemax={100}"));
  assert.ok(source.includes('className="clinical-progress h-1.5 max-w-[80px] flex-1"'));
  assert.ok(source.includes("getRoutePlanStatusVariant(plan.status)"));
  assert.ok(source.includes("getRoutePlanStatusLabel(plan.status)"));
});

test("dashboard logistica rutas distinguishes load failures from real empty state", () => {
  const source = read(RUTAS_PAGE_PATH);

  assert.ok(source.includes("routePlansLoadError ? ("));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("No se pudieron cargar los planes de ruta. Intente nuevamente."));
  assert.ok(source.includes("No hay planes de ruta disponibles."));
  assert.ok(source.includes("colSpan={6}"));
  assert.ok(source.includes("<ModuleCard"));
  assert.ok(source.includes('className="clinical-table-state"'));
  assert.equal(source.includes("bg-gray-100"), false);
  assert.equal(source.includes("border-gray-100"), false);
  assert.equal(source.includes("fetch("), false);

  const separated = { violations: [], alertWhenSet: true, emptyWhenSet: false, alertWhenClear: false };
  assert.deepEqual(routePlansFailure(source), separated);

  const neverRaised = source.replace("routePlansLoadError = true;", () => "if (false)\nroutePlansLoadError = true;");
  assert.notEqual(neverRaised, source);
  assert.deepEqual(routePlansFailure(neverRaised), {
    ...separated,
    violations: ["routePlansLoadError = true is not an unconditional statement of a catch block"],
  });
});
