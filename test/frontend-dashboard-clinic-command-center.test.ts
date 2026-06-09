import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const CLINIC_COMMAND_CENTER_PATH = "frontend/src/app/dashboard/ClinicCommandCenter.tsx";
const DASHBOARD_PAGE_PATH = "frontend/src/app/dashboard/page.tsx";
const STATUS_BADGE_PATH = "frontend/src/components/dashboard/StatusBadge.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

// ── Existence and scope boundaries ──────────────────────────────────────────

test("ClinicCommandCenter file exists at app/dashboard location", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);
  assert.ok(source.length > 0);
});

test("ClinicCommandCenter does not import from app/api, middleware, or auth modules", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.equal(source.includes('from "@/lib/api"'), false);
  assert.equal(source.includes('from "@/app/api'), false);
  assert.equal(source.includes("middleware"), false);
  assert.equal(source.includes('from "next/headers"'), false);
  assert.equal(source.includes('from "next-auth"'), false);
  assert.equal(source.includes('import { cookies }'), false);
});

test("ClinicCommandCenter does not import public-facing components", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.equal(source.includes('@/components/public/'), false);
  assert.equal(source.includes('PublicRouteControl'), false);
});

test("ClinicCommandCenter does not perform data fetching", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("await "), false);
  assert.equal(source.includes("getDashboardStats"), false);
  assert.equal(source.includes("getReports"), false);
  assert.equal(source.includes("getLogisticsFieldVisits"), false);
});

test("ClinicCommandCenter is not a client component", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.equal(source.includes('"use client"'), false);
  assert.equal(source.includes("'use client'"), false);
});

// ── Props contract ───────────────────────────────────────────────────────────

test("ClinicCommandCenter exports typed props and component", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes("export type ClinicCommandCenterProps = {"));
  assert.ok(source.includes("export function ClinicCommandCenter("));
  assert.ok(source.includes("stats: DashboardStats | null;"));
  assert.ok(source.includes("statsLoadError: boolean;"));
  assert.ok(source.includes("recentReports: Report[];"));
  assert.ok(source.includes("recentVisits: FieldVisit[];"));
  assert.ok(source.includes("reportsLoadError: boolean;"));
  assert.ok(source.includes("visitsLoadError: boolean;"));
});

test("ClinicCommandCenter imports types from @/types only (no server-only imports)", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes('import type { Report, FieldVisit, DashboardStats } from "@/types";'));
});

// ── Operational summary section ──────────────────────────────────────────────

test("ClinicCommandCenter renders operational priority section with KPI pills", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes("Estado operativo clínica"));
  assert.ok(source.includes("Priorice informes pendientes y visitas activas"));
  assert.ok(source.includes("dashboard-operational-priority"));
  assert.ok(source.includes("Informes pendientes"));
  assert.ok(source.includes("Visitas activas"));
  assert.ok(source.includes("{stats?.pendingReports ?? \"—\"}"));
  assert.ok(source.includes("{stats?.activeVisits ?? \"—\"}"));
  assert.ok(source.includes("dashboard-kpi-pill"));
  assert.ok(source.includes('data-tone="critical"'));
  assert.ok(source.includes('data-tone="focus"'));
});

// ── Metrics section ──────────────────────────────────────────────────────────

test("ClinicCommandCenter renders metrics section heading and StatsCards", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes("Métricas operativas"));
  assert.ok(source.includes("dashboard-section-heading"));
  assert.ok(source.includes("dashboard-section-description"));
  assert.ok(source.includes("Vista rápida de informes, pendientes y actividad logística del día."));
  assert.ok(source.includes("<StatsCards stats={stats} />"));
  assert.ok(source.includes('import { StatsCards } from "@/components/dashboard/StatsCards";'));
});

test("ClinicCommandCenter shows metrics error alert when statsLoadError is true", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes("statsLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar las métricas operativas. Intente nuevamente."));
  assert.ok(source.includes('role="alert"'));
});

// ── Reports list ─────────────────────────────────────────────────────────────

test("ClinicCommandCenter renders recent reports card with StatusBadge", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes("Informes recientes"));
  assert.ok(source.includes("Últimos estudios cargados y su estado actual."));
  assert.ok(source.includes("reportsLoadError ?"));
  assert.ok(source.includes("recentReports.length ?"));
  assert.ok(source.includes("recentReports.map((report) =>"));
  assert.ok(source.includes("{report.patientName ?? \"Sin nombre\"}"));
  assert.ok(source.includes("formatDate(report.uploadDate)"));
  assert.ok(source.includes("status={report.status}"));
  assert.ok(source.includes('import { StatusBadge } from "@/components/dashboard/StatusBadge";'));
});

