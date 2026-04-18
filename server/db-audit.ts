import type { AuditActorType, AuditEvent } from "../drizzle/schema";
import type { AdminAuditListFilters } from "./lib/admin-audit";
import { serializeAuditLogListItem } from "./lib/admin-audit";
import { pgClient } from "./db";

type CreateAuditLogInput = {
  event: AuditEvent;
  actorType: AuditActorType;
  actorAdminUserId?: number | null;
  actorClinicUserId?: number | null;
  actorReportAccessTokenId?: number | null;
  clinicId?: number | null;
  reportId?: number | null;
  targetAdminUserId?: number | null;
  targetClinicUserId?: number | null;
  targetReportAccessTokenId?: number | null;
  requestId?: string | null;
  requestMethod?: string | null;
  requestPath?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  action?: string | null;
  entity?: string | null;
  entityId?: number | null;
};

type InsertValue = string | number | null;
type QueryValue = string | number;

type ColumnSpec = {
  column: string;
  value: InsertValue;
  cast?: "jsonb";
};

let auditLogColumnsCache: Set<string> | null = null;

async function getAuditLogColumns(): Promise<Set<string>> {
  if (auditLogColumnsCache !== null) {
    return auditLogColumnsCache;
  }

  const rows = await pgClient`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_log'
  `;

  auditLogColumnsCache = new Set(rows.map((row) => String(row.column_name)));

  return auditLogColumnsCache;
}

function deriveLegacyEntity(input: CreateAuditLogInput): string {
  if (input.entity && input.entity.trim().length > 0) {
    return input.entity;
  }

  if (input.event.startsWith("auth.admin.")) return "admin_user";
  if (input.event.startsWith("auth.clinic.")) return "clinic_user";
  if (input.event.startsWith("report_access_token.")) return "report_access_token";
  if (input.event === "report.public_accessed") return "report_access_token";
  if (input.event.startsWith("report.")) return "report";

  return "audit_log";
}

function deriveLegacyEntityId(input: CreateAuditLogInput): number | null {
  if (input.entityId !== undefined) {
    return input.entityId;
  }

  return (
    input.reportId ??
    input.targetReportAccessTokenId ??
    input.clinicId ??
    input.targetAdminUserId ??
    input.targetClinicUserId ??
    input.actorAdminUserId ??
    input.actorClinicUserId ??
    input.actorReportAccessTokenId ??
    null
  );
}

function buildAuditLogWhere(filters: AdminAuditListFilters): {
  whereSql: string;
  values: QueryValue[];
} {
  const clauses: string[] = [];
  const values: QueryValue[] = [];

  const addClause = (sqlFragment: string, value: QueryValue) => {
    values.push(value);
    clauses.push(`${sqlFragment} $${values.length}`);
  };

  const addUtcDateClause = (sqlFragment: string, value: Date) => {
    values.push(value.toISOString());
    clauses.push(`${sqlFragment} ($${values.length}::timestamptz AT TIME ZONE 'UTC')`);
  };

  if (filters.event) addClause(`"event" =`, filters.event);
  if (filters.actorType) addClause(`"actor_type" =`, filters.actorType);
  if (typeof filters.clinicId === "number") addClause(`"clinic_id" =`, filters.clinicId);
  if (typeof filters.reportId === "number") addClause(`"report_id" =`, filters.reportId);
  if (typeof filters.actorAdminUserId === "number") {
    addClause(`"actor_admin_user_id" =`, filters.actorAdminUserId);
  }
  if (typeof filters.actorClinicUserId === "number") {
    addClause(`"actor_clinic_user_id" =`, filters.actorClinicUserId);
  }
  if (typeof filters.actorReportAccessTokenId === "number") {
    addClause(`"actor_report_access_token_id" =`, filters.actorReportAccessTokenId);
  }
  if (typeof filters.targetReportAccessTokenId === "number") {
    addClause(`"target_report_access_token_id" =`, filters.targetReportAccessTokenId);
  }
  if (filters.from instanceof Date) {
    addUtcDateClause(`"created_at" >=`, filters.from);
  }
  if (filters.to instanceof Date) {
    addUtcDateClause(`"created_at" <=`, filters.to);
  }

  return {
    whereSql: clauses.length > 0 ? `where ${clauses.join(" and ")}` : "",
    values,
  };
}

function buildOptionalSelect(
  columnsPresent: Set<string>,
  column: string,
  fallbackSql: string,
): string {
  return columnsPresent.has(column)
    ? `"${column}"`
    : `${fallbackSql} as "${column}"`;
}

