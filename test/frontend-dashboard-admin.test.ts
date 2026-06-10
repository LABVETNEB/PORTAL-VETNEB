import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const ADMIN_COMMAND_CENTER_PATH =
  "frontend/src/app/dashboard/admin/AdminCommandCenter.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard admin defines non-indexable metadata and admin dependencies", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { PublicRouteControl } from "@/components/public/PublicRouteControl";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('title: "Administración — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  assert.ok(source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'));
  assert.ok(source.includes('import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";'));
  assert.ok(source.includes('import { AdminDashboardWorkspaceController } from "./AdminDashboardWorkspaceController";'));
  assert.ok(source.includes('import { AdminCommandCenter } from "./AdminCommandCenter";'));
  assert.ok(source.includes('import { getAdminSystemHealth, getAuditEntries } from "@/lib/api";'));
  assert.ok(source.includes('import { formatDateTime } from "@/lib/utils";'));
});

test("dashboard admin includes read-only admin cards", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes('import { AdminClinicsManagementCard } from "./AdminClinicsManagementCard";'));
  assert.ok(source.includes('import { AdminFailedLoginAlertsReadOnlyCard } from "./AdminFailedLoginAlertsReadOnlyCard";'));
  assert.ok(source.includes('import { AdminMaintenanceDryRunCard } from "./AdminMaintenanceDryRunCard";'));
  assert.ok(source.includes('import { AdminParticularTokensCard } from "./AdminParticularTokensCard";'));
  assert.ok(source.includes('import { AdminSessionsReadOnlyCard } from "./AdminSessionsReadOnlyCard";'));
  assert.ok(source.includes('import { AdminUsersRolesReadOnlyCard } from "./AdminUsersRolesReadOnlyCard";'));
  assert.equal(source.includes('import { UploadReportModal } from "@/components/dashboard/UploadReportModal";'), false);
  assert.ok(source.includes("<AdminMaintenanceDryRunCard />"));
  assert.ok(source.includes("<AdminClinicsManagementCard />"));
  assert.ok(source.includes("<AdminParticularTokensCard />"));
  assert.ok(source.includes("<AdminSessionsReadOnlyCard />"));
  assert.ok(source.includes("<AdminFailedLoginAlertsReadOnlyCard />"));
  assert.ok(source.includes("<AdminUsersRolesReadOnlyCard />"));
});

test("dashboard admin keeps audit event and actor labels", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes("const EVENT_LABELS: Record<string, string> = {"));
  assert.ok(source.includes('"auth.admin.login.succeeded": "Login admin"'));
  assert.ok(source.includes('"auth.clinic.login.succeeded": "Login clínica"'));
  assert.ok(source.includes('"clinic.created": "Clínica creada"'));
  assert.ok(source.includes('"clinic.updated": "Clínica actualizada"'));
  assert.ok(source.includes('"clinic_user.created": "Usuario clínica creado"'));
  assert.ok(source.includes('"clinic_user.credentials.updated": "Credenciales clínica"'));
  assert.ok(source.includes('"clinic_user.role.changed": "Cambio rol clínica"'));
  assert.ok(source.includes('"report.status.changed": "Estado informe"'));
  assert.ok(source.includes('"report.uploaded": "Informe subido"'));
  assert.ok(source.includes('"report_access_token.revoked": "Token revocado"'));
  assert.ok(source.includes('"report.public_accessed": "Acceso público"'));
  assert.ok(source.includes("const ACTOR_LABELS: Record<string, string> = {"));
  assert.ok(source.includes('system: "Sistema"'));
  assert.ok(source.includes('admin_user: "Admin"'));
  assert.ok(source.includes('clinic_user: "Clínica"'));
  assert.ok(source.includes('public_report_access_token: "Token público"'));
});