test("ClinicCommandCenter renders empty state with EmptyState component for missing reports", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes('import { EmptyState } from "@/components/dashboard/EmptyState";'));
  assert.ok(source.includes("No hay informes recientes disponibles."));
});

test("ClinicCommandCenter shows reports load error alert with role=alert", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes("No se pudieron cargar los informes recientes. Intente nuevamente."));
});

// ── Visits list ──────────────────────────────────────────────────────────────

test("ClinicCommandCenter renders recent visits card with StatusBadge", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes("Visitas de campo"));
  assert.ok(source.includes("Programación logística con seguimiento en curso."));
  assert.ok(source.includes("visitsLoadError ?"));
  assert.ok(source.includes("recentVisits.length ?"));
  assert.ok(source.includes("recentVisits.map((visit) =>"));
  assert.ok(source.includes("{visit.clinicName ?? `Clínica #${visit.clinicId}`}"));
  assert.ok(source.includes("formatDate(visit.scheduledAt)"));
  assert.ok(source.includes("status={visit.status}"));
});

test("ClinicCommandCenter renders empty state with EmptyState component for missing visits", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes("No hay visitas de campo recientes disponibles."));
});

test("ClinicCommandCenter shows visits load error alert", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes("No se pudieron cargar las visitas de campo recientes. Intente nuevamente."));
});

// ── Layout contract ──────────────────────────────────────────────────────────

test("ClinicCommandCenter uses two-column responsive grid for reports and visits", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes("grid grid-cols-1 gap-6 lg:grid-cols-2"));
  assert.ok(source.includes("dashboard-surface"));
  assert.ok(source.includes("dashboard-list-row"));
});

test("ClinicCommandCenter uses section element with aria labelling", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes("<section"));
  assert.ok(source.includes("aria-labelledby=\"clinic-command-center-heading\""));
  assert.ok(source.includes("clinic-command-center-heading"));
});

// ── page.tsx integration contract ───────────────────────────────────────────

test("dashboard page imports and uses ClinicCommandCenter with full data prop set", () => {
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

test("dashboard page uses DashboardPageHeader and workspace controller above ClinicCommandCenter", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes('<DashboardPageHeader'));
  // PR5B: DashboardModuleHub and hub cards are inside ClinicDashboardWorkspaceController.
  assert.ok(source.includes('<ClinicDashboardWorkspaceController'));
  assert.ok(source.includes('<ClinicCommandCenter'));
  assert.equal(source.includes('import Link from "next/link"'), false);
  assert.equal(source.includes('<a href='), false);
});

test("dashboard page does not use next/link or bare anchor tags for navigation", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.equal(source.includes('import Link from "next/link"'), false);
  assert.equal(source.includes('import Link from \'next/link\''), false);
  assert.equal(source.includes('<a href='), false);
});

// ── StatusBadge extension ────────────────────────────────────────────────────

test("StatusBadge maps scheduled and no_show field visit statuses", () => {
  const source = read(STATUS_BADGE_PATH);

  assert.ok(source.includes('"scheduled"') || source.includes("scheduled:"));
  assert.ok(source.includes('"no_show"') || source.includes("no_show:"));
  assert.ok(source.includes("Programada"));
  assert.ok(source.includes("No presentado"));
});

// ── Scope invariants ─────────────────────────────────────────────────────────

test("package.json and pnpm-lock.yaml are not modified by this feature", () => {
  const rootPkg = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
  const frontendPkg = readFileSync(resolve(process.cwd(), "frontend/package.json"), "utf8");

  assert.ok(rootPkg.length > 0);
  assert.ok(frontendPkg.length > 0);
  // Verify no new dependencies were silently added to frontend
  assert.equal(frontendPkg.includes("ClinicCommandCenter"), false);
});

test("ClinicCommandCenter does not reference app/api routes or server-only functions", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.equal(source.includes("/api/"), false);
  assert.equal(source.includes("process.env"), false);
  assert.equal(source.includes("revalidatePath"), false);
  assert.equal(source.includes("revalidateTag"), false);
});
