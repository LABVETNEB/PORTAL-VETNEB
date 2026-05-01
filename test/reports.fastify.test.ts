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
const { reportsNativeRoutes } = await import("../server/routes/reports.fastify.ts");

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
    currentStatus: "ready",
    statusChangedAt: new Date("2026-04-21T00:00:00.000Z"),
    statusChangedByClinicUserId: 9,
    statusChangedByAdminUserId: null,
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    updatedAt: new Date("2026-04-22T12:00:00.000Z"),
    ...overrides,
  };
}

function createStatusHistoryFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    reportId: 55,
    fromStatus: "processing",
    toStatus: "ready",
    note: "Informe listo",
    changedByClinicUserId: 9,
    changedByAdminUserId: null,
    createdAt: new Date("2026-04-21T00:00:00.000Z"),
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

  await app.register(reportsNativeRoutes as any, {
    prefix: "/api/reports",
    ...createAuthStubs(),
    getReportsByClinicId: async () => [createReportFixture()],
    searchReports: async () => [createReportFixture({ id: 56 })],
    getStudyTypes: async () => ["Histopatología", "Citología"],
    getReportById: async () => createReportFixture(),
    getReportStatusHistory: async () => [createStatusHistoryFixture()],
    createSignedReportUrl: async (storagePath: string) => `preview:${storagePath}`,
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => `download:${storagePath}:${fileName ?? ""}`,
    now: () => new Date("2026-04-24T00:00:00.000Z").getTime(),
    ...overrides,
  });

  return app;
}

test("reportsNativeRoutes no registra POST /upload en superficie clinic read-only", async () => {
  const app = await createTestApp({
    getActiveSessionByToken: async () => {
      throw new Error("POST /upload clinic no debe autenticar sesion");
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/reports/upload",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.headers["set-cookie"], undefined);
    assert.match(response.body, /POST:\/api\/reports\/upload|Route/);
  } finally {
    await app.close();
  }
});

test("reportsNativeRoutes expone GET / con lista clinic-scoped", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const app = await createTestApp({
    getReportsByClinicId: async (
      clinicId: number,
      limit: number,
      offset: number,
      currentStatus?: string,
    ) => {
      calls.push({ clinicId, limit, offset, currentStatus });
      return [createReportFixture()];
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/reports?status=ready&limit=5&offset=2",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(calls, [
      {
        clinicId: 3,
        limit: 5,
        offset: 2,
        currentStatus: "ready",
      },
    ]);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.equal(body.reports[0].id, 55);
    assert.equal(body.reports[0].previewUrl, "preview:reports/3/luna.pdf");
    assert.equal(
      body.reports[0].downloadUrl,
      "download:reports/3/luna.pdf:luna.pdf",
    );
    assert.equal(body.filters.status, "ready");
    assert.equal(body.pagination.limit, 5);
    assert.equal(body.pagination.offset, 2);
  } finally {
    await app.close();
  }
});

test("reportsNativeRoutes expone GET /search con filtros normalizados", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const app = await createTestApp({
    searchReports: async (
      clinicId: number,
      query: string | undefined,
      studyType: string | undefined,
      limit: number,
      offset: number,
      currentStatus?: string,
    ) => {
      calls.push({ clinicId, query, studyType, limit, offset, currentStatus });
      return [createReportFixture({ id: 56 })];
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/reports/search?query= Luna &studyType= Histo &status=ready&limit=10&offset=4",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(calls, [
      {
        clinicId: 3,
        query: "Luna",
        studyType: "Histo",
        limit: 10,
        offset: 4,
        currentStatus: "ready",
      },
    ]);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.reports[0].id, 56);
    assert.equal(body.filters.query, "Luna");
    assert.equal(body.filters.studyType, "Histo");
    assert.equal(body.filters.status, "ready");
  } finally {
    await app.close();
  }
});

