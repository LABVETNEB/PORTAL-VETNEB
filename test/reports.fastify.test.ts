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
    getClinicScopedStudyTrackingCase: async () => ({
      id: 77,
      clinicId: 3,
    }),
    updateStudyTrackingCase: async () => {},
    uploadReport: async () => "reports/3/luna-new.pdf",
    upsertReport: async () =>
      createReportFixture({
        id: 88,
        currentStatus: "uploaded",
        storagePath: "reports/3/luna-new.pdf",
      }),
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

function buildMultipartReportPayload(options: { includeFile?: boolean } = {}) {
  const boundary = "----vetneb-report-boundary";
  const includeFile = options.includeFile ?? true;
  const chunks = [
    `--${boundary}\r\n`,
    'Content-Disposition: form-data; name="patientName"\r\n\r\n',
    "Luna Gomez",
    `\r\n--${boundary}\r\n`,
    'Content-Disposition: form-data; name="studyType"\r\n\r\n',
    "Histopatologia",
    `\r\n--${boundary}\r\n`,
    'Content-Disposition: form-data; name="uploadDate"\r\n\r\n',
    "2026-04-25T10:30:00.000Z",
    `\r\n--${boundary}\r\n`,
    'Content-Disposition: form-data; name="trackingCaseId"\r\n\r\n',
    "77",
  ];

  if (includeFile) {
    chunks.push(
      `\r\n--${boundary}\r\n`,
      'Content-Disposition: form-data; name="file"; filename="luna.pdf"\r\n',
      "Content-Type: application/pdf\r\n\r\n",
      "PDFDATA",
    );
  }

  chunks.push(`\r\n--${boundary}--\r\n`);

  return {
    boundary,
    payload: Buffer.from(chunks.join(""), "utf8"),
  };
}

test("reportsNativeRoutes expone POST /upload con multipart y tracking", async () => {
  const uploadCalls: Array<Record<string, unknown>> = [];
  const trackingCalls: Array<Record<string, unknown>> = [];
  const updateTrackingCalls: Array<Record<string, unknown>> = [];
  const upsertCalls: Array<Record<string, unknown>> = [];
  const multipart = buildMultipartReportPayload();

  const app = await createTestApp({
    uploadReport: async (input: {
      file: Buffer;
      fileName: string;
      clinicId: number;
      mimeType: string;
    }) => {
      uploadCalls.push({
        clinicId: input.clinicId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        file: input.file.toString("utf8"),
      });

      return "reports/3/luna-new.pdf";
    },
    getClinicScopedStudyTrackingCase: async (
      trackingCaseId: number,
      clinicId: number,
    ) => {
      trackingCalls.push({ trackingCaseId, clinicId });
      return {
        id: trackingCaseId,
        clinicId,
      };
    },
    updateStudyTrackingCase: async (
      trackingCaseId: number,
      input: { reportId: number },
    ) => {
      updateTrackingCalls.push({ trackingCaseId, input });
    },
    upsertReport: async (input: Record<string, unknown>) => {
      upsertCalls.push(input);

      return createReportFixture({
        id: 88,
        clinicId: input.clinicId,
        patientName: input.patientName,
        studyType: input.studyType,
        uploadDate: input.uploadDate,
        fileName: input.fileName,
        storagePath: input.storagePath,
        currentStatus: "uploaded",
        createdByClinicUserId: input.createdByClinicUserId,
      });
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/reports/upload",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.cookieName}=session-token`,
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 201);
    assert.deepEqual(uploadCalls, [
      {
        clinicId: 3,
        fileName: "luna.pdf",
        mimeType: "application/pdf",
        file: "PDFDATA",
      },
    ]);
    assert.deepEqual(trackingCalls, [
      {
        trackingCaseId: 77,
        clinicId: 3,
      },
    ]);
    assert.deepEqual(updateTrackingCalls, [
      {
        trackingCaseId: 77,
        input: {
          reportId: 88,
        },
      },
    ]);

    assert.equal(upsertCalls.length, 1);
    assert.equal(upsertCalls[0].clinicId, 3);
    assert.equal(upsertCalls[0].patientName, "Luna Gomez");
    assert.equal(upsertCalls[0].studyType, "Histopatologia");
    assert.equal(
      (upsertCalls[0].uploadDate as Date).toISOString(),
      "2026-04-25T10:30:00.000Z",
    );
    assert.equal(upsertCalls[0].fileName, "luna.pdf");
    assert.equal(upsertCalls[0].storagePath, "reports/3/luna-new.pdf");
    assert.equal(upsertCalls[0].createdByClinicUserId, 9);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.message, "Archivo subido correctamente");
    assert.equal(body.report.id, 88);
    assert.equal(body.report.clinicId, 3);
    assert.equal(body.report.patientName, "Luna Gomez");
    assert.equal(body.report.studyType, "Histopatologia");
    assert.equal(body.report.uploadDate, "2026-04-25T10:30:00.000Z");
    assert.equal(body.report.fileName, "luna.pdf");
    assert.equal(body.report.storagePath, "reports/3/luna-new.pdf");
    assert.equal(body.report.previewUrl, "preview:reports/3/luna-new.pdf");
    assert.equal(
      body.report.downloadUrl,
      "download:reports/3/luna-new.pdf:luna.pdf",
    );
  } finally {
    await app.close();
  }
});

test("reportsNativeRoutes bloquea POST /upload sin archivo", async () => {
  const multipart = buildMultipartReportPayload({ includeFile: false });
  let uploadCalled = false;

  const app = await createTestApp({
    uploadReport: async () => {
      uploadCalled = true;
      return "reports/3/luna-new.pdf";
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/reports/upload",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.cookieName}=session-token`,
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 400);
    assert.equal(uploadCalled, false);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "No se proporciono ningun archivo",
    });
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
test("reportsNativeRoutes responde preflight OPTIONS permitido sin autenticar", async () => {
  const app = await createTestApp({
    getActiveSessionByToken: async () => {
      throw new Error("preflight OPTIONS no debe autenticar sesión clinic");
    },
  });

  try {
    for (const url of [
      "/api/reports",
      "/api/reports/upload",
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
        "GET,POST,OPTIONS",
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

test("reportsNativeRoutes bloquea preflight OPTIONS con origin no permitido", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/reports/upload",
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
