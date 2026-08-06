import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  assertClean7aDependencyCleanupInvariants,
} from "../../../helpers/clean7a-dependency-cleanup-scope.ts";
import { isReportForeignAccessBackendFile } from "../../../helpers/report-foreign-access-scope.ts";
import { dashboardScopeGuardApplies } from "../../../helpers/dashboard-scope-guard.ts";

const LOGISTICS_PAGE_PATH = "frontend/src/app/dashboard/logistica/page.tsx";
const COMMAND_CENTER_PATH =
  "frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx";
const STICKY_ACTION_BAR_PATH =
  "frontend/src/components/dashboard/StickyActionBar.tsx";
const DASHBOARD_PAGE_HEADER_PATH =
  "frontend/src/components/dashboard/DashboardPageHeader.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function assertNoForbiddenSurfaceImports(source: string, context: string): void {
  const importLines = source
    .split("\n")
    .filter((line) => line.trim().startsWith("import "));
  const forbiddenPatterns = [
    /@\/app\/api/,
    /@\/middleware/,
    /@\/lib\/auth/,
    /@\/components\/public/,
    /\.\.\/.*\/auth/,
    /\.\.\/.*\/middleware/,
    /\.\.\/.*\/public/,
  ];

  for (const line of importLines) {
    for (const pattern of forbiddenPatterns) {
      assert.equal(
        pattern.test(line),
        false,
        `${context} must not import forbidden surface via: ${line}`,
      );
    }
  }
}

// ── Existence and scope boundaries ──────────────────────────────────────────

test("LogisticsCommandCenter file exists at app/dashboard/logistica location", () => {
  const source = read(COMMAND_CENTER_PATH);
  assert.ok(source.length > 0);
});

test("LogisticsCommandCenter does not import from API, auth, public, or middleware modules", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.equal(source.includes('from "@/lib/api"'), false);
  assert.equal(source.includes('from "@/app/api'), false);
  assert.equal(source.includes("middleware"), false);
  assert.equal(source.includes('from "next/headers"'), false);
  assert.equal(source.includes('from "next-auth"'), false);
  assert.equal(source.includes('import { cookies }'), false);
  assert.equal(source.includes('@/components/public/'), false);
  assert.equal(source.includes('PublicRouteControl'), false);
});

test("LogisticsCommandCenter does not perform data fetching", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("await "), false);
  assert.equal(source.includes("getLogisticsFieldVisits"), false);
  assert.equal(source.includes("getRoutePlans"), false);
});

test("LogisticsCommandCenter is not a client component", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.equal(source.includes('"use client"'), false);
  assert.equal(source.includes("'use client'"), false);
});

test("LogisticsCommandCenter does not reference app/api routes or server-only functions", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.equal(source.includes("/api/"), false);
  assert.equal(source.includes("process.env"), false);
  assert.equal(source.includes("revalidatePath"), false);
  assert.equal(source.includes("revalidateTag"), false);
});

// ── Props contract ───────────────────────────────────────────────────────────

test("LogisticsCommandCenter exports typed props and component", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("export type LogisticsCommandCenterProps = {"));
  assert.ok(source.includes("export function LogisticsCommandCenter("));
  assert.ok(source.includes("fieldVisits: FieldVisit[];"));
  assert.ok(source.includes("routePlans: RoutePlan[];"));
  assert.ok(source.includes("fieldVisitsLoadError: boolean;"));
  assert.ok(source.includes("routePlansLoadError: boolean;"));
});

test("LogisticsCommandCenter imports types from @/types only (no server-only imports)", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes('import type { FieldVisit, RoutePlan } from "@/types";'));
});

// ── Operational priority section ─────────────────────────────────────────────

test("LogisticsCommandCenter renders operational priority section with KPI pills", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("Estado operativo logística"));
  assert.ok(source.includes("Priorice visitas activas y planes en curso"));
  assert.ok(source.includes("logistics-operational-priority"));
  assert.ok(source.includes("Visitas activas"));
  assert.ok(source.includes("Planes activos"));
  assert.ok(source.includes("Total visitas"));
  assert.ok(source.includes("dashboard-kpi-pill"));
  assert.ok(source.includes('data-tone="focus"'));
  assert.ok(source.includes('data-tone="critical"'));
  assert.ok(source.includes("{activeVisits.length}"));
  assert.ok(source.includes("{activePlans.length}"));
  assert.ok(source.includes("{fieldVisits.length}"));
});

