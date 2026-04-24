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
const { ENV } = await import("../server/lib/env.ts");
const {
  REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_ERROR_MESSAGE,
} = await import("../server/lib/report-access-token-rate-limit.ts");
const {
  adminReportAccessTokensNativeRoutes,
} = await import("../server/routes/admin-report-access-tokens.fastify.ts");

function createClinicFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    ...overrides,
  };
}

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
    tokenHash: "hash:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    tokenLast4: "aaaa",
    accessCount: 0,
    lastAccessAt: null,
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    revokedAt: null,
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    updatedAt: new Date("2026-04-22T12:00:00.000Z"),
    createdByClinicUserId: null,
    createdByAdminUserId: 1,
    revokedByClinicUserId: null,
    revokedByAdminUserId: null,
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
    generateSessionToken: () => "a".repeat(64),
    hashSessionToken: (token: string) => `hash:${token}`,
    ...overrides,
  };
}

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(adminReportAccessTokensNativeRoutes as any, {
    prefix: "/api/admin/report-access-tokens",
    ...createAuthStubs(),
    getClinicById: async () => createClinicFixture(),
    getReportById: async () => createReportFixture(),
    createReportAccessToken: async () => createReportAccessTokenFixture(),
    getReportAccessTokenById: async () => createReportAccessTokenFixture(),
    listReportAccessTokens: async () => [createReportAccessTokenFixture()],
    revokeReportAccessToken: async () =>
      createReportAccessTokenFixture({
        revokedAt: new Date("2026-04-24T00:00:00.000Z"),
        revokedByAdminUserId: 1,
      }),
    writeAuditLog: async () => {},
    ...overrides,
  });

  return app;
}

test(
  "adminReportAccessTokensNativeRoutes crea POST / con payload estable, path público y auditoria",
  async () => {
    const rawToken = "a".repeat(64);
    const clinic = createClinicFixture();
    const report = createReportFixture();
    const createdToken = createReportAccessTokenFixture({
      tokenHash: `hash:${rawToken}`,
    });
    const auditCalls: Array<Record<string, unknown>> = [];
    const createCalls: Array<Record<string, unknown>> = [];

    const app = await createTestApp({
      generateSessionToken: () => rawToken,
      getClinicById: async (clinicId: number) => {
        assert.equal(clinicId, 3);
        return clinic;
      },
      getReportById: async (reportId: number) => {
        assert.equal(reportId, 55);
        return report;
      },
      createReportAccessToken: async (input: Record<string, unknown>) => {
        createCalls.push(input);
        return createdToken;
      },
      writeAuditLog: async (_req: unknown, input: Record<string, unknown>) => {
        auditCalls.push(input);
      },
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/admin/report-access-tokens",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
          "content-type": "application/json",
        },
        payload: {
          clinicId: 3,
          reportId: 55,
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
      });

      assert.equal(response.statusCode, 201);
      assert.equal(
        response.headers["access-control-allow-origin"],
        "http://localhost:3000",
      );
      assert.equal(response.headers["ratelimit-limit"], "10");
      assert.equal(createCalls.length, 1);
      assert.equal(createCalls[0].clinicId, 3);
      assert.equal(createCalls[0].reportId, 55);
      assert.equal(createCalls[0].tokenHash, `hash:${rawToken}`);
      assert.equal(createCalls[0].tokenLast4, "aaaa");
      assert.equal(createCalls[0].createdByAdminUserId, 1);
      assert.equal(createCalls[0].createdByClinicUserId, null);

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        message: "Token público de informe creado correctamente",
        token: rawToken,
        publicAccessPath: `/api/public/report-access/${rawToken}`,
        reportAccessToken: {
          id: 9,
          clinicId: 3,
          reportId: 55,
          tokenLast4: "aaaa",
          accessCount: 0,
          lastAccessAt: null,
          expiresAt: "2099-01-01T00:00:00.000Z",
          revokedAt: null,
          createdAt: "2026-04-20T12:00:00.000Z",
          updatedAt: "2026-04-22T12:00:00.000Z",
          createdByClinicUserId: null,
          createdByAdminUserId: 1,
          revokedByClinicUserId: null,
          revokedByAdminUserId: null,
          state: "active",
          isExpired: false,
          isRevoked: false,
        },
      });

      assert.equal(auditCalls.length, 1);
      assert.equal(auditCalls[0].event, AUDIT_EVENTS.REPORT_ACCESS_TOKEN_CREATED);
      assert.equal(auditCalls[0].clinicId, 3);
      assert.equal(auditCalls[0].reportId, 55);
      assert.equal(auditCalls[0].targetReportAccessTokenId, 9);
    } finally {
      await app.close();
    }
  },
);

