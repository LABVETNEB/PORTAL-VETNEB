import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { AdminMaintenanceDryRunCard } from "./AdminMaintenanceDryRunCard";
import { AdminSessionsReadOnlyCard } from "./AdminSessionsReadOnlyCard";
import { AdminUsersRolesReadOnlyCard } from "./AdminUsersRolesReadOnlyCard";
import { getAdminSystemHealth, getAuditEntries } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Administración — Portal VETNEB",
  robots: { index: false, follow: false },
};

const EVENT_LABELS: Record<string, string> = {
  "auth.admin.login.succeeded": "Login admin",
  "auth.clinic.login.succeeded": "Login clínica",
  "clinic_user.role.changed": "Cambio rol clínica",
  "report.status.changed": "Estado informe",
  "report.uploaded": "Informe subido",
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

function getEventVariant(
  event: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (event.includes("login")) return "default";
  if (event.includes("revoked") || event.includes("canceled")) return "destructive";
  if (event.includes("created") || event.includes("uploaded")) return "secondary";
  return "outline";
}


function getServiceVariant(
  value: unknown,
): "default" | "secondary" | "destructive" | "outline" {
  if (value === "up") return "default";
  if (value === "down") return "destructive";
  if (value === "unknown" || value === undefined || value === null) {
    return "outline";
  }
  return "secondary";
}

function formatServiceStatus(value: unknown) {
  if (value === "up") return "Activo";
  if (value === "down") return "Caído";
  if (value === "unknown" || value === undefined || value === null) {
    return "Desconocido";
  }
  return String(value);
}

function getSystemStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ok") return "default";
  if (status === "down") return "destructive";
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
  if (status === "ok") return "bg-green-500 animate-pulse";
  if (status === "degraded") return "bg-amber-500";
  if (status === "down") return "bg-red-500";
  return "bg-gray-400";
}

function formatSystemStatusDetail(services: Record<string, unknown>) {
  return `DB: ${formatServiceStatus(services.database)} · Storage: ${formatServiceStatus(
    services.storage,
  )}`;
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
] as const;

function isSensitiveAuditMetadataKey(key: string) {
  const normalizedKey = key.toLowerCase();

  return SENSITIVE_AUDIT_METADATA_KEY_PARTS.some((part) =>
    normalizedKey.includes(part),
  );
}

function formatAuditMetadataValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
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

  if (!metadata) {
    return "—";
  }

  if (entry.event === "clinic_user.role.changed") {
    const username = formatAuditMetadataValue(metadata.username);
    const clinicName = formatAuditMetadataValue(metadata.clinicName);
    const previousRole = formatAuditMetadataValue(metadata.previousRole);
    const newRole = formatAuditMetadataValue(metadata.newRole);

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

  if (!visibleEntries.length) {
    return "—";
  }

  return visibleEntries
    .map(([key, value]) => `${key}: ${formatAuditMetadataValue(value)}`)
    .join(" · ");
}
function formatHealthTimestamp(value: unknown) {
  if (typeof value !== "string") return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return formatDateTime(date.toISOString());
}

type AdminPageSearchParams = {
  event?: string;
  actorType?: string;
};