test("dashboard admin keeps status and service formatting helpers", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes("function getEventVariant("));
  assert.ok(source.includes('if (event.includes("login")) return "default";'));
  assert.ok(source.includes('if (event.includes("revoked") || event.includes("canceled")) return "outline";'));
  assert.ok(source.includes("function getServiceVariant("));
  assert.ok(source.includes('if (value === "up") return "default";'));
  assert.ok(source.includes('if (value === "degraded") return "secondary";'));
  assert.ok(source.includes('if (value === "down") return "outline";'));
  assert.ok(source.includes("function formatServiceStatus(value: unknown)"));
  assert.ok(source.includes('if (value === "up") return "Activo";'));
  assert.ok(source.includes('if (value === "configured") return "Configurado";'));
  assert.ok(source.includes('if (value === "degraded") return "Degradado";'));
  assert.ok(source.includes('if (value === "down") return "Caído";'));
  assert.ok(source.includes('if (value === "not_configured") return "No configurado";'));
  assert.ok(source.includes("function getConfiguredContactRecipients(services: Record<string, unknown>)"));
  assert.ok(source.includes("function getSystemStatusVariant("));
  assert.ok(source.includes("function formatSystemStatus(status: string)"));
  assert.ok(source.includes("function getSystemStatusIndicatorClass(status: string)"));
  assert.ok(source.includes("function formatUptime(totalSeconds: number | undefined)"));
});

test("dashboard admin keeps sensitive audit metadata redaction", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes("const SENSITIVE_AUDIT_METADATA_KEY_PARTS = ["));
  assert.ok(source.includes('"password"'));
  assert.ok(source.includes('"token"'));
  assert.ok(source.includes('"secret"'));
  assert.ok(source.includes('"cookie"'));
  assert.ok(source.includes('"auth"'));
  assert.ok(source.includes('"hash"'));
  assert.ok(source.includes("function isSensitiveAuditMetadataKey(key: string)"));
  assert.ok(source.includes("normalizedKey.includes(part)"));
  assert.ok(source.includes("!isSensitiveAuditMetadataKey(key)"));
  assert.ok(source.includes("function getAuditMetadataSummary(entry: { event: string; metadata: Record<string, unknown> | null })"));
});

test("dashboard admin forwards cookies and performs no-store admin reads", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes("async function getAdminRequestOptions(): Promise<RequestInit>"));
  assert.ok(source.includes("const cookieHeader = (await cookies()).toString();"));
  assert.ok(source.includes('cache: "no-store"'));
  assert.ok(source.includes("headers: cookieHeader ? { Cookie: cookieHeader } : {},"));
  assert.ok(source.includes("let auditEntries: Awaited<ReturnType<typeof getAuditEntries>> = [];"));
  assert.ok(source.includes("let auditEntriesLoadError = false;"));
  assert.ok(source.includes("auditEntries = await getAuditEntries(await getAdminRequestOptions(), {"));
  assert.ok(source.includes("throwOnError: true,"));
  assert.ok(source.includes("const systemHealth = await getAdminSystemHealth(await getAdminRequestOptions());"));
});

test("dashboard admin keeps audit filters and filter href builder", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes("type AdminPageSearchParams = {"));
  assert.ok(source.includes("event?: string;"));
  assert.ok(source.includes("actorType?: string;"));
  assert.ok(source.includes("function normalizeAuditFilter(value: string | string[] | undefined)"));
  assert.ok(source.includes("function buildAdminAuditFilterHref(input: {"));
  assert.ok(source.includes('query.set("event", input.event);'));
  assert.ok(source.includes('query.set("actorType", input.actorType);'));
  assert.ok(source.includes('return `/dashboard/admin?${query.toString()}`;'));
  assert.ok(source.includes("const hasActiveAuditFilters ="));
});

test("dashboard admin renders topbar, health, and summary cards", () => {
  const source = read(ADMIN_PAGE_PATH);
  const commandCenterSource = read(ADMIN_COMMAND_CENTER_PATH);
  const combinedSource = `${source}\n${commandCenterSource}`;

  assert.ok(source.includes('title="Administración"'));
  assert.ok(source.includes('subtitle="Auditoría, reportes y estado operacional"'));
  assert.ok(source.includes("<DashboardPageHeader"));
  assert.ok(source.includes("<AdminDashboardWorkspaceController"));
  assert.ok(source.includes("<AdminCommandCenter"));
  assert.ok(combinedSource.includes("Eventos de auditoría"));
  assert.ok(combinedSource.includes("Tipos de evento"));
  assert.ok(combinedSource.includes("Estado del sistema"));
  assert.ok(source.includes('id="admin-report-upload"'));
  assert.ok(source.includes("Panel administrador"));
  assert.ok(source.includes("cada token administrado"));
  assert.ok(source.includes("sin búsqueda manual"));
  assert.equal(source.includes("<UploadReportModal />"), false);
  assert.ok(source.includes('id="admin-health"'));
  assert.ok(source.includes("<AdminClinicsManagementCard />"));
  assert.ok(source.includes('id="admin-maintenance"'));
  assert.ok(source.includes('id="admin-sessions"'));
  assert.ok(source.includes('id="admin-particular-tokens"'));
  assert.ok(source.includes('id="admin-users-roles"'));
  assert.ok(source.includes('id="admin-event-summary"'));
  assert.ok(source.includes("Estado y mantenimiento"));
  assert.ok(source.includes("Transporte de correo"));
  assert.ok(source.includes("Gmail API"));
  assert.ok(source.includes("Contacto email"));
  assert.ok(source.includes("CORS público"));
  assert.ok(source.includes("Entorno"));
  assert.ok(source.includes("serviceChecks.email_transport"));
  assert.ok(source.includes("serviceChecks.gmail_api"));
  assert.ok(source.includes("serviceChecks.contact_email"));
  assert.ok(source.includes("serviceChecks.cors"));
  assert.ok(source.includes("serviceChecks.contact_to_configured"));
  assert.ok(source.includes("serviceChecks.smtp_from_configured"));
  assert.ok(source.includes("serviceChecks.node_env"));
  assert.ok(source.includes("contactRecipients.length > 0"));
  assert.ok(source.includes("corsOrigins.length > 0"));
  assert.equal(source.includes("Health & Maintenance"), false);
  assert.equal(source.includes("AdminSourceContractMarkers"), false);
  assert.equal(source.includes("ADMIN_READ_CONTRACT_MARKERS"), false);
});

