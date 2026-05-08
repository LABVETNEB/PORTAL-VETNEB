import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const { adminFailedLoginAlertsNativeRoutes } = await import(
  "../server/routes/admin-failed-login-alerts.fastify.ts"
);

type AdminFailedLoginAlertsNativeRoutesOptions = import(
  "../server/routes/admin-failed-login-alerts.fastify.ts"
).AdminFailedLoginAlertsNativeRoutesOptions;
type AdminFailedLoginAlertsQuery = import(
  "../server/db-admin-failed-login-alerts.ts"
).AdminFailedLoginAlertsQuery;
type AdminFailedLoginAlertsSnapshot = import(
  "../server/db-admin-failed-login-alerts.ts"
).AdminFailedLoginAlertsSnapshot;

function buildDeps(
  overrides: Partial<AdminFailedLoginAlertsNativeRoutesOptions> = {},
): AdminFailedLoginAlertsNativeRoutesOptions {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => ({
      id: 99,
      adminUserId: 1,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-05-07T00:00:00.000Z"),
    }),
    getAdminUserById: async () => ({
      id: 1,
      username: "VETNEB",
    }),
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    listAdminFailedLoginAlerts:
      async (): Promise<AdminFailedLoginAlertsSnapshot> => ({
        success: true,
        failedLoginAlerts: [],
        count: 0,
        total: 0,
        limit: 50,
        offset: 0,
        filters: {
          surface: null,
          reason: null,
        },
      }),
    buildAdminFailedLoginAlertsCsv: (items) =>
      [
        "id,surface,username,reason,ipAddress,userAgent,createdAt",
        ...items.map((item) =>
          [
            item.id,
            item.surface,
            item.username ?? "",
            item.reason,
            item.ipAddress ?? "",
            item.userAgent ?? "",
            item.createdAt,
          ].join(","),
        ),
      ].join("\n"),
    buildAdminFailedLoginAlertsCsvFilename: () =>
      "admin-failed-login-alerts-test.csv",
    now: () => Date.UTC(2026, 4, 8, 0, 0, 0),
    ...overrides,
  };
}

test("admin failed-login alerts requiere sesión admin", async () => {
  const app = Fastify();

  await app.register(
    adminFailedLoginAlertsNativeRoutes,
    buildDeps({
      getAdminSessionByToken: async () => null,
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/",
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Admin no autenticado",
    });
  } finally {
    await app.close();
  }
});

test("admin failed-login alerts devuelve intentos sanitizados", async () => {
  const app = Fastify();
  let receivedParams: AdminFailedLoginAlertsQuery | null = null;

  await app.register(
    adminFailedLoginAlertsNativeRoutes,
    buildDeps({
      listAdminFailedLoginAlerts: async (
        params,
      ): Promise<AdminFailedLoginAlertsSnapshot> => {
        receivedParams = params;

        return {
          success: true,
          failedLoginAlerts: [
            {
              id: 10,
              surface: "admin",
              username: "VETNEB",
              reason: "invalid_credentials",
              ipAddress: "203.0.113.10",
              userAgent: "node-test",
              createdAt: "2026-05-08T00:00:00.000Z",
            },
            {
              id: 11,
              surface: "particular",
              username: null,
              reason: "rate_limited",
              ipAddress: "203.0.113.11",
              userAgent: "node-test-2",
              createdAt: "2026-05-08T00:01:00.000Z",
            },
          ],
          count: 2,
          total: 2,
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
          filters: {
            surface: params.surface ?? null,
            reason: params.reason ?? null,
          },
        };
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/?surface=admin&reason=invalid_credentials&limit=25&offset=5",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(receivedParams, {
      surface: "admin",
      reason: "invalid_credentials",
      limit: 25,
      offset: 5,
    });

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.count, 2);
    assert.equal(body.total, 2);
    assert.deepEqual(body.checkedBy, {
      adminUserId: 1,
      username: "VETNEB",
    });
    assert.equal(body.failedLoginAlerts[0].surface, "admin");
    assert.equal(body.failedLoginAlerts[0].reason, "invalid_credentials");
    assert.equal(body.failedLoginAlerts[0].token, undefined);
    assert.equal(body.failedLoginAlerts[0].tokenHash, undefined);
    assert.equal(body.failedLoginAlerts[0].cookie, undefined);
    assert.equal(JSON.stringify(body).includes("hash:"), false);
  } finally {
    await app.close();
  }
});

