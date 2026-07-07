import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../../../../server/lib/env.ts");
const {
  adminReportsNativeRoutes,
} = await import("../../../../server/routes/admin-reports.fastify.ts");

function createReportFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 88,
    clinicId: 3,
    uploadDate: new Date("2026-04-22T09:00:00.000Z"),
    studyType: "histopatologia",
    patientName: "Luna",
    fileName: "luna-report.pdf",
    currentStatus: "uploaded",
    statusChangedAt: new Date("2026-04-22T09:30:00.000Z"),
    createdAt: new Date("2026-04-22T09:00:00.000Z"),
    updatedAt: new Date("2026-04-22T09:30:00.000Z"),
    storagePath: "reports/3/luna-report.pdf",
    ...overrides,
  };
}

function createParticularTokenFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    clinicId: 3,
    reportId: null,
    tokenHash: "hash:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    tokenLast4: "aaaa",
    tutorLastName: "Gomez",
    petName: "Luna",
    petAge: "8 años",
    petBreed: "Caniche",
    petSex: "Hembra",
    petSpecies: "Canina",
    sampleLocation: "Pabellón auricular",
    sampleEvolution: "15 días",
    detailsLesion: "Lesión nodular pequeña",
    extractionDate: new Date("2026-04-20T00:00:00.000Z"),
    shippingDate: new Date("2026-04-21T00:00:00.000Z"),
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    updatedAt: new Date("2026-04-20T12:30:00.000Z"),
    createdByAdminId: 1,
    createdByClinicUserId: null,
    ...overrides,
  };
}

function createTrackingCaseFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    clinicId: 3,
    reportId: 88,
    particularTokenId: 7,
    createdByAdminId: 1,
    createdByClinicUserId: null,
    receptionAt: new Date("2026-04-20T00:00:00.000Z"),
    estimatedDeliveryAt: new Date("2026-05-08T00:00:00.000Z"),
    estimatedDeliveryAutoCalculatedAt: new Date("2026-05-08T00:00:00.000Z"),
    estimatedDeliveryWasManuallyAdjusted: false,
    currentStage: "delivered",
    processingAt: null,
    evaluationAt: null,
    reportDevelopmentAt: null,
    deliveredAt: new Date("2026-04-22T12:00:00.000Z"),
    specialStainRequired: false,
    specialStainNotifiedAt: null,
    paymentUrl: null,
    adminContactEmail: null,
    adminContactPhone: null,
    notes: "Lesión nodular pequeña",
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    updatedAt: new Date("2026-04-22T12:00:00.000Z"),
    ...overrides,
  };
}

function createNotificationFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 41,
    studyTrackingCaseId: 11,
    clinicId: 3,
    reportId: 88,
    particularTokenId: 7,
    type: "report_delivered",
    title: "Informe disponible",
    message: "El informe del estudio ya está disponible.",
    isRead: false,
    readAt: null,
    createdAt: new Date("2026-04-22T12:01:00.000Z"),
    ...overrides,
  };
}

function createAuthStubs(overrides: Record<string, unknown> = {}) {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => ({
      adminUserId: 1,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-04-23T00:00:00.000Z"),
    }),
    getAdminUserById: async () => ({
      id: 1,
      username: "ADMIN",
    }),
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    ...overrides,
  };
}

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(adminReportsNativeRoutes as any, {
    prefix: "/api/admin/reports",
    ...createAuthStubs(),
    getClinicById: async () => ({ id: 3 }),
    getReportById: async () => createReportFixture(),
    uploadReport: async () => "reports/3/luna-report.pdf",
    upsertReport: async () => createReportFixture(),
    getParticularTokenById: async () => null,
    updateParticularTokenReport: async () => null,
    getParticularStudyTrackingCase: async () => null,
    getStudyTrackingCaseByReportId: async () => null,
    createStudyTrackingCase: async () => {
      throw new Error(
        "createStudyTrackingCase no debe ejecutarse sin particularTokenId",
      );
    },
    updateStudyTrackingCase: async () => null,
    createStudyTrackingNotification: async () => createNotificationFixture(),
    createSignedReportUrl: async (storagePath: string) =>
      `signed-preview:${storagePath}`,
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => `signed-download:${storagePath}:${fileName ?? ""}`,
    writeAuditLog: async () => {},
    ...overrides,
  });

  return app;
}

