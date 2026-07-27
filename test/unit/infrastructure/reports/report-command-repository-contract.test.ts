import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { createReportCommandRepository } = await import(
  "../../../../server/features/reports/infrastructure/report-command-repository.ts"
);

type FakeState = {
  transactionCalls: number;
  selectResults: unknown[][];
  selectLimits: number[];
  updateSets: Array<Record<string, unknown>>;
  updateWhereCalls: number;
  updateRows?: Array<Array<Record<string, unknown>>>;
  insertValues: Array<Record<string, unknown>>;
  executeCalls: unknown[];
  executeError?: unknown;
  updateResult: Record<string, unknown>;
  insertResult: Record<string, unknown>;
};

function fakeDatabase(overrides: Partial<FakeState> = {}) {
  const state: FakeState = {
    transactionCalls: 0,
    selectResults: [],
    selectLimits: [],
    updateSets: [],
    updateWhereCalls: 0,
    insertValues: [],
    executeCalls: [],
    updateResult: { id: 41, currentStatus: "ready" },
    insertResult: { id: 41, currentStatus: "uploaded" },
    ...overrides,
  };

  const select = () => ({
    from: () => ({
      where: () => ({
        limit: async (limit: number) => {
          state.selectLimits.push(limit);
          return state.selectResults.shift() ?? [];
        },
      }),
    }),
  });
  const update = () => ({
    set: (values: Record<string, unknown>) => {
      state.updateSets.push(values);
      return {
        where: () => ({
          returning: async () => {
            state.updateWhereCalls += 1;
            return state.updateRows?.shift() ?? [state.updateResult];
          },
        }),
      };
    },
  });
  const insert = () => ({
    values: (values: Record<string, unknown>) => {
      state.insertValues.push(values);
      const thenable = {
        returning: async () => [state.insertResult],
        then: (
          resolvePromise: (value: undefined) => void,
          _rejectPromise: (reason: unknown) => void,
        ) => resolvePromise(undefined),
      };
      return thenable;
    },
  });
  const tx = {
    select,
    update,
    insert,
    execute: async (query: unknown) => {
      state.executeCalls.push(query);
      if (state.executeError) {
        throw state.executeError;
      }
    },
  };
  const database = {
    select,
    transaction: async <T>(operation: (transaction: typeof tx) => Promise<T>) => {
      state.transactionCalls += 1;
      return operation(tx);
    },
  };

  return { database, state };
}

test("upsert update conserva transacción, lookup limit 1 y set exacto sin historial", async () => {
  const timestamp = new Date("2026-07-27T12:00:00.000Z");
  const existing = { id: 41, currentStatus: "processing" };
  const expected = { ...existing, fileName: "new.pdf" };
  const { database, state } = fakeDatabase({
    selectResults: [[existing]],
    updateResult: expected,
  });
  const repository = createReportCommandRepository({
    database: database as never,
    now: () => timestamp,
  });

  const result = await repository.createOrEditReport({
    clinicId: 99,
    storagePath: "reports/7/original.pdf",
    uploadDate: undefined,
    studyType: undefined,
    patientName: undefined,
    fileName: "new.pdf",
    createdByClinicUserId: 5,
    createdByAdminUserId: 6,
  });

  assert.equal(state.transactionCalls, 1);
  assert.deepEqual(state.selectLimits, [1]);
  assert.deepEqual(state.updateSets, [
    {
      uploadDate: null,
      studyType: null,
      patientName: null,
      fileName: "new.pdf",
      updatedAt: timestamp,
    },
  ]);
  assert.equal(state.insertValues.length, 0);
  assert.equal(state.executeCalls.length, 0);
  assert.equal(result, expected);
});

