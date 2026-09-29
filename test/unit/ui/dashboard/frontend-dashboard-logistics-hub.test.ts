import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import ts from "typescript";
import {
  assertClean7aDependencyCleanupInvariants,
} from "../../../helpers/clean7a-dependency-cleanup-scope.ts";
import { isReportForeignAccessBackendFile } from "../../../helpers/report-foreign-access-scope.ts";
import { dashboardScopeGuardApplies } from "../../../helpers/dashboard-scope-guard.ts";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import {
  activeStatuses,
  assertPlainProps,
  descendants,
  elementText,
  exportedFunction,
  type JsxNode,
  parseTsx,
  renderedUnder,
  staticAttribute,
  tagName,
  TYPES_PATH,
} from "./dashboard-source-oracle.ts";

const LOGISTICS_PAGE_PATH = "frontend/src/app/dashboard/logistica/page.tsx";
const COMMAND_CENTER_PATH =
  "frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx";
const STICKY_ACTION_BAR_PATH =
  "frontend/src/components/dashboard/StickyActionBar.tsx";
const DASHBOARD_PAGE_HEADER_PATH =
  "frontend/src/components/dashboard/DashboardPageHeader.tsx";
const VISITS_ALERT = [
  "fieldVisitsLoadError",
  "No se pudieron cargar las visitas de campo. Intente nuevamente.",
  "No hay visitas de campo disponibles.",
] as const;
const PLANS_ALERT = [
  "routePlansLoadError",
  "No se pudieron cargar los planes de ruta. Intente nuevamente.",
  "No hay planes de ruta disponibles.",
] as const;
const DISTINGUISHED = { whenSet: true, emptyWhenSet: false, whenClear: false };
const ACTIVE = { activeVisits: ["scheduled", "in_progress"], activePlans: ["released", "in_progress"] };

// TEST-GLOBAL-07 (G06-D12): with its flag set the alert renders on every path
// and the empty state on none; with the flag clear the alert renders on no
// path. `.includes("fieldVisitsLoadError ?")` also matches the inverted
// `!fieldVisitsLoadError ?` (C.15.1 M-D10).
function alertRendering(source: string, flag: string, message: string, empty: string) {
  const component = exportedFunction(
    parseTsx(source, COMMAND_CENTER_PATH),
    "LogisticsCommandCenter",
  );
  const isAlert = (element: JsxNode) =>
    staticAttribute(element, "role") === "alert" && elementText(element).includes(message);
  const isEmpty = (element: JsxNode) =>
    tagName(element) === "EmptyState" && staticAttribute(element, "description") === empty;

  assertPlainProps(component, [flag]);

  const set = renderedUnder(component, new Map([[flag, true]]));
  return {
    whenSet: set.some((rendered) => rendered.must && isAlert(rendered.element)),
    emptyWhenSet: set.some((rendered) => isEmpty(rendered.element)),
    whenClear: renderedUnder(component, new Map([[flag, false]])).some((rendered) =>
      isAlert(rendered.element),
    ),
  };
}

// The hub is where "active" is derived for display (the route page's copy is
// not rendered): each metric must show the length of its executed filter.
function displayedActiveCounts(source: string): string[][] {
  return descendants(parseTsx(source, COMMAND_CENTER_PATH), ts.isObjectLiteralExpression)
    .map((metric) => {
      const field = (name: string) => {
        const property = metric.properties.find(
          (candidate) => ts.isPropertyAssignment(candidate) && candidate.name.getText() === name,
        );
        return property && ts.isPropertyAssignment(property) ? property.initializer : undefined;
      };
      const key = field("key");
      const value = field("value");

      return key && ts.isStringLiteral(key) && value ? [key.text, value.getText()] : [];
    })
    .filter(([key]) => key === "visitas-activas" || key === "planes-activos");
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

test("LogisticsCommandCenter renders operational priority section with the shared metric run", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("Estado operativo logística"));
  assert.ok(source.includes("Priorice visitas activas y planes en curso"));
  assert.ok(source.includes("logistics-operational-priority"));
  assert.ok(source.includes("Visitas activas"));
  assert.ok(source.includes("Planes activos"));
  assert.ok(source.includes("Total visitas"));
  assert.ok(source.includes("<ModuleMetricRun"));
  assert.ok(source.includes('surfaceId="clinic-logistica-full"'));
  assert.ok(source.includes('value: activeVisits.length'));
  assert.ok(source.includes('value: activePlans.length'));
  assert.ok(source.includes('value: fieldVisits.length'));
});

