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
const { adminSessionsNativeRoutes } = await import(
  "../server/routes/admin-sessions.fastify.ts"
);

type AdminSessionsNativeRoutesOptions = import(
  "../server/routes/admin-sessions.fastify.ts"
).AdminSessionsNativeRoutesOptions;
type AdminSessionsQuery = import(
  "../server/db-admin-sessions.ts"
).AdminSessionsQuery;
type AdminSessionsSnapshot = import(
  "../server/db-admin-sessions.ts"
).AdminSessionsSnapshot;
type AdminSessionSummary = import(
  "../server/db-admin-sessions.ts"
).AdminSessionSummary;
type AdminSessionRevocationResult = import(
  "../server/db-admin-sessions.ts"
).AdminSessionRevocationResult;

function buildDeps(
  overrides: Partial<AdminSessionsNativeRoutesOptions> = {},
): AdminSessionsNativeRoutesOptions {
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
    getAdminSessionsSnapshot: async (): Promise<AdminSessionsSnapshot> => ({
      success: true,
      sessions: [],
      total: 0,
      limit: 50,
      offset: 0,
    }),
    revokeAdminSessionById: async (): Promise<AdminSessionRevocationResult | null> =>
      null,
    createAuditLog: async () => ({}),
    now: () => Date.UTC(2026, 4, 8, 0, 0, 0),
    ...overrides,
  };
}

test("admin sessions requiere sesión admin", async () => {
  const app = Fastify();

  await app.register(
    adminSessionsNativeRoutes,
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

test("admin sessions devuelve sesiones sanitizadas sin tokenHash", async () => {
  const app = Fastify();

  await app.register(
    adminSessionsNativeRoutes,
    buildDeps({
      getAdminSessionsSnapshot: async (
        params: AdminSessionsQuery,
      ): Promise<AdminSessionsSnapshot> => {
        const sessions: AdminSessionSummary[] = [
          {
            sessionType: "admin",
            sessionId: 10,
            actorType: "admin_user",
            actorId: 1,
            createdAt: "2026-05-08T00:00:00.000Z",
            lastAccess: "2026-05-08T00:10:00.000Z",
            expiresAt: "2099-01-01T00:00:00.000Z",
            status: "active",
          },
          {
            sessionType: "clinic",
            sessionId: 20,
            actorType: "clinic_user",
            actorId: 7,
            createdAt: "2026-05-07T00:00:00.000Z",
            lastAccess: null,
            expiresAt: "2026-05-07T01:00:00.000Z",
            status: "expired",
          },
        ];

        const filtered = sessions.filter((item) =>
          params.status ? item.status === params.status : true,
        );

        return {
          success: true,
          sessions: filtered,
          total: filtered.length,
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
        };
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/?status=active&limit=25&offset=0",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.deepEqual(body.checkedBy, {
      adminUserId: 1,
      username: "VETNEB",
    });
    assert.equal(body.sessions.length, 1);
    assert.equal(body.sessions[0].sessionType, "admin");
    assert.equal(body.sessions[0].status, "active");
    assert.equal(body.sessions[0].tokenHash, undefined);
    assert.equal(body.sessions[0].token, undefined);
    assert.equal(body.sessions[0].cookie, undefined);
    assert.equal(JSON.stringify(body).includes("hash:"), false);
  } finally {
    await app.close();
  }
});

test("admin sessions rechaza filtros inválidos", async () => {
  const app = Fastify();
  let snapshotCalled = false;

  await app.register(
    adminSessionsNativeRoutes,
    buildDeps({
      getAdminSessionsSnapshot: async (): Promise<AdminSessionsSnapshot> => {
        snapshotCalled = true;

        return {
          success: true,
          sessions: [],
          total: 0,
          limit: 50,
          offset: 0,
        };
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/?sessionType=unknown",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).success, false);
    assert.equal(snapshotCalled, false);
  } finally {
    await app.close();
  }
});

test("admin sessions revoca sesión remota y audita sin filtrar tokenHash", async () => {
  const app = Fastify();
  const auditCalls: unknown[] = [];
  const revokeCalls: unknown[] = [];

  await app.register(
    adminSessionsNativeRoutes,
    buildDeps({
      revokeAdminSessionById: async (target): Promise<AdminSessionRevocationResult> => {
        revokeCalls.push(target);

        return {
          sessionType: "clinic",
          sessionId: target.sessionId,
          actorType: "clinic_user",
          actorId: 7,
          createdAt: "2026-05-08T00:00:00.000Z",
          lastAccess: "2026-05-08T00:10:00.000Z",
          expiresAt: "2099-01-01T00:00:00.000Z",
          status: "active",
          revokedAt: "2026-05-08T00:00:00.000Z",
        };
      },
      createAuditLog: async (input) => {
        auditCalls.push(input);
        return {};
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "POST",
      url: "/clinic/20/revoke",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "user-agent": "node-test",
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.revokedSession.sessionType, "clinic");
    assert.equal(body.revokedSession.sessionId, 20);
    assert.equal(body.revokedSession.tokenHash, undefined);
    assert.equal(body.revokedSession.token, undefined);
    assert.equal(JSON.stringify(body).includes("hash:"), false);
    assert.deepEqual(revokeCalls, [{ sessionType: "clinic", sessionId: 20 }]);
    assert.equal(auditCalls.length, 1);
    assert.equal((auditCalls[0] as { event?: string }).event, "auth.session.revoked");
    assert.equal(
      (auditCalls[0] as { actorAdminUserId?: number }).actorAdminUserId,
      1,
    );
  } finally {
    await app.close();
  }
});

test("admin sessions bloquea auto-revocación de sesión admin actual", async () => {
  const app = Fastify();
  let revokeCalled = false;
  let auditCalled = false;

  await app.register(
    adminSessionsNativeRoutes,
    buildDeps({
      revokeAdminSessionById: async () => {
        revokeCalled = true;
        return null;
      },
      createAuditLog: async () => {
        auditCalled = true;
        return {};
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "POST",
      url: "/admin/99/revoke",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).success, false);
    assert.equal(revokeCalled, false);
    assert.equal(auditCalled, false);
  } finally {
    await app.close();
  }
});

test("admin sessions devuelve 404 si la sesión a revocar no existe", async () => {
  const app = Fastify();
  let auditCalled = false;

  await app.register(
    adminSessionsNativeRoutes,
    buildDeps({
      revokeAdminSessionById: async () => null,
      createAuditLog: async () => {
        auditCalled = true;
        return {};
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "POST",
      url: "/particular/123/revoke",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 404);
    assert.equal(JSON.parse(response.body).success, false);
    assert.equal(auditCalled, false);
  } finally {
    await app.close();
  }
});