test("admin failed-login alerts rechaza filtros inválidos", async () => {
  const app = Fastify();
  let listCalled = false;

  await app.register(
    adminFailedLoginAlertsNativeRoutes,
    buildDeps({
      listAdminFailedLoginAlerts: async () => {
        listCalled = true;

        return {
          success: true,
          failedLoginAlerts: [],
          count: 0,
          total: 0,
          limit: 50,
          offset: 0,
          filters: {
            surface: null,
            reason: null,
          },
        };
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/?surface=unknown",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).success, false);
    assert.equal(listCalled, false);
  } finally {
    await app.close();
  }
});


test("admin failed-login alerts exporta CSV sanitizado", async () => {
  const app = Fastify();
  let receivedParams: AdminFailedLoginAlertsQuery | null = null;

  await app.register(
    adminFailedLoginAlertsNativeRoutes,
    buildDeps({
      listAdminFailedLoginAlerts: async (
        params,
      ): Promise<AdminFailedLoginAlertsSnapshot> => {
        receivedParams = params;

        return {
          success: true,
          failedLoginAlerts: [
            {
              id: 20,
              surface: "clinic",
              username: "clinic-user",
              reason: "invalid_credentials",
              ipAddress: "203.0.113.20",
              userAgent: "csv-test-agent",
              createdAt: "2026-05-08T00:02:00.000Z",
            },
            {
              id: 21,
              surface: "particular",
              username: null,
              reason: "rate_limited",
              ipAddress: "203.0.113.21",
              userAgent: "csv-test-agent-2",
              createdAt: "2026-05-08T00:03:00.000Z",
            },
          ],
          count: 2,
          total: 2,
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
          filters: {
            surface: params.surface ?? null,
            reason: params.reason ?? null,
          },
        };
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/export.csv?surface=clinic&reason=invalid_credentials&limit=25&offset=5",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["content-type"],
      "text/csv; charset=utf-8",
    );
    assert.equal(
      response.headers["content-disposition"],
      'attachment; filename="admin-failed-login-alerts-test.csv"',
    );
    assert.deepEqual(receivedParams, {
      surface: "clinic",
      reason: "invalid_credentials",
      limit: 10000,
      offset: 0,
    });

    assert.equal(
      response.body,
      [
        "id,surface,username,reason,ipAddress,userAgent,createdAt",
        "20,clinic,clinic-user,invalid_credentials,203.0.113.20,csv-test-agent,2026-05-08T00:02:00.000Z",
        "21,particular,,rate_limited,203.0.113.21,csv-test-agent-2,2026-05-08T00:03:00.000Z",
      ].join("\n"),
    );

    assert.equal(response.body.includes("tokenHash"), false);
    assert.equal(response.body.includes("hash:"), false);
    assert.equal(response.body.includes("password"), false);
    assert.equal(response.body.includes("cookie"), false);
  } finally {
    await app.close();
  }
});

test("admin failed-login alerts export rechaza filtros inválidos", async () => {
  const app = Fastify();
  let listCalled = false;

  await app.register(
    adminFailedLoginAlertsNativeRoutes,
    buildDeps({
      listAdminFailedLoginAlerts: async () => {
        listCalled = true;

        return {
          success: true,
          failedLoginAlerts: [],
          count: 0,
          total: 0,
          limit: 50,
          offset: 0,
          filters: {
            surface: null,
            reason: null,
          },
        };
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/export.csv?reason=bad",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).success, false);
    assert.equal(listCalled, false);
  } finally {
    await app.close();
  }
});
