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
const { adminUsersRolesNativeRoutes } = await import(
  "../server/routes/admin-users-roles.fastify.ts"
);

type AdminUsersRolesNativeRoutesOptions = import(
  "../server/routes/admin-users-roles.fastify.ts"
).AdminUsersRolesNativeRoutesOptions;
type AdminUsersRolesQuery = import(
  "../server/db-admin-users-roles.ts"
).AdminUsersRolesQuery;
type AdminUsersRolesSnapshot = import(
  "../server/db-admin-users-roles.ts"
).AdminUsersRolesSnapshot;
type AdminRoleUserSummary = import(
  "../server/db-admin-users-roles.ts"
).AdminRoleUserSummary;

function buildDeps(
  overrides: Partial<AdminUsersRolesNativeRoutesOptions> = {},
): AdminUsersRolesNativeRoutesOptions {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => ({
      id: 1,
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
    getAdminUsersRolesSnapshot: async (): Promise<AdminUsersRolesSnapshot> => ({
      success: true,
      users: [],
      total: 0,
      limit: 50,
      offset: 0,
      totals: {
        adminUsers: 0,
        clinicUsers: 0,
      },
    }),
    now: () => Date.UTC(2026, 4, 8, 0, 0, 0),
    ...overrides,
  };
}

test("admin users roles requiere sesión admin", async () => {
  const app = Fastify();

  await app.register(
    adminUsersRolesNativeRoutes,
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

test("admin users roles devuelve usuarios sanitizados sin hashes ni auth ids", async () => {
  const app = Fastify();

  await app.register(
    adminUsersRolesNativeRoutes,
    buildDeps({
      getAdminUsersRolesSnapshot: async (
        params: AdminUsersRolesQuery,
      ): Promise<AdminUsersRolesSnapshot> => {
        const users: AdminRoleUserSummary[] = [
          {
            userType: "admin",
            userId: 1,
            username: "VETNEB",
            role: "admin",
            clinicId: null,
            clinicName: null,
            createdAt: "2026-05-08T00:00:00.000Z",
            updatedAt: "2026-05-08T00:00:00.000Z",
          },
          {
            userType: "clinic",
            userId: 2,
            username: "clinic-owner",
            role: "clinic_owner",
            clinicId: 10,
            clinicName: "Clínica Demo",
            createdAt: "2026-05-08T00:00:00.000Z",
            updatedAt: "2026-05-08T00:00:00.000Z",
          },
        ];

        const filtered = users.filter((user) =>
          params.role ? user.role === params.role : true,
        );

        return {
          success: true,
          users: filtered,
          total: filtered.length,
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
          totals: {
            adminUsers: filtered.filter((user) => user.userType === "admin")
              .length,
            clinicUsers: filtered.filter((user) => user.userType === "clinic")
              .length,
          },
        };
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/?role=clinic_owner&limit=25&offset=0",
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
    assert.equal(body.users.length, 1);
    assert.equal(body.users[0].userType, "clinic");
    assert.equal(body.users[0].role, "clinic_owner");
    assert.equal(body.users[0].passwordHash, undefined);
    assert.equal(body.users[0].authProId, undefined);
    assert.equal(JSON.stringify(body).includes("password"), false);
    assert.equal(JSON.stringify(body).includes("hash:"), false);
  } finally {
    await app.close();
  }
});

test("admin users roles rechaza filtros inválidos", async () => {
  const app = Fastify();
  let snapshotCalled = false;

  await app.register(
    adminUsersRolesNativeRoutes,
    buildDeps({
      getAdminUsersRolesSnapshot: async (): Promise<AdminUsersRolesSnapshot> => {
        snapshotCalled = true;

        return {
          success: true,
          users: [],
          total: 0,
          limit: 50,
          offset: 0,
          totals: {
            adminUsers: 0,
            clinicUsers: 0,
          },
        };
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/?role=superadmin",
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