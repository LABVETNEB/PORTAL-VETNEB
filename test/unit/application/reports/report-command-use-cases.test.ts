import assert from "node:assert/strict";
import test from "node:test";

import {
  createReportCommandUseCases,
  type CreateOrEditReportInput,
  type PersistReportStatusTransitionInput,
  type ReportCommandRecord,
  type ReportCommandRepository,
  type TransitionReportStatusInput,
} from "../../../../server/features/reports/application/index.ts";

type FixtureReport = ReportCommandRecord & {
  clinicId: number;
  marker: string;
};

function report(
  currentStatus: FixtureReport["currentStatus"] = "uploaded",
): FixtureReport {
  return { id: 41, clinicId: 7, currentStatus, marker: "fixture" };
}

function repository(
  overrides: Partial<ReportCommandRepository<FixtureReport>> = {},
): ReportCommandRepository<FixtureReport> {
  return {
    findReportById: async () => report(),
    createOrEditReport: async () => report(),
    persistReportStatusTransition: async (input) =>
      report(input.toStatus),
    ...overrides,
  };
}

test("createOrEditReport delega una vez, preserva input y devuelve el resultado", async () => {
  const calls: CreateOrEditReportInput[] = [];
  const expected = report("processing");
  const useCases = createReportCommandUseCases(
    repository({
      createOrEditReport: async (input) => {
        calls.push(input);
        return expected;
      },
    }),
  );
  const input: CreateOrEditReportInput = {
    clinicId: 7,
    uploadDate: new Date("2026-07-27T10:00:00.000Z"),
    studyType: "histopatologia",
    patientName: "Luna",
    fileName: "luna.pdf",
    storagePath: "reports/7/luna.pdf",
    createdByClinicUserId: null,
    createdByAdminUserId: 3,
  };

  const result = await useCases.createOrEditReport(input);

  assert.equal(calls.length, 1);
  assert.equal(calls[0], input);
  assert.equal(result, expected);
});

test("createOrEditReport propaga errores del repository", async () => {
  const failure = new Error("write failed");
  const useCases = createReportCommandUseCases(
    repository({
      createOrEditReport: async () => {
        throw failure;
      },
    }),
  );

  await assert.rejects(
    useCases.createOrEditReport({
      clinicId: 7,
      storagePath: "reports/7/luna.pdf",
    }),
    (error) => error === failure,
  );
});

test("transitionReportStatus devuelve not_found sin persistir", async () => {
  let writes = 0;
  const useCases = createReportCommandUseCases(
    repository({
      findReportById: async () => null,
      persistReportStatusTransition: async () => {
        writes += 1;
        return report("ready");
      },
    }),
  );

  assert.deepEqual(
    await useCases.transitionReportStatus({
      reportId: 41,
      toStatus: "ready",
      note: null,
    }),
    { type: "not_found", reportId: 41 },
  );
  assert.equal(writes, 0);
});

test("transitionReportStatus devuelve same_status sin persistir", async () => {
  let writes = 0;
  const useCases = createReportCommandUseCases(
    repository({
      findReportById: async () => report("ready"),
      persistReportStatusTransition: async () => {
        writes += 1;
        return report("ready");
      },
    }),
  );

  assert.deepEqual(
    await useCases.transitionReportStatus({
      reportId: 41,
      toStatus: "ready",
      note: null,
    }),
    {
      type: "same_status",
      currentStatus: "ready",
      requestedStatus: "ready",
    },
  );
  assert.equal(writes, 0);
});

test("transitionReportStatus devuelve transition_not_allowed con ambos estados", async () => {
  let writes = 0;
  const useCases = createReportCommandUseCases(
    repository({
      findReportById: async () => report("delivered"),
      persistReportStatusTransition: async () => {
        writes += 1;
        return report("processing");
      },
    }),
  );

  assert.deepEqual(
    await useCases.transitionReportStatus({
      reportId: 41,
      toStatus: "processing",
      note: "retry",
    }),
    {
      type: "transition_not_allowed",
      currentStatus: "delivered",
      requestedStatus: "processing",
    },
  );
  assert.equal(writes, 0);
});

const allowedTransitions = [
  ["uploaded", "processing"],
  ["uploaded", "ready"],
  ["uploaded", "delivered"],
  ["processing", "ready"],
  ["processing", "delivered"],
  ["ready", "delivered"],
] as const;

for (const [fromStatus, toStatus] of allowedTransitions) {
  test(`transitionReportStatus persiste exactamente una vez ${fromStatus} -> ${toStatus}`, async () => {
    const calls: PersistReportStatusTransitionInput[] = [];
    const expected = report(toStatus);
    const useCases = createReportCommandUseCases(
      repository({
        findReportById: async () => report(fromStatus),
        persistReportStatusTransition: async (input) => {
          calls.push(input);
          return expected;
        },
      }),
    );
    const input: TransitionReportStatusInput = {
      reportId: 41,
      toStatus,
      note: "nota exacta",
      changedByClinicUserId: 9,
      changedByAdminUserId: null,
    };

    const result = await useCases.transitionReportStatus(input);

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      ...input,
      expectedFromStatus: fromStatus,
    });
    assert.deepEqual(result, { type: "persisted", report: expected });
  });
}

test("transitionReportStatus ignora expectedFromStatus forjado por el caller", async () => {
  const calls: PersistReportStatusTransitionInput[] = [];
  const useCases = createReportCommandUseCases(
    repository({
      findReportById: async () => report("uploaded"),
      persistReportStatusTransition: async (input) => {
        calls.push(input);
        return report(input.toStatus);
      },
    }),
  );
  const forgedInput = {
    reportId: 41,
    toStatus: "ready",
    note: "caller externo",
    changedByClinicUserId: 9,
    changedByAdminUserId: null,
    expectedFromStatus: "delivered",
  } as const;

  const result = await useCases.transitionReportStatus(forgedInput);

  assert.deepEqual(calls, [
    {
      reportId: 41,
      toStatus: "ready",
      note: "caller externo",
      changedByClinicUserId: 9,
      changedByAdminUserId: null,
      expectedFromStatus: "uploaded",
    },
  ]);
  assert.equal(result.type, "persisted");
});

test("transitionReportStatus modela desaparición concurrente", async () => {
  const useCases = createReportCommandUseCases(
    repository({
      findReportById: async () => report("processing"),
      persistReportStatusTransition: async () => undefined,
    }),
  );

  assert.deepEqual(
    await useCases.transitionReportStatus({
      reportId: 41,
      toStatus: "ready",
      note: null,
    }),
    { type: "concurrent_not_found", reportId: 41 },
  );
});

test("transitionReportStatus propaga error de lectura", async () => {
  const failure = new Error("read failed");
  const useCases = createReportCommandUseCases(
    repository({
      findReportById: async () => {
        throw failure;
      },
    }),
  );

  await assert.rejects(
    useCases.transitionReportStatus({
      reportId: 41,
      toStatus: "ready",
      note: null,
    }),
    (error) => error === failure,
  );
});

test("transitionReportStatus propaga error de persistencia", async () => {
  const failure = new Error("write failed");
  const useCases = createReportCommandUseCases(
    repository({
      findReportById: async () => report("processing"),
      persistReportStatusTransition: async () => {
        throw failure;
      },
    }),
  );

  await assert.rejects(
    useCases.transitionReportStatus({
      reportId: 41,
      toStatus: "ready",
      note: null,
    }),
    (error) => error === failure,
  );
});
