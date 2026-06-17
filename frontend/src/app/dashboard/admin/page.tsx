import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { AdminCommandCenter } from "./AdminCommandCenter";
import { AdminClinicsManagementCard } from "./AdminClinicsManagementCard";
import { AdminFailedLoginAlertsReadOnlyCard } from "./AdminFailedLoginAlertsReadOnlyCard";
import { AdminMaintenanceDryRunCard } from "./AdminMaintenanceDryRunCard";
import { AdminParticularTokensCard } from "./AdminParticularTokensCard";
import { AdminPricingEditorCard } from "./AdminPricingEditorCard";
import { AdminSchemaHealthStatusCard } from "./AdminSchemaHealthStatusCard";
import { AdminSessionsReadOnlyCard } from "./AdminSessionsReadOnlyCard";
import { AdminUsersRolesReadOnlyCard } from "./AdminUsersRolesReadOnlyCard";
import { PasswordChangePanel } from "@/components/dashboard/PasswordChangePanel";
import { AdminDashboardWorkspaceController } from "./AdminDashboardWorkspaceController";
import type { AdminModule } from "./AdminDashboardWorkspaceController";
import { ModuleTabs } from "@/components/dashboard/ModuleTabs";
import { AdminAuditLogTable, type AdminAuditLogRow } from "./AdminAuditLogTable";
import { getAdminSystemHealth, getAuditEntries } from "@/lib/api";
import { redirectToLoginOnUnauthorized } from "@/lib/dashboard-server-auth";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Administración — Portal VETNEB",
  robots: { index: false, follow: false },
};

const EVENT_LABELS: Record<string, string> = {
  "auth.admin.login.succeeded": "Login admin",
  "auth.clinic.login.succeeded": "Login clínica",
  "auth.session.revoked": "Sesión revocada",
  "clinic.created": "Clínica creada",
  "clinic.updated": "Clínica actualizada",
  "clinic.deleted": "Clínica eliminada",
  "clinic_user.created": "Usuario clínica creado",
  "clinic_user.credentials.updated": "Credenciales clínica",
  "clinic_user.role.changed": "Cambio rol clínica",
  "admin.pricing.update": "Precio actualizado",
  "report.status.changed": "Estado informe",
  "report.uploaded": "Informe subido",
  "report.workflow_stage.changed": "Etapa de informe",
  "report.special_stain.changed": "Tinción especial",
  "study_tracking.case.created": "Caso creado",
  "study_tracking.case.updated": "Caso actualizado",
  "study_tracking.notification.created": "Notificación",
  "report_access_token.created": "Token creado",
  "report_access_token.revoked": "Token revocado",
  "report.public_accessed": "Acceso público",
};

const ACTOR_LABELS: Record<string, string> = {
  system: "Sistema",
  admin_user: "Admin",
  clinic_user: "Clínica",
  public_report_access_token: "Token público",
};

const VALID_ADMIN_MODULES: AdminModule[] = [
  "admin",
  "admin-report-upload",
  "admin-health",
  "admin-clinics",
  "admin-particular-tokens",
  "admin-pricing",
  "admin-sessions",
  "admin-users-roles",
  "audit-log",
  "admin-maintenance",
];

function parseAdminModule(value: string | undefined): AdminModule | null {
  if (!value) return null;
  return VALID_ADMIN_MODULES.includes(value as AdminModule)
    ? (value as AdminModule)
    : null;
}

function getEventVariant(
  event: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (event.includes("login")) return "default";
  if (event.includes("revoked") || event.includes("canceled")) return "outline";
  if (event.includes("created") || event.includes("uploaded")) return "secondary";
  return "outline";
}

function getServiceVariant(
  value: unknown,
): "default" | "secondary" | "destructive" | "outline" {
  if (value === "up") return "default";
  if (value === "configured") return "default";
  if (value === "degraded") return "secondary";
  if (value === "down") return "outline";
  if (value === "not_configured") return "outline";
  if (value === "unknown" || value === undefined || value === null) {
    return "outline";
  }
  return "secondary";
}

function formatServiceStatus(value: unknown) {
  if (value === "up") return "Activo";
  if (value === "configured") return "Configurado";
  if (value === "degraded") return "Degradado";
  if (value === "down") return "Caído";
  if (value === "not_configured") return "No configurado";
  if (value === "unknown" || value === undefined || value === null) {
    return "Desconocido";
  }
  return String(value);
}

