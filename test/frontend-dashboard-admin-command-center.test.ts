import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const ADMIN_COMMAND_CENTER_PATH =
  "frontend/src/app/dashboard/admin/AdminCommandCenter.tsx";
const STICKY_ACTION_BAR_PATH =
  "frontend/src/components/dashboard/StickyActionBar.tsx";

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

test("StickyActionBar keeps reusable fixed and sticky action contracts", () => {
  const source = read(STICKY_ACTION_BAR_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("export type StickyActionBarAction = {"));
  assert.ok(source.includes("label: string;"));
  assert.ok(source.includes("href?: string;"));
  assert.ok(source.includes("onClick?: () => void;"));
  assert.ok(source.includes('variant?: ButtonProps["variant"];'));
  assert.ok(source.includes('"aria-label"?: string;'));
  assert.ok(source.includes("context?: string;"));
  assert.ok(source.includes("visible?: boolean;"));
  assert.ok(source.includes("if (visible === false) {"));
  assert.ok(source.includes("return null;"));
  assert.ok(source.includes("const navigateToHref = (href: string) => {"));
  assert.ok(source.includes("window.location.assign(href);"));
  assert.ok(source.includes("if (action.href) {"));
  assert.ok(source.includes("navigateToHref(action.href);"));
  assert.ok(source.includes("action.onClick?.();"));
  assert.ok(source.includes("<span>{action.label}</span>"));
  assert.ok(source.includes("fixed inset-x-0 bottom-0 z-50"));
  assert.ok(source.includes("md:sticky md:top-[4.75rem]"));
  assert.ok(source.includes("focus-visible:ring-2 focus-visible:ring-ring/85"));
  assert.equal(source.includes("Dropdown"), false);
  assert.equal(source.includes('from "next/link"'), false);
  assert.equal(source.includes("<Link"), false);
  assert.equal(source.includes("<a"), false);
  assert.equal(source.includes("fetch("), false);
});

test("AdminCommandCenter keeps real KPI summary and alert shortcuts", () => {
  const source = read(ADMIN_COMMAND_CENTER_PATH);

  assert.ok(source.includes("type AdminCommandCenterProps = {"));
  assert.ok(source.includes("auditEntriesCount: number;"));
  assert.ok(source.includes("eventTypesCount: number;"));
  assert.ok(source.includes("systemStatusLabel: string;"));
  assert.ok(source.includes("hasSystemHealthFetchError: boolean;"));
  assert.ok(source.includes('aria-labelledby="admin-command-center-heading"'));
  assert.ok(source.includes("Resumen operativo"));
  assert.ok(source.includes("Eventos de auditoría"));
  assert.ok(source.includes("Tipos de evento"));
  assert.ok(source.includes("Estado del sistema"));
  assert.ok(source.includes("Registros totales"));
  assert.ok(source.includes("Categorías distintas"));
  assert.ok(source.includes("No se pudo consultar el estado del sistema."));
  assert.ok(source.includes("Alertas"));
  assert.ok(source.includes("Intentos fallidos de login"));
  assert.ok(source.includes("Consultar salud, esquema y mantenimiento agrupados."));
  assert.ok(source.includes('className="surface-soft"'));
  assert.equal(source.includes("<a"), false);
  assert.equal(source.includes("fetch("), false);
});

test("dashboard admin composes module hub, command center, and existing cards", () => {
  const source = read(ADMIN_PAGE_PATH);
  const controllerSource = read("frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx");

  assert.ok(source.includes("<DashboardPageHeader"));
  // PR5B: DashboardModuleHub and adminCards are inside AdminDashboardWorkspaceController.
  assert.ok(source.includes("<AdminDashboardWorkspaceController"));
  assert.ok(source.includes("<AdminCommandCenter"));
  assert.ok(controllerSource.includes("const adminCards = ["));
  assert.ok(controllerSource.includes('title: "Subir informe"'));
  assert.ok(controllerSource.includes('"admin-report-upload"'));
  assert.ok(controllerSource.includes('title: "Clínicas"'));
  assert.ok(controllerSource.includes('"admin-clinics"'));
  assert.ok(controllerSource.includes('title: "Tokens particulares"'));
  assert.ok(controllerSource.includes('"admin-particular-tokens"'));
  assert.ok(controllerSource.includes('title: "Estado del sistema"'));
  assert.ok(controllerSource.includes('"admin-health"'));
  assert.ok(source.includes("<AdminFailedLoginAlertsReadOnlyCard />"));
  assert.ok(source.includes("<AdminSchemaHealthStatusCard />"));
  assert.ok(source.includes("<AdminMaintenanceDryRunCard />"));
  assert.ok(source.includes("<AdminClinicsManagementCard />"));
  assert.ok(source.includes("<AdminParticularTokensCard />"));
  assert.ok(source.includes("<AdminPricingEditorCard />"));
  assert.ok(source.includes("<AdminSessionsReadOnlyCard />"));
  assert.ok(source.includes("<AdminUsersRolesReadOnlyCard />"));
  assert.ok(source.includes('className="h-24 md:hidden" aria-hidden="true"'));

  const mainIndex = source.indexOf('<main className="dashboard-main">');
  const pageHeaderIndex = source.indexOf("<DashboardPageHeader", mainIndex);
  const workspaceControllerIndex = source.indexOf("<AdminDashboardWorkspaceController", mainIndex);
  // PR5B: slot vars defined before <main> in render order (commandCenter → alerts → tabs).
  const commandCenterIndex = source.indexOf("<AdminCommandCenter");
  const alertsIndex = source.indexOf("Alertas críticas");
  const alertsCardIndex = source.indexOf("<AdminFailedLoginAlertsReadOnlyCard />");
  // App Shell: the audit registry is a dedicated component rendered in the slot.
  const auditLogIndex = source.indexOf("<AdminAuditLogTable");

  // PR5C: slot vars defined before <main>; each workspace is isolated per module.
  // App Shell: page header is a controller prop, so it appears after the
  // controller opening tag (last in source order).
  const order = [
    commandCenterIndex,
    alertsIndex,
    alertsCardIndex,
    auditLogIndex,
    workspaceControllerIndex,
    pageHeaderIndex,
  ];

  for (const index of order) {
    assert.ok(index >= 0, `admin main source must contain ordered marker at index ${index}`);
  }

  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
    "admin command center order must prioritize actions, alerts, system, management, and audit",
  );
});

test("dashboard admin command center changes stay inside frontend scope", () => {
  const stickyActionBarSource = read(STICKY_ACTION_BAR_PATH);
  const commandCenterSource = read(ADMIN_COMMAND_CENTER_PATH);
  const packageDiff = execFileSync(
    "git",
    ["diff", "--name-only", "--", "package.json", "pnpm-lock.yaml"],
    { encoding: "utf8" },
  ).trim();

  assertNoForbiddenSurfaceImports(stickyActionBarSource, "StickyActionBar");
  assertNoForbiddenSurfaceImports(commandCenterSource, "AdminCommandCenter");
  assert.equal(stickyActionBarSource.includes("app/api"), false);
  assert.equal(commandCenterSource.includes("app/api"), false);
  assert.equal(stickyActionBarSource.toLowerCase().includes("middleware"), false);
  assert.equal(commandCenterSource.toLowerCase().includes("middleware"), false);
  assert.equal(packageDiff, "");
});
