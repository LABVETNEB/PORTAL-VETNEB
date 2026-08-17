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
import { AdminMobileCommandModule } from "./AdminMobileCommandModule";
import { AdminMobileHealthModule } from "./AdminMobileHealthModule";
import { AdminMobilePricingModule } from "./AdminMobilePricingModule";
import { AdminMobileMaintenanceModule } from "./AdminMobileMaintenanceModule";
import { ModuleTabs } from "@/components/dashboard/ModuleTabs";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { Button } from "@/components/ui/button";
import {
  AdminAuditCard,
  ADMIN_AUDIT_FALLBACK_ROWS,
} from "./AdminAuditCard";
import {
  getAdminSystemHealth,
  getAuditEntries,
  type AdminAuditQuery,
  type AdminAuditSnapshot,
} from "@/lib/api";
import { redirectToLoginOnUnauthorized } from "@/lib/dashboard-server-auth";
import { parseAdminModule } from "@/features/dashboard/config";
import { getAdminAccessErrorStatus } from "@/lib/api-error";
import { formatDateTime } from "@/lib/utils";
import {
  EVENT_LABELS,
  ACTOR_LABELS,
  formatAuditDate,
  getAuditActor,
} from "./admin-audit-shared";

export const metadata: Metadata = {
  title: "Administración — Portal VETNEB",
  robots: { index: false, follow: false },
};

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

function createEmptyAuditSnapshot(query: AdminAuditQuery): AdminAuditSnapshot {
  return {
    success: true,
    count: 0,
    items: [],
    pagination: {
      limit: query.limit ?? ADMIN_AUDIT_FALLBACK_ROWS,
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
      accessErrorStatus: null,
    };
  } catch (error) {
    redirectToLoginOnUnauthorized(error);
    return {
      snapshot: createEmptyAuditSnapshot(query),
      loadError: true,
      accessErrorStatus: getAdminAccessErrorStatus(error),
    };
  }
}

