import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.COOKIE_NAME = "app_session_id";

const { ENV } = await import("../server/lib/env.ts");
const {
  clinicAuditNativeRoutes,
} = await import("../server/routes/clinic-audit.fastify.ts");

function createAuditItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    event: "report.public_accessed",
    action: "report.public_accessed",
    entity: "report_access_token",
    entityId: 55,
    actorType: "public_report_access_token",
    actorAdminUserId: null,
    actorClinicUserId: null,
    actorReportAccessTokenId: 9,
    clinicId: 3,
    reportId: 55,
    targetAdminUserId: null,
    targetClinicUserId: null,
    targetReportAccessTokenId: 9,
    requestId: "req-1",
    requestMethod: "GET",
    requestPath: "/api/public/report-access/[REDACTED]",
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
    metadata: {
      tokenLast4: "ABCD",
    },
    createdAt: new Date("2026-04-24T00:00:00.000Z"),
    ...overrides,
  };
}

function createAuthStubs(overrides: Record<string, unknown> = {}) {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => ({
      clinicUserId: 9,
      expiresAt: new Date("2026-05-01T00:00:00.000Z"),
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

  await app.register(clinicAuditNativeRoutes as any, {
    prefix: "/api/clinic/audit-log",
    ...createAuthStubs(),
    listAuditLog: async () => ({
      items: [createAuditItem()],
      total: 1,
    }),
    buildClinicAuditListFilters: (
      _query: Record<string, unknown>,
      clinicId: number,
    ) => ({
      filters: {
        clinicId,
        limit: 50,
        offset: 0,
      },
      errors: [],
    }),
    buildAdminAuditCsv: (items: Array<Record<string, unknown>>) =>
      `id,event\n${items[0].id},${items[0].event}`,
    ...overrides,
  });

  return app;
}

test(
  "clinicAuditNativeRoutes expone GET / con payload estable y filtros clinic-scoped",
  async () => {
    const filterCalls: Array<Record<string, unknown>> = [];
    const listCalls: Array<Record<string, unknown>> = [];
    const item = createAuditItem();

    const app = await createTestApp({
      buildClinicAuditListFilters: (
        query: Record<string, unknown>,
        clinicId: number,
      ) => {
        filterCalls.push({ query, clinicId });

        return {
          filters: {
            clinicId,
            event: "report.public_accessed",
            actorType: "public_report_access_token",
            reportId: 55,
            actorClinicUserId: undefined,
            actorReportAccessTokenId: 9,
            targetReportAccessTokenId: 9,
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
          items: [{ ...item, createdAt: "2026-04-24T00:00:00.000Z" }],
          total: 1,
        };
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/clinic/audit-log?event=report.public_accessed&limit=25&offset=5",
        headers: {
          cookie: `${ENV.cookieName}=session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(filterCalls.length, 1);
      assert.equal(filterCalls[0].clinicId, 3);
      assert.equal(listCalls.length, 1);
      assert.equal(listCalls[0].clinicId, 3);
      assert.equal(listCalls[0].limit, 25);
      assert.equal(listCalls[0].offset, 5);

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        count: 1,
        items: [{ ...item, createdAt: "2026-04-24T00:00:00.000Z" }],
        pagination: {
          limit: 25,
          offset: 5,
          total: 1,
        },
        filters: {
          event: "report.public_accessed",
          actorType: "public_report_access_token",
          clinicId: 3,
          reportId: 55,
          actorClinicUserId: null,
          actorReportAccessTokenId: 9,
          targetReportAccessTokenId: 9,
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
  "clinicAuditNativeRoutes exporta GET /export.csv con headers y límite fijo",
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
        url: "/api/clinic/audit-log/export.csv",
        headers: {
          cookie: `${ENV.cookieName}=session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["content-type"], "text/csv; charset=utf-8");
      assert.match(
        String(response.headers["content-disposition"] ?? ""),
        /^attachment; filename="clinic-audit-log-/,
      );

      assert.equal(listCalls.length, 1);
      assert.equal(listCalls[0].clinicId, 3);
      assert.equal(listCalls[0].limit, 10000);
      assert.equal(listCalls[0].offset, 0);

      assert.equal(response.body, "id,event\n101,report.public_accessed");
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicAuditNativeRoutes devuelve 400 cuando los filtros son inválidos",
  async () => {
    const app = await createTestApp({
      buildClinicAuditListFilters: () => ({
        filters: {
          clinicId: 3,
          limit: 50,
          offset: 0,
        },
        errors: ["event invalido"],
      }),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/clinic/audit-log?event=bad",
        headers: {
          cookie: `${ENV.cookieName}=session-token`,
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
  "clinicAuditNativeRoutes devuelve 400 cuando export.csv supera el máximo permitido",
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
        url: "/api/clinic/audit-log/export.csv",
        headers: {
          cookie: `${ENV.cookieName}=session-token`,
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
test(
  "clinicAuditNativeRoutes usa ENV.cookieName y rechaza cookie legacy vetneb_session",
  async () => {
    const hashCalls: string[] = [];
    const app = await createTestApp({
      hashSessionToken: (token: string) => {
        hashCalls.push(token);
        return `hash:${token}`;
      },
    });

    try {
      const legacyResponse = await app.inject({
        method: "GET",
        url: "/api/clinic/audit-log",
        headers: {
          cookie: "vetneb_session=session-token",
        },
      });

      assert.equal(legacyResponse.statusCode, 401);
      assert.deepEqual(JSON.parse(legacyResponse.body), {
        success: false,
        error: "No autenticado",
      });
      assert.deepEqual(hashCalls, []);

      const envCookieResponse = await app.inject({
        method: "GET",
        url: "/api/clinic/audit-log",
        headers: {
          cookie: `${ENV.cookieName}=session-token`,
        },
      });

      assert.equal(envCookieResponse.statusCode, 200);
      assert.deepEqual(hashCalls, ["session-token"]);
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicAuditNativeRoutes limpia cookie de sesión con contrato ENV cuando expira",
  async () => {
    const deletedSessions: string[] = [];
    const app = await createTestApp({
      getActiveSessionByToken: async () => ({
        clinicUserId: 9,
        expiresAt: new Date("2026-04-01T00:00:00.000Z"),
        lastAccess: new Date("2026-03-31T00:00:00.000Z"),
      }),
      deleteActiveSession: async (tokenHash: string) => {
        deletedSessions.push(tokenHash);
      },
      now: () => new Date("2026-04-29T00:00:00.000Z").getTime(),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/clinic/audit-log",
        headers: {
          cookie: `${ENV.cookieName}=session-token`,
        },
      });

      assert.equal(response.statusCode, 401);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: "Sesión expirada",
      });
      assert.deepEqual(deletedSessions, ["hash:session-token"]);

      const setCookie = String(response.headers["set-cookie"] ?? "");
      assert.ok(setCookie.startsWith("app_session_id=;"));
      assert.match(setCookie, /Path=\//);
      assert.match(setCookie, /HttpOnly/);
      assert.match(setCookie, /SameSite=lax/);
      assert.match(setCookie, /Max-Age=0/);
      assert.match(setCookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
      assert.equal(setCookie.includes("vetneb_session"), false);
    } finally {
      await app.close();
    }
  },
);
