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
const { adminClinicsNativeRoutes } = await import(
  "../../../../server/routes/admin-clinics.fastify.ts"
);

type AdminClinicsNativeRoutesOptions = import(
  "../../../../server/routes/admin-clinics.fastify.ts"
).AdminClinicsNativeRoutesOptions;
type AdminClinicCreateResult = import(
  "../../../../server/features/clinics/admin-clinics-command-service.ts"
).AdminClinicCreateResult;
type AdminClinicSummary = import(
  "../../../../server/features/clinics/admin-clinics-query-service.ts"
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

// C04 server sort contract (admin clinics list): request layer.

type AdminClinicsListCall = Parameters<NonNullable<AdminClinicsNativeRoutesOptions["listAdminClinics"]>>[0];

async function injectClinicsList(
  url: string,
  overrides: Partial<AdminClinicsNativeRoutesOptions> = {},
) {
  const calls: AdminClinicsListCall[] = [];
  const app = Fastify();

  await app.register(
    adminClinicsNativeRoutes,
    buildDeps({
      listAdminClinics: async (params) => {
        calls.push(params);
        return { success: true, clinics: [], total: 7, limit: 3, offset: 3 };
      },
      ...overrides,
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url,
      headers: { cookie: `${ENV.adminCookieName}=admin-session-token` },
    });

    return { response, calls };
  } finally {
    await app.close();
  }
}

test("C04 sort clínicas: sin sort/direction los params del listado son los legacy exactos", async () => {
  const { response, calls } = await injectClinicsList("/?limit=3&offset=3&search=norte");

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [{ limit: 3, offset: 3, search: "norte" }]);
  assert.equal(Object.hasOwn(calls[0] ?? {}, "sort"), false);
});

test("C04 sort clínicas: claves allowlisted en asc/desc llegan tipadas sin tocar search, limit, offset ni payload", async () => {
  const unsorted = await injectClinicsList("/?limit=3&offset=3&search=norte");

  for (const key of ["name", "createdAt"] as const) {
    for (const direction of ["asc", "desc"] as const) {
      const { response, calls } = await injectClinicsList(
        `/?limit=3&offset=3&search=norte&sort=${key}&direction=${direction}`,
      );

      assert.equal(response.statusCode, 200, `${key} ${direction}`);
      assert.deepEqual(calls, [
        { limit: 3, offset: 3, search: "norte", sort: { key, direction } },
      ]);
      assert.equal(response.body, unsorted.response.body, "payload idéntico");
      assert.equal(
        response.headers["content-type"],
        unsorted.response.headers["content-type"],
      );
    }
  }
});

test("C04 sort clínicas: entrada inválida responde 400 explícito y nunca consulta el listado", async () => {
  for (const [query, error] of [
    ["sort=id&direction=asc", "Query inválida. sort no permitido."],
    ["sort=id%20desc&direction=asc", "Query inválida. sort no permitido."],
    ["sort=contactEmail&direction=asc", "Query inválida. sort no permitido."],
    ["sort=created_at&direction=asc", "Query inválida. sort no permitido."],
    ["sort=name%3B%20DROP%20TABLE%20clinics&direction=asc", "Query inválida. sort no permitido."],
    ["sort=constructor&direction=asc", "Query inválida. sort no permitido."],
    ["sort=name&sort=createdAt&direction=asc", "Query inválida. sort no permitido."],
    ["sort=&direction=asc", "Query inválida. sort no permitido."],
    ["sort=name&direction=random", "Query inválida. direction debe ser asc o desc."],
    ["sort=name&direction=ASC", "Query inválida. direction debe ser asc o desc."],
    ["sort=name", "Query inválida. sort y direction deben enviarse juntos."],
    ["direction=desc", "Query inválida. sort y direction deben enviarse juntos."],
  ] as const) {
    const { response, calls } = await injectClinicsList(`/?${query}`);

    assert.equal(response.statusCode, 400, query);
    assert.deepEqual(JSON.parse(response.body), { success: false, error }, query);
    assert.equal(calls.length, 0, query);
  }
});

test("C04 sort clínicas: sin sesión admin el sort no evita el 401 ni consulta", async () => {
  const { response, calls } = await injectClinicsList("/?sort=name&direction=desc", {
    getAdminSessionWithUser: async () => null,
  });

  assert.equal(response.statusCode, 401);
  assert.equal(calls.length, 0);
});

// C04 server sort contract (admin clinics list): query layer. No DB is
// available locally, so the proof evaluates the exact SQL Drizzle emits.

