export const AUDIT_ACTOR_TYPES = [
  "system",
  "admin_user",
  "clinic_user",
  "public_report_access_token",
] as const;

export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const AUDIT_EVENTS = [
  "auth.admin.login.succeeded",
  "auth.clinic.login.succeeded",
  "report.status.changed",
  "report.uploaded",
  "report_access_token.created",
  "report_access_token.revoked",
  "report.public_accessed",
] as const;

export type AuditEvent = (typeof AUDIT_EVENTS)[number];

export type AuditListFilters = {
  event?: AuditEvent;
  actorType?: AuditActorType;
  clinicId?: number;
  reportId?: number;
  actorAdminUserId?: number;
  actorClinicUserId?: number;
  actorReportAccessTokenId?: number;
  targetReportAccessTokenId?: number;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
};

export type AuditListFilterBuildResult = {
  filters: AuditListFilters;
  errors: string[];
};

export type AuditLogListItem = {
  id: number;
  event: string;
  action: string | null;
  entity: string | null;
  entityId: number | null;
  actorType: string | null;
  actorAdminUserId: number | null;
  actorClinicUserId: number | null;
  actorReportAccessTokenId: number | null;
  clinicId: number | null;
  reportId: number | null;
  targetAdminUserId: number | null;
  targetClinicUserId: number | null;
  targetReportAccessTokenId: number | null;
  requestId: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date | string | null;
};

export const AUDIT_LOG_CSV_HEADERS = [
  "id",
  "event",
  "action",
  "entity",
  "entityId",
  "actorType",
  "actorAdminUserId",
  "actorClinicUserId",
  "actorReportAccessTokenId",
  "clinicId",
  "reportId",
  "targetAdminUserId",
  "targetClinicUserId",
  "targetReportAccessTokenId",
  "requestId",
  "requestMethod",
  "requestPath",
  "ipAddress",
  "userAgent",
  "metadata",
  "createdAt",
] as const;

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim().length === 0)
  );
}

function parsePositiveInt(
  value: unknown,
  fallback: number,
  max?: number,
): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  if (typeof max === "number") {
    return Math.min(parsed, max);
  }

  return parsed;
}

