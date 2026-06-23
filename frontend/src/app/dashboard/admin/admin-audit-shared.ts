import type { AdminAuditEntry } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

export const EVENT_LABELS: Record<string, string> = {
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

export const ACTOR_LABELS: Record<string, string> = {
  system: "Sistema",
  admin_user: "Admin",
  clinic_user: "Clínica",
  public_report_access_token: "Token público",
};

export function getEventVariant(
  event: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (event.includes("login")) return "default";
  if (event.includes("revoked") || event.includes("canceled")) return "outline";
  if (event.includes("created") || event.includes("uploaded")) return "secondary";
  return "outline";
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

export function getAuditMetadataSummary(entry: {
  event: string;
  metadata: Record<string, unknown> | null;
}) {
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

export function formatAuditDate(value: string | null) {
  return value ? formatDateTime(value) : "—";
}

export function getAuditActor(entry: AdminAuditEntry) {
  const actorType = entry.actorType ?? "system";
  const actorId =
    entry.actorAdminUserId ??
    entry.actorClinicUserId ??
    entry.actorReportAccessTokenId;
  const actorLabel = ACTOR_LABELS[actorType] ?? actorType;
  return actorId ? `${actorLabel} #${actorId}` : actorLabel;
}

export function getAuditEntity(entry: AdminAuditEntry) {
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