test("LogisticsCommandCenter computes active visits and plans from props without fetch", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("const activeVisits = fieldVisits.filter("));
  assert.ok(source.includes('v.status === "in_progress" || v.status === "scheduled"'));
  assert.ok(source.includes("const activePlans = routePlans.filter("));
  assert.ok(source.includes('p.status === "in_progress" || p.status === "released"'));
});

// ── Section heading ──────────────────────────────────────────────────────────

test("LogisticsCommandCenter renders section heading with aria labelling", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("<section"));
  assert.ok(source.includes('aria-labelledby="logistics-command-center-heading"'));
  assert.ok(source.includes("logistics-command-center-heading"));
  assert.ok(source.includes("Centro de logística"));
  assert.ok(source.includes("dashboard-section-heading"));
  assert.ok(source.includes("dashboard-section-description"));
});

// ── Visits list ──────────────────────────────────────────────────────────────

test("LogisticsCommandCenter hands the full ordered visit collection to the bounded canvas with StatusBadge", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("Visitas de campo"));
  // A03: cardinality belongs to LogisticsRecentListCanvas, which measures its
  // own height. A pre-pagination cap here capped the list below the measured
  // page size and made a complete second page unreachable on tall viewports.
  assert.ok(source.includes("const recentVisits = fieldVisits;"));
  assert.ok(
    !/const recentVisits = fieldVisits\.slice\(/.test(source),
    "recentVisits must not be truncated before the adaptive canvas pages it",
  );
  assert.ok(source.includes("recentVisits.map((visit) =>"));
  assert.ok(source.includes("{visit.clinicName ?? `Clínica #${visit.clinicId}`}"));
  assert.ok(source.includes('visit.address ?? "Sin dirección"'));
  assert.ok(source.includes("formatDate(visit.scheduledAt)"));
  assert.ok(source.includes("status={visit.status}"));
  assert.ok(source.includes('import { StatusBadge } from "@/components/dashboard/StatusBadge";'));
  assert.ok(source.includes('className="dashboard-list-row"'));
});

test("LogisticsCommandCenter shows visits error alert with role=alert", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("fieldVisitsLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar las visitas de campo. Intente nuevamente."));
  assert.ok(source.includes('role="alert"'));
});

test("LogisticsCommandCenter renders EmptyState for missing visits", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes('import { EmptyState } from "@/components/dashboard/EmptyState";'));
  assert.ok(source.includes("Sin visitas activas"));
  assert.ok(source.includes("No hay visitas de campo disponibles."));
});

// ── Route plans list ─────────────────────────────────────────────────────────

test("LogisticsCommandCenter hands the full ordered route plan collection to the bounded canvas with status badge", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("Planes de ruta"));
  assert.ok(source.includes("const recentPlans = routePlans;"));
  assert.ok(
    !/const recentPlans = routePlans\.slice\(/.test(source),
    "recentPlans must not be truncated before the adaptive canvas pages it",
  );
  assert.ok(source.includes("recentPlans.map((plan) =>"));
  assert.ok(source.includes("{plan.name}"));
  assert.ok(source.includes("{plan.completedStops}/{plan.totalStops} paradas"));
  assert.ok(source.includes("formatDate(plan.plannedDate)"));
  assert.ok(source.includes("getRoutePlanStatusVariant(plan.status)"));
  assert.ok(source.includes("getRoutePlanStatusLabel(plan.status)"));
  assert.ok(source.includes('className="dashboard-list-row"'));
});

test("LogisticsCommandCenter shows route plans error alert with role=alert", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("routePlansLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar los planes de ruta. Intente nuevamente."));
});

test("LogisticsCommandCenter renders EmptyState for missing route plans", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("Sin planes de ruta"));
  assert.ok(source.includes("No hay planes de ruta disponibles."));
});

// ── Layout contract ──────────────────────────────────────────────────────────

test("LogisticsCommandCenter uses two-column responsive grid for visits and plans", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("grid grid-cols-1 gap-6 lg:grid-cols-2"));
  assert.ok(source.includes("dashboard-surface"));
  assert.ok(source.includes("dashboard-list-row"));
});

test("LogisticsCommandCenter does not use next/link or bare anchor tags", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.equal(source.includes('from "next/link"'), false);
  assert.equal(source.includes('<a href='), false);
  assert.equal(source.includes("<Link"), false);
});

// ── page.tsx integration contract ───────────────────────────────────────────

