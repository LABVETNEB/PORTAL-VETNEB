import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { AUDIT_EVENTS } = await import("../server/lib/audit.ts");
const {
  PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE,
} = await import("../server/lib/public-report-access-rate-limit.ts");
const {
  publicReportAccessNativeRoutes,
} = await import("../server/routes/public-report-access.fastify.ts");

function createReportFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 55,
    clinicId: 3,
    uploadDate: new Date("2026-04-22T09:00:00.000Z"),
    studyType: "Histopatología",
    patientName: "Luna",
    fileName: "luna-report.pdf",
    currentStatus: "ready",
    statusChangedAt: new Date("2026-04-22T09:30:00.000Z"),
    createdAt: new Date("2026-04-22T09:00:00.000Z"),
    updatedAt: new Date("2026-04-22T09:30:00.000Z"),
    storagePath: "reports/report-55.pdf",
    ...overrides,
  };
}

function createReportAccessTokenFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 9,
    clinicId: 3,
    reportId: 55,
    tokenLast4: "ABCD",
    accessCount: 2,
    lastAccessAt: new Date("2026-04-22T10:00:00.000Z"),
    expiresAt: new Date("2026-05-01T00:00:00.000Z"),
    revokedAt: null,
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    updatedAt: new Date("2026-04-22T12:00:00.000Z"),
    createdByClinicUserId: 5,
    createdByAdminUserId: null,
    revokedByClinicUserId: null,
    revokedByAdminUserId: null,
    ...overrides,
  };
}

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(publicReportAccessNativeRoutes as any, {
    prefix: "/api/public/report-access",
    getReportAccessTokenWithReportByTokenHash: async () => null,
    recordReportAccessTokenAccess: async () => null,
    createSignedReportUrl: async (storagePath: string) => `signed-preview:${storagePath}`,
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => `signed-download:${storagePath}:${fileName ?? ""}`,
    hashSessionToken: (token: string) => `hash:${token}`,
    writeAuditLog: async () => {},
    ...overrides,
  });

  return app;
}

test(
  "publicReportAccessNativeRoutes responde acceso público con payload estable, urls firmadas y auditoria",
  async () => {
    const rawToken = "a".repeat(64);
    const report = createReportFixture();
    const token = createReportAccessTokenFixture();
    const auditCalls: Array<Record<string, unknown>> = [];

    const app = await createTestApp({
      now: () => Date.UTC(2026, 3, 24, 0, 0, 0),
      hashSessionToken: (value: string) => `hash:${value}`,
      getReportAccessTokenWithReportByTokenHash: async (tokenHash: string) => {
        assert.equal(tokenHash, `hash:${rawToken}`);
        return { token, report };
      },
      recordReportAccessTokenAccess: async (tokenId: number) => {
        assert.equal(tokenId, token.id);
        return {
          ...token,
          accessCount: 3,
          lastAccessAt: new Date("2026-04-24T00:00:00.000Z"),
        };
      },
      createSignedReportUrl: async (storagePath: string) => {
        assert.equal(storagePath, report.storagePath);
        return "https://signed.example/preview";
      },
      createSignedReportDownloadUrl: async (
        storagePath: string,
        fileName?: string,
      ) => {
        assert.equal(storagePath, report.storagePath);
        assert.equal(fileName, report.fileName);
        return "https://signed.example/download";
      },
      writeAuditLog: async (_req: unknown, input: Record<string, unknown>) => {
        auditCalls.push(input);
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: `/api/public/report-access/${rawToken}`,
        headers: {
          origin: "http://localhost:3000",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(
        response.headers["access-control-allow-origin"],
        "http://localhost:3000",
      );
      assert.equal(response.headers["access-control-allow-credentials"], "true");
      assert.equal(response.headers["ratelimit-limit"], "10");

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        report: {
          id: report.id,
          clinicId: report.clinicId,
          uploadDate: report.uploadDate.toISOString(),
          studyType: report.studyType,
          patientName: report.patientName,
          fileName: report.fileName,
          currentStatus: report.currentStatus,
          statusChangedAt: report.statusChangedAt.toISOString(),
          createdAt: report.createdAt.toISOString(),
          updatedAt: report.updatedAt.toISOString(),
          previewUrl: "https://signed.example/preview",
          downloadUrl: "https://signed.example/download",
        },
        token: {
          accessCount: 3,
          lastAccessAt: "2026-04-24T00:00:00.000Z",
          expiresAt: token.expiresAt.toISOString(),
        },
      });

      assert.equal(auditCalls.length, 1);
      assert.equal(auditCalls[0].event, AUDIT_EVENTS.REPORT_PUBLIC_ACCESSED);
      assert.equal(auditCalls[0].clinicId, token.clinicId);
      assert.equal(auditCalls[0].reportId, token.reportId);
      assert.equal(auditCalls[0].targetReportAccessTokenId, token.id);
    } finally {
      await app.close();
    }
  },
);

test(
  "publicReportAccessNativeRoutes devuelve 400 cuando el token es invalido",
  async () => {
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/public/report-access/token-invalido",
      });

      assert.equal(response.statusCode, 400);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: "Token de acceso inválido",
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "publicReportAccessNativeRoutes devuelve 410 cuando el token fue revocado",
  async () => {
    const rawToken = "b".repeat(64);
    const report = createReportFixture();
    const token = createReportAccessTokenFixture({
      revokedAt: new Date("2026-04-23T00:00:00.000Z"),
    });

    const app = await createTestApp({
      getReportAccessTokenWithReportByTokenHash: async () => ({ token, report }),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: `/api/public/report-access/${rawToken}`,
      });

      assert.equal(response.statusCode, 410);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: "El token público de informe fue revocado",
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "publicReportAccessNativeRoutes devuelve 409 cuando el informe no está disponible públicamente",
  async () => {
    const rawToken = "c".repeat(64);
    const report = createReportFixture({
      currentStatus: "draft",
    });
    const token = createReportAccessTokenFixture();

    const app = await createTestApp({
      getReportAccessTokenWithReportByTokenHash: async () => ({ token, report }),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: `/api/public/report-access/${rawToken}`,
      });

      assert.equal(response.statusCode, 409);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: "El informe todavía no está disponible para acceso público",
        currentStatus: "draft",
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "publicReportAccessNativeRoutes aplica rate limit nativo fijo por IP",
  async () => {
    const rawToken = "d".repeat(64);

    const app = await createTestApp({
      now: () => 0,
      publicReportAccessRateLimitWindowMs: 60_000,
      publicReportAccessRateLimitMaxAttempts: 2,
      getReportAccessTokenWithReportByTokenHash: async () => null,
    });

    try {
      const first = await app.inject({
        method: "GET",
        url: `/api/public/report-access/${rawToken}`,
        remoteAddress: "203.0.113.40",
      });

      const second = await app.inject({
        method: "GET",
        url: `/api/public/report-access/${rawToken}`,
        remoteAddress: "203.0.113.40",
      });

      const third = await app.inject({
        method: "GET",
        url: `/api/public/report-access/${rawToken}`,
        remoteAddress: "203.0.113.40",
      });

      assert.equal(first.statusCode, 404);
      assert.equal(second.statusCode, 404);
      assert.equal(third.statusCode, 429);
      assert.equal(third.headers["ratelimit-limit"], "2");
      assert.equal(third.headers["ratelimit-remaining"], "0");
      assert.deepEqual(JSON.parse(third.body), {
        success: false,
        error: PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE,
      });
    } finally {
      await app.close();
    }
  },
);