function parseOffset(value: unknown, fallback = 0): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function parseOptionalPositiveId(value: unknown): number | undefined | null {
  if (isBlank(value)) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalDate(value: unknown): Date | undefined | null {
  if (isBlank(value)) {
    return undefined;
  }

  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOptionalAuditEvent(
  value: unknown,
): AuditEvent | undefined | null {
  if (isBlank(value)) {
    return undefined;
  }

  const normalized = String(value).trim();

  return (AUDIT_EVENTS as readonly string[]).includes(normalized)
    ? (normalized as AuditEvent)
    : null;
}

function parseOptionalAuditActorType(
  value: unknown,
): AuditActorType | undefined | null {
  if (isBlank(value)) {
    return undefined;
  }

  const normalized = String(value).trim();

  return (AUDIT_ACTOR_TYPES as readonly string[]).includes(normalized)
    ? (normalized as AuditActorType)
    : null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function serializeCsvPrimitive(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function escapeCsvCell(value: unknown): string {
  const serialized = serializeCsvPrimitive(value);

  if (/[",\r\n]/.test(serialized)) {
    return `"${serialized.replace(/"/g, '""')}"`;
  }

  return serialized;
}

function parseAuditTimestampString(value: string): Date | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const normalizedSqlTimestamp = trimmed.replace(" ", "T");

  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(
      normalizedSqlTimestamp,
    )
  ) {
    const parsed = new Date(`${normalizedSqlTimestamp}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatAuditCsvCreatedAt(value: AuditLogListItem["createdAt"]): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== "string") {
    return "";
  }

  const parsed = parseAuditTimestampString(value);
  return parsed ? parsed.toISOString() : value;
}

export function normalizeAuditListMetadata(
  value: unknown,
): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }

    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

export function serializeAuditLogListItem(
  row: Record<string, unknown>,
): AuditLogListItem {
  return {
    id: Number(row.id),
    event: String(row.event),
    action: toNullableString(row.action),
    entity: toNullableString(row.entity),
    entityId: toNullableNumber(row.entity_id),
    actorType: toNullableString(row.actor_type),
    actorAdminUserId: toNullableNumber(row.actor_admin_user_id),
    actorClinicUserId: toNullableNumber(row.actor_clinic_user_id),
    actorReportAccessTokenId: toNullableNumber(row.actor_report_access_token_id),
    clinicId: toNullableNumber(row.clinic_id),
    reportId: toNullableNumber(row.report_id),
    targetAdminUserId: toNullableNumber(row.target_admin_user_id),
    targetClinicUserId: toNullableNumber(row.target_clinic_user_id),
    targetReportAccessTokenId: toNullableNumber(row.target_report_access_token_id),
    requestId: toNullableString(row.request_id),
    requestMethod: toNullableString(row.request_method),
    requestPath: toNullableString(row.request_path),
    ipAddress: toNullableString(row.ip_address),
    userAgent: toNullableString(row.user_agent),
    metadata: normalizeAuditListMetadata(row.metadata),
    createdAt:
      row.created_at instanceof Date || typeof row.created_at === "string"
        ? row.created_at
        : null,
  };
}

export function buildAuditListFilters(
  query: Record<string, unknown>,
): AuditListFilterBuildResult {
  const errors: string[] = [];

  const event = parseOptionalAuditEvent(query.event);
  const actorType = parseOptionalAuditActorType(query.actorType);
  const clinicId = parseOptionalPositiveId(query.clinicId);
  const reportId = parseOptionalPositiveId(query.reportId);
  const actorAdminUserId = parseOptionalPositiveId(query.actorAdminUserId);
  const actorClinicUserId = parseOptionalPositiveId(query.actorClinicUserId);
  const actorReportAccessTokenId = parseOptionalPositiveId(
    query.actorReportAccessTokenId,
  );
  const targetReportAccessTokenId = parseOptionalPositiveId(
    query.targetReportAccessTokenId,
  );
  const from = parseOptionalDate(query.from);
  const to = parseOptionalDate(query.to);

  if (event === null) errors.push("event invalido");
  if (actorType === null) errors.push("actorType invalido");
  if (clinicId === null) errors.push("clinicId invalido");
  if (reportId === null) errors.push("reportId invalido");
  if (actorAdminUserId === null) errors.push("actorAdminUserId invalido");
  if (actorClinicUserId === null) errors.push("actorClinicUserId invalido");
  if (actorReportAccessTokenId === null) {
    errors.push("actorReportAccessTokenId invalido");
  }
  if (targetReportAccessTokenId === null) {
    errors.push("targetReportAccessTokenId invalido");
  }
  if (from === null) errors.push("from invalido");
  if (to === null) errors.push("to invalido");

  const limit = parsePositiveInt(query.limit, 50, 100);
  const offset = parseOffset(query.offset, 0);

  return {
    errors,
    filters: {
      event: event ?? undefined,
      actorType: actorType ?? undefined,
      clinicId: clinicId ?? undefined,
      reportId: reportId ?? undefined,
      actorAdminUserId: actorAdminUserId ?? undefined,
      actorClinicUserId: actorClinicUserId ?? undefined,
      actorReportAccessTokenId: actorReportAccessTokenId ?? undefined,
      targetReportAccessTokenId: targetReportAccessTokenId ?? undefined,
      from: from ?? undefined,
      to: to ?? undefined,
      limit,
      offset,
    },
  };
}

export function buildClinicAuditListFilters(
  query: Record<string, unknown>,
  clinicId: number,
): AuditListFilterBuildResult {
  const { filters, errors } = buildAuditListFilters(query);

  return {
    errors,
    filters: {
      ...filters,
      clinicId,
      actorAdminUserId: undefined,
    },
  };
}

export function buildParticularAuditListFilters(
  query: Record<string, unknown>,
): AuditListFilterBuildResult {
  const { filters, errors } = buildAuditListFilters(query);

  return {
    errors,
    filters: {
      event: filters.event,
      actorType: filters.actorType,
      reportId: filters.reportId,
      from: filters.from,
      to: filters.to,
      limit: filters.limit,
      offset: filters.offset,
      clinicId: undefined,
      actorAdminUserId: undefined,
      actorClinicUserId: undefined,
      actorReportAccessTokenId: undefined,
      targetReportAccessTokenId: undefined,
    },
  };
}

export function buildAuditCsv(items: AuditLogListItem[]): string {
  const headerRow = AUDIT_LOG_CSV_HEADERS.join(",");
  const rows = items.map((item) => {
    const values = [
      item.id,
      item.event,
      item.action,
      item.entity,
      item.entityId,
      item.actorType,
      item.actorAdminUserId,
      item.actorClinicUserId,
      item.actorReportAccessTokenId,
      item.clinicId,
      item.reportId,
      item.targetAdminUserId,
      item.targetClinicUserId,
      item.targetReportAccessTokenId,
      item.requestId,
      item.requestMethod,
      item.requestPath,
      item.ipAddress,
      item.userAgent,
      item.metadata,
      formatAuditCsvCreatedAt(item.createdAt),
    ];

    return values.map((value) => escapeCsvCell(value)).join(",");
  });

  return `\uFEFF${[headerRow, ...rows].join("\n")}`;
}

export function buildGlobalAuditCsvFilename(now = new Date()): string {
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  return `admin-audit-log-${timestamp}.csv`;
}

export function buildParticularAuditCsvFilename(now = new Date()): string {
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  return `particular-audit-log-${timestamp}.csv`;
}
