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
  reportAccessTokensNativeRoutes,
} = await import("../server/routes/report-access-tokens.fastify.ts");

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
    createdByClinicUserId: 9,
    createdByAdminUserId: null,
    revokedByClinicUserId: null,
    revokedByAdminUserId: null,
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
    generateSessionToken: () => "a".repeat(64),
    hashPassword: async () => "unused",
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: async () => ({
      valid: false,
      needsRehash: false,
    }),
    ...overrides,
  };
}

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(reportAccessTokensNativeRoutes as any, {
    prefix: "/api/report-access-tokens",
    ...createAuthStubs(),
    getReportById: async () => createReportFixture(),
    createReportAccessToken: async () => createReportAccessTokenFixture(),
    getClinicScopedReportAccessToken: async () => createReportAccessTokenFixture(),
    listReportAccessTokens: async () => [createReportAccessTokenFixture()],
    revokeReportAccessToken: async () =>
      createReportAccessTokenFixture({
        revokedAt: new Date("2026-04-24T00:00:00.000Z"),
        revokedByClinicUserId: 9,
      }),
    writeAuditLog: async () => {},
    ...overrides,
  });

  return app;
}

test(
  "reportAccessTokensNativeRoutes crea POST / con payload estable, path público y auditoria",
  async () => {
    const rawToken = "a".repeat(64);
    const report = createReportFixture();
    const createdToken = createReportAccessTokenFixture({
      tokenHash: `hash:${rawToken}`,
    });
    const auditCalls: Array<Record<string, unknown>> = [];
    const createCalls: Array<Record<string, unknown>> = [];

    const app = await createTestApp({
      generateSessionToken: () => rawToken,
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
        url: "/api/report-access-tokens",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.cookieName}=session-token`,
          "content-type": "application/json",
        },
        payload: {
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
      assert.equal(createCalls[0].createdByClinicUserId, 9);

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
          createdByClinicUserId: 9,
          createdByAdminUserId: null,
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
  "reportAccessTokensNativeRoutes bloquea POST / con origin no permitido",
  async () => {
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/report-access-tokens",
        headers: {
          origin: "https://evil.example",
          cookie: `${ENV.cookieName}=session-token`,
          "content-type": "application/json",
        },
        payload: {
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
  "reportAccessTokensNativeRoutes expone GET / con lista, filtros y paginación",
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
        url: "/api/report-access-tokens?reportId=55&limit=5&offset=2",
        headers: {
          cookie: `${ENV.cookieName}=session-token`,
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
            createdByClinicUserId: 9,
            createdByAdminUserId: null,
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
          reportId: 55,
        },
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "reportAccessTokensNativeRoutes expone GET /:tokenId con detalle y reporte vinculado",
  async () => {
    const token = createReportAccessTokenFixture();
    const report = createReportFixture();

    const app = await createTestApp({
      getClinicScopedReportAccessToken: async (tokenId: number, clinicId: number) => {
        assert.equal(tokenId, 9);
        assert.equal(clinicId, 3);
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
        url: "/api/report-access-tokens/9",
        headers: {
          cookie: `${ENV.cookieName}=session-token`,
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
          createdByClinicUserId: 9,
          createdByAdminUserId: null,
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
  "reportAccessTokensNativeRoutes revoca PATCH /:tokenId/revoke y escribe auditoria",
  async () => {
    const existing = createReportAccessTokenFixture();
    const revoked = createReportAccessTokenFixture({
      revokedAt: new Date("2026-04-24T00:00:00.000Z"),
      revokedByClinicUserId: 9,
    });
    const report = createReportFixture();
    const auditCalls: Array<Record<string, unknown>> = [];

    const app = await createTestApp({
      getClinicScopedReportAccessToken: async () => existing,
      revokeReportAccessToken: async (input: Record<string, unknown>) => {
        assert.equal(input.id, 9);
        assert.equal(input.revokedByClinicUserId, 9);
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
        url: "/api/report-access-tokens/9/revoke",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.cookieName}=session-token`,
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
          createdByClinicUserId: 9,
          createdByAdminUserId: null,
          revokedByClinicUserId: 9,
          revokedByAdminUserId: null,
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
  "reportAccessTokensNativeRoutes bloquea mutaciones sin management permission",
  async () => {
    const app = await createTestApp({
      getClinicUserById: async () => ({
        id: 9,
        clinicId: 3,
        username: "staff",
        authProId: null,
        role: "clinic_staff",
      }),
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/report-access-tokens",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.cookieName}=session-token`,
          "content-type": "application/json",
        },
        payload: {
          reportId: 55,
        },
      });

      assert.equal(response.statusCode, 403);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: "No autorizado para administrar tokens públicos de informes",
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "reportAccessTokensNativeRoutes aplica rate limit nativo fijo sobre mutaciones",
  async () => {
    const app = await createTestApp({
      now: () => 0,
      mutationRateLimitWindowMs: 60_000,
      mutationRateLimitMaxAttempts: 2,
      getReportById: async () => null,
    });

    try {
      const first = await app.inject({
        method: "POST",
        url: "/api/report-access-tokens",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.cookieName}=session-token`,
          "content-type": "application/json",
        },
        payload: {
          reportId: 55,
        },
        remoteAddress: "203.0.113.40",
      });

      const second = await app.inject({
        method: "POST",
        url: "/api/report-access-tokens",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.cookieName}=session-token`,
          "content-type": "application/json",
        },
        payload: {
          reportId: 55,
        },
        remoteAddress: "203.0.113.40",
      });

      const third = await app.inject({
        method: "POST",
        url: "/api/report-access-tokens",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.cookieName}=session-token`,
          "content-type": "application/json",
        },
        payload: {
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

test(
  "reportAccessTokensNativeRoutes oculta detalle de token ajeno con 404",
  async () => {
    let getReportCalled = false;

    const app = await createTestApp({
      getClinicScopedReportAccessToken: async (
        tokenId: number,
        clinicId: number,
      ) => {
        assert.equal(tokenId, 9);
        assert.equal(clinicId, 3);
        return null;
      },
      getReportById: async () => {
        getReportCalled = true;
        return createReportFixture();
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/report-access-tokens/9",
        headers: {
          cookie: ENV.cookieName + "=session-token",
        },
      });

      assert.equal(response.statusCode, 404);
      assert.equal(getReportCalled, false);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: "Token público de informe no encontrado",
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "reportAccessTokensNativeRoutes oculta revocacion de token ajeno antes de mutar",
  async () => {
    let revokeCalled = false;
    let auditCalled = false;

    const app = await createTestApp({
      getClinicScopedReportAccessToken: async (
        tokenId: number,
        clinicId: number,
      ) => {
        assert.equal(tokenId, 9);
        assert.equal(clinicId, 3);
        return null;
      },
      revokeReportAccessToken: async () => {
        revokeCalled = true;
        return null;
      },
      writeAuditLog: async () => {
        auditCalled = true;
      },
    });

    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/report-access-tokens/9/revoke",
        headers: {
          origin: "http://localhost:3000",
          cookie: ENV.cookieName + "=session-token",
        },
      });

      assert.equal(response.statusCode, 404);
      assert.equal(revokeCalled, false);
      assert.equal(auditCalled, false);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: "Token público de informe no encontrado",
      });
    } finally {
      await app.close();
    }
  },
);

test("reportAccessTokensNativeRoutes responde preflight OPTIONS permitido sin autenticar", async () => {
  const app = await createTestApp({
    getActiveSessionByToken: async () => {
      throw new Error("preflight OPTIONS no debe autenticar sesión clinic");
    },
  });

  try {
    for (const url of [
      "/api/report-access-tokens",
      "/api/report-access-tokens/9",
      "/api/report-access-tokens/9/revoke",
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
        "GET,POST,PATCH,OPTIONS",
      );
      assert.equal(
        response.headers["access-control-allow-headers"],
        "content-type,x-requested-with",
      );
      assert.equal(
        response.headers["access-control-expose-headers"],
        "RateLimit-Policy, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset",
      );
      assert.equal(response.headers["set-cookie"], undefined);
    }
  } finally {
    await app.close();
  }
});

test("reportAccessTokensNativeRoutes bloquea preflight OPTIONS con origin no permitido", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/report-access-tokens/9/revoke",
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
