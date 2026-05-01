import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function routeFiles(): string[] {
  return readdirSync(resolve(process.cwd(), "server/routes"))
    .filter((file) => file.endsWith(".fastify.ts"))
    .map((file) => `server/routes/${file}`)
    .sort();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function routeStartRegex(method: "post" | "patch" | "delete", path: string) {
  return new RegExp(
    `app\\.${method}(?:<[\\s\\S]*?>)?\\(\\s*${escapeRegex(
      JSON.stringify(path),
    )}`,
  );
}

function extractRouteBlock(file: string, method: "post", path: string): string {
  const source = readSource(file);
  const match = routeStartRegex(method, path).exec(source);

  assert.notEqual(
    match,
    null,
    `${file} debe declarar ${method.toUpperCase()} ${path}`,
  );

  const start = match!.index;
  const afterStart = source.slice(start + match![0].length);
  const nextRouteMatch = /\n\s+app\.(?:get|post|patch|delete|options)(?:<[\s\S]*?>)?\(/.exec(
    afterStart,
  );
  const end = nextRouteMatch
    ? start + match![0].length + nextRouteMatch.index
    : source.length;

  return source.slice(start, end);
}

function assertBefore(
  haystack: string,
  earlier: string,
  later: string,
  context: string,
): void {
  const earlierIndex = haystack.indexOf(earlier);
  const laterIndex = haystack.indexOf(later);

  assert.notEqual(
    earlierIndex,
    -1,
    `${context} debe contener checkpoint previo: ${earlier}`,
  );
  assert.notEqual(
    laterIndex,
    -1,
    `${context} debe contener operación protegida: ${later}`,
  );
  assert.ok(
    earlierIndex < laterIndex,
    `${context} debe ejecutar ${earlier} antes de ${later}`,
  );
}

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

async function createAdminReportUploadApp(overrides: Record<string, unknown> = {}) {
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
    now: () => new Date("2026-04-24T00:00:00.000Z").getTime(),
    ...overrides,
  });

  return app;
}

function buildMultipartReportPayload() {
  const boundary = "----vetneb-report-write-owner-boundary";
  const chunks = [
    `--${boundary}\r\n`,
    'Content-Disposition: form-data; name="clinicId"\r\n\r\n',
    "3",
    `\r\n--${boundary}\r\n`,
    'Content-Disposition: form-data; name="patientName"\r\n\r\n',
    "Luna",
    `\r\n--${boundary}\r\n`,
    'Content-Disposition: form-data; name="studyType"\r\n\r\n',
    "Histopatologia",
    `\r\n--${boundary}\r\n`,
    'Content-Disposition: form-data; name="uploadDate"\r\n\r\n',
    "2026-04-22T09:00:00.000Z",
    `\r\n--${boundary}\r\n`,
    'Content-Disposition: form-data; name="file"; filename="luna-report.pdf"\r\n',
    "Content-Type: application/pdf\r\n\r\n",
    "PDFDATA",
    `\r\n--${boundary}--\r\n`,
  ];

  return {
    boundary,
    payload: Buffer.from(chunks.join(""), "utf8"),
  };
}

test("report write surface owner registry queda limitado al router admin reports", () => {
  const owners = routeFiles().filter((file) => {
    const source = readSource(file);

    return (
      source.includes('app.post("/upload"') ||
      source.includes("runReportUpload") ||
      source.includes("deps.uploadReport") ||
      source.includes("ReportUploadInput")
    );
  });

  assert.deepEqual(owners, ["server/routes/admin-reports.fastify.ts"]);
});