export async function createAuditLog(input: CreateAuditLogInput) {
  const columnsPresent = await getAuditLogColumns();
  const metadataJson =
    input.metadata === undefined || input.metadata === null
      ? null
      : JSON.stringify(input.metadata);

  const specs: ColumnSpec[] = [];

  if (columnsPresent.has("event")) {
    specs.push({ column: "event", value: input.event });
  }

  if (columnsPresent.has("action")) {
    specs.push({ column: "action", value: input.action ?? input.event });
  }

  if (columnsPresent.has("entity")) {
    specs.push({ column: "entity", value: deriveLegacyEntity(input) });
  }

  if (columnsPresent.has("entity_id")) {
    specs.push({ column: "entity_id", value: deriveLegacyEntityId(input) });
  }

  if (columnsPresent.has("actor_type")) {
    specs.push({ column: "actor_type", value: input.actorType });
  }

  if (columnsPresent.has("actor_admin_user_id")) {
    specs.push({
      column: "actor_admin_user_id",
      value: input.actorAdminUserId ?? null,
    });
  }

  if (columnsPresent.has("actor_clinic_user_id")) {
    specs.push({
      column: "actor_clinic_user_id",
      value: input.actorClinicUserId ?? null,
    });
  }

  if (columnsPresent.has("actor_report_access_token_id")) {
    specs.push({
      column: "actor_report_access_token_id",
      value: input.actorReportAccessTokenId ?? null,
    });
  }

  if (columnsPresent.has("clinic_id")) {
    specs.push({ column: "clinic_id", value: input.clinicId ?? null });
  }

  if (columnsPresent.has("report_id")) {
    specs.push({ column: "report_id", value: input.reportId ?? null });
  }

  if (columnsPresent.has("target_admin_user_id")) {
    specs.push({
      column: "target_admin_user_id",
      value: input.targetAdminUserId ?? null,
    });
  }

  if (columnsPresent.has("target_clinic_user_id")) {
    specs.push({
      column: "target_clinic_user_id",
      value: input.targetClinicUserId ?? null,
    });
  }

  if (columnsPresent.has("target_report_access_token_id")) {
    specs.push({
      column: "target_report_access_token_id",
      value: input.targetReportAccessTokenId ?? null,
    });
  }

  if (columnsPresent.has("request_id")) {
    specs.push({ column: "request_id", value: input.requestId ?? null });
  }

  if (columnsPresent.has("request_method")) {
    specs.push({
      column: "request_method",
      value: input.requestMethod ?? null,
    });
  }

  if (columnsPresent.has("request_path")) {
    specs.push({ column: "request_path", value: input.requestPath ?? null });
  }

  if (columnsPresent.has("ip_address")) {
    specs.push({ column: "ip_address", value: input.ipAddress ?? null });
  }

  if (columnsPresent.has("user_agent")) {
    specs.push({ column: "user_agent", value: input.userAgent ?? null });
  }

  if (columnsPresent.has("metadata")) {
    specs.push({
      column: "metadata",
      value: metadataJson,
      cast: "jsonb",
    });
  }

  const query = `
    insert into "audit_log" (${specs.map((spec) => `"${spec.column}"`).join(", ")})
    values (${specs
      .map((spec, index) => {
        const placeholder = `$${index + 1}`;
        return spec.cast ? `${placeholder}::${spec.cast}` : placeholder;
      })
      .join(", ")})
    returning *
  `;

  const values = specs.map((spec) => spec.value);
  const result = await pgClient.unsafe(query, values);

  return result[0];
}

export async function listAuditLog(filters: AdminAuditListFilters) {
  const columnsPresent = await getAuditLogColumns();
  const { whereSql, values } = buildAuditLogWhere(filters);

  const selectAction = buildOptionalSelect(columnsPresent, "action", "null::text");
  const selectEntity = buildOptionalSelect(columnsPresent, "entity", "null::text");
  const selectEntityId = buildOptionalSelect(
    columnsPresent,
    "entity_id",
    "null::integer",
  );

  const rows = await pgClient.unsafe(
    `
      select
        "id",
        "event",
        ${selectAction},
        ${selectEntity},
        ${selectEntityId},
        "actor_type",
        "actor_admin_user_id",
        "actor_clinic_user_id",
        "actor_report_access_token_id",
        "clinic_id",
        "report_id",
        "target_admin_user_id",
        "target_clinic_user_id",
        "target_report_access_token_id",
        "request_id",
        "request_method",
        "request_path",
        "ip_address",
        "user_agent",
        "metadata",
        "created_at"
      from "audit_log"
      ${whereSql}
      order by "created_at" desc, "id" desc
      limit $${values.length + 1}
      offset $${values.length + 2}
    `,
    [...values, filters.limit, filters.offset],
  );

  const countRows = await pgClient.unsafe(
    `
      select count(*)::int as count
      from "audit_log"
      ${whereSql}
    `,
    values,
  );

  return {
    items: rows.map((row) =>
      serializeAuditLogListItem(row as Record<string, unknown>),
    ),
    total: Number(countRows[0]?.count ?? 0),
  };
}
