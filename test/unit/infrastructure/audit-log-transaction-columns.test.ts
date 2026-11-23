import assert from "node:assert/strict";
import test, { after } from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
// Pool global inalcanzable y de una sola conexion: si el codigo pidiera otra
// conexion al pool desde dentro de una transaccion, fallaria de inmediato aqui.
process.env.DATABASE_URL = "postgresql://nobody:none@127.0.0.1:1/unreachable";
process.env.SUPABASE_DB_URL = process.env.DATABASE_URL;
process.env.DATABASE_MAX_CONNECTIONS = "1";

const { createAuditLogWithinTransaction } = await import(
  "../../../server/db-audit.ts"
);

after(() => {
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_DB_URL;
  delete process.env.DATABASE_MAX_CONNECTIONS;
  // El cliente de la base es perezoso y nunca llego a conectar: se termina el proceso.
});

const dialect = new PgDialect();

function createFakeTransaction() {
  const statements: Array<{ sql: string; params: unknown[] }> = [];

  return {
    statements,
    tx: {
      execute: async (query: SQL) => {
        const rendered = dialect.sqlToQuery(query);
        statements.push({ sql: rendered.sql, params: rendered.params });

        if (rendered.sql.includes("information_schema.columns")) {
          return [
            { column_name: "event" },
            { column_name: "actor_type" },
            { column_name: "clinic_id" },
            { column_name: "report_id" },
            { column_name: "metadata" },
          ];
        }

        return [{ id: 1 }];
      },
    },
  };
}

const input = {
  event: "report.uploaded" as const,
  actorType: "admin_user" as const,
  clinicId: 3,
  reportId: 88,
  metadata: { uploadedVia: "admin" },
};

test("con la caché de columnas fría, la auditoría transaccional consulta las columnas por la propia transacción y no pide otra conexión", async () => {
  const { tx, statements } = createFakeTransaction();

  const row = await createAuditLogWithinTransaction(tx, input);

  assert.deepEqual(row, { id: 1 });
  assert.equal(statements[0]?.sql.includes("information_schema.columns"), true);
  assert.equal(statements[1]?.sql.includes('insert into "audit_log"'), true);
  assert.deepEqual(
    statements.map((statement) =>
      statement.sql.includes("information_schema.columns")
        ? "columns"
        : "insert",
    ),
    ["columns", "insert"],
  );
});

test("el insert transaccional usa sólo las columnas existentes y valores enlazados, no interpolados", async () => {
  const { tx, statements } = createFakeTransaction();

  await createAuditLogWithinTransaction(tx, input);

  // La caché ya está caliente: sólo se ejecuta el insert.
  assert.deepEqual(
    statements.map((statement) => statement.sql.includes('insert into "audit_log"')),
    [true],
  );
  const insert = statements[0];
  assert.equal(
    insert?.sql.includes('("event", "actor_type", "clinic_id", "report_id", "metadata")'),
    true,
  );
  assert.deepEqual(insert?.params, [
    "report.uploaded",
    "admin_user",
    3,
    88,
    JSON.stringify({ uploadedVia: "admin" }),
  ]);
  assert.equal(insert?.sql.includes("report.uploaded"), false);
});
