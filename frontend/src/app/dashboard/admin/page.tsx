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
import { AdminCommandCenter } from "./AdminCommandCenter";
import { AdminClinicsManagementCard } from "./AdminClinicsManagementCard";
import { AdminFailedLoginAlertsReadOnlyCard } from "./AdminFailedLoginAlertsReadOnlyCard";
import { AdminMaintenanceDryRunCard } from "./AdminMaintenanceDryRunCard";
import { AdminParticularTokensCard } from "./AdminParticularTokensCard";
import { AdminReportsCard } from "./AdminReportsCard";
import { AdminPricingEditorCard } from "./AdminPricingEditorCard";
import { AdminSchemaHealthStatusCard } from "./AdminSchemaHealthStatusCard";
import { AdminSessionsReadOnlyCard } from "./AdminSessionsReadOnlyCard";
import { AdminUsersRolesReadOnlyCard } from "./AdminUsersRolesReadOnlyCard";
import { PasswordChangePanel } from "@/components/dashboard/PasswordChangePanel";
import { AdminDashboardWorkspaceController } from "./AdminDashboardWorkspaceController";
import type { AdminModule } from "./AdminDashboardWorkspaceController";
import { ModuleTabs } from "@/components/dashboard/ModuleTabs";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { Button } from "@/components/ui/button";
import {
  AdminAuditCard,
  ADMIN_AUDIT_PAGE_SIZE,
} from "./AdminAuditCard";
import type { AdminAuditRow } from "./AdminAuditDenseTable";
import {
  getAdminSystemHealth,
  getAuditEntries,
  type AdminAuditEntry,
  type AdminAuditQuery,
  type AdminAuditSnapshot,
} from "@/lib/api";
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
  "logistics.route_plan.lifecycle_changed": "Ciclo de ruta",
  "logistics.route_event.created": "Evento logístico",
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

const ADMIN_MODULE_ALIASES: Partial<Record<string, AdminModule>> = {
  "admin-upload-report": "admin-report-upload",
  maintenance: "admin-maintenance",
};

function parseAdminModule(value: string | undefined): AdminModule | null {
  if (!value) return null;
  const alias = ADMIN_MODULE_ALIASES[value];
  if (alias) {
    return alias;
  }
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
  "email",
  "session",
  "ip",
  "useragent",
  "user_agent",
  "requestid",
  "request_id",
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
  return "Dato estructurado omitido";
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
  from?: string;
  to?: string;
  clinicId?: string;
  reportId?: string;
  auditPage?: string;
};

