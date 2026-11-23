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
  notifications: string[];
  audits: string[];
};

type FaultPoint =
  | "none"
  | "report_insert"
  | "history_insert"
  | "token_update"
  | "token_update_zero_rows"
  | "tracking_create"
  | "tracking_update"
  | "tracking_update_zero_rows"
  | "notification_write"
  | "audit_write";

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
  compensations: ReportStorageCompensationLog[];
  transactions: number;
  uploads: number;
  reportInserts: number;
  /** Secuencias globales: no se revierten con la transaccion, igual que en PostgreSQL. */
  sequence: { report: number; tracking: number };
  waiters: number;
  /** Fallos y commits ambiguos dirigidos a una sola transaccion (id 1, 2, ...). */
  faultOnlyTx: number | undefined;
  commitFailureOnlyTx: number | undefined;
  /** Se invoca con el lock del token ya adquirido; permite pausar al titular. */
  afterLock: ((txId: number, tokenId: number) => Promise<void>) | undefined;
  /** Se invoca cuando una transaccion tiene que esperar un lock ocupado. */
  onWaiter: (() => void) | undefined;
};

type TokenLock = {
  holder: number | undefined;
  queue: Array<{ txId: number; resolve: () => void }>;
};

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

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
    notifications: [],
    audits: [],
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
    compensations: [],
    transactions: 0,
    uploads: 0,
    reportInserts: 0,
    sequence: { report: 100, tracking: 100 },
    waiters: 0,
    faultOnlyTx: undefined,
    commitFailureOnlyTx: undefined,
    afterLock: undefined,
    onWaiter: undefined,
  };

  const txIds = new WeakMap<World, number>();
  const txBase = new WeakMap<World, World>();

  function mergeRowsById<TRow extends { id: number }>(
    target: TRow[],
    base: TRow[],
    work: TRow[],
  ) {
    const baseById = new Map(base.map((row) => [row.id, row]));

    for (const row of work) {
      const before = baseById.get(row.id);
      if (!before) {
        target.push(row);
        continue;
      }

      if (JSON.stringify(before) !== JSON.stringify(row)) {
        const index = target.findIndex((candidate) => candidate.id === row.id);
        if (index >= 0) target[index] = row;
      }
    }
  }

  function applyCommit(working: World) {
    const base = txBase.get(working);
    const merged = structuredClone(env.committed);

    if (!base) {
      env.committed = working;
      return;
    }

    mergeRowsById(merged.reports, base.reports, working.reports);
    mergeRowsById(merged.tokens, base.tokens, working.tokens);
    mergeRowsById(merged.tracking, base.tracking, working.tracking);
    merged.history.push(...working.history.slice(base.history.length));
    merged.notifications.push(
      ...working.notifications.slice(base.notifications.length),
    );
    merged.audits.push(...working.audits.slice(base.audits.length));
    env.committed = merged;
  }
  const locks = new Map<number, TokenLock>();
  const heldBy = new Map<number, number[]>();

  async function acquireTokenLock(tokenId: number, txId: number) {
    let lock = locks.get(tokenId);
    if (!lock) {
      lock = { holder: undefined, queue: [] };
      locks.set(tokenId, lock);
    }

    if (lock.holder === undefined) {
      lock.holder = txId;
    }

    if (lock.holder !== txId) {
      const waiting = lock;
      env.waiters += 1;
      env.onWaiter?.();
      // El titular se asigna al despertar (handoff FIFO): nadie salta la cola.
      await new Promise<void>((resolve) => {
        waiting.queue.push({ txId, resolve });
      });
      env.waiters -= 1;
    }

    heldBy.set(txId, [...(heldBy.get(txId) ?? []), tokenId]);
  }

  function releaseTokenLocks(txId: number) {
    for (const tokenId of heldBy.get(txId) ?? []) {
      const lock = locks.get(tokenId);
      if (!lock) continue;

      const next = lock.queue.shift();
      lock.holder = next?.txId;
      next?.resolve();
    }
    heldBy.delete(txId);
  }

  function failIf(point: FaultPoint, tx: World) {
    const targeted =
      env.faultOnlyTx === undefined || env.faultOnlyTx === txIds.get(tx);

    if (env.fault === point && targeted) {
      env.thrown = new Error(`injected_${point}`);
      throw env.thrown;
    }
  }

  async function transact<TResult>(
    fn: (tx: World) => Promise<TResult>,
  ): Promise<TResult> {
    env.transactions += 1;
    const txId = env.transactions;
    const working = structuredClone(env.committed);
    txIds.set(working, txId);
    txBase.set(working, structuredClone(env.committed));

    try {
      const result = await fn(working);
      const commitFailure =
        env.commitFailureOnlyTx === undefined || env.commitFailureOnlyTx === txId
          ? env.commitFailure
          : "none";

      if (commitFailure === "before_apply") {
        throw new Error("commit_failure_not_applied");
      }

      applyCommit(working);

      if (commitFailure === "after_apply") {
        throw new Error("commit_failure_applied");
      }

      return result;
    } finally {
      // El lock se libera al terminar la transaccion, confirmada o no.
      releaseTokenLocks(txId);
    }
  }

  function partsFor(tx: World): ReportUploadScopeParts {
    return {
      lockParticularToken: async (tokenId) => {
        const txId = txIds.get(tx) ?? 0;
        await acquireTokenLock(tokenId, txId);
        // READ COMMITTED: tras esperar, se lee lo que confirmo el titular anterior.
        Object.assign(tx, structuredClone(env.committed));
        txBase.set(tx, structuredClone(env.committed));
        await env.afterLock?.(txId, tokenId);
        return tx.tokens.find((candidate) => candidate.id === tokenId);
      },
      createOrEditReport: async (input) => {
        env.reportInserts += 1;
        failIf("report_insert", tx);
        const duplicate = tx.reports.some(
          (row) => row.storagePath === input.storagePath,
        );
        if (duplicate) throw uniqueViolation();

        const reportId = env.sequence.report;
        env.sequence.report += 1;
        const row = reportRow(reportId, input.clinicId, input.storagePath, {
          fileName: input.fileName,
          patientName: input.patientName,
          studyType: input.studyType,
          uploadDate: input.uploadDate,
          statusChangedByAdminUserId: input.createdByAdminUserId,
        });
        tx.reports.push(row);
        failIf("history_insert", tx);
        tx.history.push({ reportId: row.id, toStatus: "uploaded" });
        return row;
      },
      updateParticularTokenReport: async (id, reportId) => {
        failIf("token_update", tx);
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
        failIf("tracking_create", tx);
        const duplicateToken =
          input.particularTokenId !== null &&
          tx.tracking.some(
            (row) => row.particularTokenId === input.particularTokenId,
          );
        const duplicateReport =
          input.reportId !== null &&
          tx.tracking.some((row) => row.reportId === input.reportId);
        if (duplicateToken || duplicateReport) throw uniqueViolation();

        const trackingId = env.sequence.tracking;
        env.sequence.tracking += 1;
        const row: StudyTrackingCase = {
          ...input,
          id: trackingId,
          createdAt: T1,
          updatedAt: T1,
        };
        tx.tracking.push(row);
        return row;
      },
      createReportDeliveredNotification: async (input) => {
        if (env.fault === "notification_write") {
          return { created: false, error: new Error("notification_failure") };
        }
        tx.notifications.push(input.type);
        return { created: true };
      },
      writeReportUploadedAudit: async (_auditContext, input) => {
        failIf("audit_write", tx);
        tx.audits.push(input.event);
      },
      updateStudyTrackingCase: async (id, input) => {
        failIf("tracking_update", tx);
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
    findPersistedReportByStoragePath: async (storagePath) =>
      env.committed.reports.find((row) => row.storagePath === storagePath),
    createStudyTrackingNotification: async () => {
      throw new Error("los efectos de la subida deben ocurrir dentro de la transaccion");
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
    writeAuditLog: async () => {
      throw new Error("los efectos de la subida deben ocurrir dentro de la transaccion");
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
  assert.deepEqual(env.committed.audits, ["report.uploaded"]);
  assert.deepEqual(env.committed.notifications, []);
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
  assert.deepEqual(env.committed.notifications, ["report_delivered"]);
  assert.deepEqual(env.committed.audits, ["report.uploaded"]);
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
      assert.deepEqual(env.committed.notifications, before.notifications);
      assert.deepEqual(env.committed.audits, before.audits);
      assert.deepEqual(
        env.compensations.map((entry) => entry.outcome),
        ["deleted"],
      );
    });
  }
});