test("dashboard admin keeps module hub cards and preserves admin sections", () => {
  const source = read(ADMIN_PAGE_PATH);
  const controllerSource = read("frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx");

  // PR5B: admin cards and DashboardModuleHub are inside AdminDashboardWorkspaceController.
  assert.ok(controllerSource.includes("const adminCards = ["));
  assert.ok(controllerSource.includes('title: "Subir informe"'));
  assert.ok(controllerSource.includes('"admin-report-upload"'));
  assert.ok(controllerSource.includes('title: "Clínicas"'));
  assert.ok(controllerSource.includes('"admin-clinics"'));
  assert.ok(controllerSource.includes('title: "Tokens particulares"'));
  assert.ok(controllerSource.includes('"admin-particular-tokens"'));
  assert.ok(controllerSource.includes('title: "Estado del sistema"'));
  assert.ok(controllerSource.includes('"admin-health"'));
  assert.ok(source.includes('<AdminDashboardWorkspaceController'));
  assert.ok(source.includes('id="admin-report-upload"'));
  assert.ok(source.includes("Carga de informes"));
  assert.ok(source.includes("cada token administrado"));
  assert.ok(source.includes("Alertas críticas"));
  assert.ok(source.includes("Sistema"));
  assert.ok(source.includes("Auditoría"));
  assert.ok(source.includes('id="admin-health"'));
  assert.ok(source.includes("<AdminClinicsManagementCard />"));
  assert.ok(source.includes('id="admin-maintenance"'));
  assert.ok(source.includes('id="admin-particular-tokens"'));
  assert.ok(source.includes('id="admin-sessions"'));
  assert.ok(source.includes('id="admin-users-roles"'));
  assert.ok(source.includes('id="audit-role-changes"'));
  assert.ok(source.includes('id="audit-log"'));

  const mainIndex = source.indexOf('<main className="dashboard-main">');
  const pageHeaderIndex = source.indexOf("<DashboardPageHeader", mainIndex);
  const workspaceControllerIndex = source.indexOf("<AdminDashboardWorkspaceController", mainIndex);
  // PR5B: slot vars defined before <main> in render order (commandCenter → alerts → tabs).
  const commandCenterIndex = source.indexOf("<AdminCommandCenter");
  const alertsCardIndex = source.indexOf("<AdminFailedLoginAlertsReadOnlyCard />");
  const reportUploadTitleIndex = source.indexOf("Carga de informes");

  assert.ok(mainIndex >= 0);
  assert.ok(pageHeaderIndex >= 0);
  assert.ok(workspaceControllerIndex >= 0);
  assert.ok(commandCenterIndex >= 0);
  assert.ok(alertsCardIndex >= 0);
  assert.ok(reportUploadTitleIndex >= 0);
  assert.ok(mainIndex < pageHeaderIndex);
  assert.ok(pageHeaderIndex < workspaceControllerIndex);
  assert.ok(commandCenterIndex < alertsCardIndex);
  assert.ok(alertsCardIndex < reportUploadTitleIndex);
  assert.equal(source.includes(`xl:grid-cols-${7}`), false);
});

