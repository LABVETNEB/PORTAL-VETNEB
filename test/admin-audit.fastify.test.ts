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
  adminAuditNativeRoutes,
} = await import("../server/routes/admin-audit.fastify.ts");

function createAuditItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 201,
    event: "auth.admin.login.succeeded",
    action: "auth.admin.login.succeeded",
    entity: "admin_user",
    entityId: 1,
    actorType: "admin_user",
    actorAdminUserId: 1,
    actorClinicUserId: null,
    actorReportAccessTokenId: null,
    clinicId: 3,
    reportId: null,
    targetAdminUserId: 1,
    targetClinicUserId: null,
    targetReportAccessTokenId: null,
    requestId: "req-admin-1",
    requestMethod: "POST",
    requestPath: "/api/admin/auth/login",
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
    metadata: {
      username: "ADMIN",
    },
    createdAt: new Date("2026-04-24T00:00:00.000Z"),
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

  await app.register(adminAuditNativeRoutes as any, {
    prefix: "/api/admin/audit-log",
    ...createAuthStubs(),
    listAuditLog: async () => ({
      items: [createAuditItem()],
      total: 1,
    }),
    buildAdminAuditListFilters: (_query: Record<string, unknown>) => ({
      filters: {
        limit: 50,
        offset: 0,
      },
      errors: [],
    }),
    buildAdminAuditCsv: (items: Array<Record<string, unknown>>) =>
      `id,event\n${items[0].id},${items[0].event}`,
    buildAdminAuditCsvFilename: () => "admin-audit-log-test.csv",
    ...overrides,
  });

  return app;
}

test(
  "adminAuditNativeRoutes expone GET / con payload estable y filtros globales",
  async () => {
    const filterCalls: Array<Record<string, unknown>> = [];
    const listCalls: Array<Record<string, unknown>> = [];
    const item = createAuditItem();

    const app = await createTestApp({
      buildAdminAuditListFilters: (query: Record<string, unknown>) => {
        filterCalls.push({ query });

        return {
          filters: {
            event: "auth.admin.login.succeeded",
            actorType: "admin_user",
            clinicId: 3,
            reportId: null,
            actorAdminUserId: 1,
            actorClinicUserId: null,
            actorReportAccessTokenId: null,
            targetReportAccessTokenId: null,
            from: new Date("2026-04-01T00:00:00.000Z"),
            to: new Date("2026-04-30T23:59:59.000Z"),
            limit: 25,
            offset: 5,
          },
          errors: [],
        };
      },
      listAuditLog: async (filters: Record<string, unknown>) => {
        listCalls.push(filters);

        return {
          items: [item],
          total: 1,
        };
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/audit-log?event=auth.admin.login.succeeded&limit=25&offset=5",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(filterCalls.length, 1);
      assert.equal(listCalls.length, 1);
      assert.equal(listCalls[0].actorAdminUserId, 1);
      assert.equal(listCalls[0].limit, 25);
      assert.equal(listCalls[0].offset, 5);

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        count: 1,
        items: [
          {
            ...item,
            createdAt: "2026-04-24T00:00:00.000Z",
          },
        ],
        pagination: {
          limit: 25,
          offset: 5,
          total: 1,
        },
        filters: {
          event: "auth.admin.login.succeeded",
          actorType: "admin_user",
          clinicId: 3,
          reportId: null,
          actorAdminUserId: 1,
          actorClinicUserId: null,
          actorReportAccessTokenId: null,
          targetReportAccessTokenId: null,
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.000Z",
        },
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "adminAuditNativeRoutes exporta GET /export.csv con headers y límite fijo",
  async () => {
    const listCalls: Array<Record<string, unknown>> = [];

    const app = await createTestApp({
      listAuditLog: async (filters: Record<string, unknown>) => {
        listCalls.push(filters);

        return {
          items: [createAuditItem()],
          total: 1,
        };
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/audit-log/export.csv",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["content-type"], "text/csv; charset=utf-8");
      assert.equal(
        response.headers["content-disposition"],
        'attachment; filename="admin-audit-log-test.csv"',
      );

      assert.equal(listCalls.length, 1);
      assert.equal(listCalls[0].limit, 10000);
      assert.equal(listCalls[0].offset, 0);

      assert.equal(response.body, "id,event\n201,auth.admin.login.succeeded");
    } finally {
      await app.close();
    }
  },
);

test(
  "adminAuditNativeRoutes devuelve 400 cuando los filtros son inválidos",
  async () => {
    const app = await createTestApp({
      buildAdminAuditListFilters: () => ({
        filters: {
          limit: 50,
          offset: 0,
        },
        errors: ["event invalido"],
      }),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/audit-log?event=bad",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 400);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: "event invalido",
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "adminAuditNativeRoutes devuelve 400 cuando export.csv supera el máximo permitido",
  async () => {
    const app = await createTestApp({
      listAuditLog: async () => ({
        items: [createAuditItem()],
        total: 10001,
      }),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/audit-log/export.csv",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 400);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error:
          "Demasiados registros para exportar. Aplica filtros mas especificos (maximo 10000).",
      });
    } finally {
      await app.close();
    }
  },
);