test("logistics page imports and uses LogisticsCommandCenter with full data prop set", () => {
  const source = read(LOGISTICS_PAGE_PATH);

  assert.ok(source.includes('import { LogisticsCommandCenter } from "./LogisticsCommandCenter";'));
  assert.ok(source.includes("<LogisticsCommandCenter"));
  assert.ok(source.includes("fieldVisits={fieldVisits}"));
  assert.ok(source.includes("routePlans={routePlans}"));
  assert.ok(source.includes("fieldVisitsLoadError={fieldVisitsLoadError}"));
  assert.ok(source.includes("routePlansLoadError={routePlansLoadError}"));
});

test("logistics page uses DashboardPageHeader and StickyActionBar above LogisticsCommandCenter", () => {
  const source = read(LOGISTICS_PAGE_PATH);

  assert.ok(source.includes('<DashboardPageHeader'));
  assert.ok(source.includes('title="Hub de logística"'));
  assert.ok(source.includes('<StickyActionBar'));
  assert.ok(source.includes('context="Acciones rápidas"'));
  assert.ok(source.includes("href: ROUTES.dashboardLogisticaVisitas"));
  assert.ok(source.includes("href: ROUTES.dashboardLogisticaRutas"));
  assert.ok(source.includes("href: ROUTES.dashboardLogisticaMetricas"));
  assert.equal(source.includes('import Link from "next/link"'), false);
  assert.equal(source.includes('<a href='), false);
});

test("logistics page does not use next/link or bare anchor tags for navigation", () => {
  const source = read(LOGISTICS_PAGE_PATH);

  assert.equal(source.includes('import Link from "next/link"'), false);
  assert.equal(source.includes('import Link from \'next/link\''), false);
  assert.equal(source.includes('<a href='), false);
});

// ── DashboardPageHeader contract passthrough ─────────────────────────────────

test("DashboardPageHeader exports typed props and component", () => {
  const source = read(DASHBOARD_PAGE_HEADER_PATH);

  assert.ok(source.includes("export type DashboardPageHeaderProps = {"));
  assert.ok(source.includes("export function DashboardPageHeader("));
  assert.ok(source.includes("title: string;"));
  assert.ok(source.includes("description?: string;"));
  assert.ok(source.includes("badge?: ReactNode;"));
  assert.ok(source.includes("actions?: ReactNode;"));
});

// ── Scope invariants ─────────────────────────────────────────────────────────

test("logistics hub preserves frontend boundaries and CLEAN7A dependency invariants", () => {
  const commandCenterSource = read(COMMAND_CENTER_PATH);
  const stickyActionBarSource = read(STICKY_ACTION_BAR_PATH);

  assertNoForbiddenSurfaceImports(commandCenterSource, "LogisticsCommandCenter");
  assertNoForbiddenSurfaceImports(stickyActionBarSource, "StickyActionBar");
  assertClean7aDependencyCleanupInvariants();
});

test("logistics hub changes do not touch backend, API routes, auth, middleware or SEO files", () => {
  const changedFiles = execFileSync(
    "git",
    ["diff", "--name-only"],
    { encoding: "utf8" },
  ).trim();

  // PR-specific guard: only enforce when the diff touches dashboard scope. A
  // backend logistics feature shell (server/features/logistics/**) is not a
  // frontend dashboard/logistics-hub change, so this guard is not-applicable.
  if (!dashboardScopeGuardApplies(changedFiles.split(/\r?\n/).filter(Boolean))) {
    return;
  }

  const forbiddenPaths = [
    "server/",
    "middleware.ts",
    "next.config",
    "app/api/",
    "app/login",
    "app/profesionales",
    "app/particulares",
    "app/contacto",
    "pnpm-lock.yaml",
    "next-env.d.ts",
  ];

  const pr4ServerFiles = [
    "server/db.ts",
    "server/routes/reports.fastify.ts",
    "server/routes/contact.fastify.ts",
  ];
  const filteredChangedFiles = changedFiles
    .split("\n")
    .filter(
      (f) =>
        !pr4ServerFiles.includes(f.trim()) &&
        !isReportForeignAccessBackendFile(f.trim()),
    )
    .join("\n");
  for (const path of forbiddenPaths) {
    const matching = filteredChangedFiles
      .split("\n")
      .filter((f) => f.includes(path));
    assert.equal(
      matching.length,
      0,
      `logistics hub must not modify ${path}: found ${matching.join(", ")}`,
    );
  }
});
