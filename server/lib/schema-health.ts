import { pgClient } from "../db.ts";

export type SchemaHealthStatus = "ok" | "degraded";

export type SchemaHealthColumnCheck = {
  name: string;
  present: boolean;
};

export type SchemaHealthTableCheck = {
  schema: "public";
  table: string;
  status: SchemaHealthStatus;
  requiredColumns: number;
  presentColumns: number;
  missingColumns: number;
  columns: SchemaHealthColumnCheck[];
  missingColumnNames: string[];
};

export type SchemaHealthMissingColumn = {
  schema: "public";
  table: string;
  column: string;
};

export type SchemaHealthSnapshot = {
  success: boolean;
  status: SchemaHealthStatus;
  generatedAt: string;
  summary: {
    requiredTables: number;
    requiredColumns: number;
    presentColumns: number;
    missingColumns: number;
  };
  tables: SchemaHealthTableCheck[];
  missing: SchemaHealthMissingColumn[];
};

export const CRITICAL_SCHEMA_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  "public.reports": [
    "id",
    "clinic_id",
    "upload_date",
    "study_type",
    "patient_name",
    "file_name",
    "storage_path",
    "current_status",
    "status_changed_at",
    "workflow_stage",
    "special_stain_requested",
    "special_stain_at",
    "workflow_updated_at",
    "created_at",
    "updated_at",
  ],
  "public.report_status_history": [
    "id",
    "report_id",
    "from_status",
    "to_status",
    "changed_by_clinic_user_id",
    "changed_by_admin_user_id",
    "note",
    "created_at",
  ],
  "public.report_access_tokens": [
    "id",
    "clinic_id",
    "report_id",
    "token_hash",
    "token_last4",
    "access_count",
    "last_access_at",
    "expires_at",
    "revoked_at",
    "created_at",
    "updated_at",
  ],
};

export function buildSchemaHealthSnapshotFromRows(
  rows: Array<{ table_schema: unknown; table_name: unknown; column_name: unknown }>,
  generatedAt?: string,
): SchemaHealthSnapshot {
  const timestamp = generatedAt ?? new Date().toISOString();

  const presentSet = new Set<string>(
    rows.map(
      (r) =>
        `${String(r.table_schema)}.${String(r.table_name)}.${String(r.column_name)}`,
    ),
  );

  const tableChecks: SchemaHealthTableCheck[] = [];
  const allMissing: SchemaHealthMissingColumn[] = [];

  for (const [tableKey, requiredCols] of Object.entries(CRITICAL_SCHEMA_COLUMNS)) {
    const dotIndex = tableKey.indexOf(".");
    const schema = tableKey.slice(0, dotIndex) as "public";
    const table = tableKey.slice(dotIndex + 1);

    const columns: SchemaHealthColumnCheck[] = requiredCols.map((col) => ({
      name: col,
      present: presentSet.has(`${schema}.${table}.${col}`),
    }));

    const missingColumnNames = columns.filter((c) => !c.present).map((c) => c.name);
    const presentCount = columns.filter((c) => c.present).length;
    const missingCount = missingColumnNames.length;

    for (const col of missingColumnNames) {
      allMissing.push({ schema, table, column: col });
    }

    tableChecks.push({
      schema,
      table,
      status: missingCount === 0 ? "ok" : "degraded",
      requiredColumns: requiredCols.length,
      presentColumns: presentCount,
      missingColumns: missingCount,
      columns,
      missingColumnNames,
    });
  }

  const totalRequired = Object.values(CRITICAL_SCHEMA_COLUMNS).reduce(
    (sum, cols) => sum + cols.length,
    0,
  );
  const totalPresent = tableChecks.reduce((sum, t) => sum + t.presentColumns, 0);
  const totalMissing = allMissing.length;
  const overallStatus: SchemaHealthStatus = totalMissing === 0 ? "ok" : "degraded";

  return {
    success: overallStatus === "ok",
    status: overallStatus,
    generatedAt: timestamp,
    summary: {
      requiredTables: tableChecks.length,
      requiredColumns: totalRequired,
      presentColumns: totalPresent,
      missingColumns: totalMissing,
    },
    tables: tableChecks,
    missing: allMissing,
  };
}

export async function getSchemaHealthSnapshot(): Promise<SchemaHealthSnapshot> {
  const rows = await pgClient`
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name IN ('reports', 'report_status_history', 'report_access_tokens')
  `;

  return buildSchemaHealthSnapshotFromRows(rows, new Date().toISOString());
}
