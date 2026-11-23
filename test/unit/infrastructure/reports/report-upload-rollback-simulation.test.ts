/**
 * SIMULACION con rollback: usa el runner transaccional REAL y el servicio REAL,
 * pero la base (PostgreSQL) y Storage son un motor en memoria que clona el
 * mundo al abrir la transaccion y lo descarta si el callback lanza.
 * Esto NO certifica atomicidad de infraestructura: eso exige PostgreSQL real.
 */
import assert from "node:assert/strict";
import test from "node:test";

import type {
  ParticularToken,
  Report,
  StudyTrackingCase,
} from "../../../../drizzle/schema.ts";
import {
  createReportRouteService,
  ReportPersistenceCommitUnknownError,
  ReportUploadPersistenceError,
  type ReportRouteServiceDependencies,
  type ReportStorageCompensationLog,
  type ReportUploadRouteInput,
} from "../../../../server/features/reports/application/index.ts";
import {
  buildReportUploadScope,
  createTransactionalReportPersistenceRunner,
  type ReportUploadScopeParts,
} from "../../../../server/features/reports/composition/report-upload-persistence-composition.ts";
import { resolveReportSafeErrorName } from "../../../../server/features/reports/composition/report-route-composition.ts";

type World = {
  reports: Report[];
  tokens: ParticularToken[];
  tracking: StudyTrackingCase[];
  history: Array<{ reportId: number; toStatus: string }>;
  nextId: number;
};

type FaultPoint =
  | "none"
  | "report_insert"
  | "history_insert"
  | "token_update"
  | "token_update_zero_rows"
  | "tracking_create"
  | "tracking_update"
  | "tracking_update_zero_rows";

type CommitFailure = "none" | "before_apply" | "after_apply";

type WorkflowRecord = {
  id: number;
  clinicId: number;
  workflowStage: string;
  workflowUpdatedAt: string | null;
  specialStainRequested: boolean;
  specialStainAt: string | null;
};

type ServiceDependencies = ReportRouteServiceDependencies<
  Report,
  ParticularToken,
  StudyTrackingCase,
  WorkflowRecord
>;

type Environment = {
  committed: World;
  commitFailure: CommitFailure;
  fault: FaultPoint;
  thrown: Error | undefined;
  storage: Set<string>;
  failRemove: boolean;
  failVerify: boolean;
  beforeVerify: ((path: string) => void) | undefined;
  notifications: string[];
  audits: string[];
  compensations: ReportStorageCompensationLog[];
  transactions: number;
  uploads: number;
};

const T0 = new Date("2026-11-01T10:00:00.000Z");
const T1 = new Date("2026-11-02T10:00:00.000Z");
const NOW = new Date("2026-11-02T12:00:00.000Z");