test("upsert insert conserva payload, timestamp único e historial inicial único", async () => {
  const timestamp = new Date("2026-07-27T12:00:00.000Z");
  const inserted = { id: 41, currentStatus: "uploaded" };
  const { database, state } = fakeDatabase({
    selectResults: [[]],
    insertResult: inserted,
  });
  const repository = createReportCommandRepository({
    database: database as never,
    now: () => timestamp,
  });

  const result = await repository.createOrEditReport({
    clinicId: 7,
    storagePath: "reports/7/new.pdf",
    createdByClinicUserId: 5,
    createdByAdminUserId: 6,
  });

  assert.equal(state.transactionCalls, 1);
  assert.deepEqual(state.selectLimits, [1]);
  assert.deepEqual(state.insertValues, [
    {
      clinicId: 7,
      uploadDate: null,
      studyType: null,
      patientName: null,
      fileName: null,
      storagePath: "reports/7/new.pdf",
      previewUrl: null,
      downloadUrl: null,
      currentStatus: "uploaded",
      statusChangedAt: timestamp,
      statusChangedByClinicUserId: 5,
      statusChangedByAdminUserId: 6,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]);
  assert.equal(state.executeCalls.length, 1);
  assert.equal(result, inserted);
});

test("transition ausente no escribe y transición válida conserva set exacto", async () => {
  const missing = fakeDatabase({ selectResults: [[]] });
  const missingRepository = createReportCommandRepository({
    database: missing.database as never,
  });

  assert.equal(
    await missingRepository.persistReportStatusTransition({
      reportId: 41,
      expectedFromStatus: "processing",
      toStatus: "ready",
    }),
    undefined,
  );
  assert.equal(missing.state.transactionCalls, 1);
  assert.deepEqual(missing.state.selectLimits, [1]);
  assert.equal(missing.state.updateSets.length, 0);
  assert.equal(missing.state.executeCalls.length, 0);

  const timestamp = new Date("2026-07-27T13:00:00.000Z");
  const updated = { id: 41, currentStatus: "ready" };
  const valid = fakeDatabase({
    selectResults: [[{ id: 41, currentStatus: "processing" }]],
    updateResult: updated,
  });
  const validRepository = createReportCommandRepository({
    database: valid.database as never,
    now: () => timestamp,
  });

  assert.equal(
    await validRepository.persistReportStatusTransition({
      reportId: 41,
      expectedFromStatus: "processing",
      toStatus: "ready",
      note: undefined,
      changedByClinicUserId: 5,
      changedByAdminUserId: 6,
    }),
    updated,
  );
  assert.equal(valid.state.transactionCalls, 1);
  assert.deepEqual(valid.state.selectLimits, [1]);
  assert.deepEqual(valid.state.updateSets, [
    {
      currentStatus: "ready",
      statusChangedAt: timestamp,
      statusChangedByClinicUserId: 5,
      statusChangedByAdminUserId: 6,
      updatedAt: timestamp,
    },
  ]);
  assert.equal(valid.state.executeCalls.length, 1);
});

test("transition rechaza estado fresco distinto sin update ni historial", async () => {
  const stale = fakeDatabase({
    selectResults: [[{ id: 41, currentStatus: "delivered" }]],
  });
  const repository = createReportCommandRepository({
    database: stale.database as never,
  });

  assert.equal(
    await repository.persistReportStatusTransition({
      reportId: 41,
      expectedFromStatus: "uploaded",
      toStatus: "ready",
    }),
    undefined,
  );
  assert.equal(stale.state.updateSets.length, 0);
  assert.equal(stale.state.updateWhereCalls, 0);
  assert.equal(stale.state.executeCalls.length, 0);
  assert.equal(stale.state.insertValues.length, 0);
});

test("transition no crea historial cuando el UPDATE CAS devuelve cero filas", async () => {
  const lost = fakeDatabase({
    selectResults: [[{ id: 41, currentStatus: "uploaded" }]],
    updateRows: [[]],
  });
  const repository = createReportCommandRepository({
    database: lost.database as never,
  });

  assert.equal(
    await repository.persistReportStatusTransition({
      reportId: 41,
      expectedFromStatus: "uploaded",
      toStatus: "ready",
      note: "stale",
    }),
    undefined,
  );
  assert.equal(lost.state.updateSets.length, 1);
  assert.equal(lost.state.updateWhereCalls, 1);
  assert.equal(lost.state.executeCalls.length, 0);
  assert.equal(lost.state.insertValues.length, 0);
});

test("dos transiciones con el mismo expected status sólo persisten una", async () => {
  const shared = fakeDatabase({
    selectResults: [
      [{ id: 41, currentStatus: "uploaded" }],
      [{ id: 41, currentStatus: "uploaded" }],
    ],
    updateRows: [
      [{ id: 41, currentStatus: "delivered" }],
      [],
    ],
  });
  const repository = createReportCommandRepository({
    database: shared.database as never,
  });
  const input = {
    reportId: 41,
    expectedFromStatus: "uploaded" as const,
    toStatus: "delivered" as const,
    note: null,
  };

  const first = await repository.persistReportStatusTransition(input);
  const second = await repository.persistReportStatusTransition(input);

  assert.equal(first?.currentStatus, "delivered");
  assert.equal(second, undefined);
  assert.equal(shared.state.transactionCalls, 2);
  assert.equal(shared.state.updateWhereCalls, 2);
  assert.equal(shared.state.executeCalls.length, 1);
  assert.equal(shared.state.insertValues.length, 0);
});

test("fallback Drizzle corre sólo ante PostgreSQL 42703", async () => {
  const timestamp = new Date("2026-07-27T14:00:00.000Z");
  const fallback = fakeDatabase({
    selectResults: [[{ id: 41, currentStatus: "ready" }]],
    executeError: { code: "42703" },
  });
  const repository = createReportCommandRepository({
    database: fallback.database as never,
    now: () => timestamp,
  });

  await repository.persistReportStatusTransition({
    reportId: 41,
    expectedFromStatus: "ready",
    toStatus: "delivered",
    note: undefined,
    changedByClinicUserId: null,
    changedByAdminUserId: 6,
  });

  assert.deepEqual(fallback.state.insertValues, [
    {
      reportId: 41,
      fromStatus: "ready",
      toStatus: "delivered",
      changedByClinicUserId: null,
      changedByAdminUserId: 6,
      note: null,
      createdAt: timestamp,
    },
  ]);

  const failure = { code: "23505" };
  const nonFallback = fakeDatabase({
    selectResults: [[{ id: 41, currentStatus: "ready" }]],
    executeError: failure,
  });
  const nonFallbackRepository = createReportCommandRepository({
    database: nonFallback.database as never,
  });

  await assert.rejects(
    nonFallbackRepository.persistReportStatusTransition({
      reportId: 41,
      expectedFromStatus: "ready",
      toStatus: "delivered",
    }),
    (error) => error === failure,
  );
  assert.equal(nonFallback.state.insertValues.length, 0);
});

test("source contract fija SQL dual, autoría, límites y ausencia de side effects", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "server/features/reports/infrastructure/report-command-repository.ts",
    ),
    "utf8",
  ).replace(/\r\n/g, "\n");

  for (const marker of [
    '.where(eq(reports.storagePath, input.storagePath))',
    ".where(eq(reports.id, input.reportId))",
    "report.currentStatus !== input.expectedFromStatus",
    "and(\n              eq(reports.id, input.reportId),\n              eq(reports.currentStatus, input.expectedFromStatus),",
    "const updatedReport = updated[0]",
    "if (!updatedReport)",
    "fromStatus: input.expectedFromStatus",
    ".limit(1)",
    'INSERT INTO "report_status_history"',
    '"status"',
    '"previous_status"',
    '"changed_by"',
    '"changed_by_type"',
    '"notes"',
    '"from_status"',
    '"to_status"',
    '"changed_by_clinic_user_id"',
    '"changed_by_admin_user_id"',
    '"note"',
    "input.createdAt.toISOString()",
    'error.code !== "42703"',
    "input.changedByClinicUserId ?? input.changedByAdminUserId ?? null",
    'input.changedByClinicUserId != null\n      ? "clinic_user"',
    ': input.changedByAdminUserId != null\n        ? "admin_user"\n        : "system"',
  ]) {
    assert.ok(source.includes(marker), `missing source contract: ${marker}`);
  }

  for (const forbidden of [
    "Fastify",
    "writeAudit",
    "sendEmail",
    "supabase",
    "console.",
    "uploadReport",
    "createSignedReport",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.equal(
    source.match(/database\.transaction\(/g)?.length,
    2,
  );
  assert.equal(
    source.match(/INSERT INTO "report_status_history"/g)?.length,
    1,
  );
});
