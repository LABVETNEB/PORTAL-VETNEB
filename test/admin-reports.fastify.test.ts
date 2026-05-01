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
const {
  adminReportsNativeRoutes,
} = await import("../server/routes/admin-reports.fastify.ts");

function createReportFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 88,
    clinicId: 3,
    uploadDate: new Date("2026-04-22T09:00:00.000Z"),
    studyType: "Histopatologia",
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
    uploadReport: async () => "reports/3/luna-report.pdf",
    upsertReport: async () => createReportFixture(),
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
    studyType: " Histopatologia ",
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
        studyType: "Histopatologia",
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
              storagePath: "reports/3/luna-report.pdf",
              patientName: "Luna",
              studyType: "Histopatologia",
              uploadDate: "2026-04-22T09:00:00.000Z",
              uploadedVia: "admin",
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
    assert.equal(body.report.studyType, "Histopatologia");
    assert.equal(body.report.previewUrl, "signed-preview:reports/3/luna-report.pdf");
    assert.equal(
      body.report.downloadUrl,
      "signed-download:reports/3/luna-report.pdf:luna-report.pdf",
    );
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
    studyType: "Histopatologia",
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
