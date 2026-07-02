import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.CORS_ORIGIN ??=
  "https://portal-vetneb-frontend-staging.onrender.com";

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
type AdminClinicUserRoleChangeResult = import(
  "../server/db-admin-users-roles.ts"
).AdminClinicUserRoleChangeResult;
type AdminClinicUserCredentialsUpdateResult = import(
  "../server/db-admin-clinics.ts"
).AdminClinicUserCredentialsUpdateResult;
const STAGING_ORIGIN = "https://portal-vetneb-frontend-staging.onrender.com";

const demoClinicUser: Extract<AdminRoleUserSummary, { userType: "clinic" }> = {
  userType: "clinic",
  userId: 2,
  username: "clinic-owner",
  role: "clinic_owner",
  clinicId: 10,
  clinicName: "Clínica Demo",
  createdAt: "2026-05-08T00:00:00.000Z",
  updatedAt: "2026-05-08T00:00:00.000Z",
};

function buildDeps(
  overrides: Partial<AdminUsersRolesNativeRoutesOptions> = {},
): AdminUsersRolesNativeRoutesOptions {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionWithUser: async () => ({
      session: {
        id: 1,
        adminUserId: 1,
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        lastAccess: new Date("2026-05-07T00:00:00.000Z"),
      },
      adminUser: {
        id: 1,
        username: "VETNEB",
      },
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
    changeClinicUserRole:
      async (): Promise<AdminClinicUserRoleChangeResult> => ({
        ok: true,
        user: demoClinicUser,
        previousRole: "clinic_staff",
        roleChanged: true,
      }),
    updateAdminClinicUserCredentials:
      async (): Promise<AdminClinicUserCredentialsUpdateResult> => ({
        ok: true,
        user: demoClinicUser,
        previousUsername: "clinic-owner",
        usernameChanged: false,
        credentialUpdated: false,
      }),
    hashPassword: async (password: string) => `argon:${password.length}`,
    writeAuditLog: async () => {},
    now: () => Date.UTC(2026, 4, 8, 0, 0, 0),
    ...overrides,
  };
}

test("admin users roles requiere sesión admin", async () => {
  const app = Fastify();

  await app.register(
    adminUsersRolesNativeRoutes,
    buildDeps({
      getAdminSessionWithUser: async () => null,
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
          demoClinicUser,
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

test("admin users roles pasa search normalizado (trim) al snapshot", async () => {
  const app = Fastify();
  let receivedParams: AdminUsersRolesQuery | undefined;

  await app.register(
    adminUsersRolesNativeRoutes,
    buildDeps({
      getAdminUsersRolesSnapshot: async (
        params: AdminUsersRolesQuery,
      ): Promise<AdminUsersRolesSnapshot> => {
        receivedParams = params;

        return {
          success: true,
          users: [],
          total: 0,
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
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
      url: `/?search=${encodeURIComponent("  Clínica Demo  ")}`,
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(receivedParams?.search, "Clínica Demo");
  } finally {
    await app.close();
  }
});

test("admin users roles trata search vacío o sólo-espacios como ausente", async () => {
  const app = Fastify();
  let receivedParams: AdminUsersRolesQuery | undefined;

  await app.register(
    adminUsersRolesNativeRoutes,
    buildDeps({
      getAdminUsersRolesSnapshot: async (
        params: AdminUsersRolesQuery,
      ): Promise<AdminUsersRolesSnapshot> => {
        receivedParams = params;

        return {
          success: true,
          users: [],
          total: 0,
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
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
      url: "/?search=%20%20%20",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(receivedParams?.search, undefined);
    assert.ok(!("search" in (receivedParams ?? {})) || receivedParams?.search === undefined);
  } finally {
    await app.close();
  }
});

test("admin users roles compone search con userType y role", async () => {
  const app = Fastify();
  let receivedParams: AdminUsersRolesQuery | undefined;

  await app.register(
    adminUsersRolesNativeRoutes,
    buildDeps({
      getAdminUsersRolesSnapshot: async (
        params: AdminUsersRolesQuery,
      ): Promise<AdminUsersRolesSnapshot> => {
        receivedParams = params;

        return {
          success: true,
          users: [],
          total: 0,
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
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
      url: "/?search=demo&userType=clinic&role=clinic_owner&limit=10&offset=5",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(receivedParams, {
      userType: "clinic",
      role: "clinic_owner",
      search: "demo",
      limit: 10,
      offset: 5,
    });
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

test("admin users roles cambia rol de clinic user y escribe audit log", async () => {
  const app = Fastify();
  const auditWrites: Array<{
    input: {
      event?: string;
      clinicId?: number | null;
      targetClinicUserId?: number | null;
      metadata?: Record<string, unknown>;
    };
  }> = [];

  await app.register(
    adminUsersRolesNativeRoutes,
    buildDeps({
      changeClinicUserRole: async (input) => {
        assert.deepEqual(input, {
          clinicUserId: 2,
          role: "clinic_owner",
          now: new Date("2026-05-08T00:00:00.000Z"),
        });

        return {
          ok: true,
          user: {
            ...demoClinicUser,
            role: "clinic_owner",
          },
          previousRole: "clinic_staff",
          roleChanged: true,
        };
      },
      writeAuditLog: async (_req, input) => {
        auditWrites.push({ input });
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/clinic/2/role",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
      payload: {
        role: "clinic_owner",
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.user.userType, "clinic");
    assert.equal(body.user.userId, 2);
    assert.equal(body.user.role, "clinic_owner");
    assert.deepEqual(body.changedBy, {
      adminUserId: 1,
      username: "VETNEB",
    });
    assert.equal(body.user.passwordHash, undefined);
    assert.equal(body.user.authProId, undefined);
    assert.equal(JSON.stringify(body).includes("password"), false);

    assert.equal(auditWrites.length, 1);
    assert.equal(auditWrites[0].input.event, "clinic_user.role.changed");
    assert.equal(auditWrites[0].input.clinicId, 10);
    assert.equal(auditWrites[0].input.targetClinicUserId, 2);
    assert.deepEqual(auditWrites[0].input.metadata, {
      username: "clinic-owner",
      clinicName: "Clínica Demo",
      previousRole: "clinic_staff",
      newRole: "clinic_owner",
      roleChanged: true,
    });
  } finally {
    await app.close();
  }
});

test("admin users roles rechaza rol inválido en cambio", async () => {
  const app = Fastify();
  let roleChangeCalled = false;

  await app.register(
    adminUsersRolesNativeRoutes,
    buildDeps({
      changeClinicUserRole: async (): Promise<AdminClinicUserRoleChangeResult> => {
        roleChangeCalled = true;

        return {
          ok: true,
          user: demoClinicUser,
          previousRole: "clinic_staff",
          roleChanged: true,
        };
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/clinic/2/role",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
      payload: {
        role: "admin",
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).success, false);
    assert.equal(roleChangeCalled, false);
  } finally {
    await app.close();
  }
});

test("admin users roles no degrada último clinic_owner", async () => {
  const app = Fastify();
  let auditCalled = false;

  await app.register(
    adminUsersRolesNativeRoutes,
    buildDeps({
      changeClinicUserRole: async (): Promise<AdminClinicUserRoleChangeResult> => ({
        ok: false,
        reason: "last_clinic_owner",
      }),
      writeAuditLog: async () => {
        auditCalled = true;
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/clinic/2/role",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
      payload: {
        role: "clinic_staff",
      },
    });

    assert.equal(response.statusCode, 409);
    assert.equal(JSON.parse(response.body).success, false);
    assert.equal(auditCalled, false);
  } finally {
    await app.close();
  }
});

test("admin users roles devuelve 404 si clinic user no existe", async () => {
  const app = Fastify();
  let auditCalled = false;

  await app.register(
    adminUsersRolesNativeRoutes,
    buildDeps({
      changeClinicUserRole: async (): Promise<AdminClinicUserRoleChangeResult> => ({
        ok: false,
        reason: "not_found",
      }),
      writeAuditLog: async () => {
        auditCalled = true;
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/clinic/999/role",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
      payload: {
        role: "clinic_staff",
      },
    });

    assert.equal(response.statusCode, 404);
    assert.equal(JSON.parse(response.body).success, false);
    assert.equal(auditCalled, false);
  } finally {
    await app.close();
  }
});

test("admin users roles cambia username de clínica y audita sin secretos", async () => {
  const app = Fastify();
  const auditWrites: Array<{
    input: {
      event?: string;
      clinicId?: number | null;
      targetClinicUserId?: number | null;
      metadata?: Record<string, unknown>;
    };
  }> = [];

  await app.register(
    adminUsersRolesNativeRoutes,
    buildDeps({
      updateAdminClinicUserCredentials: async (input) => {
        assert.deepEqual(input, {
          clinicUserId: 2,
          username: "nueva-clinica",
          passwordHash: undefined,
          now: new Date("2026-05-08T00:00:00.000Z"),
        });

        return {
          ok: true,
          user: {
            ...demoClinicUser,
            username: "nueva-clinica",
          },
          previousUsername: "clinic-owner",
          usernameChanged: true,
          credentialUpdated: false,
        };
      },
      writeAuditLog: async (_req, input) => {
        auditWrites.push({ input });
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/clinic/2/credentials",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
      payload: {
        username: "nueva-clinica",
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.user.username, "nueva-clinica");
    assert.equal(body.user.passwordHash, undefined);
    assert.equal(JSON.stringify(body).includes("password"), false);
    assert.equal(JSON.stringify(body).includes("argon:"), false);

    assert.equal(auditWrites.length, 1);
    assert.equal(auditWrites[0].input.event, "clinic_user.credentials.updated");
    assert.equal(auditWrites[0].input.clinicId, 10);
    assert.equal(auditWrites[0].input.targetClinicUserId, 2);
    assert.deepEqual(auditWrites[0].input.metadata, {
      previousUsername: "clinic-owner",
      newUsername: "nueva-clinica",
      clinicName: "Clínica Demo",
      usernameChanged: true,
      credentialUpdated: false,
      updatedFields: ["username"],
    });
    assert.equal(JSON.stringify(auditWrites).includes("password"), false);
    assert.equal(JSON.stringify(auditWrites).includes("hash"), false);
  } finally {
    await app.close();
  }
});

test("admin users roles cambia contraseña sin devolver hash ni auditar valor", async () => {
  const app = Fastify();
  const auditWrites: Array<{
    input: {
      event?: string;
      metadata?: Record<string, unknown>;
    };
  }> = [];

  await app.register(
    adminUsersRolesNativeRoutes,
    buildDeps({
      hashPassword: async (password: string) => `argon:${password.length}`,
      updateAdminClinicUserCredentials: async (input) => {
        assert.deepEqual(input, {
          clinicUserId: 2,
          username: undefined,
          passwordHash: "argon:12",
          now: new Date("2026-05-08T00:00:00.000Z"),
        });

        return {
          ok: true,
          user: demoClinicUser,
          previousUsername: "clinic-owner",
          usernameChanged: false,
          credentialUpdated: true,
        };
      },
      writeAuditLog: async (_req, input) => {
        auditWrites.push({ input });
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/clinic/2/credentials",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
      payload: {
        password: "nuevaClave12",
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.user.userId, 2);
    assert.equal(body.user.passwordHash, undefined);
    assert.equal(JSON.stringify(body).includes("nuevaClave12"), false);
    assert.equal(JSON.stringify(body).includes("argon:"), false);

    assert.equal(auditWrites.length, 1);
    assert.equal(auditWrites[0].input.event, "clinic_user.credentials.updated");
    assert.deepEqual(auditWrites[0].input.metadata, {
      previousUsername: "clinic-owner",
      newUsername: "clinic-owner",
      clinicName: "Clínica Demo",
      usernameChanged: false,
      credentialUpdated: true,
      updatedFields: ["accessCredential"],
    });
    assert.equal(JSON.stringify(auditWrites).includes("nuevaClave12"), false);
    assert.equal(JSON.stringify(auditWrites).includes("argon:"), false);
    assert.equal(JSON.stringify(auditWrites).includes("password"), false);
    assert.equal(JSON.stringify(auditWrites).includes("hash"), false);
  } finally {
    await app.close();
  }
});

test("admin users roles devuelve 409 si username de clínica ya existe", async () => {
  const app = Fastify();
  let auditCalled = false;

  await app.register(
    adminUsersRolesNativeRoutes,
    buildDeps({
      updateAdminClinicUserCredentials:
        async (): Promise<AdminClinicUserCredentialsUpdateResult> => ({
          ok: false,
          reason: "username_conflict",
        }),
      writeAuditLog: async () => {
        auditCalled = true;
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/clinic/2/credentials",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
      payload: {
        username: "existente",
      },
    });

    assert.equal(response.statusCode, 409);
    assert.equal(JSON.parse(response.body).success, false);
    assert.equal(auditCalled, false);
  } finally {
    await app.close();
  }
});

test("admin users roles responde preflight OPTIONS para mutaciones", async () => {
  const app = Fastify();
  await app.register(adminUsersRolesNativeRoutes, buildDeps());

  try {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/clinic/2/credentials",
      headers: {
        origin: STAGING_ORIGIN,
        "access-control-request-method": "PATCH",
        "access-control-request-headers": "content-type",
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(
      response.headers["access-control-allow-origin"],
      STAGING_ORIGIN,
    );
    assert.equal(response.headers["access-control-allow-credentials"], "true");
    assert.equal(
      response.headers["access-control-allow-methods"],
      "GET,PATCH,OPTIONS",
    );
  } finally {
    await app.close();
  }
});

test("admin users roles bloquea mutaciones con origin no permitido", async () => {
  const app = Fastify();
  await app.register(adminUsersRolesNativeRoutes, buildDeps());

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/clinic/2/role",
      headers: {
        origin: "https://evil.example",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        role: "clinic_owner",
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
});