test("LogisticsCommandCenter computes active visits and plans from props without fetch", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("const activeVisits = fieldVisits.filter("));
  assert.ok(source.includes('v.status === "in_progress" || v.status === "scheduled"'));
  assert.ok(source.includes("const activePlans = routePlans.filter("));
  assert.ok(source.includes('p.status === "in_progress" || p.status === "released"'));
  assert.deepEqual(activeStatuses(source, COMMAND_CENTER_PATH, read(TYPES_PATH)), ACTIVE);
  assert.deepEqual(displayedActiveCounts(source), [
    ["visitas-activas", "activeVisits.length"],
    ["planes-activos", "activePlans.length"],
  ]);
});

// ── Section heading ──────────────────────────────────────────────────────────

test("LogisticsCommandCenter renders section heading with aria labelling", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("<section"));
  assert.ok(source.includes('aria-labelledby="logistics-command-center-heading"'));
  assert.ok(source.includes("logistics-command-center-heading"));
  assert.ok(source.includes("Centro de logística"));
  assert.ok(source.includes("<ModuleCard"));
  assert.ok(source.includes('ariaLabel="Centro de logística"'));
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
  // CMP-08: the visit row converged on the shared CanonicalOperationalRow
  // primitive (canonical "regular" pitch); the bespoke `.dashboard-list-row`
  // class was retired with it, identified now by its own data attribute.
  assert.ok(source.includes('dataAttributes={{ "data-logistics-recent-row": "visita" }}'));
});

test("LogisticsCommandCenter shows visits error alert with role=alert", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("fieldVisitsLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar las visitas de campo. Intente nuevamente."));
  assert.ok(source.includes('role="alert"'));
  assert.deepEqual(alertRendering(source, ...VISITS_ALERT), DISTINGUISHED);

  const inverted = source.replace("{fieldVisitsLoadError ? (", () => "{!fieldVisitsLoadError ? (");
  assert.notEqual(inverted, source);
  assert.deepEqual(alertRendering(inverted, ...VISITS_ALERT), {
    whenSet: false,
    emptyWhenSet: true,
    whenClear: true,
  });
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
  assert.ok(source.includes("identity={plan.name}"));
  assert.ok(source.includes("${plan.completedStops}/${plan.totalStops} paradas"));
  assert.ok(source.includes("formatDate(plan.plannedDate)"));
  assert.ok(source.includes("getRoutePlanStatusVariant(plan.status)"));
  assert.ok(source.includes("getRoutePlanStatusLabel(plan.status)"));
  // CMP-08: same CanonicalOperationalRow convergence as the visits list.
  assert.ok(source.includes('dataAttributes={{ "data-logistics-recent-row": "ruta" }}'));
});

test("LogisticsCommandCenter shows route plans error alert with role=alert", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("routePlansLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar los planes de ruta. Intente nuevamente."));
  assert.deepEqual(alertRendering(source, ...PLANS_ALERT), DISTINGUISHED);
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
  assert.ok(source.includes("<ModuleCard"));
  assert.ok(source.includes("<CanonicalOperationalRow"));
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

test("logistics page mounts the hub in the full-route module stage and passes its header actions", () => {
  const source = read(LOGISTICS_PAGE_PATH);

  assert.ok(source.includes("<ClinicFullRouteModuleStage moduleId=\"logistica-full\""));
  assert.ok(source.includes("headerActions={"));
  assert.ok(source.includes("href={ROUTES.dashboardLogisticaVisitas}"));
  assert.ok(source.includes("href={ROUTES.dashboardLogisticaRutas}"));
  assert.ok(source.includes("href={ROUTES.dashboardLogisticaMetricas}"));
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
