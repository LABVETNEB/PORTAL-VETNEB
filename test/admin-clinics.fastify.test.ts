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

const { ENV } = await import("../server/lib/env.ts");
const { adminClinicsNativeRoutes } = await import(
  "../server/routes/admin-clinics.fastify.ts"
);

type AdminClinicsNativeRoutesOptions = import(
  "../server/routes/admin-clinics.fastify.ts"
).AdminClinicsNativeRoutesOptions;
type AdminClinicCreateResult = import(
  "../server/db-admin-clinics.ts"
).AdminClinicCreateResult;
type AdminClinicSummary = import(
  "../server/db-admin-clinics.ts"
).AdminClinicSummary;

const demoClinic: AdminClinicSummary = {
  clinicId: 10,
  clinicName: "Clínica Demo",
  contactEmail: "demo@clinic.test",
  contactPhone: "1144556677",
  createdAt: "2026-05-08T00:00:00.000Z",
  updatedAt: "2026-05-08T00:00:00.000Z",
};

const demoClinicUser = {
  userType: "clinic" as const,
  userId: 2,
  username: "clinic-owner",
  role: "clinic_owner" as const,
  clinicId: 10,
  clinicName: "Clínica Demo",
  createdAt: "2026-05-08T00:00:00.000Z",
  updatedAt: "2026-05-08T00:00:00.000Z",
};

const STAGING_ORIGIN = "https://portal-vetneb-frontend-staging.onrender.com";