test(
  "adminReportAccessTokensNativeRoutes bloquea POST / con origin no permitido",
  async () => {
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/admin/report-access-tokens",
        headers: {
          origin: "https://evil.example",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
          "content-type": "application/json",
        },
        payload: {
          clinicId: 3,
          reportId: 55,
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
  },
);

test(
  "adminReportAccessTokensNativeRoutes expone GET / con lista, filtros y paginación",
  async () => {
    const listCalls: Array<Record<string, unknown>> = [];
    const token = createReportAccessTokenFixture();

    const app = await createTestApp({
      listReportAccessTokens: async (params: Record<string, unknown>) => {
        listCalls.push(params);
        return [token];
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/report-access-tokens?clinicId=3&reportId=55&limit=5&offset=2",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(listCalls.length, 1);
      assert.equal(listCalls[0].clinicId, 3);
      assert.equal(listCalls[0].reportId, 55);
      assert.equal(listCalls[0].limit, 5);
      assert.equal(listCalls[0].offset, 2);

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        count: 1,
        reportAccessTokens: [
          {
            id: 9,
            clinicId: 3,
            reportId: 55,
            tokenLast4: "aaaa",
            accessCount: 0,
            lastAccessAt: null,
            expiresAt: "2099-01-01T00:00:00.000Z",
            revokedAt: null,
            createdAt: "2026-04-20T12:00:00.000Z",
            updatedAt: "2026-04-22T12:00:00.000Z",
            createdByClinicUserId: null,
            createdByAdminUserId: 1,
            revokedByClinicUserId: null,
            revokedByAdminUserId: null,
            state: "active",
            isExpired: false,
            isRevoked: false,
          },
        ],
        pagination: {
          limit: 5,
          offset: 2,
        },
        filters: {
          clinicId: 3,
          reportId: 55,
        },
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "adminReportAccessTokensNativeRoutes expone GET /:tokenId con detalle y reporte vinculado",
  async () => {
    const token = createReportAccessTokenFixture();
    const report = createReportFixture();

    const app = await createTestApp({
      getReportAccessTokenById: async (tokenId: number) => {
        assert.equal(tokenId, 9);
        return token;
      },
      getReportById: async (reportId: number) => {
        assert.equal(reportId, 55);
        return report;
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/report-access-tokens/9",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        reportAccessToken: {
          id: 9,
          clinicId: 3,
          reportId: 55,
          tokenLast4: "aaaa",
          accessCount: 0,
          lastAccessAt: null,
          expiresAt: "2099-01-01T00:00:00.000Z",
          revokedAt: null,
          createdAt: "2026-04-20T12:00:00.000Z",
          updatedAt: "2026-04-22T12:00:00.000Z",
          createdByClinicUserId: null,
          createdByAdminUserId: 1,
          revokedByClinicUserId: null,
          revokedByAdminUserId: null,
          state: "active",
          isExpired: false,
          isRevoked: false,
          report: {
            id: 55,
            clinicId: 3,
            uploadDate: "2026-04-22T09:00:00.000Z",
            studyType: "Histopatología",
            patientName: "Luna",
            fileName: "luna-report.pdf",
            currentStatus: "ready",
            statusChangedAt: "2026-04-22T09:30:00.000Z",
            createdAt: "2026-04-22T09:00:00.000Z",
            updatedAt: "2026-04-22T09:30:00.000Z",
          },
        },
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "adminReportAccessTokensNativeRoutes revoca PATCH /:tokenId/revoke y escribe auditoria",
  async () => {
    const existing = createReportAccessTokenFixture();
    const revoked = createReportAccessTokenFixture({
      revokedAt: new Date("2026-04-24T00:00:00.000Z"),
      revokedByAdminUserId: 1,
    });
    const report = createReportFixture();
    const auditCalls: Array<Record<string, unknown>> = [];

    const app = await createTestApp({
      getReportAccessTokenById: async () => existing,
      revokeReportAccessToken: async (input: Record<string, unknown>) => {
        assert.equal(input.id, 9);
        assert.equal(input.revokedByAdminUserId, 1);
        return revoked;
      },
      getReportById: async () => report,
      writeAuditLog: async (_req: unknown, input: Record<string, unknown>) => {
        auditCalls.push(input);
      },
    });

    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/admin/report-access-tokens/9/revoke",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["ratelimit-limit"], "10");

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        message: "Token público de informe revocado correctamente",
        reportAccessToken: {
          id: 9,
          clinicId: 3,
          reportId: 55,
          tokenLast4: "aaaa",
          accessCount: 0,
          lastAccessAt: null,
          expiresAt: "2099-01-01T00:00:00.000Z",
          revokedAt: "2026-04-24T00:00:00.000Z",
          createdAt: "2026-04-20T12:00:00.000Z",
          updatedAt: "2026-04-22T12:00:00.000Z",
          createdByClinicUserId: null,
          createdByAdminUserId: 1,
          revokedByClinicUserId: null,
          revokedByAdminUserId: 1,
          state: "revoked",
          isExpired: false,
          isRevoked: true,
          report: {
            id: 55,
            clinicId: 3,
            uploadDate: "2026-04-22T09:00:00.000Z",
            studyType: "Histopatología",
            patientName: "Luna",
            fileName: "luna-report.pdf",
            currentStatus: "ready",
            statusChangedAt: "2026-04-22T09:30:00.000Z",
            createdAt: "2026-04-22T09:00:00.000Z",
            updatedAt: "2026-04-22T09:30:00.000Z",
          },
        },
      });

      assert.equal(auditCalls.length, 1);
      assert.equal(auditCalls[0].event, AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED);
      assert.equal(auditCalls[0].clinicId, 3);
      assert.equal(auditCalls[0].reportId, 55);
      assert.equal(auditCalls[0].targetReportAccessTokenId, 9);
    } finally {
      await app.close();
    }
  },
);

test(
  "adminReportAccessTokensNativeRoutes aplica rate limit nativo fijo sobre mutaciones",
  async () => {
    const app = await createTestApp({
      now: () => 0,
      mutationRateLimitWindowMs: 60_000,
      mutationRateLimitMaxAttempts: 2,
      getClinicById: async () => createClinicFixture(),
      getReportById: async () => null,
    });

    try {
      const first = await app.inject({
        method: "POST",
        url: "/api/admin/report-access-tokens",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
          "content-type": "application/json",
        },
        payload: {
          clinicId: 3,
          reportId: 55,
        },
        remoteAddress: "203.0.113.40",
      });

      const second = await app.inject({
        method: "POST",
        url: "/api/admin/report-access-tokens",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
          "content-type": "application/json",
        },
        payload: {
          clinicId: 3,
          reportId: 55,
        },
        remoteAddress: "203.0.113.40",
      });

      const third = await app.inject({
        method: "POST",
        url: "/api/admin/report-access-tokens",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
          "content-type": "application/json",
        },
        payload: {
          clinicId: 3,
          reportId: 55,
        },
        remoteAddress: "203.0.113.40",
      });

      assert.equal(first.statusCode, 404);
      assert.equal(second.statusCode, 404);
      assert.equal(third.statusCode, 429);
      assert.equal(third.headers["ratelimit-limit"], "2");
      assert.equal(third.headers["ratelimit-remaining"], "0");
      assert.deepEqual(JSON.parse(third.body), {
        success: false,
        error: REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_ERROR_MESSAGE,
      });
    } finally {
      await app.close();
    }
  },
);