test("reportsNativeRoutes expone GET /study-types clinic-scoped", async () => {
  const calls: number[] = [];
  const app = await createTestApp({
    getStudyTypes: async (clinicId: number) => {
      calls.push(clinicId);
      return ["Histopatología", "Citología"];
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/reports/study-types",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(calls, [3]);
    assert.deepEqual(JSON.parse(response.body), {
      success: true,
      studyTypes: ["Histopatología", "Citología"],
    });
  } finally {
    await app.close();
  }
});

test("reportsNativeRoutes expone GET /:reportId/history con historial clinic-scoped", async () => {
  const getReportCalls: number[] = [];
  const historyCalls: number[] = [];
  const app = await createTestApp({
    getReportById: async (reportId: number) => {
      getReportCalls.push(reportId);
      return createReportFixture({ id: reportId });
    },
    getReportStatusHistory: async (reportId: number) => {
      historyCalls.push(reportId);
      return [createStatusHistoryFixture({ reportId })];
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/reports/55/history",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(getReportCalls, [55]);
    assert.deepEqual(historyCalls, [55]);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.reportId, 55);
    assert.equal(body.currentStatus, "ready");
    assert.equal(body.count, 1);
    assert.equal(body.history[0].toStatus, "ready");
  } finally {
    await app.close();
  }
});

test("reportsNativeRoutes expone GET /:reportId/preview-url clinic-scoped", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/reports/55/preview-url",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      success: true,
      previewUrl: "preview:reports/3/luna.pdf",
    });
  } finally {
    await app.close();
  }
});

test("reportsNativeRoutes expone GET /:reportId/download-url clinic-scoped", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/reports/55/download-url",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      success: true,
      downloadUrl: "download:reports/3/luna.pdf:luna.pdf",
    });
  } finally {
    await app.close();
  }
});

test("reportsNativeRoutes bloquea reportId inválido en rutas parametrizadas", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/reports/abc/history",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "ID de informe invalido",
    });
  } finally {
    await app.close();
  }
});

test("reportsNativeRoutes bloquea informe ajeno en rutas parametrizadas", async () => {
  const app = await createTestApp({
    getReportById: async () => createReportFixture({ clinicId: 99 }),
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/reports/55/download-url",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "No autorizado para descargar este informe",
    });
  } finally {
    await app.close();
  }
});

test("reportsNativeRoutes devuelve 404 cuando el informe no existe en rutas parametrizadas", async () => {
  const app = await createTestApp({
    getReportById: async () => null,
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/reports/55/preview-url",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Informe no encontrado",
    });
  } finally {
    await app.close();
  }
});

test("reportsNativeRoutes bloquea clinicId ajeno", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/reports?clinicId=5",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "No autorizado para consultar otra clinica",
    });
  } finally {
    await app.close();
  }
});

test("reportsNativeRoutes valida status inválido", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/reports?status=bad",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.success, false);
    assert.equal(body.error, "Estado de informe invalido");
    assert.ok(Array.isArray(body.allowedStatuses));
  } finally {
    await app.close();
  }
});

test("reportsNativeRoutes bloquea GET / sin sesión", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/reports",
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "No autenticado",
    });
  } finally {
    await app.close();
  }
});
test("reportsNativeRoutes responde preflight OPTIONS para superficie clinic read-only sin autenticar", async () => {
  const app = await createTestApp({
    getActiveSessionByToken: async () => {
      throw new Error("preflight OPTIONS no debe autenticar sesion clinic");
    },
  });

  try {
    for (const url of [
      "/api/reports",
      "/api/reports/search",
      "/api/reports/study-types",
      "/api/reports/55/history",
      "/api/reports/55/preview-url",
      "/api/reports/55/download-url",
    ]) {
      const response = await app.inject({
        method: "OPTIONS",
        url,
        headers: {
          origin: "http://localhost:3000",
          "access-control-request-headers": "content-type,x-requested-with",
        },
      });

      assert.equal(response.statusCode, 204);
      assert.equal(response.body, "");
      assert.equal(
        response.headers["access-control-allow-origin"],
        "http://localhost:3000",
      );
      assert.equal(response.headers["access-control-allow-credentials"], "true");
      assert.equal(
        response.headers["access-control-allow-methods"],
        "GET,OPTIONS",
      );
      assert.equal(
        response.headers["access-control-allow-headers"],
        "content-type,x-requested-with",
      );
      assert.equal(response.headers["set-cookie"], undefined);
    }
  } finally {
    await app.close();
  }
});

test("reportsNativeRoutes no anuncia POST /upload en preflight clinic", async () => {
  const app = await createTestApp({
    getActiveSessionByToken: async () => {
      throw new Error("preflight OPTIONS /upload no debe autenticar sesion clinic");
    },
  });

  try {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/reports/upload",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-headers": "content-type,x-requested-with",
      },
    });

    assert.notEqual(response.statusCode, 204);
    assert.equal(response.headers["access-control-allow-methods"], undefined);
    assert.equal(response.headers["set-cookie"], undefined);
  } finally {
    await app.close();
  }
});

test("reportsNativeRoutes bloquea preflight OPTIONS con origin no permitido", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/reports/search",
      headers: {
        origin: "https://evil.example",
        "access-control-request-headers": "content-type",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Origen no permitido",
    });
  } finally {
    await app.close();
  }
});