function normalizeAuditFilter(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function buildAdminAuditFilterHref(input: {
  event?: string;
  actorType?: string;
}) {
  const query = new URLSearchParams();

  if (input.event) {
    query.set("event", input.event);
  }

  if (input.actorType) {
    query.set("actorType", input.actorType);
  }

  const qs = query.toString();

  return qs ? `/dashboard/admin?${qs}#audit-log` : "/dashboard/admin#audit-log";
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
  const selectedAuditEvent = normalizeAuditFilter(resolvedSearchParams.event);
  const selectedActorType = normalizeAuditFilter(resolvedSearchParams.actorType);
  const auditEntries = await getAuditEntries(await getAdminRequestOptions());
  const systemHealth = await getAdminSystemHealth(await getAdminRequestOptions());
  const serviceChecks = systemHealth?.services ?? {};
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

  return (
    <>
      <DashboardTopbar
        title="Administración"
        subtitle="Auditoría, reportes y estado operacional"
      />
      <main className="flex-1 p-6 space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-700">
          Lectura conectada a <code>GET /api/admin/audit-log</code>, <code>GET /api/admin/system/health</code>, <code>GET /api/admin/sessions</code>, <code>GET /api/admin/users-roles</code> y <code>POST /api/admin/system/maintenance/purge-dry-run</code>.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Eventos de auditoría
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {auditEntries.length}
              </p>
              <p className="text-xs text-gray-400 mt-1">Registros totales</p>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Tipos de evento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {Object.keys(eventCounts).length}
              </p>
              <p className="text-xs text-gray-400 mt-1">Categorías distintas</p>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Estado del sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${getSystemStatusIndicatorClass(
                    systemStatus,
                  )}`}
                />
                <Badge variant={getSystemStatusVariant(systemStatus)}>
                  {formatSystemStatus(systemStatus)}
                </Badge>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {formatSystemStatusDetail(serviceChecks)}
              </p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Health & Maintenance</CardTitle>
            <CardDescription>
              Estado de servicios, versión y consumo runtime del backend en producción
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-400 mb-2">Database</p>
                <Badge variant={getServiceVariant(serviceChecks.database)}>
                  {formatServiceStatus(serviceChecks.database)}
                </Badge>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-400 mb-2">Storage</p>
                <Badge variant={getServiceVariant(serviceChecks.storage)}>
                  {formatServiceStatus(serviceChecks.storage)}
                </Badge>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-400">Backend</p>
                <p className="text-lg font-semibold text-gray-800 mt-1">
                  {systemHealth?.version ?? "—"}
                </p>
                <p className="text-xs text-gray-400 mt-1">Versión activa</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-400">Uptime</p>
                <p className="text-lg font-semibold text-gray-800 mt-1">
                  {formatUptime(systemHealth?.runtime.uptimeSeconds)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Check: {formatHealthTimestamp(systemHealth?.health?.timestamp)}
                </p>
              </div>
                            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-400">Memoria runtime</p>
                <p className="text-lg font-semibold text-gray-800 mt-1">
                  {systemHealth?.runtime.memory.rssMb ?? "—"} MB
                </p>
                <div className="mt-2 space-y-1 text-xs text-gray-400">
                  <p>RSS: {systemHealth?.runtime.memory.rssMb ?? "—"} MB</p>
                  <p>
                    Heap usado: {systemHealth?.runtime.memory.heapUsedMb ?? "—"} MB
                  </p>
                  <p>
                    Heap total: {systemHealth?.runtime.memory.heapTotalMb ?? "—"} MB
                  </p>
                  <p>
                    External: {systemHealth?.runtime.memory.externalMb ?? "—"} MB
                  </p>
                  <p>
                    Array buffers:{" "}
                    {systemHealth?.runtime.memory.arrayBuffersMb ?? "—"} MB
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <AdminMaintenanceDryRunCard />
        <AdminSessionsReadOnlyCard />
        <AdminUsersRolesReadOnlyCard />
        <Card id="audit-role-changes">
          <CardHeader>
            <CardTitle className="text-base">
              Auditoría de cambios de rol clínica
            </CardTitle>
            <CardDescription>
              Acceso rápido a eventos <code>clinic_user.role.changed</code>
              generados desde usuarios y roles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-400">Cambios registrados</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {roleChangeAuditEntries.length}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-400">Último cambio</p>
                <p className="mt-1 text-sm font-semibold text-gray-800">
                  {lastRoleChangeAuditEntry
                    ? formatDateTime(lastRoleChangeAuditEntry.createdAt)
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-400">Filtro audit</p>
                <Link
                  href={buildAdminAuditFilterHref({
                    event: "clinic_user.role.changed",
                  })}
                  className="mt-1 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-900"
                >
                  Ver cambios de rol
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen por tipo de evento</CardTitle>
            <CardDescription>
              Distribución de eventos registrados en el log de auditoría
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(eventCounts).map(([event, count]) => (
                <div
                  key={event}
                  className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <Badge variant={getEventVariant(event)} className="text-xs">
                    {EVENT_LABELS[event] ?? event}
                  </Badge>
                  <span className="text-sm font-semibold text-gray-700">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card id="audit-log">
          <CardHeader>
            <CardTitle className="text-base">
              Log de auditoría ({filteredAuditEntries.length}/{auditEntries.length})
            </CardTitle>
            <CardDescription>
              Filtros activos: evento <strong>{selectedAuditEventLabel}</strong>
              {" · "}actor <strong>{selectedActorTypeLabel}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-0">
            {hasActiveAuditFilters ? (
              <div className="mx-6 mt-4 flex flex-col gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700 md:flex-row md:items-center md:justify-between">
                <span>
                  Mostrando {filteredAuditEntries.length} de {auditEntries.length} eventos.
                </span>
                <Link
                  href="/dashboard/admin#audit-log"
                  className="font-semibold text-blue-800 hover:text-blue-950"
                >
                  Limpiar filtros
                </Link>
              </div>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Tipo actor</TableHead>
                  <TableHead>Objetivo</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuditEntries.length ? (
                  filteredAuditEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-gray-400">
                        #{entry.id}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getEventVariant(entry.event)}>
                          {EVENT_LABELS[entry.event] ?? entry.event}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {entry.actorId ? `#${entry.actorId}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {ACTOR_LABELS[entry.actorType] ?? entry.actorType}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {entry.targetType && entry.targetId
                          ? `${entry.targetType} #${entry.targetId}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-gray-400 text-xs">
                        {formatDateTime(entry.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-sm text-gray-400"
                    >
                      {hasActiveAuditFilters
                        ? "No hay eventos para los filtros seleccionados."
                        : "No hay eventos de auditoría disponibles."}
                      {hasActiveAuditFilters ? (
                        <div className="mt-2">
                          <Link
                            href="/dashboard/admin#audit-log"
                            className="font-semibold text-blue-700 hover:text-blue-900"
                          >
                            Limpiar filtros
                          </Link>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
</main>
    </>
  );
}