function normalizeAuditFilter(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalizeAuditDate(value: string | string[] | undefined) {
  const normalized = normalizeAuditFilter(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function normalizeAuditId(value: string | string[] | undefined) {
  const normalized = normalizeAuditFilter(value);
  return /^[1-9]\d*$/.test(normalized) ? normalized : "";
}

function parseAuditPage(value: string | string[] | undefined) {
  const normalized = Number.parseInt(normalizeAuditFilter(value), 10);
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 1;
}

function createEmptyAuditSnapshot(query: AdminAuditQuery): AdminAuditSnapshot {
  return {
    success: true,
    count: 0,
    items: [],
    pagination: {
      limit: query.limit ?? ADMIN_AUDIT_PAGE_SIZE,
      offset: query.offset ?? 0,
      total: 0,
    },
    filters: {},
  };
}

async function loadAdminAuditSnapshot(
  query: AdminAuditQuery,
  options: RequestInit,
) {
  try {
    return {
      snapshot: await getAuditEntries(query, options, { throwOnError: true }),
      loadError: false,
    };
  } catch (error) {
    redirectToLoginOnUnauthorized(error);
    return {
      snapshot: createEmptyAuditSnapshot(query),
      loadError: true,
    };
  }
}

function formatAuditDate(value: string | null) {
  return value ? formatDateTime(value) : "—";
}

function getAuditActor(entry: AdminAuditEntry) {
  const actorType = entry.actorType ?? "system";
  const actorId =
    entry.actorAdminUserId ??
    entry.actorClinicUserId ??
    entry.actorReportAccessTokenId;
  const actorLabel = ACTOR_LABELS[actorType] ?? actorType;
  return actorId ? `${actorLabel} #${actorId}` : actorLabel;
}

function getAuditEntity(entry: AdminAuditEntry) {
  if (entry.entity) {
    return entry.entityId ? `${entry.entity} #${entry.entityId}` : entry.entity;
  }
  if (entry.reportId) return `Informe #${entry.reportId}`;
  if (entry.clinicId) return `Clínica #${entry.clinicId}`;
  if (entry.targetClinicUserId) return `Usuario clínica #${entry.targetClinicUserId}`;
  if (entry.targetAdminUserId) return `Usuario admin #${entry.targetAdminUserId}`;
  if (entry.targetReportAccessTokenId) {
    return `Token particular ref. #${entry.targetReportAccessTokenId}`;
  }
  return "—";
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
  const requestedAuditEvent = normalizeAuditFilter(resolvedSearchParams.event);
  const requestedActorType = normalizeAuditFilter(resolvedSearchParams.actorType);
  const selectedAuditEvent = Object.hasOwn(EVENT_LABELS, requestedAuditEvent)
    ? requestedAuditEvent
    : "";
  const selectedActorType = Object.hasOwn(ACTOR_LABELS, requestedActorType)
    ? requestedActorType
    : "";
  const selectedAuditFrom = normalizeAuditDate(resolvedSearchParams.from);
  const selectedAuditTo = normalizeAuditDate(resolvedSearchParams.to);
  const selectedAuditClinicId = normalizeAuditId(resolvedSearchParams.clinicId);
  const selectedAuditReportId = normalizeAuditId(resolvedSearchParams.reportId);
  const auditPage = parseAuditPage(resolvedSearchParams.auditPage);
  const auditFilters = {
    event: selectedAuditEvent,
    actorType: selectedActorType,
    from: selectedAuditFrom,
    to: selectedAuditTo,
    clinicId: selectedAuditClinicId,
    reportId: selectedAuditReportId,
  };
  const auditQuery: AdminAuditQuery = {
    ...(selectedAuditEvent ? { event: selectedAuditEvent } : {}),
    ...(selectedActorType ? { actorType: selectedActorType } : {}),
    ...(selectedAuditFrom ? { from: `${selectedAuditFrom}T00:00:00.000Z` } : {}),
    ...(selectedAuditTo ? { to: `${selectedAuditTo}T23:59:59.999Z` } : {}),
    ...(selectedAuditClinicId ? { clinicId: Number(selectedAuditClinicId) } : {}),
    ...(selectedAuditReportId ? { reportId: Number(selectedAuditReportId) } : {}),
    limit: ADMIN_AUDIT_PAGE_SIZE,
    offset: (auditPage - 1) * ADMIN_AUDIT_PAGE_SIZE,
  };
  const requestOptions = await getAdminRequestOptions();
  const [
    auditRead,
    auditOverviewRead,
    roleChangeRead,
    notificationRead,
    systemHealth,
  ] = await Promise.all([
    loadAdminAuditSnapshot(auditQuery, requestOptions),
    loadAdminAuditSnapshot(
      { limit: ADMIN_AUDIT_PAGE_SIZE, offset: 0 },
      requestOptions,
    ),
    loadAdminAuditSnapshot(
      { event: "clinic_user.role.changed", limit: 1, offset: 0 },
      requestOptions,
    ),
    loadAdminAuditSnapshot(
      { event: "study_tracking.notification.created", limit: 1, offset: 0 },
      requestOptions,
    ),
    getAdminSystemHealth(requestOptions),
  ]);
  const auditSnapshot = auditRead.snapshot;
  const auditEntriesLoadError = auditRead.loadError;
  const auditOverviewSnapshot = auditOverviewRead.snapshot;
  const roleChangeSnapshot = roleChangeRead.snapshot;
  const notificationSnapshot = notificationRead.snapshot;
  const hasSystemHealthFetchError = systemHealth === null;
  const serviceChecks = systemHealth?.services ?? {};
  const contactRecipients = getConfiguredContactRecipients(serviceChecks);
  const corsOrigins = getConfiguredCorsOrigins(serviceChecks);
  const nodeEnv =
    typeof serviceChecks.node_env === "string"
      ? serviceChecks.node_env
      : "unknown";
  const systemStatus = systemHealth?.status ?? "unknown";
  const eventTypesCount = new Set(
    auditOverviewSnapshot.items.map((entry) => entry.event),
  ).size;
  const auditEventOptions = Object.entries(EVENT_LABELS)
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, "es"));
  const actorTypeOptions = Object.entries(ACTOR_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  // Only safe, display-ready values cross the server/client boundary. Network,
  // session and raw metadata fields stay on the server.
  const auditRows: AdminAuditRow[] = auditSnapshot.items.map((entry) => ({
    id: entry.id,
    eventCode: entry.event,
    eventLabel: EVENT_LABELS[entry.event] ?? entry.event,
    eventVariant: getEventVariant(entry.event),
    actor: getAuditActor(entry),
    action: entry.action ?? EVENT_LABELS[entry.event] ?? entry.event,
    entity: getAuditEntity(entry),
    detail: getAuditMetadataSummary(entry),
    date: formatAuditDate(entry.createdAt),
  }));
  const latestAuditEntry = auditOverviewSnapshot.items[0];
  const recentAdminActivity = latestAuditEntry
    ? {
        event: EVENT_LABELS[latestAuditEntry.event] ?? latestAuditEntry.event,
        actor: getAuditActor(latestAuditEntry),
        date: formatAuditDate(latestAuditEntry.createdAt),
      }
    : null;

  // ── Administración workspace: command center + critical alerts ──────────────
  // Single-viewport App Shell: split the resumen command center and the critical
  // alerts table into tabs so each fits one desktop viewport without scroll
  // (previously stacked via space-y-6, growing past the viewport).
  const adminWorkspaceSlot = (
    <ModuleTabs
      ariaLabel="Resumen y alertas"
      tabs={[
        {
          id: "resumen",
          label: "Resumen",
          content: (
            <div
              id="admin-command-center"
              className="flex min-h-0 flex-1 flex-col"
            >
              <AdminCommandCenter
                auditEntriesCount={auditOverviewSnapshot.pagination.total}
                eventTypesCount={eventTypesCount}
                systemStatusLabel={formatSystemStatus(systemStatus)}
                systemStatusVariant={getSystemStatusVariant(systemStatus)}
                systemStatusIndicatorClass={getSystemStatusIndicatorClass(systemStatus)}
                systemStatusDetail={formatSystemStatusDetail(serviceChecks)}
                hasSystemHealthFetchError={hasSystemHealthFetchError}
                recentActivity={recentAdminActivity}
              />
            </div>
          ),
        },
        {
          id: "alertas",
          label: "Alertas",
          content: (
            <section
              className="flex min-h-0 flex-1 flex-col gap-4"
              aria-labelledby="admin-alertas-heading"
            >
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
          ),
        },
      ]}
    />
  );

  // ── Informes workspace ──────────────────────────────────────────────────────
  const reportUploadWorkspaceSlot = (
    <section
      id="admin-report-upload"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <AdminReportsCard />
    </section>
  );

  // ── Estado del sistema workspace ────────────────────────────────────────────
  // Single-viewport App Shell: the service grid + runtime + schema are split into
  // tabs so each fits one desktop viewport without scroll (fixed chrome that
  // previously overflowed even with empty data).
  const healthServicesGrid = (
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
          variant={getEmailTransportBadgeVariant(serviceChecks.email_transport)}
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
          <p className="mt-1 truncate text-xs text-muted-foreground">
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
    </div>
  );

  const healthRuntimeGrid = (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div className="surface-soft">
        <p className="text-xs text-muted-foreground">Entorno</p>
        <p className="mt-1 text-lg font-semibold text-vetneb-ink">{nodeEnv}</p>
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
          <p>Heap usado: {systemHealth?.runtime.memory.heapUsedMb ?? "—"} MB</p>
          <p>Heap total: {systemHealth?.runtime.memory.heapTotalMb ?? "—"} MB</p>
          <p>Memoria externa: {systemHealth?.runtime.memory.externalMb ?? "—"} MB</p>
          <p>Buffers: {systemHealth?.runtime.memory.arrayBuffersMb ?? "—"} MB</p>
        </div>
      </div>
    </div>
  );

  const healthWorkspaceSlot = (
    <section id="admin-health" className="flex min-h-0 flex-1 flex-col gap-3">
      {hasSystemHealthFetchError ? (
        <div role="alert" className="clinical-alert-warning shrink-0">
          No se pudo consultar el estado del sistema. Los valores de salud
          operacional se muestran como desconocidos hasta recuperar la lectura.
        </div>
      ) : null}
      <ModuleTabs
        ariaLabel="Estado y mantenimiento"
        tabs={[
          { id: "servicios", label: "Servicios", content: healthServicesGrid },
          { id: "runtime", label: "Runtime", content: healthRuntimeGrid },
          {
            id: "esquema",
            label: "Esquema",
            content: <AdminSchemaHealthStatusCard />,
          },
        ]}
      />
    </section>
  );

  // ── Clínicas workspace ──────────────────────────────────────────────────────
  const clinicsWorkspaceSlot = <AdminClinicsManagementCard />;

  // ── Tokens particulares workspace ───────────────────────────────────────────
  const tokensWorkspaceSlot = (
    <section id="admin-particular-tokens" className="flex min-h-0 flex-1 flex-col">
      <AdminParticularTokensCard />
    </section>
  );

  // ── Precios workspace ───────────────────────────────────────────────────────
  const pricingWorkspaceSlot = (
    <section id="admin-pricing" className="flex min-h-0 flex-1 flex-col">
      <AdminPricingEditorCard />
    </section>
  );

  // ── Sesiones workspace ──────────────────────────────────────────────────────
  // Single-viewport App Shell: the sessions card needs the full viewport height,
  // so password change moves into a compact dialog (button) instead of a sibling
  // tab/card — keeping the card the primary, no-scroll surface.
  const sessionsWorkspaceSlot = (
    <section id="admin-sessions" className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-end">
        <ModuleDialog
          title="Cambiar contraseña"
          description="Actualizá tu contraseña de acceso sin cerrar la sesión actual."
          trigger={
            <Button type="button" variant="outline" size="sm">
              Cambiar contraseña
            </Button>
          }
        >
          <PasswordChangePanel variant="admin" />
        </ModuleDialog>
      </div>
      <AdminSessionsReadOnlyCard />
    </section>
  );

  // ── Roles clínica workspace ─────────────────────────────────────────────────
  // Height chain so the read-only roles card owns the viewport without scroll.
  const usersRolesWorkspaceSlot = (
    <section id="admin-users-roles" className="flex min-h-0 flex-1 flex-col">
      <AdminUsersRolesReadOnlyCard />
    </section>
  );

  // ── Auditoría workspace ─────────────────────────────────────────────────────
  const auditLogWorkspaceSlot = (
    <AdminAuditCard
      rows={auditRows}
      totalCount={auditSnapshot.pagination.total}
      page={auditPage}
      loadError={auditEntriesLoadError}
      filters={auditFilters}
      eventOptions={auditEventOptions}
      actorTypeOptions={actorTypeOptions}
      globalTotal={auditOverviewSnapshot.pagination.total}
      roleChanges={{
        total: roleChangeSnapshot.pagination.total,
        latestDate: formatAuditDate(roleChangeSnapshot.items[0]?.createdAt ?? null),
      }}
      notifications={{
        total: notificationSnapshot.pagination.total,
        latestDate: formatAuditDate(notificationSnapshot.items[0]?.createdAt ?? null),
      }}
    />
  );

  // ── Mantenimiento workspace ─────────────────────────────────────────────────
  // Single-viewport App Shell: schema health and the dry-run card switch via tabs
  // so each owns the viewport without the previous space-y-4 vertical stack.
  const maintenanceWorkspaceSlot = (
    <ModuleTabs
      ariaLabel="Mantenimiento del sistema"
      tabs={[
        {
          id: "esquema",
          label: "Esquema",
          content: <AdminSchemaHealthStatusCard />,
        },
        {
          id: "dry-run",
          label: "Dry-run",
          content: (
            <section id="admin-maintenance">
              <AdminMaintenanceDryRunCard />
            </section>
          ),
        },
      ]}
    />
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
            auditEntriesCount={auditOverviewSnapshot.pagination.total}
            eventTypesCount={eventTypesCount}
          />
        </Suspense>
      </main>
    </>
  );
}