test("simulación con rollback: commit ambiguo no pierde efectos: o no existe nada, o existen informe, notificación y auditoría y se resuelve como éxito", async (context) => {
  await context.test("el commit no se aplicó: nada queda y el objeto se conserva", async () => {
    const { env, service, snapshot } = createEnvironment();
    const before = snapshot();
    env.commitFailure = "before_apply";

    await assert.rejects(
      upload(service, { particularTokenId: 7 }),
      (error) =>
        error instanceof ReportPersistenceCommitUnknownError &&
        error.cause instanceof Error,
    );

    assert.deepEqual(env.committed, before);
    assert.equal(env.storage.size, 1);
    assert.deepEqual(
      env.compensations.map((entry) => ({
        outcome: entry.outcome,
        verification: entry.verification,
      })),
      [{ outcome: "preserved_commit_unknown", verification: "not_persisted" }],
    );
  });

  await context.test("el commit sí se aplicó: informe, notificación y auditoría existen una sola vez y el servicio devuelve éxito", async () => {
    const { env, service } = createEnvironment();
    env.commitFailure = "after_apply";

    const result = await upload(service, { particularTokenId: 7 });

    assert.equal(result.type, "uploaded");
    assert.deepEqual(
      env.committed.reports.map((row) => row.clinicId),
      [3],
    );
    assert.deepEqual(env.committed.notifications, ["report_delivered"]);
    assert.deepEqual(env.committed.audits, ["report.uploaded"]);
    assert.deepEqual(
      [...env.storage],
      env.committed.reports.map((row) => row.storagePath),
    );
    assert.deepEqual(
      env.compensations.map((entry) => ({
        outcome: entry.outcome,
        verification: entry.verification,
      })),
      [{ outcome: "commit_confirmed", verification: "persisted" }],
    );
  });
});