function buildDeps(
  overrides: Partial<AdminClinicsNativeRoutesOptions> = {},
): AdminClinicsNativeRoutesOptions {
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
    hashPassword: async (password: string) => `argon:${password.length}`,
    listAdminClinics: async () => ({
      success: true,
      clinics: [
        {
          ...demoClinic,
          users: [demoClinicUser],
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    }),
    createAdminClinicWithUser: async (): Promise<AdminClinicCreateResult> => ({
      ok: true,
      clinic: demoClinic,
      user: demoClinicUser,
    }),
    getAdminClinicById: async () => demoClinic,
    updateAdminClinic: async () => demoClinic,
    deleteAdminClinic: async () => demoClinic,
    writeAuditLog: async () => {},
    now: () => Date.UTC(2026, 4, 8, 0, 0, 0),
    ...overrides,
  };
}

test("admin clinics requiere sesión admin", async () => {
  const app = Fastify();

  await app.register(
    adminClinicsNativeRoutes,
    buildDeps({
      getAdminSessionWithUser: async () => null,
    }),
  );

  try {
    const response = await app.inject({
      method: "POST",
      url: "/",
      headers: {
        origin: STAGING_ORIGIN,
      },
      payload: {},
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

test("admin clinics responde preflight OPTIONS para frontend staging", async () => {
  const app = Fastify();

  await app.register(adminClinicsNativeRoutes, buildDeps());

  try {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/",
      headers: {
        origin: STAGING_ORIGIN,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.body, "");
    assert.equal(
      response.headers["access-control-allow-origin"],
      STAGING_ORIGIN,
    );
    assert.equal(response.headers["access-control-allow-credentials"], "true");
    assert.equal(
      response.headers["access-control-allow-methods"],
      "GET,POST,PATCH,DELETE,OPTIONS",
    );
    assert.equal(
      response.headers["access-control-allow-headers"],
      "content-type",
    );
    assert.equal(response.headers["set-cookie"], undefined);
  } finally {
    await app.close();
  }
});

test("admin clinics lista clínicas y usuarios sanitizados", async () => {
  const app = Fastify();

  await app.register(adminClinicsNativeRoutes, buildDeps());

  try {
    const response = await app.inject({
      method: "GET",
      url: "/?limit=25&offset=0",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.clinics[0].clinicName, "Clínica Demo");
    assert.equal(body.clinics[0].users[0].username, "clinic-owner");
    assert.equal(body.clinics[0].users[0].passwordHash, undefined);
    assert.equal(JSON.stringify(body).includes("password"), false);
    assert.equal(JSON.stringify(body).includes("argon:"), false);
  } finally {
    await app.close();
  }
});

test("admin clinics crea clínica y usuario sin role visible con default owner y respuesta sanitizada", async () => {
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
    adminClinicsNativeRoutes,
    buildDeps({
      createAdminClinicWithUser: async (input) => {
        assert.deepEqual(input, {
          clinicName: "Clínica Demo",
          contactEmail: "demo@clinic.test",
          contactPhone: "1144556677",
          username: "clinic-owner",
          passwordHash: "argon:12",
          role: "clinic_owner",
          now: new Date("2026-05-08T00:00:00.000Z"),
        });

        return {
          ok: true,
          clinic: demoClinic,
          user: demoClinicUser,
        };
      },
      writeAuditLog: async (_req, input) => {
        auditWrites.push({ input });
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "POST",
      url: "/",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        origin: STAGING_ORIGIN,
      },
      payload: {
        clinicName: "Clínica Demo",
        contactEmail: "demo@clinic.test",
        contactPhone: "1144556677",
        username: "clinic-owner",
        password: "claveSegura1",
      },
    });

    assert.equal(response.statusCode, 201);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.clinic.clinicName, "Clínica Demo");
    assert.equal(body.user.username, "clinic-owner");
    assert.equal(body.user.passwordHash, undefined);
    assert.equal(body.user.password_hash, undefined);
    assert.equal(JSON.stringify(body).includes("claveSegura1"), false);
    assert.equal(JSON.stringify(body).includes("argon:"), false);
    assert.equal(JSON.stringify(body).includes("password_hash"), false);

    assert.equal(auditWrites.length, 2);
    assert.equal(auditWrites[0].input.event, "clinic.created");
    assert.equal(auditWrites[1].input.event, "clinic_user.created");
    assert.equal(JSON.stringify(auditWrites).includes("claveSegura1"), false);
    assert.equal(JSON.stringify(auditWrites).includes("argon:"), false);
    assert.equal(JSON.stringify(auditWrites).includes("password"), false);
    assert.equal(JSON.stringify(auditWrites).includes("password_hash"), false);
    assert.equal(JSON.stringify(auditWrites).includes("hash"), false);
  } finally {
    await app.close();
  }
});

test("admin clinics devuelve 409 al crear usuario duplicado", async () => {
  const app = Fastify();
  let auditCalled = false;

  await app.register(
    adminClinicsNativeRoutes,
    buildDeps({
      createAdminClinicWithUser:
        async (): Promise<AdminClinicCreateResult> => ({
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
      method: "POST",
      url: "/",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        origin: STAGING_ORIGIN,
      },
      payload: {
        clinicName: "Clínica Demo",
        contactEmail: "demo@clinic.test",
        username: "clinic-owner",
        password: "claveSegura1",
      },
    });

    assert.equal(response.statusCode, 409);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "El usuario de acceso ya existe.",
    });
    assert.equal(auditCalled, false);
  } finally {
    await app.close();
  }
});

test("admin clinics devuelve 500 operativo cuando create falla por incompatibilidad de esquema (23502)", async () => {
  const app = Fastify();
  let auditCalled = false;

  await app.register(
    adminClinicsNativeRoutes,
    buildDeps({
      createAdminClinicWithUser: async () => {
        throw {
          name: "PostgresError",
          code: "23502",
          constraint_name: "clinics_clinic_id_not_null",
          column_name: "clinic_id",
        };
      },
      writeAuditLog: async () => {
        auditCalled = true;
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "POST",
      url: "/",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        origin: STAGING_ORIGIN,
      },
      payload: {
        clinicName: "Clínica Demo",
        contactEmail: "demo@clinic.test",
        username: "clinic-owner",
        password: "claveSegura1",
      },
    });

    assert.equal(response.statusCode, 500);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error:
        "No se pudo crear la clínica por incompatibilidad de esquema de base de datos.",
    });
    assert.equal(auditCalled, false);
    assert.equal(response.body.includes("claveSegura1"), false);
    assert.equal(response.body.toLowerCase().includes("password"), false);
    assert.equal(response.body.toLowerCase().includes("password_hash"), false);
    assert.equal(response.body.toLowerCase().includes("token"), false);
  } finally {
    await app.close();
  }
});

test("admin clinics cambia datos básicos de clínica y audita", async () => {
  const app = Fastify();
  const auditWrites: Array<{
    input: {
      event?: string;
      clinicId?: number | null;
      metadata?: Record<string, unknown>;
    };
  }> = [];

  await app.register(
    adminClinicsNativeRoutes,
    buildDeps({
      updateAdminClinic: async (input) => {
        assert.deepEqual(input, {
          clinicId: 10,
          clinicName: "Clínica Nueva",
          contactEmail: "nueva@clinic.test",
          contactPhone: null,
          now: new Date("2026-05-08T00:00:00.000Z"),
        });

        return {
          ...demoClinic,
          clinicName: "Clínica Nueva",
          contactEmail: "nueva@clinic.test",
          contactPhone: null,
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
      url: "/10",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        origin: STAGING_ORIGIN,
      },
      payload: {
        clinicName: "Clínica Nueva",
        contactEmail: "nueva@clinic.test",
        contactPhone: "",
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.clinic.clinicName, "Clínica Nueva");
    assert.equal(body.clinic.passwordHash, undefined);
    assert.equal(JSON.stringify(body).includes("password"), false);

    assert.equal(auditWrites.length, 1);
    assert.equal(auditWrites[0].input.event, "clinic.updated");
    assert.equal(auditWrites[0].input.clinicId, 10);
    assert.deepEqual(auditWrites[0].input.metadata, {
      clinicName: "Clínica Nueva",
      contactEmail: "nueva@clinic.test",
      contactPhone: null,
      updatedFields: ["clinicName", "contactEmail", "contactPhone"],
    });
    assert.equal(JSON.stringify(auditWrites).includes("password"), false);
    assert.equal(JSON.stringify(auditWrites).includes("hash"), false);
  } finally {
    await app.close();
  }
});

test("admin clinics elimina clínica con confirmación exacta y audita evento seguro", async () => {
  const app = Fastify();
  const auditWrites: Array<{ input: { event?: string; clinicId?: number | null } }> =
    [];
  const deleteCalls: Array<{ clinicId: number }> = [];

  await app.register(
    adminClinicsNativeRoutes,
    buildDeps({
      getAdminClinicById: async (clinicId) =>
        clinicId === 10 ? { ...demoClinic, clinicId } : null,
      deleteAdminClinic: async (input) => {
        deleteCalls.push(input);
        return { ...demoClinic, clinicId: input.clinicId };
      },
      writeAuditLog: async (_req, input) => {
        auditWrites.push({ input });
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "DELETE",
      url: "/10",
      headers: {
        origin: STAGING_ORIGIN,
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        confirmClinicName: "Clínica Demo",
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.clinic.clinicId, 10);
    assert.equal(body.message, "Clínica eliminada definitivamente.");
    assert.equal(body.clinic.passwordHash, undefined);
    assert.equal(body.clinic.password_hash, undefined);
    assert.equal(JSON.stringify(body).includes("password"), false);
    assert.equal(JSON.stringify(body).includes("password_hash"), false);
    assert.equal(JSON.stringify(body).includes("token"), false);
    assert.deepEqual(deleteCalls, [{ clinicId: 10 }]);
    assert.equal(auditWrites.length, 1);
    assert.equal(auditWrites[0].input.event, "clinic.deleted");
    assert.equal(auditWrites[0].input.clinicId, 10);
  } finally {
    await app.close();
  }
});

test("admin clinics delete exige confirmación exacta y trusted origin", async () => {
  const app = Fastify();
  let deleteCalled = false;

  await app.register(
    adminClinicsNativeRoutes,
    buildDeps({
      deleteAdminClinic: async () => {
        deleteCalled = true;
        return demoClinic;
      },
    }),
  );

  try {
    const mismatchResponse = await app.inject({
      method: "DELETE",
      url: "/10",
      headers: {
        origin: STAGING_ORIGIN,
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        confirmClinicName: "Otra clínica",
      },
    });

    assert.equal(mismatchResponse.statusCode, 400);
    assert.deepEqual(JSON.parse(mismatchResponse.body), {
      success: false,
      error: "La confirmación no coincide con el nombre exacto de la clínica.",
    });
    assert.equal(deleteCalled, false);

    const forbiddenOriginResponse = await app.inject({
      method: "DELETE",
      url: "/10",
      headers: {
        origin: "https://evil.example",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        confirmClinicName: "Clínica Demo",
      },
    });

    assert.equal(forbiddenOriginResponse.statusCode, 403);
    assert.deepEqual(JSON.parse(forbiddenOriginResponse.body), {
      success: false,
      error: "Origen no permitido",
    });
    assert.equal(deleteCalled, false);
  } finally {
    await app.close();
  }
});

test("admin clinics delete mapea 23503 a 409 operativo y evita 500 genérico", async () => {
  const app = Fastify();
  let auditCalled = false;

  await app.register(
    adminClinicsNativeRoutes,
    buildDeps({
      getAdminClinicById: async () => demoClinic,
      deleteAdminClinic: async () => {
        throw {
          name: "PostgresError",
          code: "23503",
          constraint_name: "report_access_tokens_clinic_id_fkey",
        };
      },
      writeAuditLog: async () => {
        auditCalled = true;
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "DELETE",
      url: "/10",
      headers: {
        origin: STAGING_ORIGIN,
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        confirmClinicName: "Clínica Demo",
      },
    });

    assert.equal(response.statusCode, 409);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error:
        "No se pudo eliminar la clínica porque tiene dependencias activas. Revise informes, tokens o sesiones asociados.",
    });
    assert.equal(auditCalled, false);
    assert.equal(response.body.toLowerCase().includes("password"), false);
    assert.equal(response.body.toLowerCase().includes("password_hash"), false);
    assert.equal(response.body.toLowerCase().includes("hash"), false);
  } finally {
    await app.close();
  }
});

test("admin clinics GET reenvía parámetro search al listado", async () => {
  const app = Fastify();
  let receivedParams: { limit?: number; offset?: number; search?: string } = {};

  await app.register(
    adminClinicsNativeRoutes,
    buildDeps({
      listAdminClinics: async (params) => {
        receivedParams = params;
        return { success: true, clinics: [], total: 0, limit: params.limit ?? 50, offset: params.offset ?? 0 };
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/?limit=50&offset=0&search=demo",
      headers: { cookie: `${ENV.adminCookieName}=admin-session-token` },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(receivedParams.search, "demo");
    assert.equal(receivedParams.limit, 50);
    assert.equal(receivedParams.offset, 0);
  } finally {
    await app.close();
  }
});

test("admin clinics GET sin search no envía el campo al listado", async () => {
  const app = Fastify();
  let receivedParams: { limit?: number; offset?: number; search?: string } = {};

  await app.register(
    adminClinicsNativeRoutes,
    buildDeps({
      listAdminClinics: async (params) => {
        receivedParams = params;
        return { success: true, clinics: [], total: 0, limit: params.limit ?? 50, offset: params.offset ?? 0 };
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/?limit=50&offset=0",
      headers: { cookie: `${ENV.adminCookieName}=admin-session-token` },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(receivedParams.search, undefined);
  } finally {
    await app.close();
  }
});

test("admin clinics GET search vacío no envía el campo al listado", async () => {
  const app = Fastify();
  let receivedParams: { limit?: number; offset?: number; search?: string } = {};

  await app.register(
    adminClinicsNativeRoutes,
    buildDeps({
      listAdminClinics: async (params) => {
        receivedParams = params;
        return { success: true, clinics: [], total: 0, limit: params.limit ?? 50, offset: params.offset ?? 0 };
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/?search=   ",
      headers: { cookie: `${ENV.adminCookieName}=admin-session-token` },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(receivedParams.search, undefined);
  } finally {
    await app.close();
  }
});

test("admin clinics GET trunca search a 100 caracteres", async () => {
  const app = Fastify();
  let receivedSearch: string | undefined;

  await app.register(
    adminClinicsNativeRoutes,
    buildDeps({
      listAdminClinics: async (params) => {
        receivedSearch = params.search;
        return { success: true, clinics: [], total: 0, limit: params.limit ?? 50, offset: params.offset ?? 0 };
      },
    }),
  );

  try {
    const longSearch = "a".repeat(200);
    const response = await app.inject({
      method: "GET",
      url: `/?search=${longSearch}`,
      headers: { cookie: `${ENV.adminCookieName}=admin-session-token` },
    });

    assert.equal(response.statusCode, 200);
    assert.ok(receivedSearch !== undefined);
    assert.equal((receivedSearch as string).length, 100);
  } finally {
    await app.close();
  }
});

test("admin clinics no falla si la auditoría de delete falla después de persistir", async () => {
  const app = Fastify();
  let deleteCalled = false;

  await app.register(
    adminClinicsNativeRoutes,
    buildDeps({
      deleteAdminClinic: async () => {
        deleteCalled = true;
        return demoClinic;
      },
      writeAuditLog: async () => {
        throw new Error("audit unavailable");
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "DELETE",
      url: "/10",
      headers: {
        origin: STAGING_ORIGIN,
        cookie: `${ENV.adminCookieName}=admin-session-token`,
        "content-type": "application/json",
      },
      payload: {
        confirmClinicName: "Clínica Demo",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(deleteCalled, true);
    assert.equal(JSON.parse(response.body).success, true);
  } finally {
    await app.close();
  }
});