const {
  ADMIN_CLINICS_LIST_ORDER,
  buildAdminClinicsListQuery,
} = await import(
  "../../../../server/features/clinics/infrastructure/admin-clinics-repository.ts"
);
const { ADMIN_CLINICS_SORT_KEYS, ADMIN_CLINICS_SORT_DIRECTIONS } = await import(
  "../../../../server/features/clinics/domain/index.ts"
);

type ClinicsListQueryParams = NonNullable<Parameters<typeof buildAdminClinicsListQuery>[0]>;

const LEGACY_CLINICS_LIST_SQL =
  'select "id", "name", "contact_email", "contact_phone", "created_at", "updated_at" from "clinics" order by "clinics"."name" asc, "clinics"."id" asc limit $1';
const LEGACY_CLINICS_SEARCH_SQL =
  'select "id", "name", "contact_email", "contact_phone", "created_at", "updated_at" from "clinics" where ("clinics"."name" ilike $1 or "clinics"."contact_email" ilike $2) order by "clinics"."name" asc, "clinics"."id" asc limit $3 offset $4';

function clinicsListSql(params: ClinicsListQueryParams) {
  const query = buildAdminClinicsListQuery(params);
  const rows = query.rows.toSQL();
  const match =
    /^(select .+ from "clinics"(?: where .+)?) order by (.+) limit \$(\d+)(?: offset \$(\d+))?$/.exec(
      rows.sql,
    );

  assert.ok(match, `WHERE -> ORDER BY -> LIMIT -> OFFSET en una sola sentencia: ${rows.sql}`);

  const limit = rows.params[Number(match[3]) - 1];
  const offset = match[4] ? rows.params[Number(match[4]) - 1] : 0;

  return {
    sql: rows.sql,
    head: match[1],
    order: match[2] ?? "",
    params: rows.params,
    limit: Number(limit),
    offset: Number(offset),
    total: query.total.toSQL(),
  };
}

type SyntheticClinic = { id: number; name: string; createdAt: number };

const clinicColumns: Record<string, (row: SyntheticClinic) => string | number> = {
  '"clinics"."name"': (row) => row.name,
  '"clinics"."created_at"': (row) => row.createdAt,
  '"clinics"."id"': (row) => row.id,
};

// Applies the emitted ORDER BY and LIMIT/OFFSET the way Postgres does: order
// the whole filtered set first, then slice.
function compareBySql(order: string) {
  const terms = order.split(", ").map((term) => {
    const match = /^(.+) (asc|desc)$/.exec(term);
    assert.ok(match, term);
    const column = clinicColumns[match[1] ?? ""];
    assert.ok(column, `columna no evaluable: ${match[1]}`);
    return { column, sign: match[2] === "asc" ? 1 : -1 };
  });

  return (a: SyntheticClinic, b: SyntheticClinic) => {
    for (const { column, sign } of terms) {
      const left = column(a);
      const right = column(b);
      if (left < right) return -sign;
      if (left > right) return sign;
    }
    return 0;
  };
}

function pageBySql(dataset: SyntheticClinic[], params: ClinicsListQueryParams) {
  const emitted = clinicsListSql(params);
  const ordered = [...dataset].sort(compareBySql(emitted.order));
  return {
    emitted,
    page: ordered.slice(emitted.offset, emitted.offset + emitted.limit),
  };
}

const DAY = 86_400_000;
// Repeated names and repeated creation dates force ties on every sort key.
const syntheticClinics: SyntheticClinic[] = [
  { id: 4, name: "Norte", createdAt: 2 * DAY },
  { id: 1, name: "Centro", createdAt: 1 * DAY },
  { id: 7, name: "Norte", createdAt: 1 * DAY },
  { id: 2, name: "Sur", createdAt: 3 * DAY },
  { id: 6, name: "Centro", createdAt: 2 * DAY },
  { id: 3, name: "Norte", createdAt: 1 * DAY },
  { id: 5, name: "Oeste", createdAt: 3 * DAY },
];

test("C04 sort clínicas: sin sort el SQL es el legacy exacto (default histórico)", () => {
  assert.equal(clinicsListSql({}).sql, LEGACY_CLINICS_LIST_SQL);
  const searched = clinicsListSql({ limit: 3, offset: 3, search: "norte" });
  assert.equal(searched.sql, LEGACY_CLINICS_SEARCH_SQL);
  assert.deepEqual(searched.params, ["%norte%", "%norte%", 3, 3]);
});

test("C04 sort clínicas: cada variante emite un ORDER BY total con desempate id en su dirección", () => {
  const t = '"clinics"';
  const expected: Record<string, string> = {
    "name asc": `${t}."name" asc, ${t}."id" asc`,
    "name desc": `${t}."name" desc, ${t}."id" desc`,
    "createdAt asc": `${t}."created_at" asc, ${t}."id" asc`,
    "createdAt desc": `${t}."created_at" desc, ${t}."id" desc`,
  };

  for (const key of ADMIN_CLINICS_SORT_KEYS) {
    for (const direction of ADMIN_CLINICS_SORT_DIRECTIONS) {
      assert.equal(
        clinicsListSql({ limit: 3, offset: 3, sort: { key, direction } }).order,
        expected[`${key} ${direction}`],
        `${key} ${direction}`,
      );
    }
  }
});

