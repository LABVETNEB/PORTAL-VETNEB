import "dotenv/config";
import postgres from "postgres";

const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Error: Falta SUPABASE_DB_URL o DATABASE_URL en .env");
  process.exit(1);
}

const CRITICAL_SCHEMA_COLUMNS = {
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

const sql = postgres(databaseUrl, { prepare: false });

try {
  const rows = await sql`
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name IN ('reports', 'report_status_history', 'report_access_tokens')
  `;

  const presentSet = new Set(
    rows.map((r) => `${r.table_schema}.${r.table_name}.${r.column_name}`),
  );

  let totalMissing = 0;
  const tableResults = [];

  for (const [tableKey, cols] of Object.entries(CRITICAL_SCHEMA_COLUMNS)) {
    const [schema, table] = tableKey.split(".");
    const missingCols = cols.filter(
      (col) => !presentSet.has(`${schema}.${table}.${col}`),
    );

    tableResults.push({
      table: tableKey,
      required: cols.length,
      present: cols.length - missingCols.length,
      missing: missingCols.length,
      missingColumns: missingCols,
    });

    totalMissing += missingCols.length;
  }

  const status = totalMissing === 0 ? "ok" : "degraded";

  console.log(
    JSON.stringify(
      {
        status,
        generatedAt: new Date().toISOString(),
        summary: {
          requiredTables: tableResults.length,
          totalMissing,
        },
        tables: tableResults,
      },
      null,
      2,
    ),
  );

  if (status !== "ok") {
    console.error(
      `\nSchema DEGRADED: faltan ${totalMissing} columna(s) critica(s).`,
    );
    process.exit(1);
  }

  console.log("\nSchema OK: todas las columnas criticas presentes.");
} catch (err) {
  console.error(
    "Error al consultar el esquema:",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
} finally {
  await sql.end();
}