test("dashboard admin surfaces system health fetch failures", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes("const hasSystemHealthFetchError = systemHealth === null;"));
  assert.ok(source.includes("hasSystemHealthFetchError"));
  assert.ok(source.includes("No se pudo consultar el estado del sistema."));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("Los valores de salud"));
  assert.ok(source.includes("formatSystemStatusDetail(serviceChecks)"));
});

test("dashboard admin surfaces study tracking notifications", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes("const notificationAuditEntries = auditEntries.filter("));
  assert.ok(source.includes('(entry) => entry.event === "study_tracking.notification.created",'));
  assert.ok(source.includes("const lastNotificationAuditEntry = notificationAuditEntries[0];"));
  assert.ok(source.includes('id="admin-notifications"'));
  assert.ok(source.includes('<CardTitle className="text-base">Notificaciones</CardTitle>'));
  assert.ok(source.includes("notificationAuditEntries.length"));
  assert.ok(source.includes("lastNotificationAuditEntry"));
  assert.ok(source.includes("formatDateTime(lastNotificationAuditEntry.createdAt)"));
  assert.ok(source.includes('event: "study_tracking.notification.created",'));
  assert.ok(source.includes("Ver notificaciones"));
});

test("dashboard admin renders role-change audit and audit log table", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes('id="audit-role-changes"'));
  assert.ok(source.includes("Auditoría de cambios de rol clínica"));
  assert.ok(source.includes('event: "clinic_user.role.changed"'));
  assert.ok(source.includes("Ver cambios de rol"));
  assert.ok(source.includes("Resumen por tipo de evento"));
  assert.ok(source.includes('id="audit-log"'));
  assert.ok(source.includes("Log de auditoría ({filteredAuditEntries.length}/{auditEntries.length})"));
  assert.ok(source.includes("<TableHead>ID</TableHead>"));
  assert.ok(source.includes("<TableHead>Evento</TableHead>"));
  assert.ok(source.includes("<TableHead>Actor</TableHead>"));
  assert.ok(source.includes("<TableHead>Tipo actor</TableHead>"));
  assert.ok(source.includes("<TableHead>Objetivo</TableHead>"));
  assert.ok(source.includes("<TableHead>Detalle</TableHead>"));
  assert.ok(source.includes("<TableHead>Fecha</TableHead>"));
});

test("dashboard admin distinguishes audit log load failures from empty states", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes("auditEntriesLoadError ? ("));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("No se pudieron cargar los eventos de auditoría. Intente nuevamente."));
  assert.ok(source.includes("No hay eventos para los filtros seleccionados."));
  assert.ok(source.includes("No hay eventos de auditoría disponibles."));
  assert.ok(source.includes("Limpiar filtros"));
  assert.ok(source.includes("getAuditMetadataSummary(entry)"));
  assert.ok(source.includes("formatDateTime(entry.createdAt)"));
  assert.equal(source.includes("fetch("), false);
});

test("AdminDashboardWorkspaceController syncs module from URL with useSearchParams and useEffect", () => {
  const source = readFileSync(
    resolve(process.cwd(), "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  assert.ok(source.includes('useSearchParams'));
  assert.ok(source.includes('useEffect'));
  assert.ok(source.includes('const ADMIN_MODULE_VALUES = ['));
  assert.ok(source.includes('function parseModuleFromUrl(value: string | null): AdminModule | null'));
  assert.ok(source.includes('searchParams.get("module")'));
  assert.ok(source.includes('setActiveModule(parseModuleFromUrl(searchParams.get("module")));'));
  assert.ok(source.includes('[searchParams]'));
  assert.ok(source.includes('from "next/navigation"'));
  assert.ok(source.includes('useRouter, useSearchParams'));
});

test("admin page wraps AdminDashboardWorkspaceController in Suspense for useSearchParams", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes('<Suspense>'));
  assert.ok(source.includes('</Suspense>'));
  assert.ok(source.includes('import { Suspense } from "react";'));
});

test("dashboard admin avoids duplicate section ids in navigation anchors", () => {
  const source = read(ADMIN_PAGE_PATH);
  const adminHealthIdMatches = source.match(/id="admin-health"/g) ?? [];
  const adminNotificationsIdMatches =
    source.match(/id="admin-notifications"/g) ?? [];

  assert.equal(adminHealthIdMatches.length, 1);
  assert.equal(adminNotificationsIdMatches.length, 1);
  assert.equal(source.includes('id="admin-event-summary"'), true);
});