function getEmailTransportBadgeVariant(
  value: unknown,
): "default" | "secondary" | "destructive" | "outline" {
  if (value === "gmail_api" || value === "smtp") {
    return "default";
  }
  if (value === "not_configured") {
    return "outline";
  }
  return "secondary";
}

function formatEmailTransport(value: unknown) {
  if (value === "gmail_api") return "Gmail API HTTPS";
  if (value === "smtp") return "SMTP";
  if (value === "not_configured") return "No configurado";
  return "Desconocido";
}

function getSystemStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ok") return "default";
  if (status === "down") return "outline";
  if (status === "degraded") return "secondary";
  return "outline";
}

function formatSystemStatus(status: string) {
  if (status === "ok") return "Operativo";
  if (status === "degraded") return "Degradado";
  if (status === "down") return "Caído";
  return "Desconocido";
}

function getSystemStatusIndicatorClass(status: string) {
  if (status === "ok") return "bg-vetneb-teal";
  if (status === "degraded") return "bg-vetneb-cyan";
  if (status === "down") return "bg-vetneb-navy";
  return "bg-muted-foreground";
}

function formatSystemStatusDetail(services: Record<string, unknown>) {
  return `Base de datos: ${formatServiceStatus(services.database)} · Almacenamiento: ${formatServiceStatus(
    services.storage,
  )} · Transporte correo: ${formatEmailTransport(services.email_transport)} · Contacto email: ${formatServiceStatus(services.contact_email)} · CORS: ${formatServiceStatus(services.cors)}`;
}

function getConfiguredContactRecipients(services: Record<string, unknown>): string[] {
  const recipients = services.contact_email_recipients;
  if (!Array.isArray(recipients)) return [];
  return recipients.filter(
    (recipient): recipient is string =>
      typeof recipient === "string" && recipient.trim().length > 0,
  );
}

function getConfiguredCorsOrigins(services: Record<string, unknown>): string[] {
  const origins = services.cors_origins;
  if (!Array.isArray(origins)) return [];
  return origins.filter(
    (origin): origin is string =>
      typeof origin === "string" && origin.trim().length > 0,
  );
}

function formatConfigurationFlag(value: unknown) {
  return value === true ? "Configurado" : "No configurado";
}

