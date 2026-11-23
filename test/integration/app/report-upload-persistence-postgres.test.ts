/**
 * PostgreSQL REAL aislado: el runner transaccional, los repositorios y el
 * servicio son los de produccion. Storage es un Set en memoria (no hay
 * Supabase). Se niega a correr fuera de loopback + base permitida y solo
 * limpia las filas que crea (clinicas sinteticas, borradas en cascada).
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";

import { eq, sql } from "drizzle-orm";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const ALLOWED_DATABASES = ["/portal_vetneb_ci", "/portal_vetneb_sec09_ci"];

for (const name of ["DATABASE_URL", "SUPABASE_DB_URL"] as const) {
  const value = process.env[name]?.trim();
  const target = value ? new URL(value) : undefined;
  if (
    !target ||
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    !ALLOWED_DATABASES.includes(target.pathname)
  ) {
    throw new Error(
      `SEC-09 requiere ${name} en loopback apuntando a una DB aislada permitida`,
    );
  }
}

process.env.DATABASE_MAX_CONNECTIONS = "6";

import type {
  ParticularToken,
  Report,
  StudyTrackingCase,
} from "../../../drizzle/schema.ts";
import type {
  ReportRouteServiceDependencies,
  ReportStorageCompensationLog,
} from "../../../server/features/reports/application/index.ts";

const { db, closeDbConnection } = await import("../../../server/db.ts");
const {
  adminUsers,
  clinics,
  particularTokens,
  reports,
  reportStatusHistory,
  studyTrackingCases,
} = await import("../../../drizzle/schema.ts");
const {
  createReportRouteService,
  ReportPersistenceCommitUnknownError,
  ReportUploadPersistenceError,
} = await import("../../../server/features/reports/application/index.ts");
const {
  buildReportUploadScope,
  createTransactionalReportPersistenceRunner,
  loadReportUploadPersistence,
} = await import(
  "../../../server/features/reports/composition/report-upload-persistence-composition.ts"
);
const { resolveReportSafeErrorName } = await import(
  "../../../server/features/reports/composition/report-route-composition.ts"
);
const { createOrEditReportWithinTransaction } = await import(
  "../../../server/features/reports/infrastructure/index.ts"
);
const { loadReportUploadStudyTrackingPersistence } = await import(
  "../../../server/features/study-tracking/index.ts"
);
const { loadReportUploadParticularAccessPersistence } = await import(
  "../../../server/features/particular-access/index.ts"
);

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

type Database = typeof db;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const RUN = `${process.pid}-${Date.now()}`;
const NOW = new Date("2026-11-02T12:00:00.000Z");
const MISSING_ID = 2147483000;

const createdClinicIds: number[] = [];
const createdAdminIds: number[] = [];
let tokenSequence = 0;

// Algunas bases locales conservan la columna legacy `clinics.clinic_id`
// (varchar UNIQUE NOT NULL) que no existe en una base migrada desde cero.
const legacyClinicIdColumn =
  (
    await db.execute(
      sql`select 1 as present from information_schema.columns where table_schema = 'public' and table_name = 'clinics' and column_name = 'clinic_id'`,
    )
  ).length > 0;

async function createClinic(label: string) {
  const name = `sec09-${RUN}-${label}`;

  if (legacyClinicIdColumn) {
    const legacyRows = await db.execute(
      sql`insert into clinics (clinic_id, name) values (${name}, ${name}) returning id`,
    );
    const legacyId = Number((legacyRows[0] as { id: unknown }).id);
    createdClinicIds.push(legacyId);
    return { id: legacyId };
  }

  const rows = await db.insert(clinics).values({ name }).returning();
  const row = rows[0];
  createdClinicIds.push(row.id);
  return row;
}

async function createAdmin() {
  const rows = await db
    .insert(adminUsers)
    .values({
      username: `sec09-${RUN}`,
      passwordHash: "synthetic-not-a-credential",
    })
    .returning();
  const row = rows[0];
  createdAdminIds.push(row.id);
  return row;
}

async function createToken(clinicId: number) {
  tokenSequence += 1;
  const hash = crypto
    .createHash("sha256")
    .update(`${RUN}-${tokenSequence}`)
    .digest("hex");
  const rows = await db
    .insert(particularTokens)
    .values({
      clinicId,
      tokenHash: hash,
      tokenLast4: hash.slice(-4),
      tutorLastName: "Sintetico",
      petName: "Mascota",
      petAge: "3",
      petBreed: "Mestizo",
      petSex: "M",
      petSpecies: "Canino",
      sampleLocation: "Piel",
      sampleEvolution: "Una semana",
      extractionDate: NOW,
      shippingDate: NOW,
    })
    .returning();
  return rows[0];
}

async function reportsOfClinic(clinicId: number) {
  const rows = await db
    .select({ id: reports.id })
    .from(reports)
    .where(eq(reports.clinicId, clinicId));
  return rows.map((row) => row.id).sort((a, b) => a - b);
}

async function reportsByPath(storagePath: string) {
  return db.select().from(reports).where(eq(reports.storagePath, storagePath));
}

async function historyStatuses(reportId: number) {
  const rows = await db
    .select({ toStatus: reportStatusHistory.toStatus })
    .from(reportStatusHistory)
    .where(eq(reportStatusHistory.reportId, reportId));
  return rows.map((row) => row.toStatus);
}

async function tokenById(tokenId: number) {
  const rows = await db
    .select()
    .from(particularTokens)
    .where(eq(particularTokens.id, tokenId))
    .limit(1);
  return rows[0];
}

async function trackingOfToken(tokenId: number) {
  return db
    .select()
    .from(studyTrackingCases)
    .where(eq(studyTrackingCases.particularTokenId, tokenId));
}

function pgCode(error: unknown): string | undefined {
  const direct = (error as { code?: unknown } | null)?.code;
  if (typeof direct === "string") return direct;
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;
  if (typeof cause?.code === "string") return cause.code;
  return undefined;
}

type Harness = ReturnType<typeof createHarness>;

function createHarness(
  runReportPersistence: ServiceDependencies["runReportPersistence"],
  isReportStoragePathPersisted: ServiceDependencies["isReportStoragePathPersisted"],
  overrides: Partial<ServiceDependencies> = {},
) {
  const state = {
    storage: new Set<string>(),
    notifications: [] as string[],
    audits: [] as string[],
    compensations: [] as ReportStorageCompensationLog[],
    uploads: 0,
  };

  const dependencies: ServiceDependencies = {
    getClinicById: async (clinicId) => {
      const rows = await db
        .select({ id: clinics.id })
        .from(clinics)
        .where(eq(clinics.id, clinicId))
        .limit(1);
      return rows[0] ?? null;
    },
    getReportById: async (reportId) => {
      const rows = await db
        .select()
        .from(reports)
        .where(eq(reports.id, reportId))
        .limit(1);
      return rows[0];
    },
    uploadReport: async ({ clinicId, fileName }) => {
      state.uploads += 1;
      const suffix = crypto.randomBytes(6).toString("hex");
      const storagePath = `clinics/${clinicId}/${Date.now()}-${suffix}-${fileName}`;
      state.storage.add(storagePath);
      return storagePath;
    },
    getParticularTokenById: async (tokenId) => tokenById(tokenId),
    runReportPersistence,
    deleteStorageObject: async (storagePath) => {
      state.storage.delete(storagePath);
    },
    isReportStoragePathPersisted,
    logReportStorageCompensation: (input) => {
      state.compensations.push(input);
    },
    createStudyTrackingNotification: async (input) => {
      state.notifications.push(input.type);
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
      state.audits.push(input.event);
    },
    auditEvents: {
      reportUploaded: "report.uploaded",
      workflowStageChanged: "report.workflow_stage.changed",
      specialStainChanged: "report.special_stain.changed",
    },
    resolveSafeErrorName: resolveReportSafeErrorName,
    logReportDeliveredNotificationFailure: () => undefined,
    ...overrides,
  };

  return { state, service: createReportRouteService(dependencies) };
}

function upload(
  harness: Harness,
  adminUserId: number,
  clinicId: number,
  particularTokenId?: number,
) {
  return harness.service.uploadAdminReport({
    clinicId,
    ...(particularTokenId === undefined ? {} : { particularTokenId }),
    file: {
      buffer: Buffer.from("pdf"),
      fileName: "informe.pdf",
      mimeType: "application/pdf",
    },
    patientName: "Paciente Sintetico",
    studyType: "histopatologia",
    uploadDate: "2026-11-02",
    adminUserId,
    auditContext: {},
    now: NOW,
  });
}

const real = await loadReportUploadPersistence();

function realHarness(overrides: Partial<ServiceDependencies> = {}) {
  return createHarness(
    real.runReportPersistence,
    real.isReportStoragePathPersisted,
    overrides,
  );
}

type Injection = "duplicate_tracking" | "fail_after_tracking";

async function injectedHarness(injection: Injection) {
  const trackingFeature = await loadReportUploadStudyTrackingPersistence();
  const particularFeature = await loadReportUploadParticularAccessPersistence();
  const runner = createTransactionalReportPersistenceRunner<Tx>({
    transact: (fn) => db.transaction(fn),
    bindScope: (tx) => {
      const tracking = trackingFeature.createTransactionalStudyTrackingRepository(tx);
      const tokens = particularFeature.createTransactionalParticularTokenRepository(tx);
      return buildReportUploadScope({
        createOrEditReport: (input) =>
          createOrEditReportWithinTransaction(tx, input, new Date()),
        updateParticularTokenReport: tokens.updateParticularTokenReport,
        getParticularStudyTrackingCase: tracking.getParticularStudyTrackingCase,
        getStudyTrackingCaseByReportId: tracking.getStudyTrackingCaseByReportId,
        createStudyTrackingCase: async (input) => {
          const created = await tracking.createStudyTrackingCase(input);
          if (injection === "fail_after_tracking") {
            throw new Error("injected_after_tracking_create");
          }
          void created;
          return tracking.createStudyTrackingCase(input);
        },
        updateStudyTrackingCase: tracking.updateStudyTrackingCase,
      });
    },
  });
  return createHarness(runner, real.isReportStoragePathPersisted);
}

// El cleanup se registra antes de crear filas: si la preparacion falla a
// mitad, igualmente se borran las filas sinteticas ya creadas.
async function cleanupSyntheticRows() {
  for (const clinicId of createdClinicIds) {
    await db.delete(clinics).where(eq(clinics.id, clinicId));
  }
  for (const adminId of createdAdminIds) {
    await db.delete(adminUsers).where(eq(adminUsers.id, adminId));
  }
  createdClinicIds.length = 0;
  createdAdminIds.length = 0;
}

after(async () => {
  await cleanupSyntheticRows();
  await closeDbConnection();
  delete process.env.DATABASE_MAX_CONNECTIONS;
});

async function prepareSyntheticRows() {
  try {
    const preparedAdmin = await createAdmin();
    const preparedA = await createClinic("A");
    const preparedB = await createClinic("B");
    return { preparedAdmin, preparedA, preparedB };
  } catch (error) {
    await cleanupSyntheticRows();
    await closeDbConnection();
    throw error;
  }
}

const prepared = await prepareSyntheticRows();
const admin = prepared.preparedAdmin;
const clinicA = prepared.preparedA;
const clinicB = prepared.preparedB;

test("PG real: subida sin token persiste informe e historial y no compensa", async () => {
  const harness = realHarness();

  const result = await upload(harness, admin.id, clinicA.id);

  assert.equal(result.type, "uploaded");
  if (result.type !== "uploaded") return;
  assert.deepEqual(await historyStatuses(result.report.id), ["uploaded"]);
  assert.equal(await real.isReportStoragePathPersisted(result.report.storagePath), true);
  assert.deepEqual([...harness.state.storage], [result.report.storagePath]);
  assert.deepEqual(harness.state.audits, ["report.uploaded"]);
  assert.deepEqual(harness.state.compensations, []);
});

test("PG real: subida con token vincula informe, token y tracking entregado de la misma clinica", async () => {
  const harness = realHarness();
  const token = await createToken(clinicA.id);

  const result = await upload(harness, admin.id, clinicA.id, token.id);

  assert.equal(result.type, "uploaded");
  if (result.type !== "uploaded") return;
  const linked = await tokenById(token.id);
  assert.equal(linked?.reportId, result.report.id);
  const tracking = await trackingOfToken(token.id);
  assert.deepEqual(
    tracking.map((row) => ({
      clinicId: row.clinicId,
      reportId: row.reportId,
      currentStage: row.currentStage,
    })),
    [{ clinicId: clinicA.id, reportId: result.report.id, currentStage: "delivered" }],
  );
  assert.deepEqual(await historyStatuses(result.report.id), ["uploaded"]);
  assert.deepEqual(harness.state.notifications, ["report_delivered"]);
});

test("PG real: token inexistente en el UPDATE revierte el informe ya insertado y compensa el objeto", async () => {
  const realToken = await createToken(clinicA.id);
  const before = await reportsOfClinic(clinicA.id);
  const harness = realHarness({
    getParticularTokenById: async () => ({ ...realToken, id: MISSING_ID }),
  });

  await assert.rejects(
    upload(harness, admin.id, clinicA.id, MISSING_ID),
    (error) =>
      error instanceof ReportUploadPersistenceError &&
      error.code === "token_link_failed",
  );

  assert.deepEqual(await reportsOfClinic(clinicA.id), before);
  assert.deepEqual([...harness.state.storage], []);
  assert.deepEqual(harness.state.audits, []);
  assert.deepEqual(
    harness.state.compensations.map((entry) => entry.outcome),
    ["deleted"],
  );
});

test("PG real: violacion unica 23505 revierte informe, vinculo del token y tracking", async () => {
  const token = await createToken(clinicA.id);
  const before = await reportsOfClinic(clinicA.id);
  const harness = await injectedHarness("duplicate_tracking");
  let caught: unknown;

  await assert.rejects(upload(harness, admin.id, clinicA.id, token.id), (error) => {
    caught = error;
    return true;
  });

  assert.equal(pgCode(caught), "23505");
  assert.deepEqual(await reportsOfClinic(clinicA.id), before);
  assert.equal((await tokenById(token.id))?.reportId, null);
  assert.deepEqual(await trackingOfToken(token.id), []);
  assert.deepEqual([...harness.state.storage], []);
  assert.deepEqual(
    harness.state.compensations.map((entry) => entry.outcome),
    ["deleted"],
  );
});

test("PG real: fallo tras crear el tracking revierte todas las escrituras de la unidad", async () => {
  const token = await createToken(clinicA.id);
  const before = await reportsOfClinic(clinicA.id);
  const harness = await injectedHarness("fail_after_tracking");

  await assert.rejects(
    upload(harness, admin.id, clinicA.id, token.id),
    (error) =>
      error instanceof Error && error.message === "injected_after_tracking_create",
  );

  assert.deepEqual(await reportsOfClinic(clinicA.id), before);
  assert.equal((await tokenById(token.id))?.reportId, null);
  assert.deepEqual(await trackingOfToken(token.id), []);
  assert.deepEqual([...harness.state.storage], []);
});

test("PG real: integridad referencial, una clinica inexistente (23503) no deja filas y compensa", async () => {
  const harness = realHarness({
    getClinicById: async (clinicId) => ({ id: clinicId }),
  });
  let caught: unknown;

  await assert.rejects(upload(harness, admin.id, MISSING_ID), (error) => {
    caught = error;
    return true;
  });

  assert.equal(pgCode(caught), "23503");
  assert.deepEqual(await reportsOfClinic(MISSING_ID), []);
  assert.deepEqual([...harness.state.storage], []);
  assert.deepEqual(
    harness.state.compensations.map((entry) => entry.outcome),
    ["deleted"],
  );
});

test("PG real: un token de otra clinica se rechaza antes de tocar Storage ni la base", async () => {
  const tokenOfB = await createToken(clinicB.id);
  const beforeA = await reportsOfClinic(clinicA.id);
  const beforeB = await reportsOfClinic(clinicB.id);
  const harness = realHarness();

  const result = await upload(harness, admin.id, clinicA.id, tokenOfB.id);

  assert.deepEqual(result, { type: "token_clinic_mismatch" });
  assert.equal(harness.state.uploads, 0);
  assert.deepEqual(await reportsOfClinic(clinicA.id), beforeA);
  assert.deepEqual(await reportsOfClinic(clinicB.id), beforeB);
  assert.equal((await tokenById(tokenOfB.id))?.reportId, null);
});

test("PG real: ack de commit perdido tras un COMMIT real preserva el objeto y la verificacion lo ve persistido", async () => {
  const trackingFeature = await loadReportUploadStudyTrackingPersistence();
  const particularFeature = await loadReportUploadParticularAccessPersistence();
  const token = await createToken(clinicA.id);
  const runner = createTransactionalReportPersistenceRunner<Tx>({
    transact: async (fn) => {
      await db.transaction(fn);
      throw new Error("commit_ack_lost");
    },
    bindScope: (tx) => {
      const tracking = trackingFeature.createTransactionalStudyTrackingRepository(tx);
      const tokens = particularFeature.createTransactionalParticularTokenRepository(tx);
      return buildReportUploadScope({
        createOrEditReport: (input) =>
          createOrEditReportWithinTransaction(tx, input, new Date()),
        updateParticularTokenReport: tokens.updateParticularTokenReport,
        getParticularStudyTrackingCase: tracking.getParticularStudyTrackingCase,
        getStudyTrackingCaseByReportId: tracking.getStudyTrackingCaseByReportId,
        createStudyTrackingCase: tracking.createStudyTrackingCase,
        updateStudyTrackingCase: tracking.updateStudyTrackingCase,
      });
    },
  });
  const harness = createHarness(runner, real.isReportStoragePathPersisted);

  await assert.rejects(
    upload(harness, admin.id, clinicA.id, token.id),
    (error) => error instanceof ReportPersistenceCommitUnknownError,
  );

  const stored = [...harness.state.storage];
  assert.equal(stored.length === 1, true);
  assert.equal((await reportsByPath(String(stored[0]))).map((row) => row.id).length > 0, true);
  assert.deepEqual(
    harness.state.compensations.map((entry) => ({
      outcome: entry.outcome,
      verification: entry.verification,
    })),
    [{ outcome: "preserved_commit_unknown", verification: "persisted" }],
  );
  assert.deepEqual(harness.state.notifications, []);
  assert.deepEqual(harness.state.audits, []);
});

test("PG real: dos subidas simultaneas al mismo token conservan integridad y no afectan a otra clinica", async () => {
  for (let round = 0; round < 3; round += 1) {
    const tokenA = await createToken(clinicA.id);
    const tokenB = await createToken(clinicB.id);
    const harness = realHarness();

    const results = await Promise.allSettled([
      upload(harness, admin.id, clinicA.id, tokenA.id),
      upload(harness, admin.id, clinicA.id, tokenA.id),
      upload(harness, admin.id, clinicB.id, tokenB.id),
    ]);

    const failures = results.flatMap((entry) =>
      entry.status === "rejected"
        ? [`${resolveReportSafeErrorName(entry.reason)}:${String(pgCode(entry.reason))}`]
        : [],
    );
    assert.deepEqual(failures, []);

    const reportIds = results.flatMap((entry) =>
      entry.status === "fulfilled" && entry.value.type === "uploaded"
        ? [entry.value.report.id]
        : [],
    );
    assert.equal(new Set(reportIds).size, 3);
    assert.deepEqual([...harness.state.storage].sort(), (
      await Promise.all(
        reportIds.map(async (id) => {
          const rows = await db.select().from(reports).where(eq(reports.id, id));
          return String(rows[0]?.storagePath);
        }),
      )
    ).sort());
    assert.deepEqual(harness.state.compensations, []);

    const [firstA, secondA, onlyB] = reportIds;
    const linkedA = await tokenById(tokenA.id);
    assert.equal(linkedA?.reportId === firstA || linkedA?.reportId === secondA, true);
    const trackingA = await trackingOfToken(tokenA.id);
    assert.deepEqual(
      trackingA.map((row) => ({
        reportId: row.reportId,
        currentStage: row.currentStage,
        clinicId: row.clinicId,
      })),
      [{ reportId: linkedA?.reportId, currentStage: "delivered", clinicId: clinicA.id }],
    );
    const linkedB = await tokenById(tokenB.id);
    assert.equal(linkedB?.reportId, onlyB);
    assert.equal(
      harness.state.notifications.every((type) => type === "report_delivered"),
      true,
    );
  }
});