function buildMultipartReportPayload(
  fields: Record<string, string> = {
    clinicId: "3",
    patientName: " Luna ",
    studyType: " histopatologia ",
    uploadDate: "2026-04-22T09:00:00.000Z",
  },
) {
  const boundary = "----vetneb-admin-report-boundary";
  const chunks: string[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(`--${boundary}\r\n`);
    chunks.push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
    chunks.push(value);
    chunks.push("\r\n");
  }

  chunks.push(`--${boundary}\r\n`);
  chunks.push(
    'Content-Disposition: form-data; name="file"; filename="luna-report.pdf"\r\n',
  );
  chunks.push("Content-Type: application/pdf\r\n\r\n");
  chunks.push("PDFDATA");
  chunks.push(`\r\n--${boundary}--\r\n`);

  return {
    boundary,
    payload: Buffer.from(chunks.join(""), "utf8"),
  };
}

test("adminReportsNativeRoutes genera signed preview URL para informe con sesion admin", async () => {
  const reportCalls: number[] = [];
  const signedCalls: string[] = [];

  const app = await createTestApp({
    getReportById: async (reportId: number) => {
      reportCalls.push(reportId);
      return createReportFixture({ id: reportId });
    },
    createSignedReportUrl: async (storagePath: string) => {
      signedCalls.push(storagePath);
      return `signed-preview:${storagePath}`;
    },
    createSignedReportDownloadUrl: async () => {
      throw new Error("preview no debe generar downloadUrl");
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/reports/88/preview-url",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(reportCalls, [88]);
    assert.deepEqual(signedCalls, ["reports/3/luna-report.pdf"]);
    assert.deepEqual(JSON.parse(response.body), {
      success: true,
      previewUrl: "signed-preview:reports/3/luna-report.pdf",
    });
  } finally {
    await app.close();
  }
});

test("adminReportsNativeRoutes genera signed download URL para informe con sesion admin", async () => {
  const reportCalls: number[] = [];
  const signedCalls: Array<{ storagePath: string; fileName?: string }> = [];

  const app = await createTestApp({
    getReportById: async (reportId: number) => {
      reportCalls.push(reportId);
      return createReportFixture({ id: reportId });
    },
    createSignedReportUrl: async () => {
      throw new Error("download no debe generar previewUrl");
    },
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => {
      signedCalls.push({ storagePath, fileName });
      return `signed-download:${storagePath}:${fileName ?? ""}`;
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/reports/88/download-url",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(reportCalls, [88]);
    assert.deepEqual(signedCalls, [
      {
        storagePath: "reports/3/luna-report.pdf",
        fileName: "luna-report.pdf",
      },
    ]);
    assert.deepEqual(JSON.parse(response.body), {
      success: true,
      downloadUrl: "signed-download:reports/3/luna-report.pdf:luna-report.pdf",
    });
  } finally {
    await app.close();
  }
});

test("adminReportsNativeRoutes bloquea signed URLs sin sesion admin antes de leer informe", async () => {
  let reportCalls = 0;

  const app = await createTestApp({
    getAdminSessionByToken: async () => null,
    getReportById: async () => {
      reportCalls += 1;
      return createReportFixture();
    },
    createSignedReportUrl: async () => {
      throw new Error("sin sesion admin no debe firmar previewUrl");
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/reports/88/preview-url",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(reportCalls, 0);
  } finally {
    await app.close();
  }
});

test("adminReportsNativeRoutes devuelve 404 generico para signed URL de informe inexistente", async () => {
  const app = await createTestApp({
    getReportById: async () => null,
    createSignedReportUrl: async () => {
      throw new Error("informe inexistente no debe generar signed URL");
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/reports/999/preview-url",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Informe no encontrado",
    });
    assert.equal(response.body.includes("storagePath"), false);
    assert.equal(response.body.includes("reports/"), false);
  } finally {
    await app.close();
  }
});

test("adminReportsNativeRoutes crea POST /upload con clinicId explicito y metadata", async () => {
  const multipart = buildMultipartReportPayload();
  const uploadCalls: Array<Record<string, unknown>> = [];
  const upsertCalls: Array<Record<string, unknown>> = [];
  const clinicCalls: number[] = [];
  const auditCalls: Array<Record<string, unknown>> = [];

  const app = await createTestApp({
    getClinicById: async (clinicId: number) => {
      clinicCalls.push(clinicId);
      return { id: clinicId };
    },
    uploadReport: async (input: {
      clinicId: number;
      file: Buffer;
      fileName: string;
      mimeType: string;
    }) => {
      uploadCalls.push({
        clinicId: input.clinicId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        file: input.file.toString("utf8"),
      });

      return "reports/3/luna-report.pdf";
    },
    upsertReport: async (input: Record<string, unknown>) => {
      upsertCalls.push(input);
      return createReportFixture({
        clinicId: input.clinicId,
        patientName: input.patientName,
        studyType: input.studyType,
        uploadDate: input.uploadDate,
        fileName: input.fileName,
        storagePath: input.storagePath,
      });
    },
    writeAuditLog: async (req: unknown, input: Record<string, unknown>) => {
      auditCalls.push({ req, input });
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/reports/upload",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 201);
    assert.deepEqual(clinicCalls, [3]);
    assert.deepEqual(uploadCalls, [
      {
        clinicId: 3,
        fileName: "luna-report.pdf",
        mimeType: "application/pdf",
        file: "PDFDATA",
      },
    ]);

    assert.equal(upsertCalls.length, 1);
    assert.deepEqual(
      {
        ...upsertCalls[0],
        uploadDate:
          upsertCalls[0].uploadDate instanceof Date
            ? upsertCalls[0].uploadDate.toISOString()
            : upsertCalls[0].uploadDate,
      },
      {
        clinicId: 3,
        patientName: "Luna",
        studyType: "histopatologia",
        uploadDate: "2026-04-22T09:00:00.000Z",
        fileName: "luna-report.pdf",
        storagePath: "reports/3/luna-report.pdf",
        createdByAdminUserId: 1,
      },
    );

    assert.equal(auditCalls.length, 1);
    assert.deepEqual(
      auditCalls.map((call) => {
        const input = call.input as Record<string, unknown>;
        const metadata = input.metadata as Record<string, unknown> | undefined;

        return {
          req: call.req,
          input: {
            ...input,
            metadata: {
            ...(metadata ?? {}),
            uploadDate:
              metadata?.uploadDate instanceof Date
                ? metadata.uploadDate.toISOString()
                : metadata?.uploadDate,
          },
        },
      };
      }),
      [
        {
          req: {
            method: "POST",
            originalUrl: "/api/admin/reports/upload",
            ip: "127.0.0.1",
            headers: {
              origin: "http://localhost:3000",
              cookie: `${ENV.adminCookieName}=admin-session-token`,
              "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
              "user-agent": "lightMyRequest",
              host: "localhost:80",
              "content-length": String(multipart.payload.length),
            },
            adminAuth: {
              id: 1,
              username: "ADMIN",
            },
          },
          input: {
            event: "report.uploaded",
            clinicId: 3,
            reportId: 88,
            metadata: {
              fileName: "luna-report.pdf",
              mimeType: "application/pdf",
              patientName: "Luna",
              studyType: "histopatologia",
              uploadDate: "2026-04-22T09:00:00.000Z",
              uploadedVia: "admin",
              particularTokenId: null,
              trackingCaseId: null,
              trackingStage: null,
            },
          },
        },
      ],
    );

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.message, "Informe subido correctamente");
    assert.equal(body.report.id, 88);
    assert.equal(body.report.clinicId, 3);
    assert.equal(body.report.patientName, "Luna");
    assert.equal(body.report.studyType, "histopatologia");
    assert.equal(body.report.status, "uploaded");
    assert.equal(body.report.currentStatus, "uploaded");
    assert.equal(body.report.hasFile, true);
    assert.equal(body.report.storagePath, undefined);
    assert.equal(response.body.includes("storagePath"), false);
    assert.equal(body.report.previewUrl, undefined);
    assert.equal(body.report.downloadUrl, undefined);
    assert.equal(response.body.includes("previewUrl"), false);
    assert.equal(response.body.includes("downloadUrl"), false);
  } finally {
    await app.close();
  }
});

test("adminReportsNativeRoutes bloquea POST /upload con origin no permitido antes de auth", async () => {
  const multipart = buildMultipartReportPayload();

  const app = await createTestApp({
    getAdminSessionByToken: async () => {
      throw new Error("origin no permitido no debe autenticar admin");
    },
    uploadReport: async () => {
      throw new Error("origin no permitido no debe subir archivo");
    },
    writeAuditLog: async () => {
      throw new Error("origin no permitido no debe auditar upload");
    },
    upsertReport: async () => {
      throw new Error("origin no permitido no debe persistir informe");
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/reports/upload",
      headers: {
        origin: "https://evil.example",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.payload,
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

test("adminReportsNativeRoutes bloquea POST /upload sin sesion admin antes de storage", async () => {
  const multipart = buildMultipartReportPayload();
  let uploadCalls = 0;

  const app = await createTestApp({
    getAdminSessionByToken: async () => null,
    uploadReport: async () => {
      uploadCalls += 1;
      return "reports/3/luna-report.pdf";
    },
    writeAuditLog: async () => {
      throw new Error("sin sesion admin no debe auditar upload");
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/reports/upload",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 401);
    assert.equal(uploadCalls, 0);
  } finally {
    await app.close();
  }
});

test("adminReportsNativeRoutes requiere clinicId valido antes de storage", async () => {
  const multipart = buildMultipartReportPayload({
    patientName: "Luna",
    studyType: "histopatologia",
  });
  let uploadCalls = 0;
  let upsertCalls = 0;

  const app = await createTestApp({
    uploadReport: async () => {
      uploadCalls += 1;
      return "reports/3/luna-report.pdf";
    },
    upsertReport: async () => {
      upsertCalls += 1;
      return createReportFixture();
    },
    writeAuditLog: async () => {
      throw new Error("clinicId invalido no debe auditar upload");
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/reports/upload",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "clinicId es obligatorio",
    });
    assert.equal(uploadCalls, 0);
    assert.equal(upsertCalls, 0);
  } finally {
    await app.close();
  }
});

test("adminReportsNativeRoutes devuelve 404 cuando clinicId no existe", async () => {
  const multipart = buildMultipartReportPayload();
  let uploadCalls = 0;

  const app = await createTestApp({
    getClinicById: async () => null,
    uploadReport: async () => {
      uploadCalls += 1;
      return "reports/3/luna-report.pdf";
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/reports/upload",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Clinica no encontrada",
    });
    assert.equal(uploadCalls, 0);
  } finally {
    await app.close();
  }
});

test("adminReportsNativeRoutes valida particularTokenId antes de storage", async () => {
  const multipart = buildMultipartReportPayload({
    clinicId: "3",
    particularTokenId: "invalid",
  });
  let uploadCalls = 0;

  const app = await createTestApp({
    uploadReport: async () => {
      uploadCalls += 1;
      return "reports/3/luna-report.pdf";
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/reports/upload",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "particularTokenId inválido",
    });
    assert.equal(uploadCalls, 0);
  } finally {
    await app.close();
  }
});

test("adminReportsNativeRoutes devuelve 404 cuando particularTokenId no existe", async () => {
  const multipart = buildMultipartReportPayload({
    clinicId: "3",
    particularTokenId: "7",
  });
  let uploadCalls = 0;

  const app = await createTestApp({
    getParticularTokenById: async () => null,
    uploadReport: async () => {
      uploadCalls += 1;
      return "reports/3/luna-report.pdf";
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/reports/upload",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Token particular no encontrado",
    });
    assert.equal(uploadCalls, 0);
  } finally {
    await app.close();
  }
});

test("adminReportsNativeRoutes bloquea upload si particularTokenId pertenece a otra clínica", async () => {
  const multipart = buildMultipartReportPayload({
    clinicId: "3",
    particularTokenId: "7",
  });
  let uploadCalls = 0;

  const app = await createTestApp({
    getParticularTokenById: async () =>
      createParticularTokenFixture({
        clinicId: 999,
      }),
    uploadReport: async () => {
      uploadCalls += 1;
      return "reports/3/luna-report.pdf";
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/reports/upload",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "El token particular no pertenece a la clínica indicada",
    });
    assert.equal(uploadCalls, 0);
  } finally {
    await app.close();
  }
});

test("adminReportsNativeRoutes vincula token y cierra tracking en delivered al subir informe", async () => {
  const multipart = buildMultipartReportPayload({
    clinicId: "3",
    particularTokenId: "7",
    patientName: " Luna ",
    studyType: " histopatologia ",
    uploadDate: "2026-04-22T09:00:00.000Z",
  });
  const nowDate = new Date("2026-04-22T12:00:00.000Z");
  const selectedToken = createParticularTokenFixture({
    reportId: null,
  });
  const linkedToken = createParticularTokenFixture({
    reportId: 88,
    updatedAt: nowDate,
  });
  const updateTokenCalls: Array<Record<string, unknown>> = [];
  const createTrackingCalls: Array<Record<string, unknown>> = [];
  const updateTrackingCalls: Array<Record<string, unknown>> = [];
  const notificationCalls: Array<Record<string, unknown>> = [];
  const auditCalls: Array<Record<string, unknown>> = [];

  const app = await createTestApp({
    now: () => nowDate.getTime(),
    getParticularTokenById: async () => selectedToken,
    updateParticularTokenReport: async (id: number, reportId: number | null) => {
      updateTokenCalls.push({ id, reportId });
      return linkedToken;
    },
    getParticularStudyTrackingCase: async () => null,
    getStudyTrackingCaseByReportId: async () => null,
    createStudyTrackingCase: async (input: Record<string, unknown>) => {
      createTrackingCalls.push(input);
      return createTrackingCaseFixture({
        reportId: 88,
        particularTokenId: 7,
        currentStage: "delivered",
        deliveredAt: nowDate,
      });
    },
    updateStudyTrackingCase: async (
      id: number,
      input: Record<string, unknown>,
    ) => {
      updateTrackingCalls.push({ id, input });
      return createTrackingCaseFixture({
        id,
        ...input,
      });
    },
    createStudyTrackingNotification: async (input: Record<string, unknown>) => {
      notificationCalls.push(input);
      return createNotificationFixture(input);
    },
    writeAuditLog: async (_req: unknown, input: Record<string, unknown>) => {
      auditCalls.push(input);
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/reports/upload",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 201);
    assert.deepEqual(updateTokenCalls, [{ id: 7, reportId: 88 }]);
    assert.equal(createTrackingCalls.length, 1);
    assert.equal(createTrackingCalls[0].reportId, 88);
    assert.equal(createTrackingCalls[0].particularTokenId, 7);
    assert.equal(createTrackingCalls[0].currentStage, "delivered");
    assert.equal(createTrackingCalls[0].specialStainRequired, false);
    assert.equal(updateTrackingCalls.length, 0);
    assert.equal(notificationCalls.length, 1);
    assert.equal(notificationCalls[0].type, "report_delivered");
    assert.equal(notificationCalls[0].title, "Informe disponible");
    assert.equal(
      notificationCalls[0].message,
      "El informe del estudio ya está disponible.",
    );
    assert.equal(notificationCalls[0].clinicId, 3);
    assert.equal(notificationCalls[0].reportId, 88);
    assert.equal(notificationCalls[0].particularTokenId, 7);
    assert.equal(notificationCalls[0].studyTrackingCaseId, 11);
    assert.equal(notificationCalls[0].isRead, false);
    assert.equal(notificationCalls[0].readAt, null);
    assert.equal(auditCalls.length, 1);
    assert.equal(
      (auditCalls[0].metadata as Record<string, unknown>).particularTokenId,
      7,
    );
    assert.equal(
      (auditCalls[0].metadata as Record<string, unknown>).trackingCaseId,
      11,
    );
    assert.equal(
      (auditCalls[0].metadata as Record<string, unknown>).trackingStage,
      "delivered",
    );

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.report.id, 88);
  } finally {
    await app.close();
  }
});

test("adminReportsNativeRoutes cierra tracking por reportId en delivered cuando no hay token", async () => {
  const multipart = buildMultipartReportPayload({
    clinicId: "3",
    patientName: "Luna",
  });
  const nowDate = new Date("2026-04-22T12:00:00.000Z");
  const trackingCase = createTrackingCaseFixture({
    id: 22,
    reportId: 88,
    particularTokenId: null,
    currentStage: "evaluation",
    deliveredAt: null,
  });
  const updateTrackingCalls: Array<Record<string, unknown>> = [];
  const notificationCalls: Array<Record<string, unknown>> = [];
  const auditCalls: Array<Record<string, unknown>> = [];

  const app = await createTestApp({
    now: () => nowDate.getTime(),
    getStudyTrackingCaseByReportId: async () => trackingCase,
    updateStudyTrackingCase: async (id: number, input: Record<string, unknown>) => {
      updateTrackingCalls.push({ id, input });
      return createTrackingCaseFixture({
        ...trackingCase,
        id,
        ...input,
      });
    },
    createStudyTrackingNotification: async (input: Record<string, unknown>) => {
      notificationCalls.push(input);
      return createNotificationFixture(input);
    },
    writeAuditLog: async (_req: unknown, input: Record<string, unknown>) => {
      auditCalls.push(input);
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/reports/upload",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 201);
    assert.deepEqual(updateTrackingCalls, [
      {
        id: 22,
        input: {
          reportId: 88,
          currentStage: "delivered",
          deliveredAt: nowDate,
        },
      },
    ]);
    assert.equal(notificationCalls.length, 1);
    assert.equal(notificationCalls[0].type, "report_delivered");
    assert.equal(notificationCalls[0].clinicId, 3);
    assert.equal(notificationCalls[0].reportId, 88);
    assert.equal(notificationCalls[0].particularTokenId, null);
    assert.equal(notificationCalls[0].studyTrackingCaseId, 22);
    assert.equal(auditCalls.length, 1);
    assert.equal(
      (auditCalls[0].metadata as Record<string, unknown>).trackingCaseId,
      22,
    );
    assert.equal(
      (auditCalls[0].metadata as Record<string, unknown>).trackingStage,
      "delivered",
    );
  } finally {
    await app.close();
  }
});

test("adminReportsNativeRoutes no duplica report_delivered cuando el tracking ya estaba delivered", async () => {
  const multipart = buildMultipartReportPayload({
    clinicId: "3",
    patientName: "Luna",
  });
  const trackingCase = createTrackingCaseFixture({
    id: 22,
    reportId: 88,
    particularTokenId: null,
    currentStage: "delivered",
    deliveredAt: new Date("2026-04-22T12:00:00.000Z"),
  });
  const updateTrackingCalls: Array<Record<string, unknown>> = [];
  const notificationCalls: Array<Record<string, unknown>> = [];

  const app = await createTestApp({
    getStudyTrackingCaseByReportId: async () => trackingCase,
    updateStudyTrackingCase: async (id: number, input: Record<string, unknown>) => {
      updateTrackingCalls.push({ id, input });
      return createTrackingCaseFixture({ id, ...input });
    },
    createStudyTrackingNotification: async (input: Record<string, unknown>) => {
      notificationCalls.push(input);
      return createNotificationFixture(input);
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/reports/upload",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 201);
    assert.equal(updateTrackingCalls.length, 0);
    assert.equal(notificationCalls.length, 0);
  } finally {
    await app.close();
  }
});

test("adminReportsNativeRoutes no aborta upload si falla report_delivered notification", async () => {
  const multipart = buildMultipartReportPayload({
    clinicId: "3",
    patientName: "Luna",
  });
  const nowDate = new Date("2026-04-22T12:00:00.000Z");
  const trackingCase = createTrackingCaseFixture({
    id: 22,
    reportId: 88,
    particularTokenId: null,
    currentStage: "evaluation",
    deliveredAt: null,
  });
  const auditCalls: Array<Record<string, unknown>> = [];

  const app = await createTestApp({
    now: () => nowDate.getTime(),
    getStudyTrackingCaseByReportId: async () => trackingCase,
    updateStudyTrackingCase: async (id: number, input: Record<string, unknown>) =>
      createTrackingCaseFixture({
        ...trackingCase,
        id,
        ...input,
      }),
    createStudyTrackingNotification: async () => {
      throw new Error("notification_failure");
    },
    writeAuditLog: async (_req: unknown, input: Record<string, unknown>) => {
      auditCalls.push(input);
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/reports/upload",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
      payload: multipart.payload,
    });

    assert.equal(response.statusCode, 201);
    assert.equal(auditCalls.length, 1);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.report.id, 88);
  } finally {
    await app.close();
  }
});

test("adminReportsNativeRoutes responde preflight OPTIONS /upload sin autenticar", async () => {
  const app = await createTestApp({
    getAdminSessionByToken: async () => {
      throw new Error("preflight admin reports no debe autenticar");
    },
  });

  try {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/admin/reports/upload",
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
      "POST,OPTIONS",
    );
    assert.equal(
      response.headers["access-control-allow-headers"],
      "content-type,x-requested-with",
    );
  } finally {
    await app.close();
  }
});
