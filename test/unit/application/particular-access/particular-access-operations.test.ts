import assert from "node:assert/strict";
import test from "node:test";

import type { StudyTrackingCase } from "../../../../drizzle/schema.ts";
import {
  createAdminParticularAccessOperations,
  createClinicParticularAccessOperations,
  type CreateParticularAccessTokenData,
  type ParticularAccessTokenRecord,
} from "../../../../server/features/particular-access/application/index.ts";

const now = new Date("2026-07-24T12:00:00.000Z");

function token(
  overrides: Partial<ParticularAccessTokenRecord> = {},
): ParticularAccessTokenRecord {
  return {
    id: 31,
    clinicId: 7,
    reportId: null,
    tokenLast4: "cdef",
    tutorLastName: "Pérez",
    petName: "Mora",
    petAge: "5",
    petBreed: "Mestiza",
    petSex: "Hembra",
    petSpecies: "Canina",
    sampleLocation: "Piel",
    sampleEvolution: "Dos semanas",
    detailsLesion: null,
    extractionDate: now,
    shippingDate: now,
    isActive: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    createdByAdminId: null,
    createdByClinicUserId: 19,
    ...overrides,
  };
}

function trackingCase(
  overrides: Partial<StudyTrackingCase> = {},
): StudyTrackingCase {
  return {
    id: 41,
    clinicId: 7,
    reportId: null,
    particularTokenId: 31,
    createdByAdminId: null,
    createdByClinicUserId: 19,
    receptionAt: now,
    estimatedDeliveryAt: now,
    estimatedDeliveryAutoCalculatedAt: now,
    estimatedDeliveryWasManuallyAdjusted: false,
    currentStage: "reception",
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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const createData: CreateParticularAccessTokenData = {
  reportId: null,
  recipientEmail: "tutor@example.test",
  tutorLastName: "Pérez",
  petName: "Mora",
  petAge: "5",
  petBreed: "Mestiza",
  petSex: "Hembra",
  petSpecies: "Canina",
  sampleLocation: "Piel",
  sampleEvolution: "Dos semanas",
  detailsLesion: null,
  extractionDate: now,
  shippingDate: now,
};

function baseStudyTracking(existing = trackingCase()) {
  return {
    getParticularStudyTrackingCase: async () => existing,
    getStudyTrackingCaseByReportId: async () => null,
    createStudyTrackingCase: async () => existing,
    updateStudyTrackingCase: async () => existing,
  };
}

test("admin crea con autoridad global y preserva orden email → tracking → notification", async () => {
  const calls: string[] = [];
  const created = token({ createdByAdminId: 5, createdByClinicUserId: null });
  const operations = createAdminParticularAccessOperations({
    now: () => now.getTime(),
    generateSessionToken: () => {
      calls.push("generate");
      return "raw-token-abcdef";
    },
    hashSessionToken: (value) => {
      calls.push(`hash:${value}`);
      return "opaque-test-digest";
    },
    getClinicById: async (clinicId) => {
      calls.push(`clinic:${clinicId}`);
      return { id: clinicId };
    },
    getReportById: async () => null,
    createParticularToken: async (input) => {
      calls.push(`create:${input.clinicId}:${input.tokenLast4}`);
      return created;
    },
    getParticularTokenById: async () => created,
    listParticularTokens: async () => [created],
    updateParticularTokenReport: async () => created,
    revokeParticularToken: async () => created,
    deleteParticularToken: async () => ({ id: created.id }),
    sendParticularTokenEmail: async () => {
      calls.push("email");
      return { sent: true, messageId: "message-1" };
    },
    studyTracking: {
      ...baseStudyTracking(),
      getParticularStudyTrackingCase: async () => {
        calls.push("tracking");
        return trackingCase();
      },
    },
    createStudyTrackingNotification: async () => {
      calls.push("notification");
      return {};
    },
  });

  const result = await operations.createToken(
    { ...createData, clinicId: 7 },
    5,
  );

  assert.equal(result.kind, "success");
  assert.deepEqual(calls, [
    "clinic:7",
    "generate",
    "hash:raw-token-abcdef",
    "create:7:cdef",
    "email",
    "tracking",
    "notification",
  ]);
});

test("admin rechaza report ownership antes de crear sin perder autoridad global", async () => {
  let createCalls = 0;
  const created = token();
  const operations = createAdminParticularAccessOperations({
    now: () => now.getTime(),
    generateSessionToken: () => "raw-token",
    hashSessionToken: () => "opaque-test-digest",
    getClinicById: async (clinicId) => ({ id: clinicId }),
    getReportById: async () => ({ clinicId: 8 }),
    createParticularToken: async () => {
      createCalls += 1;
      return created;
    },
    getParticularTokenById: async () => created,
    listParticularTokens: async () => [created],
    updateParticularTokenReport: async () => created,
    revokeParticularToken: async () => created,
    deleteParticularToken: async () => ({ id: created.id }),
    sendParticularTokenEmail: async () => ({
      sent: true,
      messageId: "message-1",
    }),
    studyTracking: baseStudyTracking(),
    createStudyTrackingNotification: async () => ({}),
  });

  const result = await operations.createToken(
    { ...createData, clinicId: 7, reportId: 99 },
    5,
  );

  assert.equal(result.kind, "report_wrong_clinic");
  assert.equal(createCalls, 0);
  assert.equal((await operations.getToken(31, 5)).kind, "success");
});

test("fallo de email revoca el token creado y conserva identidad del error", async () => {
  const expected = new Error("smtp test failure");
  const calls: string[] = [];
  const created = token();
  const operations = createClinicParticularAccessOperations({
    now: () => now.getTime(),
    generateSessionToken: () => "raw-token-abcdef",
    hashSessionToken: () => "opaque-test-digest",
    getClinicScopedReportById: async () => null,
    createParticularToken: async () => {
      calls.push("create");
      return created;
    },
    getClinicScopedParticularToken: async () => created,
    listParticularTokens: async () => [created],
    updateParticularTokenReport: async () => created,
    revokeParticularToken: async () => {
      calls.push("revoke");
      return created;
    },
    sendParticularTokenEmail: async () => {
      calls.push("email");
      throw expected;
    },
    studyTracking: baseStudyTracking(),
  });

  const result = await operations.createToken(createData, {
    clinicId: 7,
    clinicUserId: 19,
  });

  assert.equal(result.kind, "email_failed");
  assert.equal(result.kind === "email_failed" && result.error, expected);
  assert.deepEqual(calls, ["create", "email", "revoke"]);
});

test("clínica deriva siempre scope de sesión para listar, obtener y actualizar", async () => {
  const calls: Array<readonly unknown[]> = [];
  const own = token({ clinicId: 7 });
  const operations = createClinicParticularAccessOperations({
    now: () => now.getTime(),
    generateSessionToken: () => "raw-token",
    hashSessionToken: () => "opaque-test-digest",
    getClinicScopedReportById: async (reportId, clinicId) => {
      calls.push(["report", reportId, clinicId]);
      return { clinicId };
    },
    createParticularToken: async () => own,
    getClinicScopedParticularToken: async (tokenId, clinicId) => {
      calls.push(["token", tokenId, clinicId]);
      return clinicId === 7 ? own : null;
    },
    listParticularTokens: async (params) => {
      calls.push(["list", params]);
      return [own];
    },
    updateParticularTokenReport: async (tokenId, reportId) => {
      calls.push(["update", tokenId, reportId]);
      return token({ reportId });
    },
    revokeParticularToken: async () => own,
    sendParticularTokenEmail: async () => ({
      sent: true,
      messageId: "message-1",
    }),
    studyTracking: baseStudyTracking(),
  });

  await operations.listTokens(7, 50, 0);
  assert.equal((await operations.getToken(31, 7)).kind, "success");
  assert.equal(
    (await operations.updateTokenReport(31, 88, 7)).kind,
    "success",
  );
  assert.deepEqual(calls, [
    ["list", { clinicId: 7, limit: 50, offset: 0 }],
    ["token", 31, 7],
    ["token", 31, 7],
    ["report", 88, 7],
    ["update", 31, 88],
    ["report", 88, 7],
  ]);
});

test("token ajeno e inexistente son indistinguibles y no disparan update", async () => {
  let updateCalls = 0;
  const operations = createClinicParticularAccessOperations({
    now: () => now.getTime(),
    generateSessionToken: () => "raw-token",
    hashSessionToken: () => "opaque-test-digest",
    getClinicScopedReportById: async () => null,
    createParticularToken: async () => token(),
    getClinicScopedParticularToken: async () => null,
    listParticularTokens: async () => [],
    updateParticularTokenReport: async () => {
      updateCalls += 1;
      return token();
    },
    revokeParticularToken: async () => token(),
    sendParticularTokenEmail: async () => ({
      sent: true,
      messageId: "message-1",
    }),
    studyTracking: baseStudyTracking(),
  });

  assert.deepEqual(await operations.getToken(31, 7), {
    kind: "not_found",
  });
  assert.deepEqual(await operations.updateTokenReport(31, null, 7), {
    kind: "token_not_found",
  });
  assert.equal(updateCalls, 0);
});

test("clinicId inyectado en datos no puede reemplazar el actor autenticado", async () => {
  let persistedClinicId = 0;
  const created = token({ clinicId: 7 });
  const operations = createClinicParticularAccessOperations({
    now: () => now.getTime(),
    generateSessionToken: () => "raw-token-abcdef",
    hashSessionToken: () => "opaque-test-digest",
    getClinicScopedReportById: async () => null,
    createParticularToken: async (input) => {
      persistedClinicId = input.clinicId;
      return created;
    },
    getClinicScopedParticularToken: async () => created,
    listParticularTokens: async () => [created],
    updateParticularTokenReport: async () => created,
    revokeParticularToken: async () => created,
    sendParticularTokenEmail: async () => ({
      sent: true,
      messageId: "message-1",
    }),
    studyTracking: baseStudyTracking(),
  });

  await operations.createToken(
    { ...createData, clinicId: 999 } as CreateParticularAccessTokenData,
    { clinicId: 7, clinicUserId: 19 },
  );

  assert.equal(persistedClinicId, 7);
});