test("simulación con rollback: un fallo de auditoría o de la notificación se comporta según su contrato", async (context) => {
  await context.test("fallo de auditoría: falla cerrado, revierte todo y compensa", async () => {
    const { env, service, snapshot } = createEnvironment();
    const before = snapshot();
    env.fault = "audit_write";

    await assert.rejects(
      upload(service, { particularTokenId: 7 }),
      (error) => error instanceof Error && error === env.thrown,
    );

    assert.deepEqual(env.committed, before);
    assert.deepEqual([...env.storage], []);
    assert.deepEqual(
      env.compensations.map((entry) => entry.outcome),
      ["deleted"],
    );
  });

  await context.test("fallo de la notificación: best-effort, el informe y la auditoría se confirman", async () => {
    const { env, service } = createEnvironment();
    env.fault = "notification_write";

    const result = await upload(service, { particularTokenId: 7 });

    assert.equal(result.type, "uploaded");
    assert.equal(env.committed.reports.length === 1, true);
    assert.deepEqual(env.committed.notifications, []);
    assert.deepEqual(env.committed.audits, ["report.uploaded"]);
    assert.deepEqual(env.compensations, []);
  });
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

  assert.deepEqual(env.committed.notifications, ["report_delivered"]);
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
  assert.deepEqual(env.committed.audits, ["report.uploaded", "report.uploaded"]);
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

/** Espera a que la primera subida tome el lock; si termina sin tomarlo, falla. */
async function untilLocked(
  locked: { promise: Promise<void> },
  first: Promise<unknown>,
) {
  await Promise.race([
    locked.promise,
    first.then(
      () => {
        throw new Error("la primera subida terminó sin tomar el lock del token");
      },
      () => {
        throw new Error("la primera subida falló sin tomar el lock del token");
      },
    ),
  ]);
}

/**
 * Espera a que la segunda subida quede bloqueada en el lock. Si la subida termina
 * sin haber esperado, el lock no se tomo: falla en lugar de colgarse.
 */
async function untilWaiting(
  waiter: { promise: Promise<void> },
  second: Promise<unknown>,
) {
  await Promise.race([
    waiter.promise,
    second.then(() => {
      throw new Error("la segunda subida terminó sin esperar el lock del token");
    }),
  ]);
}

const SECOND_TOKEN = {
  id: 8,
  tokenHash: "synthetic-token-8",
  tokenLast4: "0008",
};

function twoTokenSeed(): Partial<World> {
  return { tokens: [tokenRow(), tokenRow(SECOND_TOKEN)] };
}

test("simulación de concurrencia: dos subidas al mismo token se serializan en el lock y equivalen a un orden secuencial", async () => {
  const { env, service } = createEnvironment();
  const firstLocked = deferred();
  const gate = deferred();
  const waiterSeen = deferred();
  env.afterLock = async (txId) => {
    if (txId === 1) {
      firstLocked.resolve();
      await gate.promise;
    }
  };
  env.onWaiter = () => waiterSeen.resolve();

  const first = upload(service, { particularTokenId: 7 });
  await untilLocked(firstLocked, first);
  const second = upload(service, { particularTokenId: 7 });
  await untilWaiting(waiterSeen, second);

  // Invariantes intermedias: la segunda espera el lock sin haber escrito nada.
  assert.equal(env.waiters, 1);
  assert.equal(env.reportInserts, 0);
  assert.deepEqual(env.committed.reports.map((row) => row.id), []);

  gate.resolve();
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(firstResult.type, "uploaded");
  assert.equal(secondResult.type, "uploaded");
  const ids = env.committed.reports.map((row) => row.id);
  assert.deepEqual(ids, [100, 101]);
  // Equivalente a ejecutar primero una y despues la otra: el token queda con la ultima.
  assert.equal(env.committed.tokens[0]?.reportId, 101);
  assert.deepEqual(
    env.committed.tracking.map((row) => row.reportId),
    [101],
  );
  // La segunda leyo el seguimiento ya entregado: una sola notificacion.
  assert.deepEqual(env.committed.notifications, ["report_delivered"]);
  assert.deepEqual(env.committed.audits, ["report.uploaded", "report.uploaded"]);
  assert.deepEqual(env.compensations, []);
  assert.deepEqual(
    [...env.storage].sort(),
    env.committed.reports.map((row) => row.storagePath).sort(),
  );
  assert.equal(env.waiters, 0);
});

test("simulación de concurrencia: subidas a tokens distintos no se bloquean entre sí", async () => {
  const { env, service } = createEnvironment(twoTokenSeed());
  const locked = deferred();
  const gate = deferred();
  env.afterLock = async (_txId, tokenId) => {
    if (tokenId === 7) {
      locked.resolve();
      await gate.promise;
    }
  };
  env.onWaiter = () => {
    throw new Error("una subida a otro token no debe esperar");
  };

  const first = upload(service, { particularTokenId: 7 });
  await untilLocked(locked, first);
  const second = await upload(service, { particularTokenId: 8 });

  assert.equal(second.type, "uploaded");
  assert.equal(env.waiters, 0);
  assert.deepEqual(env.committed.reports.map((row) => row.id), [100]);

  gate.resolve();
  assert.equal((await first).type, "uploaded");
  assert.deepEqual(
    env.committed.tokens.map((row) => [row.id, row.reportId !== null]),
    [
      [7, true],
      [8, true],
    ],
  );
  assert.deepEqual(
    env.committed.tracking.map((row) => row.particularTokenId).sort(),
    [7, 8],
  );
});

test("simulación de concurrencia: si el titular del lock falla, revierte y la segunda subida continúa sobre el estado limpio", async () => {
  const { env, service } = createEnvironment();
  const firstLocked = deferred();
  const gate = deferred();
  const waiterSeen = deferred();
  env.fault = "audit_write";
  env.faultOnlyTx = 1;
  env.afterLock = async (txId) => {
    if (txId === 1) {
      firstLocked.resolve();
      await gate.promise;
    }
  };
  env.onWaiter = () => waiterSeen.resolve();

  const first = upload(service, { particularTokenId: 7 });
  const firstOutcome = assert.rejects(
    first,
    (error) => error instanceof Error && error === env.thrown,
  );
  await untilLocked(firstLocked, first);
  const second = upload(service, { particularTokenId: 7 });
  await untilWaiting(waiterSeen, second);

  gate.resolve();
  await firstOutcome;
  const secondResult = await second;

  assert.equal(secondResult.type, "uploaded");
  // Nada del titular fallido quedo: un informe, un vinculo y efectos de la segunda.
  // El id 100 lo consumio el titular que revirtio: las secuencias no se revierten.
  assert.deepEqual(env.committed.reports.map((row) => row.id), [101]);
  assert.equal(env.committed.tokens[0]?.reportId, 101);
  assert.deepEqual(
    env.committed.tracking.map((row) => row.reportId),
    [101],
  );
  assert.deepEqual(env.committed.notifications, ["report_delivered"]);
  assert.deepEqual(env.committed.audits, ["report.uploaded"]);
  // El objeto del titular fallido se compensa y el de la segunda se conserva.
  assert.deepEqual(
    env.compensations.map((entry) => entry.outcome),
    ["deleted"],
  );
  assert.deepEqual(
    [...env.storage],
    env.committed.reports.map((row) => row.storagePath),
  );
});

test("simulación de concurrencia: un commit ambiguo aplicado del titular se resuelve y la segunda subida no duplica efectos", async () => {
  const { env, service } = createEnvironment();
  const firstLocked = deferred();
  const gate = deferred();
  const waiterSeen = deferred();
  env.commitFailure = "after_apply";
  env.commitFailureOnlyTx = 1;
  env.afterLock = async (txId) => {
    if (txId === 1) {
      firstLocked.resolve();
      await gate.promise;
    }
  };
  env.onWaiter = () => waiterSeen.resolve();

  const first = upload(service, { particularTokenId: 7 });
  await untilLocked(firstLocked, first);
  const second = upload(service, { particularTokenId: 7 });
  await untilWaiting(waiterSeen, second);

  gate.resolve();
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(firstResult.type, "uploaded");
  assert.equal(secondResult.type, "uploaded");
  assert.deepEqual(env.committed.reports.map((row) => row.id), [100, 101]);
  assert.equal(env.committed.tokens[0]?.reportId, 101);
  assert.deepEqual(env.committed.notifications, ["report_delivered"]);
  assert.deepEqual(env.committed.audits, ["report.uploaded", "report.uploaded"]);
  assert.deepEqual(
    env.compensations.map((entry) => entry.outcome),
    ["commit_confirmed"],
  );
});

test("simulación de concurrencia: cuatro subidas simultáneas a dos tokens terminan sin esperas residuales y con una asociación coherente por token", async () => {
  const { env, service } = createEnvironment(twoTokenSeed());

  const results = await Promise.all([
    upload(service, { particularTokenId: 7 }),
    upload(service, { particularTokenId: 8 }),
    upload(service, { particularTokenId: 7 }),
    upload(service, { particularTokenId: 8 }),
  ]);

  assert.deepEqual(
    results.map((result) => result.type),
    ["uploaded", "uploaded", "uploaded", "uploaded"],
  );
  assert.equal(env.waiters, 0);
  assert.deepEqual(env.committed.audits, [
    "report.uploaded",
    "report.uploaded",
    "report.uploaded",
    "report.uploaded",
  ]);
  assert.deepEqual(env.committed.notifications, [
    "report_delivered",
    "report_delivered",
  ]);
  for (const token of env.committed.tokens) {
    const linked = env.committed.reports.some((row) => row.id === token.reportId);
    assert.equal(linked, true);
    const cases = env.committed.tracking.filter(
      (row) => row.particularTokenId === token.id,
    );
    assert.deepEqual(
      cases.map((row) => row.reportId),
      [token.reportId],
    );
  }
  assert.deepEqual(env.compensations, []);
});
