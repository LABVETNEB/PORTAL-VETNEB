import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const VISITAS_PAGE_PATH = "frontend/src/app/dashboard/logistica/visitas/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard logistica visitas defines non-indexable metadata and dependencies", () => {
  const source = read(VISITAS_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('title: "Visitas de campo — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  // B10: the shell chrome (topbar + navigation frame + main) has one owner for
  // all six clinic routes, so the route imports the shell, not the topbar.
  assert.ok(source.includes('import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";'));
  assert.equal(
    source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'),
    false,
  );
  assert.ok(source.includes('import { Badge } from "@/components/ui/badge";'));
  assert.ok(source.includes('import { getLogisticsFieldVisits } from "@/lib/api";'));
});

test("dashboard logistica visitas forwards cookies and disables cache for live reads", () => {
  const source = read(VISITAS_PAGE_PATH);

  assert.ok(source.includes("async function getLogisticsRequestOptions(): Promise<RequestInit>"));
  assert.ok(source.includes("const cookieHeader = (await cookies()).toString();"));
  assert.ok(source.includes('cache: "no-store"'));
  assert.ok(source.includes("headers: cookieHeader ? { Cookie: cookieHeader } : {},"));
  assert.ok(source.includes("visits = await getLogisticsFieldVisits("));
  assert.ok(source.includes("await getLogisticsRequestOptions(),"));
  assert.ok(source.includes("{ throwOnError: true },"));
});

test("dashboard logistica visitas sends explicit limit/offset instead of truncating silently (R-12)", () => {
  const source = read(VISITAS_PAGE_PATH);

  assert.ok(source.includes("{ limit, offset },"));
  assert.ok(source.includes("const VISITAS_DEFAULT_LIMIT = 50;"));
  assert.ok(source.includes("const VISITAS_MAX_LIMIT = 100;"));
  assert.ok(source.includes("function normalizeOffset(value: string | string[] | undefined): number {"));
  assert.ok(source.includes("function normalizeLimit(value: string | string[] | undefined): number {"));
  assert.ok(source.includes("searchParams?: Promise<VisitasPageSearchParams>;"));
});

test("dashboard logistica visitas computes canGoNext/canGoPrevious without a backend total (R-12)", () => {
  const source = read(VISITAS_PAGE_PATH);

  assert.ok(source.includes("const canGoPrevious = !visitsLoadError && offset > 0;"));
  assert.ok(source.includes("const canGoNext = !visitsLoadError && visits.length === limit;"));
  assert.equal(source.includes("pageCount"), false);
  assert.equal(source.includes("matchMedia"), false);
  assert.equal(source.includes("ResizeObserver"), false);
});

test("dashboard logistica visitas renders a pager and page-scope disclosure (R-12)", () => {
  const source = read(VISITAS_PAGE_PATH);

  assert.ok(source.includes('aria-label="Paginación de visitas"'));
  assert.ok(source.includes('aria-label="Página anterior"'));
  assert.ok(source.includes('aria-label="Página siguiente"'));
  assert.ok(source.includes("disabled={!canGoPrevious}"));
  assert.ok(source.includes("disabled={!canGoNext}"));
  assert.ok(source.includes("Mostrando {visits.length} visitas · página {currentPage}"));
  assert.ok(source.includes("Conteos calculados sobre la página visible, no sobre el total general de visitas."));
});

test("dashboard logistica visitas renders topbar without technical source copy", () => {
  const source = read(VISITAS_PAGE_PATH);
  const removedSourcePrefix = "Lectura conectada " + "a";
  const removedFieldVisitsEndpoint = "GET " + "/api/logistics/field-visits";

  assert.ok(source.includes('title="Visitas de campo"'));
  assert.ok(source.includes('subtitle="Seguimiento de visitas programadas y en curso"'));
  assert.ok(source.includes('<ClinicDashboardShell'));
  // B10: the clinic notification role is declared once, by the shared shell.
  assert.equal(source.includes('notifications="clinic"'), false);
  assert.equal(source.includes(removedSourcePrefix), false);
  assert.equal(source.includes(removedFieldVisitsEndpoint), false);
});

test("dashboard logistica visitas keeps status counters aligned to field visit statuses", () => {
  const source = read(VISITAS_PAGE_PATH);

  assert.ok(source.includes("<ModuleMetricRun"));
  assert.ok(source.includes('surfaceId="clinic-logistica-visitas"'));
  assert.ok(source.includes('label: "Pendientes", value: visits.filter((visit) => visit.status === "pending").length'));
  assert.ok(source.includes('label: "Programadas", value: visits.filter((visit) => visit.status === "scheduled").length'));
  assert.ok(source.includes('label: "En curso", value: visits.filter((visit) => visit.status === "in_progress").length'));
  assert.ok(source.includes('label: "Completadas", value: visits.filter((visit) => visit.status === "done").length'));
  assert.equal(source.includes('className="dashboard-metric-card p-0"'), false);
});

test("dashboard logistica visitas renders table columns", () => {
  const source = read(VISITAS_PAGE_PATH);

  assert.ok(source.includes("<TableHead>ID</TableHead>"));
  assert.ok(source.includes("<TableHead>Clínica</TableHead>"));
  assert.ok(source.includes("<TableHead>Dirección</TableHead>"));
  assert.ok(source.includes("<TableHead>Programada</TableHead>"));
  assert.ok(source.includes("<TableHead>Completada</TableHead>"));
  assert.ok(source.includes("<TableHead>Estado</TableHead>"));
  assert.ok(source.includes("<TableHead>Notas</TableHead>"));
});

test("dashboard logistica visitas keeps row rendering badges dates and fallbacks", () => {
  const source = read(VISITAS_PAGE_PATH);

  assert.ok(source.includes("visits.map((visit) =>"));
  assert.ok(source.includes("visit.clinicName ?? `Clínica #${visit.clinicId}`"));
  assert.ok(source.includes('visit.address ?? "—"'));
  assert.ok(source.includes("formatDateTime(visit.scheduledAt)"));
  assert.ok(source.includes("visit.completedAt"));
  assert.ok(source.includes("formatDateTime(visit.completedAt)"));
  assert.ok(source.includes("getFieldVisitStatusVariant(visit.status)"));
  assert.ok(source.includes("getFieldVisitStatusLabel(visit.status)"));
  assert.ok(source.includes('visit.notes ?? "—"'));
});

test("dashboard logistica visitas keeps empty state and avoids client-side fetch literals", () => {
  const source = read(VISITAS_PAGE_PATH);

  assert.ok(source.includes("No hay visitas de campo disponibles."));
  assert.ok(source.includes("colSpan={7}"));
  assert.ok(source.includes("<ModuleCard"));
  assert.ok(source.includes('className="clinical-table-state"'));
  assert.equal(source.includes("border-gray-100"), false);
  assert.equal(source.includes("fetch("), false);
});

test("dashboard logistica visitas separates fetch failures from real empty visits", () => {
  const source = read(VISITAS_PAGE_PATH);

  assert.ok(source.includes("let visits: Awaited<ReturnType<typeof getLogisticsFieldVisits>> = [];"));
  assert.ok(source.includes("let visitsLoadError = false;"));
  assert.ok(source.includes("try {"));
  assert.ok(source.includes("visitsLoadError = true;"));
  assert.ok(source.includes("visitsLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar las visitas de campo. Intente nuevamente."));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes(": visits.length ?"));
  assert.ok(source.includes("No hay visitas de campo disponibles."));
});