test("C04 sort clínicas: la allowlist del repositorio coincide exactamente con la del dominio", () => {
  assert.deepEqual(Object.keys(ADMIN_CLINICS_LIST_ORDER), [...ADMIN_CLINICS_SORT_KEYS]);
  for (const key of ADMIN_CLINICS_SORT_KEYS) {
    assert.deepEqual(Object.keys(ADMIN_CLINICS_LIST_ORDER[key]), [...ADMIN_CLINICS_SORT_DIRECTIONS]);
  }
});

test("C04 sort clínicas: el orden no cambia filtro, parámetros, limit, offset ni la consulta de total", () => {
  const base = clinicsListSql({ limit: 3, offset: 3, search: "norte" });

  for (const key of ADMIN_CLINICS_SORT_KEYS) {
    for (const direction of ADMIN_CLINICS_SORT_DIRECTIONS) {
      const sorted = clinicsListSql({ limit: 3, offset: 3, search: "norte", sort: { key, direction } });
      assert.equal(sorted.head, base.head, `${key} ${direction}`);
      assert.deepEqual(sorted.params, base.params, `${key} ${direction}`);
      assert.deepEqual(sorted.total, base.total, `${key} ${direction}`);
      assert.equal(sorted.limit, 3);
      assert.equal(sorted.offset, 3);
    }
  }
});

test("C04 sort clínicas: una clave fuera de la allowlist nunca llega al SQL", () => {
  for (const sort of [
    { key: "contactEmail", direction: "asc" },
    { key: "constructor", direction: "asc" },
    { key: "name", direction: "random" },
    { key: "name", direction: "constructor" },
  ]) {
    assert.throws(
      () => buildAdminClinicsListQuery({ sort } as unknown as ClinicsListQueryParams),
      /Orden de clínicas no permitido/,
      JSON.stringify(sort),
    );
  }
});

test("C04 sort clínicas: orden global antes de paginar, total y estable con empates entre páginas", () => {
  const limit = 3;
  const variants: (ClinicsListQueryParams["sort"] | undefined)[] = [undefined];
  for (const key of ADMIN_CLINICS_SORT_KEYS) {
    for (const direction of ADMIN_CLINICS_SORT_DIRECTIONS) {
      variants.push({ key, direction });
    }
  }

  for (const sort of variants) {
    const label = sort ? `${sort.key} ${sort.direction}` : "default";
    const pages = [0, 3, 6].map((offset) =>
      pageBySql(syntheticClinics, { limit, offset, ...(sort ? { sort } : {}) }),
    );
    const compare = compareBySql(pages[0]!.emitted.order);
    const ids = pages.flatMap(({ page }) => page.map((row) => row.id));

    // Membership: the paged walk covers every row exactly once.
    assert.equal(new Set(ids).size, ids.length, `${label}: sin duplicados entre páginas`);
    assert.deepEqual([...ids].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7], `${label}: sin omisiones`);

    // Total order: no two distinct rows compare equal, so every page is deterministic.
    for (const a of syntheticClinics) {
      for (const b of syntheticClinics) {
        if (a.id !== b.id) {
          assert.notEqual(compare(a, b), 0, `${label}: empate sin desempate ${a.id}/${b.id}`);
        }
      }
    }

    // Global order: every row of a later page sorts after every row of an earlier one.
    const walk = pages.flatMap(({ page }) => page);
    for (let index = 1; index < walk.length; index += 1) {
      assert.ok(compare(walk[index - 1]!, walk[index]!) < 0, `${label}: orden global en ${index}`);
    }
  }

  // createdAt desc, id desc: 5,2 | 6,4 | 7,3,1 -> rows 4..6 of the global order.
  const second = pageBySql(syntheticClinics, {
    limit,
    offset: 3,
    sort: { key: "createdAt", direction: "desc" },
  });
  assert.deepEqual(second.page.map((row) => row.id), [4, 7, 3]);
  const nameDesc = pageBySql(syntheticClinics, { limit, offset: 0, sort: { key: "name", direction: "desc" } });
  assert.deepEqual(nameDesc.page.map((row) => row.id), [2, 5, 7]);
  const legacy = pageBySql(syntheticClinics, { limit, offset: 0 });
  assert.deepEqual(legacy.page.map((row) => row.id), [1, 6, 3]);
});
