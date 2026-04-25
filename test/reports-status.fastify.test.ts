import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const { reportsStatusNativeRoutes } = await import(
  "../server/routes/reports-status.fastify.ts"
);

function createReportFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 55,
    clinicId: 3,
    patientName: "Luna Gomez",
    studyType: "Histopatología",
    uploadDate: new Date("2026-04-20T00:00:00.000Z"),
    fileName: "luna.pdf",
    storagePath: "reports/3/luna.pdf",
    previewUrl: null,
    downloadUrl: null,
    currentStatus: "processing",
    statusChangedAt: new Date("2026-04-21T00:00:00.000Z"),
    statusChangedByClinicUserId: 9,
    statusChangedByAdminUserId: null,
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    updatedAt: new Date("2026-04-22T12:00:00.000Z"),
    ...overrides,
  };
}

function createAuthStubs(overrides: Record<string, unknown> = {}) {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => ({
      clinicUserId: 9,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-04-23T00:00:00.000Z"),
    }),
    getClinicUserById: async () => ({
      id: 9,
      clinicId: 3,
      username: "doctor",
      authProId: null,
      role: "clinic_owner",
    }),
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    ...overrides,
  };
}

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(reportsStatusNativeRoutes as any, {
    prefix: "/api/reports",
    ...createAuthStubs(),
    getReportById: async () => createReportFixture(),
    updateReportStatus: async (input: { toStatus: string }) =>
      createReportFixture({ currentStatus: input.toStatus }),
    createSignedReportUrl: async (storagePath: string) => `preview:${storagePath}`,
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => `download:${storagePath}:${fileName ?? ""}`,
    writeAuditLog: async () => {},
    now: () => new Date("2026-04-24T00:00:00.000Z").getTime(),
    ...overrides,
  });

  return app;
}

test("reportsStatusNativeRoutes actualiza PATCH /:reportId/status y escribe auditoria", async () => {
  const updateCalls: Array<Record<string, unknown>> = [];
  const auditCalls: Array<Record<string, unknown>> = [];
  const app = await createTestApp({
    updateReportStatus: async (input: Record<string, unknown>) => {
      updateCalls.push(input);
      return createReportFixture({ currentStatus: input.toStatus });
    },
    writeAuditLog: async (_req: unknown, input: Record<string, unknown>) => {
      auditCalls.push(input);
    },
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/reports/55/status",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
        origin: "http://localhost:3000",
      },
      payload: {
        status: "ready",
        note: " Informe listo ",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(updateCalls, [
      {
        reportId: 55,
        toStatus: "ready",
        note: "Informe listo",
        changedByClinicUserId: 9,
        changedByAdminUserId: null,
      },
    ]);

    assert.equal(auditCalls.length, 1);
    assert.equal(auditCalls[0].event, "report.status_changed");
    assert.equal(auditCalls[0].clinicId, 3);
    assert.equal(auditCalls[0].reportId, 55);
    assert.deepEqual(auditCalls[0].metadata, {
      fromStatus: "processing",
      toStatus: "ready",
      note: "Informe listo",
    });

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.message, "Estado de informe actualizado correctamente");
    assert.equal(body.report.currentStatus, "ready");
    assert.equal(body.report.previewUrl, "preview:reports/3/luna.pdf");
    assert.equal(
      body.report.downloadUrl,
      "download:reports/3/luna.pdf:luna.pdf",
    );
  } finally {
    await app.close();
  }
});

test("reportsStatusNativeRoutes bloquea PATCH /:reportId/status sin management permission", async () => {
  const app = await createTestApp({
    getClinicUserById: async () => ({
      id: 9,
      clinicId: 3,
      username: "doctor",
      authProId: null,
      role: "clinic_staff",
    }),
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/reports/55/status",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
      payload: {
        status: "ready",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "No autorizado para cambiar el estado de informes",
    });
  } finally {
    await app.close();
  }
});

test("reportsStatusNativeRoutes valida reportId y status inválidos", async () => {
  const app = await createTestApp();

  try {
    const invalidReportId = await app.inject({
      method: "PATCH",
      url: "/api/reports/abc/status",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
      payload: {
        status: "ready",
      },
    });

    assert.equal(invalidReportId.statusCode, 400);
    assert.deepEqual(JSON.parse(invalidReportId.body), {
      success: false,
      error: "ID de informe invalido",
    });

    const invalidStatus = await app.inject({
      method: "PATCH",
      url: "/api/reports/55/status",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
      payload: {
        status: "bad",
      },
    });

    assert.equal(invalidStatus.statusCode, 400);
    const body = JSON.parse(invalidStatus.body);
    assert.equal(body.success, false);
    assert.equal(body.error, "Estado de informe invalido");
    assert.ok(Array.isArray(body.allowedStatuses));
  } finally {
    await app.close();
  }
});

test("reportsStatusNativeRoutes bloquea informe ajeno o inexistente", async () => {
  const foreignReportApp = await createTestApp({
    getReportById: async () => createReportFixture({ clinicId: 99 }),
  });

  try {
    const response = await foreignReportApp.inject({
      method: "PATCH",
      url: "/api/reports/55/status",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
      payload: {
        status: "ready",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "No autorizado para cambiar el estado de este informe",
    });
  } finally {
    await foreignReportApp.close();
  }

  const missingReportApp = await createTestApp({
    getReportById: async () => null,
  });

  try {
    const response = await missingReportApp.inject({
      method: "PATCH",
      url: "/api/reports/55/status",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
      payload: {
        status: "ready",
      },
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Informe no encontrado",
    });
  } finally {
    await missingReportApp.close();
  }
});

test("reportsStatusNativeRoutes rechaza status repetido o transición inválida", async () => {
  const sameStatusApp = await createTestApp({
    getReportById: async () => createReportFixture({ currentStatus: "ready" }),
  });

  try {
    const response = await sameStatusApp.inject({
      method: "PATCH",
      url: "/api/reports/55/status",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
      payload: {
        status: "ready",
      },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "El informe ya se encuentra en ese estado",
    });
  } finally {
    await sameStatusApp.close();
  }

  const invalidTransitionApp = await createTestApp({
    getReportById: async () => createReportFixture({ currentStatus: "delivered" }),
  });

  try {
    const response = await invalidTransitionApp.inject({
      method: "PATCH",
      url: "/api/reports/55/status",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
      payload: {
        status: "processing",
      },
    });

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.success, false);
    assert.equal(body.error, "La transición de estado no está permitida");
    assert.equal(body.currentStatus, "delivered");
    assert.equal(body.requestedStatus, "processing");
  } finally {
    await invalidTransitionApp.close();
  }
});

test("reportsStatusNativeRoutes bloquea origin no permitido antes de auth", async () => {
  const app = await createTestApp({
    getActiveSessionByToken: async () => {
      throw new Error("auth should not run");
    },
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/reports/55/status",
      headers: {
        origin: "http://evil.example",
      },
      payload: {
        status: "ready",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Origen no permitido",
    });
  } finally {
    await app.close();
  }
});