function reportRow(
  id: number,
  clinicId: number,
  storagePath: string,
  overrides: Partial<Report> = {},
): Report {
  return {
    id,
    clinicId,
    uploadDate: null,
    studyType: null,
    patientName: null,
    fileName: null,
    storagePath,
    previewUrl: null,
    downloadUrl: null,
    currentStatus: "uploaded",
    statusChangedAt: T0,
    statusChangedByClinicUserId: null,
    statusChangedByAdminUserId: null,
    workflowStage: "sample_received",
    specialStainRequested: false,
    specialStainAt: null,
    workflowUpdatedAt: null,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

function tokenRow(overrides: Partial<ParticularToken> = {}): ParticularToken {
  return {
    id: 7,
    clinicId: 3,
    reportId: null,
    createdByAdminId: null,
    createdByClinicUserId: 19,
    tokenHash: "synthetic-token-7",
    tokenLast4: "0007",
    tutorLastName: "Sintetico",
    petName: "Mascota",
    petAge: "3",
    petBreed: "Mestizo",
    petSex: "M",
    petSpecies: "Canino",
    sampleLocation: "Piel",
    sampleEvolution: "Una semana",
    detailsLesion: null,
    extractionDate: T0,
    shippingDate: T0,
    isActive: true,
    lastLoginAt: null,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

function trackingRow(
  overrides: Partial<StudyTrackingCase> = {},
): StudyTrackingCase {
  return {
    id: 11,
    clinicId: 3,
    reportId: null,
    particularTokenId: 7,
    createdByAdminId: null,
    createdByClinicUserId: 19,
    receptionAt: T0,
    estimatedDeliveryAt: T0,
    estimatedDeliveryAutoCalculatedAt: T0,
    estimatedDeliveryWasManuallyAdjusted: false,
    currentStage: "processing",
    processingAt: null,
    evaluationAt: null,
    reportDevelopmentAt: null,
    deliveredAt: null,
    specialStainRequired: false,
    specialStainNotifiedAt: null,
    paymentUrl: null,
    adminContactEmail: null,
    adminContactPhone: null,
    notes: null,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

function uniqueViolation() {
  return Object.assign(new Error("unique_violation"), { code: "23505" });
}

function createEnvironment(seed: Partial<World> = {}) {
  const base: World = {
    reports: [],
    tokens: [tokenRow()],
    tracking: [],
    history: [],
    nextId: 100,
  };
  const env: Environment = {
    committed: { ...base, ...seed },
    commitFailure: "none",
    fault: "none",
    thrown: undefined,
    storage: new Set<string>(),
    failRemove: false,
    failVerify: false,
    beforeVerify: undefined,
    notifications: [],
    audits: [],
    compensations: [],
    transactions: 0,
    uploads: 0,
  };

  function failIf(point: FaultPoint) {
    if (env.fault === point) {
      env.thrown = new Error(`injected_${point}`);
      throw env.thrown;
    }
  }

  async function transact<TResult>(
    fn: (tx: World) => Promise<TResult>,
  ): Promise<TResult> {
    env.transactions += 1;
    const working = structuredClone(env.committed);
    const result = await fn(working);

    if (env.commitFailure === "before_apply") {
      throw new Error("commit_failure_not_applied");
    }

    env.committed = working;

    if (env.commitFailure === "after_apply") {
      throw new Error("commit_failure_applied");
    }

    return result;
  }

  function partsFor(tx: World): ReportUploadScopeParts {
    return {
      createOrEditReport: async (input) => {
        failIf("report_insert");
        const duplicate = tx.reports.some(
          (row) => row.storagePath === input.storagePath,
        );
        if (duplicate) throw uniqueViolation();

        const row = reportRow(tx.nextId, input.clinicId, input.storagePath, {
          fileName: input.fileName,
          patientName: input.patientName,
          studyType: input.studyType,
          uploadDate: input.uploadDate,
          statusChangedByAdminUserId: input.createdByAdminUserId,
        });
        tx.nextId += 1;
        tx.reports.push(row);
        failIf("history_insert");
        tx.history.push({ reportId: row.id, toStatus: "uploaded" });
        return row;
      },
      updateParticularTokenReport: async (id, reportId) => {
        failIf("token_update");
        if (env.fault === "token_update_zero_rows") return undefined;

        const row = tx.tokens.find((candidate) => candidate.id === id);
        if (!row) return undefined;

        row.reportId = reportId;
        row.updatedAt = T1;
        return row;
      },
      getParticularStudyTrackingCase: async (particularTokenId) =>
        tx.tracking.find((row) => row.particularTokenId === particularTokenId),
      getStudyTrackingCaseByReportId: async (reportId) =>
        tx.tracking.find((row) => row.reportId === reportId),
      createStudyTrackingCase: async (input) => {
        failIf("tracking_create");
        const duplicateToken =
          input.particularTokenId !== null &&
          tx.tracking.some(
            (row) => row.particularTokenId === input.particularTokenId,
          );
        const duplicateReport =
          input.reportId !== null &&
          tx.tracking.some((row) => row.reportId === input.reportId);
        if (duplicateToken || duplicateReport) throw uniqueViolation();

        const row: StudyTrackingCase = {
          ...input,
          id: tx.nextId,
          createdAt: T1,
          updatedAt: T1,
        };
        tx.nextId += 1;
        tx.tracking.push(row);
        return row;
      },
      updateStudyTrackingCase: async (id, input) => {
        failIf("tracking_update");
        if (env.fault === "tracking_update_zero_rows") return undefined;

        const row = tx.tracking.find((candidate) => candidate.id === id);
        if (!row) return undefined;

        Object.assign(row, input, { updatedAt: T1 });
        return row;
      },
    };
  }

  const runReportPersistence = createTransactionalReportPersistenceRunner<World>({
    transact: (fn) => transact(fn),
    bindScope: (tx) => buildReportUploadScope(partsFor(tx)),
  });

  const dependencies: ServiceDependencies = {
    getClinicById: async (clinicId) => {
      if (clinicId === 3 || clinicId === 4) return { id: clinicId };
      return null;
    },
    getReportById: async (reportId) =>
      env.committed.reports.find((row) => row.id === reportId),
    uploadReport: async ({ clinicId, fileName }) => {
      env.uploads += 1;
      const suffix = env.uploads.toString(16).padStart(12, "0");
      const storagePath = `clinics/${clinicId}/1790000000000-${suffix}-${fileName}`;
      env.storage.add(storagePath);
      return storagePath;
    },
    getParticularTokenById: async (tokenId) =>
      env.committed.tokens.find((row) => row.id === tokenId),
    runReportPersistence,
    deleteStorageObject: async (storagePath) => {
      if (env.failRemove) throw new Error("remove_failure");
      env.storage.delete(storagePath);
    },
    isReportStoragePathPersisted: async (storagePath) => {
      if (env.beforeVerify) env.beforeVerify(storagePath);
      if (env.failVerify) throw new Error("verify_failure");
      return env.committed.reports.some((row) => row.storagePath === storagePath);
    },
    logReportStorageCompensation: (input) => {
      env.compensations.push(input);
    },
    createStudyTrackingNotification: async (input) => {
      env.notifications.push(input.type);
    },
    createSignedReportUrl: async (storagePath) => `preview:${storagePath}`,
    createSignedReportDownloadUrl: async (storagePath) => `download:${storagePath}`,
    normalizeSearchText: (value) => {
      if (typeof value === "string" && value.trim()) return value.trim();
      return undefined;
    },
    parseReportStudyType: (value) => {
      if (typeof value === "string" && value.trim()) return value.trim();
      return undefined;
    },
    parseOptionalDate: (value) => {
      if (typeof value === "string") return new Date(value);
      return undefined;
    },
    listAdminReportWorkflowItems: async () => [],
    getAdminReportWorkflowItem: async () => null,
    updateAdminReportWorkflowStage: async () => null,
    updateAdminReportSpecialStain: async () => null,
    writeAuditLog: async (_context, input) => {
      env.audits.push(input.event);
    },
    auditEvents: {
      reportUploaded: "report.uploaded",
      workflowStageChanged: "report.workflow_stage.changed",
      specialStainChanged: "report.special_stain.changed",
    },
    resolveSafeErrorName: resolveReportSafeErrorName,
    logReportDeliveredNotificationFailure: () => undefined,
  };

  return {
    env,
    service: createReportRouteService(dependencies),
    snapshot: () => structuredClone(env.committed),
  };
}

type UploadService = ReturnType<typeof createEnvironment>["service"];

function upload(
  service: UploadService,
  overrides: Partial<
    Pick<ReportUploadRouteInput, "clinicId" | "particularTokenId">
  > = {},
) {
  return service.uploadAdminReport({
    clinicId: 3,
    file: {
      buffer: Buffer.from("pdf"),
      fileName: "informe.pdf",
      mimeType: "application/pdf",
    },
    patientName: "Paciente Sintetico",
    studyType: "histopatologia",
    uploadDate: "2026-11-02",
    adminUserId: 5,
    auditContext: {},
    now: NOW,
    ...overrides,
  });
}

test("simulación con rollback: subida sin token confirma informe, historial y objeto en una transacción y audita", async () => {
  const { env, service } = createEnvironment();

  const result = await upload(service);

  assert.equal(result.type, "uploaded");
  assert.equal(env.transactions, 1);
  assert.deepEqual(
    env.committed.reports.map((row) => row.clinicId),
    [3],
  );
  assert.deepEqual(
    env.committed.history.map((row) => row.toStatus),
    ["uploaded"],
  );
  assert.deepEqual(
    [...env.storage],
    env.committed.reports.map((row) => row.storagePath),
  );
  assert.deepEqual(env.audits, ["report.uploaded"]);
  assert.deepEqual(env.notifications, []);
  assert.deepEqual(env.compensations, []);
});

test("simulación con rollback: subida con token vincula informe, token y tracking de la misma clínica en una sola transacción", async () => {
  const { env, service } = createEnvironment();

  const result = await upload(service, { particularTokenId: 7 });

  assert.equal(result.type, "uploaded");
  assert.equal(env.transactions, 1);
  const reportId = env.committed.reports[0]?.id;
  assert.notEqual(reportId, undefined);
  assert.equal(env.committed.tokens[0]?.reportId, reportId);
  assert.deepEqual(
    env.committed.tracking.map((row) => ({
      clinicId: row.clinicId,
      reportId: row.reportId,
      particularTokenId: row.particularTokenId,
      currentStage: row.currentStage,
    })),
    [
      {
        clinicId: 3,
        reportId,
        particularTokenId: 7,
        currentStage: "delivered",
      },
    ],
  );
  assert.deepEqual(env.notifications, ["report_delivered"]);
  assert.deepEqual(env.audits, ["report.uploaded"]);
});

test("simulación con rollback: un fallo en cualquier escritura revierte todas las demás y compensa el objeto", async (context) => {
  const scenarios: Array<{
    label: string;
    fault: FaultPoint;
    seedTracking: boolean;
    code?: "token_link_failed" | "tracking_write_failed";
  }> = [
    { label: "fallo al insertar el informe", fault: "report_insert", seedTracking: false },
    { label: "fallo al insertar el historial", fault: "history_insert", seedTracking: false },
    { label: "fallo al asociar el token", fault: "token_update", seedTracking: false },
    {
      label: "asociación del token sin fila afectada",
      fault: "token_update_zero_rows",
      seedTracking: false,
      code: "token_link_failed",
    },
    { label: "fallo al crear el tracking", fault: "tracking_create", seedTracking: false },
    { label: "fallo al actualizar el tracking", fault: "tracking_update", seedTracking: true },
    {
      label: "actualización de tracking sin fila afectada",
      fault: "tracking_update_zero_rows",
      seedTracking: true,
      code: "tracking_write_failed",
    },
  ];

  for (const scenario of scenarios) {
    await context.test(scenario.label, async () => {
      const seed: Partial<World> = {};
      if (scenario.seedTracking) seed.tracking = [trackingRow()];
      const { env, service, snapshot } = createEnvironment(seed);
      const before = snapshot();
      env.fault = scenario.fault;

      await assert.rejects(
        upload(service, { particularTokenId: 7 }),
        (error) => {
          if (scenario.code === undefined) {
            return error instanceof Error && error === env.thrown;
          }
          return (
            error instanceof ReportUploadPersistenceError &&
            error.code === scenario.code
          );
        },
      );

      assert.deepEqual(env.committed, before);
      assert.deepEqual([...env.storage], []);
      assert.deepEqual(env.notifications, []);
      assert.deepEqual(env.audits, []);
      assert.deepEqual(
        env.compensations.map((entry) => entry.outcome),
        ["deleted"],
      );
    });
  }
});

test("simulación con rollback: commit ambiguo nunca elimina el objeto y conserva la evidencia de verificación", async (context) => {
  const scenarios: Array<{
    label: string;
    mode: CommitFailure;
    persisted: boolean;
    verification: "persisted" | "not_persisted";
  }> = [
    { label: "el commit no se aplicó", mode: "before_apply", persisted: false, verification: "not_persisted" },
    { label: "el commit sí se aplicó", mode: "after_apply", persisted: true, verification: "persisted" },
  ];

  for (const scenario of scenarios) {
    await context.test(scenario.label, async () => {
      const { env, service } = createEnvironment();
      env.commitFailure = scenario.mode;

      await assert.rejects(
        upload(service, { particularTokenId: 7 }),
        (error) =>
          error instanceof ReportPersistenceCommitUnknownError &&
          error.cause instanceof Error,
      );

      const stored = [...env.storage];
      const path = stored[0];
      assert.notEqual(path, undefined);
      const persistedPaths = env.committed.reports.map((row) => row.storagePath);
      assert.equal(persistedPaths.includes(String(path)), scenario.persisted);
      assert.deepEqual(
        env.compensations.map((entry) => ({
          outcome: entry.outcome,
          verification: entry.verification,
        })),
        [
          {
            outcome: "preserved_commit_unknown",
            verification: scenario.verification,
          },
        ],
      );
      assert.deepEqual(env.notifications, []);
      assert.deepEqual(env.audits, []);
    });
  }
});

test("simulación con rollback: sólo se elimina el objeto nuevo y nunca los preexistentes, referenciados o huérfanos", async () => {
  const referencedPath = "clinics/3/1700000000000-aaaaaaaaaaaa-previo.pdf";
  const orphanPath = "clinics/3/1700000000000-bbbbbbbbbbbb-huerfano.pdf";
  const { env, service, snapshot } = createEnvironment({
    reports: [reportRow(50, 3, referencedPath)],
  });
  env.storage.add(referencedPath);
  env.storage.add(orphanPath);
  const before = snapshot();
  env.fault = "history_insert";

  await assert.rejects(
    upload(service),
    (error) => error instanceof Error && error === env.thrown,
  );

  assert.deepEqual(env.committed, before);
  assert.deepEqual([...env.storage], [referencedPath, orphanPath]);
  assert.deepEqual(
    env.compensations.map((entry) => entry.outcome),
    ["deleted"],
  );
});

test("simulación con rollback: referencia confirmada por otra conexión antes de la verificación preserva el objeto", async () => {
  const { env, service } = createEnvironment();
  env.fault = "report_insert";
  env.beforeVerify = (path) => {
    env.committed.reports.push(reportRow(900, 3, path));
  };

  await assert.rejects(
    upload(service),
    (error) => error instanceof Error && error === env.thrown,
  );

  assert.equal(env.storage.size, 1);
  assert.deepEqual(
    env.compensations.map((entry) => entry.outcome),
    ["preserved_referenced"],
  );
});

test("simulación con rollback: fallo de compensación conserva el objeto, registra el fallo y propaga el error original", async () => {
  const { env, service, snapshot } = createEnvironment();
  const before = snapshot();
  env.fault = "token_update";
  env.failRemove = true;

  await assert.rejects(
    upload(service, { particularTokenId: 7 }),
    (error) => error instanceof Error && error === env.thrown,
  );

  assert.deepEqual(env.committed, before);
  assert.equal(env.storage.size, 1);
  assert.deepEqual(
    env.compensations.map((entry) => entry.outcome),
    ["delete_failed"],
  );
});

test("simulación con rollback: error de verificación conserva el objeto y propaga el error original", async () => {
  const { env, service, snapshot } = createEnvironment();
  const before = snapshot();
  env.fault = "tracking_create";
  env.failVerify = true;

  await assert.rejects(
    upload(service, { particularTokenId: 7 }),
    (error) => error instanceof Error && error === env.thrown,
  );

  assert.deepEqual(env.committed, before);
  assert.equal(env.storage.size, 1);
  assert.deepEqual(
    env.compensations.map((entry) => entry.outcome),
    ["preserved_verification_failed"],
  );
});

test("simulación con rollback: clínica inexistente y token de otra clínica se rechazan antes de tocar Storage", async () => {
  const { env, service, snapshot } = createEnvironment({
    tokens: [tokenRow({ id: 8, clinicId: 4 })],
  });
  const before = snapshot();

  assert.deepEqual(await upload(service, { clinicId: 99 }), {
    type: "clinic_not_found",
  });
  assert.deepEqual(await upload(service, { particularTokenId: 8 }), {
    type: "token_clinic_mismatch",
  });
  assert.deepEqual(await upload(service, { particularTokenId: 404 }), {
    type: "token_not_found",
  });

  assert.deepEqual(env.committed, before);
  assert.deepEqual([...env.storage], []);
  assert.equal(env.uploads, 0);
  assert.equal(env.transactions, 0);
});

test("simulación con rollback: una segunda subida al mismo token no duplica la notificación report_delivered", async () => {
  const { env, service } = createEnvironment();

  await upload(service, { particularTokenId: 7 });
  await upload(service, { particularTokenId: 7 });

  assert.deepEqual(env.notifications, ["report_delivered"]);
  assert.deepEqual(
    env.committed.reports.map((row) => row.clinicId),
    [3, 3],
  );
  const secondReportId = env.committed.reports[1]?.id;
  assert.equal(env.committed.tokens[0]?.reportId, secondReportId);
  assert.deepEqual(
    env.committed.tracking.map((row) => row.reportId),
    [secondReportId],
  );
  assert.deepEqual(env.audits, ["report.uploaded", "report.uploaded"]);
});

test("simulación con rollback: tras un fallo, el reintento crea un objeto nuevo y no deja residuos del intento fallido", async () => {
  const { env, service } = createEnvironment();
  env.fault = "tracking_create";

  await assert.rejects(
    upload(service, { particularTokenId: 7 }),
    (error) => error instanceof Error && error === env.thrown,
  );
  env.fault = "none";
  const retry = await upload(service, { particularTokenId: 7 });

  assert.equal(retry.type, "uploaded");
  assert.equal(env.uploads, 2);
  assert.deepEqual(
    [...env.storage],
    env.committed.reports.map((row) => row.storagePath),
  );
  assert.deepEqual(
    env.compensations.map((entry) => entry.outcome),
    ["deleted"],
  );
});

test("simulación con rollback: dos subidas exitosas del mismo archivo crean dos informes distintos (no hay idempotencia)", async () => {
  const { env, service } = createEnvironment();

  await upload(service);
  await upload(service);

  const paths = env.committed.reports.map((row) => row.storagePath);
  assert.equal(new Set(paths).size, 2);
  assert.deepEqual([...env.storage], paths);
});