test("admin reports upload exige admin auth antes de storage y persiste autoria admin", () => {
  const source = readSource("server/routes/admin-reports.fastify.ts");
  const uploadBlock = extractRouteBlock(
    "server/routes/admin-reports.fastify.ts",
    "post",
    "/upload",
  );

  assert.match(source, /prefix: "\/api\/admin\/reports"|adminReportsNativeRoutes/);
  assert.match(uploadBlock, /authenticateAdminUser\(request, reply, deps, now\)/);
  assert.match(uploadBlock, /createdByAdminUserId: admin\.id/);
  assert.doesNotMatch(uploadBlock, /createdByClinicUserId/);

  for (const protectedCall of [
    "runReportUpload",
    "deps.getClinicById",
    "deps.uploadReport",
    "deps.upsertReport",
  ]) {
    assertBefore(
      uploadBlock,
      "enforceTrustedOrigin",
      protectedCall,
      "admin report upload",
    );
    assertBefore(
      uploadBlock,
      "authenticateAdminUser",
      protectedCall,
      "admin report upload",
    );
  }

  assertBefore(
    uploadBlock,
    "deps.uploadReport",
    "deps.upsertReport",
    "admin report upload",
  );
});

test("admin autenticado puede subir informe y queda como owner de escritura", async () => {
  const multipart = buildMultipartReportPayload();
  const uploadCalls: Array<Record<string, unknown>> = [];
  const upsertCalls: Array<Record<string, unknown>> = [];

  const app = await createAdminReportUploadApp({
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
    assert.deepEqual(uploadCalls, [
      {
        clinicId: 3,
        fileName: "luna-report.pdf",
        mimeType: "application/pdf",
        file: "PDFDATA",
      },
    ]);

    assert.equal(upsertCalls.length, 1);
    assert.equal(upsertCalls[0].createdByAdminUserId, 1);
    assert.equal(
      Object.hasOwn(upsertCalls[0], "createdByClinicUserId"),
      false,
      "admin upload no debe persistir autoria clinic",
    );

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.report.clinicId, 3);
    assert.equal(body.report.previewUrl, "signed-preview:reports/3/luna-report.pdf");
  } finally {
    await app.close();
  }
});

test("clinic particular y publico no pueden usar la superficie admin de upload", async () => {
  const nonAdminContexts = [
    {
      label: "clinic",
      cookie: `${ENV.cookieName}=clinic-session-token`,
    },
    {
      label: "particular",
      cookie: `${ENV.particularCookieName}=particular-session-token`,
    },
    {
      label: "public",
      cookie: undefined,
    },
  ];

  for (const context of nonAdminContexts) {
    const multipart = buildMultipartReportPayload();
    let uploadCalls = 0;
    let upsertCalls = 0;

    const app = await createAdminReportUploadApp({
      getAdminSessionByToken: async () => {
        throw new Error(`${context.label} no debe autenticar sesion admin`);
      },
      uploadReport: async () => {
        uploadCalls += 1;
        return "reports/3/luna-report.pdf";
      },
      upsertReport: async () => {
        upsertCalls += 1;
        return createReportFixture();
      },
    });

    try {
      const headers: Record<string, string> = {
        origin: "http://localhost:3000",
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      };

      if (context.cookie) {
        headers.cookie = context.cookie;
      }

      const response = await app.inject({
        method: "POST",
        url: "/api/admin/reports/upload",
        headers,
        payload: multipart.payload,
      });

      assert.equal(response.statusCode, 401, context.label);
      assert.deepEqual(
        JSON.parse(response.body),
        {
          success: false,
          error: "Admin no autenticado",
        },
        context.label,
      );
      assert.equal(uploadCalls, 0, context.label);
      assert.equal(upsertCalls, 0, context.label);
    } finally {
      await app.close();
    }
  }
});

test("rutas clinic particular y publicas no declaran superficie de upload de informes", () => {
  for (const file of [
    "server/routes/reports.fastify.ts",
    "server/routes/particular-auth.fastify.ts",
    "server/routes/particular-study-tracking.fastify.ts",
    "server/routes/public-report-access.fastify.ts",
  ]) {
    const source = readSource(file);

    for (const forbiddenMarker of [
      'app.post("/upload"',
      "runReportUpload",
      "deps.uploadReport",
      "ReportUploadInput",
      "createdByClinicUserId",
    ]) {
      assert.equal(
        source.includes(forbiddenMarker),
        false,
        `${file} no debe contener superficie de upload de informes: ${forbiddenMarker}`,
      );
    }
  }
});
