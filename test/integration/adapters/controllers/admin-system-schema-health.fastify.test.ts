import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.CORS_ORIGIN = "https://portal-vetneb-frontend-staging.onrender.com";

const { ENV } = await import("../../../../server/lib/env.ts");
const { adminSystemSchemaHealthNativeRoutes } = await import(
  "../../../../server/routes/admin-system-schema-health.fastify.ts"
);

const STAGING_ORIGIN = "https://portal-vetneb-frontend-staging.onrender.com";

const okSnapshot = {
  success: true,
  status: "ok" as const,
  generatedAt: "2026-05-27T00:00:00.000Z",
  summary: {
    requiredTables: 3,
    requiredColumns: 34,
    presentColumns: 34,
    missingColumns: 0,
  },
  tables: [],
  missing: [],
};

const degradedSnapshot = {
  success: false,
  status: "degraded" as const,
  generatedAt: "2026-05-27T00:00:00.000Z",
  summary: {
    requiredTables: 3,
    requiredColumns: 34,
    presentColumns: 33,
    missingColumns: 1,
  },
  tables: [],
  missing: [
    { schema: "public" as const, table: "reports", column: "workflow_stage" },
  ],
};

function buildDeps(overrides: Record<string, unknown> = {}) {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => ({
      adminUserId: 1,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-04-23T00:00:00.000Z"),
    }),
    getAdminUserById: async () => ({ id: 1, username: "VETNEB" }),
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getSchemaHealthSnapshot: async () => okSnapshot,
    ...overrides,
  };
}

test("admin schema health 401 sin cookie", async () => {
  const app = Fastify();
  await app.register(adminSystemSchemaHealthNativeRoutes, buildDeps());

  try {
    const response = await app.inject({ method: "GET", url: "/" });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Admin no autenticado",
    });
  } finally {
    await app.close();
  }
});

test("admin schema health 200 con admin valido y schema ok", async () => {
  const app = Fastify();
  await app.register(adminSystemSchemaHealthNativeRoutes, buildDeps());

  try {
    const response = await app.inject({
      method: "GET",
      url: "/",
      headers: { cookie: `${ENV.adminCookieName}=admin-session-token` },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.status, "ok");
    assert.deepEqual(body.checkedBy, { adminUserId: 1, username: "VETNEB" });
    assert.equal(body.generatedAt, okSnapshot.generatedAt);
    assert.deepEqual(body.summary, okSnapshot.summary);
    assert.deepEqual(body.missing, []);
  } finally {
    await app.close();
  }
});

test("admin schema health 503 con admin valido y schema degraded", async () => {
  const app = Fastify();
  await app.register(
    adminSystemSchemaHealthNativeRoutes,
    buildDeps({ getSchemaHealthSnapshot: async () => degradedSnapshot }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/",
      headers: { cookie: `${ENV.adminCookieName}=admin-session-token` },
    });

    assert.equal(response.statusCode, 503);

    const body = JSON.parse(response.body);

    assert.equal(body.success, false);
    assert.equal(body.status, "degraded");
    assert.equal(body.summary.missingColumns, 1);
    assert.deepEqual(body.missing, degradedSnapshot.missing);
  } finally {
    await app.close();
  }
});

test("CORS: OPTIONS con origin permitido devuelve 204 en schema-health", async () => {
  const app = Fastify();
  await app.register(adminSystemSchemaHealthNativeRoutes, buildDeps());

  try {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/",
      headers: {
        origin: STAGING_ORIGIN,
        "access-control-request-method": "GET",
        "access-control-request-headers": "content-type",
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(
      response.headers["access-control-allow-origin"],
      STAGING_ORIGIN,
    );
    assert.equal(
      response.headers["access-control-allow-credentials"],
      "true",
    );
    assert.equal(
      response.headers["access-control-allow-methods"],
      "GET,OPTIONS",
    );
  } finally {
    await app.close();
  }
});

test("CORS: GET con origin permitido devuelve access-control-allow-origin en schema-health", async () => {
  const app = Fastify();
  await app.register(adminSystemSchemaHealthNativeRoutes, buildDeps());

  try {
    const response = await app.inject({
      method: "GET",
      url: "/",
      headers: {
        origin: STAGING_ORIGIN,
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["access-control-allow-origin"],
      STAGING_ORIGIN,
    );
    assert.equal(
      response.headers["access-control-allow-credentials"],
      "true",
    );
  } finally {
    await app.close();
  }
});

test("CORS: origin no permitido no recibe access-control-allow-origin en schema-health", async () => {
  const app = Fastify();
  await app.register(adminSystemSchemaHealthNativeRoutes, buildDeps());

  try {
    const response = await app.inject({
      method: "GET",
      url: "/",
      headers: {
        origin: "https://evil.example.com",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(
      response.headers["access-control-allow-origin"],
      undefined,
    );
  } finally {
    await app.close();
  }
});
