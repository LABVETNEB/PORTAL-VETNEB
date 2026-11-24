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
  studyTrackingNotifications,
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
  loadReportUploadTransactionalParts,
} = await import(
  "../../../server/features/reports/composition/report-upload-persistence-composition.ts"
);
const { resolveReportSafeErrorName } = await import(
  "../../../server/features/reports/composition/report-route-composition.ts"
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

async function auditEventsOfReport(reportId: number) {
  const rows = await db.execute(
    sql`select event from audit_log where report_id = ${reportId} order by id`,
  );
  return rows.map((row) => String((row as { event: unknown }).event));
}

async function auditCountOfClinic(clinicId: number) {
  const rows = await db.execute(
    sql`select count(*)::int as n from audit_log where clinic_id = ${clinicId}`,
  );
  return Number((rows[0] as { n: unknown }).n);
}

async function notificationTypesOfReport(reportId: number) {
  const rows = await db
    .select({ type: studyTrackingNotifications.type })
    .from(studyTrackingNotifications)
    .where(eq(studyTrackingNotifications.reportId, reportId));
  return rows.map((row) => row.type);
}

async function notificationCountOfClinic(clinicId: number) {
  const rows = await db
    .select({ id: studyTrackingNotifications.id })
    .from(studyTrackingNotifications)
    .where(eq(studyTrackingNotifications.clinicId, clinicId));
  return rows.map((row) => row.id).length;
}

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

/**
 * Espera a que PostgreSQL REPORTE una sesion bloqueada por un lock de fila sobre
 * particular_tokens. La prueba del bloqueo es esa observacion del servidor, no el
 * paso del tiempo: el bucle solo reintenta la consulta hasta un tope.
 */
async function waitForTokenLockWaiter(running: Promise<unknown>) {
  let settled = false;
  void running.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );

  for (let attempt = 0; attempt < 400; attempt += 1) {
    const rows = await db.execute(
      sql`select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query ilike '%particular_tokens%'`,
    );
    if (Number((rows[0] as { n: unknown }).n) > 0) {
      return;
    }
    assert.equal(
      settled,
      false,
      "la segunda subida termino sin quedar bloqueada por el lock del token",
    );
    await new Promise((resolve) => setImmediate(resolve));
  }

  assert.fail("PostgreSQL no reporto ninguna sesion esperando el lock del token");
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
    findPersistedReportByStoragePath: (storagePath) =>
      real.findPersistedReportByStoragePath(storagePath),
    logReportStorageCompensation: (input) => {
      state.compensations.push(input);
    },
    // Los efectos de la subida viven dentro de la transaccion: estas
    // dependencias no deben invocarse desde la subida.
    createStudyTrackingNotification: async () => {
      throw new Error("la notificacion de la subida debe ir dentro de la transaccion");
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
      throw new Error("la auditoria de la subida debe ir dentro de la transaccion");
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
  auditContextOverrides: Record<string, unknown> = {},
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
    auditContext: {
      method: "POST",
      originalUrl: "/api/admin/reports/upload",
      ip: "198.51.100.7",
      headers: {},
      adminAuth: { id: adminUserId, username: "sec09-synthetic" },
      ...auditContextOverrides,
    },
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

type Injection =
  | "duplicate_tracking"
  | "fail_after_tracking"
  | "fail_audit"
  | "bad_notification"
  | "none";

async function injectedHarness(
  injection: Injection,
  overrides: Partial<ServiceDependencies> = {},
  hooks: { afterLock?: () => Promise<void> } = {},
) {
  const { bindParts } = await loadReportUploadTransactionalParts();
  const runner = createTransactionalReportPersistenceRunner<Tx>({
    transact: (fn) => db.transaction(fn),
    bindScope: (tx) => {
      const parts = bindParts(tx);
      return buildReportUploadScope({
        ...parts,
        lockParticularToken: async (tokenId) => {
          const locked = await parts.lockParticularToken(tokenId);
          await hooks.afterLock?.();
          return locked;
        },
        createStudyTrackingCase: async (input) => {
          const created = await parts.createStudyTrackingCase(input);
          if (injection === "fail_after_tracking") {
            throw new Error("injected_after_tracking_create");
          }
          if (injection === "duplicate_tracking") {
            return parts.createStudyTrackingCase(input);
          }
          return created;
        },
        createReportDeliveredNotification: (input) =>
          parts.createReportDeliveredNotification(
            injection === "bad_notification"
              ? { ...input, type: "x".repeat(81) }
              : input,
          ),
        writeReportUploadedAudit: async (auditContext, input) => {
          if (injection === "fail_audit") {
            throw new Error("injected_audit_failure");
          }
          return parts.writeReportUploadedAudit(auditContext, input);
        },
      });
    },
  });
  return createHarness(runner, real.isReportStoragePathPersisted, overrides);
}

// El cleanup se registra antes de crear filas: si la preparacion falla a
// mitad, igualmente se borran las filas sinteticas ya creadas.
async function cleanupSyntheticRows() {
  for (const clinicId of createdClinicIds) {
    await db.execute(sql`delete from audit_log where clinic_id = ${clinicId}`);
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
  assert.deepEqual(await auditEventsOfReport(result.report.id), ["report.uploaded"]);
  assert.deepEqual(await notificationTypesOfReport(result.report.id), []);
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
  assert.deepEqual(await notificationTypesOfReport(result.report.id), ["report_delivered"]);
  assert.deepEqual(await auditEventsOfReport(result.report.id), ["report.uploaded"]);
});

test("PG real: token inexistente en el UPDATE revierte el informe ya insertado y compensa el objeto", async () => {
  const realToken = await createToken(clinicA.id);
  const before = await reportsOfClinic(clinicA.id);
  const auditBefore = await auditCountOfClinic(clinicA.id);
  const notificationsBefore = await notificationCountOfClinic(clinicA.id);
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
  assert.equal(await auditCountOfClinic(clinicA.id), auditBefore);
  assert.equal(await notificationCountOfClinic(clinicA.id), notificationsBefore);
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

test("PG real: un fallo de auditoría dentro de la transacción revierte informe, token, seguimiento y notificación ya insertada", async () => {
  const token = await createToken(clinicA.id);
  const before = await reportsOfClinic(clinicA.id);
  const auditBefore = await auditCountOfClinic(clinicA.id);
  const notificationsBefore = await notificationCountOfClinic(clinicA.id);
  const harness = await injectedHarness("fail_audit");

  await assert.rejects(
    upload(harness, admin.id, clinicA.id, token.id),
    (error) => error instanceof Error && error.message === "injected_audit_failure",
  );

  assert.deepEqual(await reportsOfClinic(clinicA.id), before);
  assert.equal((await tokenById(token.id))?.reportId, null);
  assert.deepEqual(await trackingOfToken(token.id), []);
  assert.equal(await auditCountOfClinic(clinicA.id), auditBefore);
  assert.equal(await notificationCountOfClinic(clinicA.id), notificationsBefore);
  assert.deepEqual([...harness.state.storage], []);
  assert.deepEqual(
    harness.state.compensations.map((entry) => entry.outcome),
    ["deleted"],
  );
});

test("PG real: una falla real de auditoría (22001) falla cerrado aunque el adaptador anterior absorbiera el error", async () => {
  const token = await createToken(clinicA.id);
  const before = await reportsOfClinic(clinicA.id);
  const auditBefore = await auditCountOfClinic(clinicA.id);
  const notificationsBefore = await notificationCountOfClinic(clinicA.id);
  const harness = realHarness();
  const tooLongIp = "9".repeat(65);
  let caught: unknown;

  await assert.rejects(
    upload(harness, admin.id, clinicA.id, token.id, { ip: tooLongIp }),
    (error) => {
      caught = error;
      return true;
    },
  );

  assert.equal(pgCode(caught), "22001");
  assert.deepEqual(await reportsOfClinic(clinicA.id), before);
  assert.equal((await tokenById(token.id))?.reportId, null);
  assert.deepEqual(await trackingOfToken(token.id), []);
  assert.equal(await auditCountOfClinic(clinicA.id), auditBefore);
  assert.equal(await notificationCountOfClinic(clinicA.id), notificationsBefore);
  assert.deepEqual([...harness.state.storage], []);
  assert.deepEqual(
    harness.state.compensations.map((entry) => entry.outcome),
    ["deleted"],
  );

  // Contraste: el adaptador anterior (writeAuditLog) absorbe ese mismo error.
  const { writeAuditLog } = await import("../../../server/lib/audit.ts");
  const originalError = console.error;
  console.error = () => undefined;
  try {
    await assert.doesNotReject(
      writeAuditLog(
        {
          method: "POST",
          originalUrl: "/api/admin/reports/upload",
          ip: tooLongIp,
          headers: {},
          adminAuth: { id: admin.id, username: "sec09-synthetic" },
        } as never,
        { event: "report.uploaded", clinicId: clinicA.id },
      ),
    );
  } finally {
    console.error = originalError;
  }
  assert.equal(await auditCountOfClinic(clinicA.id), auditBefore);
});

test("PG real: un commit realmente revertido no deja ningún efecto, conserva el objeto y un reintento crea una sola vez cada efecto", async () => {
  const { bindParts } = await loadReportUploadTransactionalParts();
  const token = await createToken(clinicA.id);
  const before = await reportsOfClinic(clinicA.id);
  const auditBefore = await auditCountOfClinic(clinicA.id);
  const notificationsBefore = await notificationCountOfClinic(clinicA.id);
  const runner = createTransactionalReportPersistenceRunner<Tx>({
    // El trabajo termina y la transaccion se revierte de verdad: es el caso
    // "commit no aplicado" con PostgreSQL real.
    transact: (fn) =>
      db.transaction(async (tx) => {
        await fn(tx);
        throw new Error("commit_not_applied");
      }),
    bindScope: (tx) => buildReportUploadScope(bindParts(tx)),
  });
  const reverted = createHarness(runner, real.isReportStoragePathPersisted);

  await assert.rejects(
    upload(reverted, admin.id, clinicA.id, token.id),
    (error) => error instanceof ReportPersistenceCommitUnknownError,
  );

  assert.deepEqual(await reportsOfClinic(clinicA.id), before);
  assert.equal((await tokenById(token.id))?.reportId, null);
  assert.deepEqual(await trackingOfToken(token.id), []);
  assert.equal(await auditCountOfClinic(clinicA.id), auditBefore);
  assert.equal(await notificationCountOfClinic(clinicA.id), notificationsBefore);
  const orphan = [...reverted.state.storage];
  assert.equal(orphan.length === 1, true);
  assert.deepEqual(
    reverted.state.compensations.map((entry) => ({
      outcome: entry.outcome,
      verification: entry.verification,
    })),
    [{ outcome: "preserved_commit_unknown", verification: "not_persisted" }],
  );

  const retry = await upload(realHarness(), admin.id, clinicA.id, token.id);

  assert.equal(retry.type, "uploaded");
  if (retry.type !== "uploaded") return;
  assert.deepEqual(await reportsByPath(String(orphan[0])), []);
  assert.deepEqual(await auditEventsOfReport(retry.report.id), ["report.uploaded"]);
  assert.deepEqual(await notificationTypesOfReport(retry.report.id), ["report_delivered"]);
  assert.equal(await auditCountOfClinic(clinicA.id), auditBefore + 1);
});

test("PG real: si la notificación falla dentro del savepoint, la transacción sigue usable y el informe y la auditoría se confirman", async () => {
  const token = await createToken(clinicA.id);
  const notificationsBefore = await notificationCountOfClinic(clinicA.id);
  const failures: string[] = [];
  const harness = await injectedHarness("bad_notification", {
    logReportDeliveredNotificationFailure: (input) => {
      failures.push(input.errorName);
    },
  });

  const result = await upload(harness, admin.id, clinicA.id, token.id);

  assert.equal(result.type, "uploaded");
  if (result.type !== "uploaded") return;
  assert.equal((await tokenById(token.id))?.reportId, result.report.id);
  assert.deepEqual(await auditEventsOfReport(result.report.id), ["report.uploaded"]);
  assert.deepEqual(await notificationTypesOfReport(result.report.id), []);
  assert.equal(await notificationCountOfClinic(clinicA.id), notificationsBefore);
  assert.equal(failures.length === 1, true);
  assert.deepEqual(harness.state.compensations, []);
});

test("PG real: dos subidas al mismo token se serializan en el lock de fila: la segunda espera de verdad y continua sobre el estado confirmado", async () => {
  const token = await createToken(clinicA.id);
  const firstLocked = deferred();
  const gate = deferred();
  const first = await injectedHarness(
    "none",
    {},
    {
      afterLock: async () => {
        firstLocked.resolve();
        await gate.promise;
      },
    },
  );
  const second = realHarness();

  const firstUpload = upload(first, admin.id, clinicA.id, token.id);
  await Promise.race([
    firstLocked.promise,
    firstUpload.then(() => {
      throw new Error("la primera subida termino sin tomar el lock");
    }),
  ]);
  const secondUpload = upload(second, admin.id, clinicA.id, token.id);
  await waitForTokenLockWaiter(secondUpload);

  // Invariantes intermedias: nada confirmado y la segunda no escribio.
  assert.deepEqual(await trackingOfToken(token.id), []);
  assert.equal((await tokenById(token.id))?.reportId, null);

  gate.resolve();
  const [firstResult, secondResult] = await Promise.all([firstUpload, secondUpload]);

  assert.equal(firstResult.type, "uploaded");
  assert.equal(secondResult.type, "uploaded");
  if (firstResult.type !== "uploaded" || secondResult.type !== "uploaded") return;
  // Equivale a ejecutar primero una y despues la otra: el token queda con la ultima.
  assert.equal((await tokenById(token.id))?.reportId, secondResult.report.id);
  const tracking = await trackingOfToken(token.id);
  assert.deepEqual(
    tracking.map((row) => row.reportId),
    [secondResult.report.id],
  );
  // La segunda leyo el seguimiento ya entregado: sin notificacion duplicada.
  assert.deepEqual(await notificationTypesOfReport(firstResult.report.id), ["report_delivered"]);
  assert.deepEqual(await notificationTypesOfReport(secondResult.report.id), []);
  assert.deepEqual(await auditEventsOfReport(firstResult.report.id), ["report.uploaded"]);
  assert.deepEqual(await auditEventsOfReport(secondResult.report.id), ["report.uploaded"]);
  assert.deepEqual(first.state.compensations, []);
  assert.deepEqual(second.state.compensations, []);
});

test("PG real: subidas a tokens distintos no se bloquean entre sí", async () => {
  const tokenA = await createToken(clinicA.id);
  const tokenB = await createToken(clinicA.id);
  const heldLocked = deferred();
  const gate = deferred();
  const held = await injectedHarness(
    "none",
    {},
    {
      afterLock: async () => {
        heldLocked.resolve();
        await gate.promise;
      },
    },
  );

  const heldUpload = upload(held, admin.id, clinicA.id, tokenA.id);
  await Promise.race([
    heldLocked.promise,
    heldUpload.then(() => {
      throw new Error("la subida retenida termino sin tomar el lock");
    }),
  ]);
  // Con el lock del token A retenido, la subida al token B completa sin esperar.
  const other = await upload(realHarness(), admin.id, clinicA.id, tokenB.id);

  assert.equal(other.type, "uploaded");
  const waiting = await db.execute(
    sql`select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query ilike '%particular_tokens%'`,
  );
  assert.equal(Number((waiting[0] as { n: unknown }).n), 0);

  gate.resolve();
  assert.equal((await heldUpload).type, "uploaded");
  assert.notEqual((await tokenById(tokenA.id))?.reportId, null);
  assert.notEqual((await tokenById(tokenB.id))?.reportId, null);
});

test("PG real: si el titular del lock falla reteniéndolo, revierte y la segunda subida continúa sobre el estado limpio", async () => {
  const token = await createToken(clinicA.id);
  const firstLocked = deferred();
  const gate = deferred();
  const first = await injectedHarness(
    "fail_audit",
    {},
    {
      afterLock: async () => {
        firstLocked.resolve();
        await gate.promise;
      },
    },
  );
  const second = realHarness();

  const firstUpload = upload(first, admin.id, clinicA.id, token.id);
  const firstOutcome = assert.rejects(
    firstUpload,
    (error) => error instanceof Error && error.message === "injected_audit_failure",
  );
  await Promise.race([
    firstLocked.promise,
    firstUpload.then(
      () => {
        throw new Error("la primera subida termino sin tomar el lock");
      },
      () => {
        throw new Error("la primera subida fallo sin tomar el lock");
      },
    ),
  ]);
  const secondUpload = upload(second, admin.id, clinicA.id, token.id);
  await waitForTokenLockWaiter(secondUpload);

  gate.resolve();
  await firstOutcome;
  const result = await secondUpload;

  assert.equal(result.type, "uploaded");
  if (result.type !== "uploaded") return;
  assert.equal((await tokenById(token.id))?.reportId, result.report.id);
  assert.deepEqual(
    (await trackingOfToken(token.id)).map((row) => row.reportId),
    [result.report.id],
  );
  assert.deepEqual(await notificationTypesOfReport(result.report.id), ["report_delivered"]);
  assert.deepEqual(
    first.state.compensations.map((entry) => entry.outcome),
    ["deleted"],
  );
  assert.deepEqual([...first.state.storage], []);
  assert.deepEqual(second.state.compensations, []);
});

test("PG real: si el token cambió de clínica entre la lectura sin lock y el lock, falla cerrado antes de crear el informe y compensa", async () => {
  const tokenOfB = await createToken(clinicB.id);
  const before = await reportsOfClinic(clinicA.id);
  const beforeB = await reportsOfClinic(clinicB.id);
  const harness = realHarness({
    // Lectura previa sin lock "vieja": afirma que el token es de la clinica A.
    getParticularTokenById: async () => ({ ...tokenOfB, clinicId: clinicA.id }),
  });

  await assert.rejects(
    upload(harness, admin.id, clinicA.id, tokenOfB.id),
    (error) =>
      error instanceof ReportUploadPersistenceError &&
      error.code === "token_link_failed",
  );

  assert.deepEqual(await reportsOfClinic(clinicA.id), before);
  assert.deepEqual(await reportsOfClinic(clinicB.id), beforeB);
  assert.equal((await tokenById(tokenOfB.id))?.reportId, null);
  assert.deepEqual([...harness.state.storage], []);
  assert.deepEqual(
    harness.state.compensations.map((entry) => entry.outcome),
    ["deleted"],
  );
});

test("PG real: el lock del token fija un lock_timeout acotado para la transacción", async () => {
  const token = await createToken(clinicA.id);
  const { bindParts } = await loadReportUploadTransactionalParts();
  let observed = "";

  await db.transaction(async (tx) => {
    const locked = await bindParts(tx).lockParticularToken(token.id);
    assert.equal(locked?.id, token.id);
    const rows = await tx.execute(sql`show lock_timeout`);
    observed = String((rows[0] as { lock_timeout: unknown }).lock_timeout);
  });

  assert.equal(observed, "10s");
});

test("PG real: cuatro subidas simultáneas a dos tokens terminan sin deadlock y con una asociación coherente por token", async () => {
  const tokenA = await createToken(clinicA.id);
  const tokenB = await createToken(clinicA.id);

  const results = await Promise.all([
    upload(realHarness(), admin.id, clinicA.id, tokenA.id),
    upload(realHarness(), admin.id, clinicA.id, tokenB.id),
    upload(realHarness(), admin.id, clinicA.id, tokenA.id),
    upload(realHarness(), admin.id, clinicA.id, tokenB.id),
  ]);

  assert.deepEqual(
    results.map((result) => result.type),
    ["uploaded", "uploaded", "uploaded", "uploaded"],
  );
  for (const token of [tokenA, tokenB]) {
    const linked = (await tokenById(token.id))?.reportId;
    const tracking = await trackingOfToken(token.id);
    assert.notEqual(linked, null);
    assert.deepEqual(
      tracking.map((row) => row.reportId),
      [linked],
    );
  }
  for (const result of results) {
    if (result.type !== "uploaded") continue;
    assert.deepEqual(await auditEventsOfReport(result.report.id), ["report.uploaded"]);
  }
});

test("PG real: ack de commit perdido tras un COMMIT real no pierde efectos y el servicio lo resuelve como éxito", async () => {
  const { bindParts } = await loadReportUploadTransactionalParts();
  const token = await createToken(clinicA.id);
  const runner = createTransactionalReportPersistenceRunner<Tx>({
    transact: async (fn) => {
      await db.transaction(fn);
      throw new Error("commit_ack_lost");
    },
    bindScope: (tx) => buildReportUploadScope(bindParts(tx)),
  });
  const harness = createHarness(runner, real.isReportStoragePathPersisted);

  const result = await upload(harness, admin.id, clinicA.id, token.id);

  assert.equal(result.type, "uploaded");
  if (result.type !== "uploaded") return;
  const stored = [...harness.state.storage];
  assert.deepEqual(stored, [result.report.storagePath]);
  assert.equal(result.report.clinicId, clinicA.id);
  assert.equal((await tokenById(token.id))?.reportId, result.report.id);
  assert.deepEqual(await notificationTypesOfReport(result.report.id), ["report_delivered"]);
  assert.deepEqual(await auditEventsOfReport(result.report.id), ["report.uploaded"]);
  assert.deepEqual(
    harness.state.compensations.map((entry) => ({
      outcome: entry.outcome,
      verification: entry.verification,
    })),
    [{ outcome: "commit_confirmed", verification: "persisted" }],
  );
});

test("PG real: un reintento de una subida ya persistida crea otro informe y no duplica el efecto del primero", async () => {
  const harness = realHarness();
  const token = await createToken(clinicA.id);

  const first = await upload(harness, admin.id, clinicA.id, token.id);
  const second = await upload(harness, admin.id, clinicA.id, token.id);

  assert.equal(first.type, "uploaded");
  assert.equal(second.type, "uploaded");
  if (first.type !== "uploaded" || second.type !== "uploaded") return;
  assert.notEqual(first.report.id, second.report.id);
  assert.deepEqual(await auditEventsOfReport(first.report.id), ["report.uploaded"]);
  assert.deepEqual(await auditEventsOfReport(second.report.id), ["report.uploaded"]);
  assert.deepEqual(await notificationTypesOfReport(first.report.id), ["report_delivered"]);
  assert.deepEqual(await notificationTypesOfReport(second.report.id), []);
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
    for (const reportId of reportIds) {
      assert.deepEqual(await auditEventsOfReport(reportId), ["report.uploaded"]);
    }
    const deliveredForA = [
      ...(await notificationTypesOfReport(firstA)),
      ...(await notificationTypesOfReport(secondA)),
    ];
    assert.equal(
      deliveredForA.length >= 1 && deliveredForA.length <= 2,
      true,
    );
    assert.equal(
      deliveredForA.every((type) => type === "report_delivered"),
      true,
    );
    assert.deepEqual(await notificationTypesOfReport(onlyB), ["report_delivered"]);
  }
});