function formatUptime(totalSeconds: number | undefined) {
  if (typeof totalSeconds !== "number" || !Number.isFinite(totalSeconds)) {
    return "—";
  }
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const SENSITIVE_AUDIT_METADATA_KEY_PARTS = [
  "password",
  "token",
  "secret",
  "cookie",
  "auth",
  "hash",
  "storage",
] as const;

function isSensitiveAuditMetadataKey(key: string) {
  const normalizedKey = key.toLowerCase();
  return SENSITIVE_AUDIT_METADATA_KEY_PARTS.some((part) =>
    normalizedKey.includes(part),
  );
}

function formatAuditMetadataValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatAuditClinicRole(value: unknown) {
  if (value === "clinic_owner") return "Owner clínica";
  if (value === "clinic_staff") return "Staff clínica";
  return formatAuditMetadataValue(value);
}

function getAuditMetadataSummary(entry: { event: string; metadata: Record<string, unknown> | null }) {
  const metadata = entry.metadata;
  if (!metadata) return "—";

  if (entry.event === "clinic_user.role.changed") {
    const username = formatAuditMetadataValue(metadata.username);
    const clinicName = formatAuditMetadataValue(metadata.clinicName);
    const previousRole = formatAuditClinicRole(metadata.previousRole);
    const newRole = formatAuditClinicRole(metadata.newRole);
    return `${username} · ${clinicName} · ${previousRole} → ${newRole}`;
  }

  const visibleEntries = Object.entries(metadata)
    .filter(
      ([key, value]) =>
        !isSensitiveAuditMetadataKey(key) &&
        value !== null &&
        value !== undefined &&
        value !== "",
    )
    .slice(0, 3);

  if (!visibleEntries.length) return "—";

  return visibleEntries
    .map(([key, value]) => `${key}: ${formatAuditMetadataValue(value)}`)
    .join(" · ");
}

function formatHealthTimestamp(value: unknown) {
  if (typeof value !== "string") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDateTime(date.toISOString());
}

type AdminPageSearchParams = {
  module?: string;
  event?: string;
  actorType?: string;
};

function normalizeAuditFilter(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function buildAdminAuditFilterHref(input: { event?: string; actorType?: string }) {
  const query = new URLSearchParams();
  query.set("module", "audit-log");
  if (input.event) query.set("event", input.event);
  if (input.actorType) query.set("actorType", input.actorType);
  return `/dashboard/admin?${query.toString()}`;
}

async function getAdminRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();
  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<AdminPageSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const initialModule = parseAdminModule(resolvedSearchParams.module);
  const selectedAuditEvent = normalizeAuditFilter(resolvedSearchParams.event);
  const selectedActorType = normalizeAuditFilter(resolvedSearchParams.actorType);
  let auditEntries: Awaited<ReturnType<typeof getAuditEntries>> = [];
  let auditEntriesLoadError = false;

  try {
    auditEntries = await getAuditEntries(await getAdminRequestOptions(), {
      throwOnError: true,
    });
  } catch (error) {
    redirectToLoginOnUnauthorized(error);
    auditEntriesLoadError = true;
  }

  const systemHealth = await getAdminSystemHealth(await getAdminRequestOptions());
  const hasSystemHealthFetchError = systemHealth === null;
  const serviceChecks = systemHealth?.services ?? {};
  const contactRecipients = getConfiguredContactRecipients(serviceChecks);
  const corsOrigins = getConfiguredCorsOrigins(serviceChecks);
  const nodeEnv =
    typeof serviceChecks.node_env === "string"
      ? serviceChecks.node_env
      : "unknown";
  const systemStatus = systemHealth?.status ?? "unknown";
  const eventCounts = auditEntries.reduce(
    (acc, entry) => {
      acc[entry.event] = (acc[entry.event] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const roleChangeAuditEntries = auditEntries.filter(
    (entry) => entry.event === "clinic_user.role.changed",
  );
  const lastRoleChangeAuditEntry = roleChangeAuditEntries[0];
  const notificationAuditEntries = auditEntries.filter(
    (entry) => entry.event === "study_tracking.notification.created",
  );
  const lastNotificationAuditEntry = notificationAuditEntries[0];
  const auditEventOptions = Object.keys(eventCounts).sort();
  const actorTypeOptions = Array.from(
    new Set(auditEntries.map((entry) => entry.actorType)),
  ).sort();
  const filteredAuditEntries = auditEntries.filter((entry) => {
    const matchesEvent = selectedAuditEvent
      ? entry.event === selectedAuditEvent
      : true;
    const matchesActorType = selectedActorType
      ? entry.actorType === selectedActorType
      : true;
    return matchesEvent && matchesActorType;
  });
  const hasActiveAuditFilters =
    Boolean(selectedAuditEvent) || Boolean(selectedActorType);
  const selectedAuditEventLabel = selectedAuditEvent
    ? EVENT_LABELS[selectedAuditEvent] ?? selectedAuditEvent
    : "Todos";
  const selectedActorTypeLabel = selectedActorType
    ? ACTOR_LABELS[selectedActorType] ?? selectedActorType
    : "Todos";

  void auditEventOptions;
  void actorTypeOptions;

  // Pre-format audit rows server-side into serializable values so the client
  // table component can paginate them without re-importing server-only helpers.
  const auditRows: AdminAuditLogRow[] = filteredAuditEntries.map((entry) => ({
    id: entry.id,
    eventLabel: EVENT_LABELS[entry.event] ?? entry.event,
    eventVariant: getEventVariant(entry.event),
    actor: entry.actorId ? `#${entry.actorId}` : "—",
    actorTypeLabel: ACTOR_LABELS[entry.actorType] ?? entry.actorType,
    target:
      entry.targetType && entry.targetId
        ? `${entry.targetType} #${entry.targetId}`
        : "—",
    detail: getAuditMetadataSummary(entry),
    date: formatDateTime(entry.createdAt),
  }));

  // ── Administración workspace: command center + critical alerts ──────────────
  const adminWorkspaceSlot = (
    <div className="space-y-6">
      <div id="admin-command-center">
        <AdminCommandCenter
          auditEntriesCount={auditEntries.length}
          eventTypesCount={Object.keys(eventCounts).length}
          systemStatusLabel={formatSystemStatus(systemStatus)}
          systemStatusVariant={getSystemStatusVariant(systemStatus)}
          systemStatusIndicatorClass={getSystemStatusIndicatorClass(systemStatus)}
          systemStatusDetail={formatSystemStatusDetail(serviceChecks)}
          hasSystemHealthFetchError={hasSystemHealthFetchError}
        />
      </div>
      <section className="space-y-4" aria-labelledby="admin-alertas-heading">
        <div>
          <h2 id="admin-alertas-heading" className="dashboard-section-heading">
            Alertas críticas
          </h2>
          <p className="dashboard-section-description">
            Intentos fallidos y señales de acceso se revisan antes de las tareas secundarias.
          </p>
        </div>
        <AdminFailedLoginAlertsReadOnlyCard />
      </section>
    </div>
  );

  // ── Subir informe workspace ─────────────────────────────────────────────────
  const reportUploadWorkspaceSlot = (
    <section
      id="admin-report-upload"
      className="dashboard-surface overflow-hidden p-0"
    >
      <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-vetneb-navy">
            Panel administrador
          </p>
          <h2 className="mt-2 text-xl font-semibold text-vetneb-ink">
            Carga de informes
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            La carga de informes se realiza desde cada token administrado
            en &quot;Últimos tokens administrados&quot;, para vincular clínica y token
            sin búsqueda manual.
          </p>
        </div>
      </div>
    </section>
  );

  // ── Estado del sistema workspace ────────────────────────────────────────────
  const healthWorkspaceSlot = (
    <div className="space-y-4">
      {hasSystemHealthFetchError ? (
        <div role="alert" className="clinical-alert-warning">
          No se pudo consultar el estado del sistema. Los valores de salud
          operacional se muestran como desconocidos hasta recuperar la lectura.
        </div>
      ) : null}
      <Card id="admin-health" className="dashboard-surface">
        <CardHeader>
          <CardTitle className="text-base">Estado y mantenimiento</CardTitle>
          <CardDescription>
            Estado de servicios, versión y consumo runtime del backend en producción
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="surface-soft">
              <p className="mb-2 text-xs text-muted-foreground">Base de datos</p>
              <Badge variant={getServiceVariant(serviceChecks.database)}>
                {formatServiceStatus(serviceChecks.database)}
              </Badge>
            </div>
            <div className="surface-soft">
              <p className="mb-2 text-xs text-muted-foreground">Almacenamiento</p>
              <Badge variant={getServiceVariant(serviceChecks.storage)}>
                {formatServiceStatus(serviceChecks.storage)}
              </Badge>
            </div>
            <div className="surface-soft">
              <p className="mb-2 text-xs text-muted-foreground">
                Transporte de correo
              </p>
              <Badge
                variant={getEmailTransportBadgeVariant(
                  serviceChecks.email_transport,
                )}
              >
                {formatEmailTransport(serviceChecks.email_transport)}
              </Badge>
              <p className="mt-2 text-xs text-muted-foreground">
                Gmail API: {formatServiceStatus(serviceChecks.gmail_api)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                SMTP: {formatServiceStatus(serviceChecks.smtp)}
              </p>
            </div>
            <div className="surface-soft">
              <p className="mb-2 text-xs text-muted-foreground">Contacto email</p>
              <Badge variant={getServiceVariant(serviceChecks.contact_email)}>
                {formatServiceStatus(serviceChecks.contact_email)}
              </Badge>
              <p className="mt-2 text-xs text-muted-foreground">
                {contactRecipients.length > 0
                  ? `Destino: ${contactRecipients.join(", ")}`
                  : "Sin destinatarios configurados"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                CONTACT_TO: {formatConfigurationFlag(serviceChecks.contact_to_configured)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                SMTP_FROM: {formatConfigurationFlag(serviceChecks.smtp_from_configured)}
              </p>
            </div>
            <div className="surface-soft">
              <p className="mb-2 text-xs text-muted-foreground">CORS público</p>
              <Badge variant={getServiceVariant(serviceChecks.cors)}>
                {formatServiceStatus(serviceChecks.cors)}
              </Badge>
              <p className="mt-2 text-xs text-muted-foreground">
                {corsOrigins.length > 0
                  ? `${corsOrigins.length} origen(es) activo(s)`
                  : "Sin orígenes configurados"}
              </p>
              {corsOrigins.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {corsOrigins.join(", ")}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                Orígenes locales/LAN:{" "}
                {serviceChecks.cors_has_local_or_lan_origins === true
                  ? "Presentes"
                  : "No"}
              </p>
            </div>
            <div className="surface-soft">
              <p className="text-xs text-muted-foreground">Entorno</p>
              <p className="mt-1 text-lg font-semibold text-vetneb-ink">
                {nodeEnv}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">nodeEnv activo</p>
            </div>
            <div className="surface-soft">
              <p className="text-xs text-muted-foreground">Backend</p>
              <p className="mt-1 text-lg font-semibold text-vetneb-ink">
                {systemHealth?.version ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Versión activa</p>
            </div>
            <div className="surface-soft">
              <p className="text-xs text-muted-foreground">Tiempo activo</p>
              <p className="mt-1 text-lg font-semibold text-vetneb-ink">
                {formatUptime(systemHealth?.runtime.uptimeSeconds)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Control: {formatHealthTimestamp(systemHealth?.health?.timestamp)}
              </p>
            </div>
            <div className="surface-soft">
              <p className="text-xs text-muted-foreground">Memoria runtime</p>
              <p className="mt-1 text-lg font-semibold text-vetneb-ink">
                {systemHealth?.runtime.memory.rssMb ?? "—"} MB
              </p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>RSS: {systemHealth?.runtime.memory.rssMb ?? "—"} MB</p>
                <p>
                  Heap usado: {systemHealth?.runtime.memory.heapUsedMb ?? "—"} MB
                </p>
                <p>
                  Heap total: {systemHealth?.runtime.memory.heapTotalMb ?? "—"} MB
                </p>
                <p>
                  Memoria externa:{" "}
                  {systemHealth?.runtime.memory.externalMb ?? "—"} MB
                </p>
                <p>
                  Buffers:{" "}
                  {systemHealth?.runtime.memory.arrayBuffersMb ?? "—"} MB
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <AdminSchemaHealthStatusCard />
    </div>
  );

  // ── Clínicas workspace ──────────────────────────────────────────────────────
  const clinicsWorkspaceSlot = <AdminClinicsManagementCard />;

  // ── Tokens particulares workspace ───────────────────────────────────────────
  const tokensWorkspaceSlot = (
    <section id="admin-particular-tokens">
      <AdminParticularTokensCard />
    </section>
  );

  // ── Precios workspace ───────────────────────────────────────────────────────
  const pricingWorkspaceSlot = (
    <section id="admin-pricing">
      <AdminPricingEditorCard />
    </section>
  );

  // ── Sesiones workspace ──────────────────────────────────────────────────────
  const sessionsWorkspaceSlot = (
    <section id="admin-sessions" className="flex min-h-0 flex-1 flex-col">
      <ModuleTabs
        ariaLabel="Secciones de sesiones"
        tabs={[
          {
            id: "acceso",
            label: "Acceso",
            content: <PasswordChangePanel variant="admin" />,
          },
          {
            id: "sesiones",
            label: "Sesiones",
            content: <AdminSessionsReadOnlyCard />,
          },
        ]}
      />
    </section>
  );

  // ── Roles clínica workspace ─────────────────────────────────────────────────
  const usersRolesWorkspaceSlot = (
    <section id="admin-users-roles">
      <AdminUsersRolesReadOnlyCard />
    </section>
  );

  // ── Auditoría workspace ─────────────────────────────────────────────────────
  const auditLogWorkspaceSlot = (
    <ModuleTabs
      ariaLabel="Secciones de auditoría"
      defaultTabId="registro"
      tabs={[
        {
          id: "resumen",
          label: "Resumen",
          content: (
            <div className="grid grid-cols-1 gap-3 content-start lg:grid-cols-3">
      <Card id="admin-notifications" className="dashboard-surface">
        <CardHeader>
          <CardTitle className="text-base">Notificaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="surface-soft">
              <p className="text-xs text-muted-foreground">Registradas</p>
              <p className="mt-1 text-2xl font-bold text-vetneb-ink">
                {notificationAuditEntries.length}
              </p>
            </div>
            <div className="surface-soft">
              <p className="text-xs text-muted-foreground">
                Última notificación
              </p>
              <p className="mt-1 text-sm font-semibold text-vetneb-ink">
                {lastNotificationAuditEntry
                  ? formatDateTime(lastNotificationAuditEntry.createdAt)
                  : "—"}
              </p>
            </div>
            <div className="surface-soft">
              <p className="text-xs text-muted-foreground">Auditoría</p>
              <PublicRouteControl
                href={buildAdminAuditFilterHref({
                  event: "study_tracking.notification.created",
                })}
                variant="textLink"
                className="mt-1 inline-flex text-sm font-semibold text-vetneb-navy hover:text-vetneb-teal"
              >
                Ver notificaciones
              </PublicRouteControl>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="audit-role-changes" className="dashboard-surface">
        <CardHeader>
          <CardTitle className="text-base">
            Auditoría de cambios de rol clínica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="surface-soft">
              <p className="text-xs text-muted-foreground">
                Cambios registrados
              </p>
              <p className="mt-1 text-2xl font-bold text-vetneb-ink">
                {roleChangeAuditEntries.length}
              </p>
            </div>
            <div className="surface-soft">
              <p className="text-xs text-muted-foreground">Último cambio</p>
              <p className="mt-1 text-sm font-semibold text-vetneb-ink">
                {lastRoleChangeAuditEntry
                  ? formatDateTime(lastRoleChangeAuditEntry.createdAt)
                  : "—"}
              </p>
            </div>
            <div className="surface-soft">
              <p className="text-xs text-muted-foreground">Filtro audit</p>
              <PublicRouteControl
                href={buildAdminAuditFilterHref({
                  event: "clinic_user.role.changed",
                })}
                variant="textLink"
                className="mt-1 inline-flex text-sm font-semibold text-vetneb-navy hover:text-vetneb-teal"
              >
                Ver cambios de rol
              </PublicRouteControl>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="admin-event-summary" className="dashboard-surface">
        <CardHeader>
          <CardTitle className="text-base">
            Resumen por tipo de evento
          </CardTitle>
          <CardDescription>
            Distribución de eventos registrados en el log de auditoría
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(eventCounts).map(([event, count]) => (
              <div
                key={event}
                className="clinical-muted-band flex items-center gap-2 rounded-lg px-3 py-2"
              >
                <Badge
                  variant={getEventVariant(event)}
                  className="text-xs"
                >
                  {EVENT_LABELS[event] ?? event}
                </Badge>
                <span className="clinical-pill px-2.5 py-0.5 text-xs tracking-normal">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
            </div>
          ),
        },
        {
          id: "registro",
          label: "Registro",
          content: (
            <AdminAuditLogTable
              rows={auditRows}
              totalCount={auditEntries.length}
              loadError={auditEntriesLoadError}
              hasActiveFilters={hasActiveAuditFilters}
              selectedAuditEventLabel={selectedAuditEventLabel}
              selectedActorTypeLabel={selectedActorTypeLabel}
            />
          ),
        },
      ]}
    />
  );

  // ── Mantenimiento workspace ─────────────────────────────────────────────────
  const maintenanceWorkspaceSlot = (
    <div className="space-y-4">
      <AdminSchemaHealthStatusCard />
      <section id="admin-maintenance">
        <AdminMaintenanceDryRunCard />
      </section>
    </div>
  );

  return (
    <>
      <DashboardTopbar
        title="Administración"
        subtitle="Auditoría, reportes y estado operacional"
        notifications="admin"
      />
      <main className="dashboard-main">
        <Suspense>
          <AdminDashboardWorkspaceController
            initialModule={initialModule}
            pageHeader={
              <DashboardPageHeader
                title="Administración"
                description="Seleccione un módulo para acceder a sus funciones."
                badge={
                  <Badge variant={getSystemStatusVariant(systemStatus)}>
                    {formatSystemStatus(systemStatus)}
                  </Badge>
                }
              />
            }
            workspaces={{
              admin: adminWorkspaceSlot,
              "admin-report-upload": reportUploadWorkspaceSlot,
              "admin-health": healthWorkspaceSlot,
              "admin-clinics": clinicsWorkspaceSlot,
              "admin-particular-tokens": tokensWorkspaceSlot,
              "admin-pricing": pricingWorkspaceSlot,
              "admin-sessions": sessionsWorkspaceSlot,
              "admin-users-roles": usersRolesWorkspaceSlot,
              "audit-log": auditLogWorkspaceSlot,
              "admin-maintenance": maintenanceWorkspaceSlot,
            }}
            systemStatus={systemStatus}
            systemStatusLabel={formatSystemStatus(systemStatus)}
            systemStatusVariant={getSystemStatusVariant(systemStatus)}
            auditEntriesCount={auditEntries.length}
            eventTypesCount={Object.keys(eventCounts).length}
          />
        </Suspense>
        <div className="h-24 md:hidden" aria-hidden="true" />
      </main>
    </>
  );
}