async function loadAdminSystemHealth(requestOptions: RequestInit) {
  try {
    return {
      snapshot: await getAdminSystemHealth(requestOptions),
      accessErrorStatus: null,
    };
  } catch (error) {
    redirectToLoginOnUnauthorized(error);
    return {
      snapshot: null,
      accessErrorStatus: getAdminAccessErrorStatus(error),
    };
  }
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
  const auditFilters = {
    event: selectedAuditEvent,
    actorType: selectedActorType,
    from: selectedAuditFrom,
    to: selectedAuditTo,
    clinicId: selectedAuditClinicId,
    reportId: selectedAuditReportId,
  };
  const requestOptions = await getAdminRequestOptions();
  const [
    auditOverviewRead,
    roleChangeRead,
    notificationRead,
    systemHealthRead,
  ] = await Promise.all([
    loadAdminAuditSnapshot(
      { limit: ADMIN_AUDIT_FALLBACK_ROWS, offset: 0 },
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
    loadAdminSystemHealth(requestOptions),
  ]);
  const auditOverviewSnapshot = auditOverviewRead.snapshot;
  const roleChangeSnapshot = roleChangeRead.snapshot;
  const notificationSnapshot = notificationRead.snapshot;
  const systemHealth = systemHealthRead.snapshot;
  const initialAccessErrorStatus =
    initialModule === "audit-log"
      ? auditOverviewRead.accessErrorStatus ??
        roleChangeRead.accessErrorStatus ??
        notificationRead.accessErrorStatus
      : initialModule === "admin-health"
        ? systemHealthRead.accessErrorStatus
        : initialModule === null || initialModule === "admin"
          ? auditOverviewRead.accessErrorStatus ??
            roleChangeRead.accessErrorStatus ??
            notificationRead.accessErrorStatus ??
            systemHealthRead.accessErrorStatus
          : null;
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
    <>
      <AdminMobileCommandModule
        auditEntriesCount={auditOverviewSnapshot.pagination.total}
        eventTypesCount={eventTypesCount}
        systemStatusLabel={formatSystemStatus(systemStatus)}
        systemStatusVariant={getSystemStatusVariant(systemStatus)}
        systemStatusIndicatorClass={getSystemStatusIndicatorClass(systemStatus)}
        systemStatusDetail={formatSystemStatusDetail(serviceChecks)}
        hasSystemHealthFetchError={hasSystemHealthFetchError}
        recentActivity={recentAdminActivity}
      />
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
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
      </div>
    </>
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

  // Mobile (md:hidden) compact, no-scroll variant of the health module. Desktop
  // grids collapse to one column and the last service card falls under the
  // bottom nav; these compact display rows fit the mobile content band.
  const healthMobileServices = [
    {
      label: "Base de datos",
      statusLabel: formatServiceStatus(serviceChecks.database),
      variant: getServiceVariant(serviceChecks.database),
      detail: null,
    },
    {
      label: "Almacenamiento",
      statusLabel: formatServiceStatus(serviceChecks.storage),
      variant: getServiceVariant(serviceChecks.storage),
      detail: null,
    },
    {
      label: "Transporte de correo",
      statusLabel: formatEmailTransport(serviceChecks.email_transport),
      variant: getEmailTransportBadgeVariant(serviceChecks.email_transport),
      detail: `Gmail API: ${formatServiceStatus(serviceChecks.gmail_api)} · SMTP: ${formatServiceStatus(serviceChecks.smtp)}`,
    },
    {
      label: "Contacto email",
      statusLabel: formatServiceStatus(serviceChecks.contact_email),
      variant: getServiceVariant(serviceChecks.contact_email),
      detail:
        contactRecipients.length > 0
          ? `Destino: ${contactRecipients.join(", ")}`
          : "Sin destinatarios configurados",
    },
    {
      label: "CORS público",
      statusLabel: formatServiceStatus(serviceChecks.cors),
      variant: getServiceVariant(serviceChecks.cors),
      detail:
        corsOrigins.length > 0
          ? `${corsOrigins.length} origen(es) activo(s)`
          : "Sin orígenes configurados",
    },
  ];
  const healthMobileRuntime = [
    { label: "Entorno", value: nodeEnv, hint: "nodeEnv activo" },
    {
      label: "Backend",
      value: systemHealth?.version ?? "—",
      hint: "Versión activa",
    },
    {
      label: "Tiempo activo",
      value: formatUptime(systemHealth?.runtime.uptimeSeconds),
      hint: `Control: ${formatHealthTimestamp(systemHealth?.health?.timestamp)}`,
    },
    {
      label: "Memoria runtime",
      value: `${systemHealth?.runtime.memory.rssMb ?? "—"} MB`,
      hint: `Heap ${systemHealth?.runtime.memory.heapUsedMb ?? "—"}/${systemHealth?.runtime.memory.heapTotalMb ?? "—"} MB`,
    },
  ];

  const healthWorkspaceSlot = (
    <>
      <AdminMobileHealthModule
        hasError={hasSystemHealthFetchError}
        services={healthMobileServices}
        runtime={healthMobileRuntime}
      />
      <section
        id="admin-health"
        className="hidden min-h-0 flex-1 flex-col gap-3 md:flex"
      >
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
    </>
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
  // Mobile (md:hidden) compact segmented editor; desktop card stays in hidden
  // md:flex so the per-study form never collapses under the bottom nav on mobile.
  const pricingWorkspaceSlot = (
    <>
      <AdminMobilePricingModule />
      <section
        id="admin-pricing"
        className="hidden min-h-0 flex-1 flex-col md:flex"
      >
        <AdminPricingEditorCard />
      </section>
    </>
  );

  // ── Sesiones workspace ──────────────────────────────────────────────────────
  // Single-viewport App Shell: the sessions card needs the full viewport height,
  // so password change moves into a compact dialog (button) instead of a sibling
  // tab/card — keeping the card the primary, no-scroll surface.
  const sessionsWorkspaceSlot = (
    <section id="admin-sessions" className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="hidden shrink-0 items-center justify-end md:flex">
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
    <>
      <AdminMobileMaintenanceModule />
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
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
                // The tabpanel is a flex column, so a wrapper without the
                // height chain is a `flex: 0 1 auto` item sized by its own
                // content. That made the card, its CardContent and the adaptive
                // rows canvas all resolve `flex-1` against an auto height, so
                // the canvas measured the rows it was already rendering and
                // capacity became self-referential: the page could only shrink,
                // and `A -> B -> A` latched one row lower instead of returning.
                // Same chain every other workspace slot declares.
                <section
                  id="admin-maintenance"
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <AdminMaintenanceDryRunCard />
                </section>
              ),
            },
          ]}
        />
      </div>
    </>
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
            initialAccessErrorStatus={initialAccessErrorStatus}
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
