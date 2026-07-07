import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

const { CRITICAL_SCHEMA_COLUMNS, buildSchemaHealthSnapshotFromRows } =
  await import("../../../server/lib/schema-health.ts");

function allPresentRows() {
  const rows: Array<{
    table_schema: string;
    table_name: string;
    column_name: string;
  }> = [];

  for (const [key, cols] of Object.entries(CRITICAL_SCHEMA_COLUMNS)) {
    const dotIndex = key.indexOf(".");
    const schema = key.slice(0, dotIndex);
    const table = key.slice(dotIndex + 1);

    for (const col of cols) {
      rows.push({ table_schema: schema, table_name: table, column_name: col });
    }
  }

  return rows;
}

function rowsWithout(tableName: string, column: string) {
  return allPresentRows().filter(
    (r) => !(r.table_name === tableName && r.column_name === column),
  );
}

test("CRITICAL_SCHEMA_COLUMNS includes reports.workflow_stage", () => {
  assert.ok(
    CRITICAL_SCHEMA_COLUMNS["public.reports"].includes("workflow_stage"),
  );
});

test("CRITICAL_SCHEMA_COLUMNS includes reports.special_stain_requested", () => {
  assert.ok(
    CRITICAL_SCHEMA_COLUMNS["public.reports"].includes(
      "special_stain_requested",
    ),
  );
});

test("CRITICAL_SCHEMA_COLUMNS includes reports.special_stain_at", () => {
  assert.ok(
    CRITICAL_SCHEMA_COLUMNS["public.reports"].includes("special_stain_at"),
  );
});

test("CRITICAL_SCHEMA_COLUMNS includes reports.workflow_updated_at", () => {
  assert.ok(
    CRITICAL_SCHEMA_COLUMNS["public.reports"].includes("workflow_updated_at"),
  );
});

test("buildSchemaHealthSnapshotFromRows marca ok cuando todas las columnas estan presentes", () => {
  const snapshot = buildSchemaHealthSnapshotFromRows(
    allPresentRows(),
    "2026-05-27T00:00:00.000Z",
  );

  assert.equal(snapshot.status, "ok");
  assert.equal(snapshot.success, true);
  assert.equal(snapshot.missing.length, 0);
  assert.equal(snapshot.generatedAt, "2026-05-27T00:00:00.000Z");

  for (const table of snapshot.tables) {
    assert.equal(table.status, "ok");
    assert.equal(table.missingColumns, 0);
    assert.deepEqual(table.missingColumnNames, []);
  }
});

test("buildSchemaHealthSnapshotFromRows marca degraded si falta reports.workflow_stage", () => {
  const rows = rowsWithout("reports", "workflow_stage");
  const snapshot = buildSchemaHealthSnapshotFromRows(
    rows,
    "2026-05-27T00:00:00.000Z",
  );

  assert.equal(snapshot.status, "degraded");
  assert.equal(snapshot.success, false);
  assert.equal(snapshot.missing.length, 1);
  assert.deepEqual(snapshot.missing[0], {
    schema: "public",
    table: "reports",
    column: "workflow_stage",
  });

  const reportsTable = snapshot.tables.find((t) => t.table === "reports");
  assert.ok(reportsTable);
  assert.equal(reportsTable.status, "degraded");
  assert.ok(reportsTable.missingColumnNames.includes("workflow_stage"));
});

test("buildSchemaHealthSnapshotFromRows marca degraded si falta reports.special_stain_requested", () => {
  const rows = rowsWithout("reports", "special_stain_requested");
  const snapshot = buildSchemaHealthSnapshotFromRows(
    rows,
    "2026-05-27T00:00:00.000Z",
  );

  assert.equal(snapshot.status, "degraded");
  assert.equal(snapshot.success, false);

  const reportsTable = snapshot.tables.find((t) => t.table === "reports");
  assert.ok(reportsTable);
  assert.equal(reportsTable.status, "degraded");
  assert.ok(
    reportsTable.missingColumnNames.includes("special_stain_requested"),
  );
});

test("buildSchemaHealthSnapshotFromRows summary cuenta correctamente requiredColumns presentColumns y missingColumns", () => {
  const rows = rowsWithout("reports", "workflow_stage");
  const snapshot = buildSchemaHealthSnapshotFromRows(rows);

  const totalRequired = Object.values(CRITICAL_SCHEMA_COLUMNS).reduce(
    (sum, cols) => sum + cols.length,
    0,
  );

  assert.equal(snapshot.summary.requiredTables, 3);
  assert.equal(snapshot.summary.requiredColumns, totalRequired);
  assert.equal(snapshot.summary.presentColumns, totalRequired - 1);
  assert.equal(snapshot.summary.missingColumns, 1);
});
