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
const { AUDIT_EVENTS } = await import("../server/lib/audit.ts");
const {
  LOGIN_RATE_LIMIT_ERROR_MESSAGE,
} = await import("../server/lib/login-rate-limit.ts");
const {
  createPersistentRateLimitStore,
  hashRateLimitKey,
} = await import("../server/lib/rate-limit-store.ts");
const {
  getClinicPermissions,
} = await import("../server/lib/permissions.ts");
const {
  clinicAuthNativeRoutes,
} = await import("../server/routes/auth.fastify.ts");

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(clinicAuthNativeRoutes as any, {
    prefix: "/api/auth",
    createActiveSession: async () => {},
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    getClinicUserByUsername: async () => null,
    updateSessionLastAccess: async () => {},
    upsertClinicUser: async () => {},
    generateSessionToken: () => "session-token",
    hashPassword: async () => "rehash-password",
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: async () => ({
      valid: false,
      needsRehash: false,
    }),
    createAdminSession: async () => {},
    getAdminUserByUsername: async () => null,
    writeAdminAuditLog: async () => {},
    createParticularSession: async () => {},
    getParticularTokenByTokenHash: async () => null,
    updateParticularTokenLastLogin: async () => {},
    writeAuditLog: async () => {},
    recordLoginFailedAttempt: async () => {},
    ...overrides,
  });

  return app;
}

type PersistentRateLimitRow = {
  count: number;
  resetAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

function createPersistentRateLimitStoreHarness(input?: {
  rows?: Map<string, PersistentRateLimitRow>;
  now?: () => number;
}) {
  const rows = input?.rows ?? new Map<string, PersistentRateLimitRow>();

  const store = createPersistentRateLimitStore(
    {
      get: async (keyHash) => rows.get(keyHash),
      set: async ({ keyHash, count, resetAt, now }) => {
        const existing = rows.get(keyHash);
        const row = {
          count,
          resetAt,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };

        rows.set(keyHash, row);

        return row;
      },
      increment: async ({ keyHash, count, resetAt, now }) => {
        const existing = rows.get(keyHash);
        const row =
          !existing || existing.resetAt.getTime() <= now.getTime()
            ? {
                count,
                resetAt,
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
              }
            : {
                ...existing,
                count: existing.count + 1,
                updatedAt: now,
              };

        rows.set(keyHash, row);

        return row;
      },
      cleanupExpired: async (now) => {
        for (const [keyHash, row] of rows) {
          if (row.resetAt.getTime() < now.getTime()) {
            rows.delete(keyHash);
          }
        }
      },
    },
    {
      now: input?.now,
    },
  );

  return { rows, store };
}

function getSetCookieHeader(response: { headers: Record<string, unknown> }) {
  const raw = response.headers["set-cookie"];

  if (Array.isArray(raw)) {
    return raw.join("\n");
  }

  return typeof raw === "string" ? raw : "";
}

test(
  "clinicAuthNativeRoutes login exitoso conserva payload, cookie y auditoria",
  async () => {
    const sessionCalls: Array<{
      clinicUserId: number;
      tokenHash: string;
      expiresAt: Date;
    }> = [];
    const auditCalls: Array<Record<string, unknown>> = [];

    const app = await createTestApp({
      now: () => 0,
      getClinicUserByUsername: async (username: string) => {
        assert.equal(username, "vetneb");

        return {
          id: 7,
          clinicId: 3,
          username: "vetneb",
          passwordHash: "stored-hash",
          authProId: "AUTH-9",
          role: "clinic_owner",
        };
      },
      verifyPassword: async (password: string, passwordHash: string) => {
        assert.equal(password, "secret");
        assert.equal(passwordHash, "stored-hash");

        return {
          valid: true,
          needsRehash: false,
        };
      },
      generateSessionToken: () => "token-123",
      hashSessionToken: (token: string) => `hash:${token}`,
      createActiveSession: async (input: {
        clinicUserId: number;
        tokenHash: string;
        expiresAt: Date;
      }) => {
        sessionCalls.push(input);
      },
      writeAuditLog: async (_req: unknown, input: Record<string, unknown>) => {
        auditCalls.push(input);
      },
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        payload: {
          username: " vetneb ",
          password: "secret",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(
        response.headers["access-control-allow-origin"],
        "http://localhost:3000",
      );
      assert.equal(response.headers["access-control-allow-credentials"], "true");

      const setCookie = getSetCookieHeader(response);
      assert.ok(setCookie.includes(`${ENV.cookieName}=token-123`));
      assert.ok(setCookie.includes("Path=/"));
      assert.ok(setCookie.includes("HttpOnly"));

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        clinicUser: {
          id: 7,
          clinicId: 3,
          username: "vetneb",
          authProId: "AUTH-9",
          role: "clinic_owner",
        },
        permissions: getClinicPermissions("clinic_owner"),
      });

      assert.equal(sessionCalls.length, 1);
      assert.equal(sessionCalls[0].clinicUserId, 7);
      assert.equal(sessionCalls[0].tokenHash, "hash:token-123");
      assert.equal(
        sessionCalls[0].expiresAt.getTime(),
        ENV.sessionTtlHours * 60 * 60 * 1000,
      );

      assert.equal(auditCalls.length, 1);
      assert.equal(auditCalls[0].event, AUDIT_EVENTS.CLINIC_LOGIN_SUCCEEDED);
      assert.equal(auditCalls[0].clinicId, 3);
      assert.equal(auditCalls[0].targetClinicUserId, 7);
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicAuthNativeRoutes login unificado autentica admin y crea cookie admin",
  async () => {
    const adminSessionCalls: Array<{
      adminUserId: number;
      tokenHash: string;
      expiresAt: Date;
    }> = [];

    const app = await createTestApp({
      now: () => 0,
      getAdminUserByUsername: async (username: string) => {
        assert.equal(username, "admin@vetneb");

        return {
          id: 101,
          username: "admin@vetneb",
          passwordHash: "admin-hash",
        };
      },
      getClinicUserByUsername: async () => {
        throw new Error("no debe evaluar clinic cuando admin autenticó");
      },
      verifyPassword: async (password: string, passwordHash: string) => {
        assert.equal(password, "secret");
        assert.equal(passwordHash, "admin-hash");

        return {
          valid: true,
          needsRehash: false,
        };
      },
      generateSessionToken: () => "admin-token-123",
      hashSessionToken: (token: string) => `hash:${token}`,
      createAdminSession: async (input: {
        adminUserId: number;
        tokenHash: string;
        expiresAt: Date;
      }) => {
        adminSessionCalls.push(input);
      },
      writeAdminAuditLog: async () => {},
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        payload: {
          identifier: " admin@vetneb ",
          password: "secret",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        role: "admin",
        redirectTo: "/dashboard/admin",
      });

      const setCookie = getSetCookieHeader(response);
      assert.ok(setCookie.includes(`${ENV.adminCookieName}=admin-token-123`));
      assert.equal(setCookie.includes(`${ENV.cookieName}=`), false);
      assert.equal(setCookie.includes(`${ENV.particularCookieName}=`), false);

      assert.equal(adminSessionCalls.length, 1);
      assert.equal(adminSessionCalls[0].adminUserId, 101);
      assert.equal(adminSessionCalls[0].tokenHash, "hash:admin-token-123");
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicAuthNativeRoutes login unificado autentica admin VETNEB y mantiene cookie admin exclusiva",
  async () => {
    const adminSessionCalls: Array<{
      adminUserId: number;
      tokenHash: string;
      expiresAt: Date;
    }> = [];

    const app = await createTestApp({
      now: () => 0,
      getAdminUserByUsername: async (username: string) => {
        assert.equal(username, "VETNEB");

        return {
          id: 109,
          username: "VETNEB",
          passwordHash: "admin-hash",
        };
      },
      getClinicUserByUsername: async () => {
        throw new Error("no debe evaluar clinic cuando admin autenticó");
      },
      verifyPassword: async (password: string, passwordHash: string) => {
        assert.equal(password, "secret");
        assert.equal(passwordHash, "admin-hash");

        return {
          valid: true,
          needsRehash: false,
        };
      },
      generateSessionToken: () => "admin-vetneb-token",
      hashSessionToken: (token: string) => `hash:${token}`,
      createAdminSession: async (input: {
        adminUserId: number;
        tokenHash: string;
        expiresAt: Date;
      }) => {
        adminSessionCalls.push(input);
      },
      writeAdminAuditLog: async () => {},
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        payload: {
          identifier: "VETNEB",
          password: "secret",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        role: "admin",
        redirectTo: "/dashboard/admin",
      });

      const setCookie = getSetCookieHeader(response);
      assert.ok(setCookie.includes(`${ENV.adminCookieName}=admin-vetneb-token`));
      assert.equal(setCookie.includes(`${ENV.cookieName}=`), false);
      assert.equal(setCookie.includes(`${ENV.particularCookieName}=`), false);

      assert.equal(adminSessionCalls.length, 1);
      assert.equal(adminSessionCalls[0].adminUserId, 109);
      assert.equal(adminSessionCalls[0].tokenHash, "hash:admin-vetneb-token");
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicAuthNativeRoutes login unificado autentica admin por email registrado",
  async () => {
    const adminSessionCalls: Array<{
      adminUserId: number;
      tokenHash: string;
      expiresAt: Date;
    }> = [];
    let adminUsernameLookupCalls = 0;

    const app = await createTestApp({
      now: () => 0,
      getAdminUserByUsername: async () => {
        adminUsernameLookupCalls += 1;
        return null;
      },
      getAdminUserByIdentifier: async (identifier: string) => {
        assert.equal(identifier, "Admin.Fixture@VetNEB.test");

        return {
          id: 205,
          username: "VETNEB",
          email: "admin.fixture@vetneb.test",
          passwordHash: "admin-hash",
        };
      },
      getClinicUserByIdentifier: async () => {
        throw new Error("no debe evaluar clinic cuando admin autenticó");
      },
      verifyPassword: async (password: string, passwordHash: string) => {
        assert.equal(password, "secret");
        assert.equal(passwordHash, "admin-hash");

        return {
          valid: true,
          needsRehash: false,
        };
      },
      generateSessionToken: () => "admin-email-token",
      hashSessionToken: (token: string) => `hash:${token}`,
      createAdminSession: async (input: {
        adminUserId: number;
        tokenHash: string;
        expiresAt: Date;
      }) => {
        adminSessionCalls.push(input);
      },
      writeAdminAuditLog: async () => {},
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        payload: {
          identifier: "  Admin.Fixture@VetNEB.test  ",
          password: "secret",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        role: "admin",
        redirectTo: "/dashboard/admin",
      });

      const setCookie = getSetCookieHeader(response);
      assert.ok(setCookie.includes(`${ENV.adminCookieName}=admin-email-token`));
      assert.equal(setCookie.includes(`${ENV.cookieName}=`), false);
      assert.equal(setCookie.includes(`${ENV.particularCookieName}=`), false);

      assert.equal(adminSessionCalls.length, 1);
      assert.equal(adminSessionCalls[0].adminUserId, 205);
      assert.equal(adminSessionCalls[0].tokenHash, "hash:admin-email-token");
      assert.equal(adminUsernameLookupCalls, 0);
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicAuthNativeRoutes login unificado autentica clínica y crea cookie app_session_id",
  async () => {
    const clinicSessionCalls: Array<{
      clinicUserId: number;
      tokenHash: string;
      expiresAt: Date;
    }> = [];

    const app = await createTestApp({
      now: () => 0,
      getAdminUserByUsername: async () => null,
      getClinicUserByUsername: async (username: string) => {
        assert.equal(username, "clinica@vetneb");

        return {
          id: 77,
          clinicId: 9,
          username: "clinica@vetneb",
          passwordHash: "clinic-hash",
          authProId: null,
          role: "clinic_staff",
        };
      },
      verifyPassword: async (password: string, passwordHash: string) => {
        assert.equal(password, "secret");
        assert.equal(passwordHash, "clinic-hash");

        return {
          valid: true,
          needsRehash: false,
        };
      },
      generateSessionToken: () => "clinic-token-123",
      hashSessionToken: (token: string) => `hash:${token}`,
      createActiveSession: async (input: {
        clinicUserId: number;
        tokenHash: string;
        expiresAt: Date;
      }) => {
        clinicSessionCalls.push(input);
      },
      writeAuditLog: async () => {},
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        payload: {
          identifier: "clinica@vetneb",
          password: "secret",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        role: "clinic",
        redirectTo: "/dashboard",
      });

      const setCookie = getSetCookieHeader(response);
      assert.ok(setCookie.includes(`${ENV.cookieName}=clinic-token-123`));
      assert.equal(setCookie.includes(`${ENV.adminCookieName}=`), false);
      assert.equal(setCookie.includes(`${ENV.particularCookieName}=`), false);

      assert.equal(clinicSessionCalls.length, 1);
      assert.equal(clinicSessionCalls[0].clinicUserId, 77);
      assert.equal(clinicSessionCalls[0].tokenHash, "hash:clinic-token-123");
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicAuthNativeRoutes login unificado autentica clínica por email asociado",
  async () => {
    const clinicSessionCalls: Array<{
      clinicUserId: number;
      tokenHash: string;
      expiresAt: Date;
    }> = [];
    let clinicUsernameLookupCalls = 0;

    const app = await createTestApp({
      now: () => 0,
      getAdminUserByIdentifier: async () => null,
      getClinicUserByUsername: async () => {
        clinicUsernameLookupCalls += 1;
        return null;
      },
      getClinicUserByIdentifier: async (identifier: string) => {
        assert.equal(identifier, "Clinica@VetNEB.com");

        return {
          id: 78,
          clinicId: 11,
          username: "clinica-owner",
          passwordHash: "clinic-hash",
          authProId: null,
          role: "clinic_owner",
        };
      },
      verifyPassword: async (password: string, passwordHash: string) => {
        assert.equal(password, "secret");
        assert.equal(passwordHash, "clinic-hash");

        return {
          valid: true,
          needsRehash: false,
        };
      },
      generateSessionToken: () => "clinic-email-token",
      hashSessionToken: (token: string) => `hash:${token}`,
      createActiveSession: async (input: {
        clinicUserId: number;
        tokenHash: string;
        expiresAt: Date;
      }) => {
        clinicSessionCalls.push(input);
      },
      writeAuditLog: async () => {},
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        payload: {
          identifier: "  Clinica@VetNEB.com  ",
          password: "secret",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        role: "clinic",
        redirectTo: "/dashboard",
      });

      const setCookie = getSetCookieHeader(response);
      assert.ok(setCookie.includes(`${ENV.cookieName}=clinic-email-token`));
      assert.equal(setCookie.includes(`${ENV.adminCookieName}=`), false);
      assert.equal(setCookie.includes(`${ENV.particularCookieName}=`), false);

      assert.equal(clinicSessionCalls.length, 1);
      assert.equal(clinicSessionCalls[0].clinicUserId, 78);
      assert.equal(clinicSessionCalls[0].tokenHash, "hash:clinic-email-token");
      assert.equal(clinicUsernameLookupCalls, 0);
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicAuthNativeRoutes login unificado autentica particular y crea cookie particular_session_id",
  async () => {
    const particularSessionCalls: Array<{
      particularTokenId: number;
      tokenHash: string;
      lastAccess: Date;
      expiresAt: Date;
    }> = [];
    const lastLoginCalls: number[] = [];

    const app = await createTestApp({
      now: () => Date.UTC(2026, 4, 9, 0, 0, 0),
      getAdminUserByUsername: async () => null,
      getClinicUserByUsername: async () => null,
      getParticularTokenByTokenHash: async (tokenHash: string) => {
        assert.equal(tokenHash, "hash:PARTICULAR-TOKEN-1");

        return {
          id: 501,
          clinicId: 7,
          reportId: 301,
          isActive: true,
        };
      },
      generateSessionToken: () => "particular-session-123",
      hashSessionToken: (token: string) => `hash:${token}`,
      createParticularSession: async (input: {
        particularTokenId: number;
        tokenHash: string;
        lastAccess: Date;
        expiresAt: Date;
      }) => {
        particularSessionCalls.push(input);
      },
      updateParticularTokenLastLogin: async (tokenId: number) => {
        lastLoginCalls.push(tokenId);
      },
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        payload: {
          identifier: "PARTICULAR-TOKEN-1",
          password: "PARTICULAR-TOKEN-1",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        role: "particular",
        redirectTo: "/particulares",
      });

      const setCookie = getSetCookieHeader(response);
      assert.ok(
        setCookie.includes(`${ENV.particularCookieName}=particular-session-123`),
      );
      assert.equal(setCookie.includes(`${ENV.cookieName}=`), false);
      assert.equal(setCookie.includes(`${ENV.adminCookieName}=`), false);

      assert.equal(particularSessionCalls.length, 1);
      assert.equal(particularSessionCalls[0].particularTokenId, 501);
      assert.equal(
        particularSessionCalls[0].tokenHash,
        "hash:particular-session-123",
      );
      assert.deepEqual(lastLoginCalls, [501]);
    } finally {
      await app.close();
    }
  },
);

test("clinicAuthNativeRoutes login unificado responde error genérico para credenciales inválidas", async () => {
  const app = await createTestApp({
    getAdminUserByUsername: async () => null,
    getClinicUserByUsername: async () => null,
    getParticularTokenByTokenHash: async () => null,
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        identifier: "desconocido",
        password: "incorrecta",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Credenciales inválidas",
    });
  } finally {
    await app.close();
  }
});

test("clinicAuthNativeRoutes login unificado valida payload inválido sin stacktrace", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        identifier: " ",
        password: "",
      },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Identificador y contraseña requeridos",
    });
    assert.equal(response.body.toLowerCase().includes("error interno"), false);
    assert.equal(response.body.toLowerCase().includes("stack"), false);
  } finally {
    await app.close();
  }
});

test("clinicAuthNativeRoutes login unificado valida payload inválido antes de rate-limit y auditoría", async () => {
  const rateLimitCalls = {
    get: 0,
    set: 0,
    increment: 0,
  };
  const failedAttempts: Array<Record<string, unknown>> = [];

  const app = await createTestApp({
    loginRateLimitStore: {
      get: async () => {
        rateLimitCalls.get += 1;
        throw new Error("rate limit get failed");
      },
      set: async () => {
        rateLimitCalls.set += 1;
        throw new Error("rate limit set failed");
      },
      increment: async () => {
        rateLimitCalls.increment += 1;
        throw new Error("rate limit increment failed");
      },
    },
    recordLoginFailedAttempt: async (input: Record<string, unknown>) => {
      failedAttempts.push(input);
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        identifier: " ",
        password: "",
      },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Identificador y contraseña requeridos",
    });
    assert.deepEqual(rateLimitCalls, {
      get: 0,
      set: 0,
      increment: 0,
    });
    assert.equal(failedAttempts.length, 0);
  } finally {
    await app.close();
  }
});

test("clinicAuthNativeRoutes login unificado mantiene 401 cuando falla lectura de rate-limit store", async () => {
  const app = await createTestApp({
    loginRateLimitStore: {
      get: async () => {
        throw new Error("rate limit get failed");
      },
      set: async () => {
        throw new Error("rate limit set failed");
      },
      increment: async () => {
        throw new Error("rate limit increment failed");
      },
    },
    getAdminUserByUsername: async () => null,
    getClinicUserByUsername: async () => null,
    getParticularTokenByTokenHash: async () => null,
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        identifier: "desconocido",
        password: "incorrecta",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Credenciales inválidas",
    });
  } finally {
    await app.close();
  }
});

test("clinicAuthNativeRoutes login unificado mantiene 401 cuando falla incremento de rate-limit store", async () => {
  const app = await createTestApp({
    loginRateLimitStore: {
      get: async () => ({
        count: 0,
        resetAt: Date.now() + 60_000,
      }),
      set: async () => {},
      increment: async () => {
        throw new Error("rate limit increment failed");
      },
    },
    getAdminUserByUsername: async () => null,
    getClinicUserByUsername: async () => null,
    getParticularTokenByTokenHash: async () => null,
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        identifier: "desconocido",
        password: "incorrecta",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Credenciales inválidas",
    });
  } finally {
    await app.close();
  }
});

test("clinicAuthNativeRoutes login unificado fallido mantiene 401 aunque falle registro auxiliar", async () => {
  const app = await createTestApp({
    getAdminUserByUsername: async () => null,
    getClinicUserByUsername: async () => null,
    getParticularTokenByTokenHash: async () => null,
    recordLoginFailedAttempt: async () => {
      throw new Error("auxiliar login failed");
    },
    writeAuditLog: async () => {
      throw new Error("no debe invocarse auditoría de éxito en login fallido");
    },
    writeAdminAuditLog: async () => {
      throw new Error("no debe invocarse auditoría de éxito en login fallido");
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        identifier: "desconocido",
        password: "incorrecta",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Credenciales inválidas",
    });
    assert.equal(
      response.body.toLowerCase().includes("error interno del servidor"),
      false,
    );
  } finally {
    await app.close();
  }
});

test(
  "clinicAuthNativeRoutes login unificado prioriza admin ante colisión de identifier",
  async () => {
    let clinicLookupCalls = 0;

    const app = await createTestApp({
      now: () => 0,
      getAdminUserByUsername: async (username: string) => {
        if (username === "shared-user") {
          return {
            id: 1,
            username: "shared-user",
            passwordHash: "shared-hash",
          };
        }

        return null;
      },
      getClinicUserByUsername: async () => {
        clinicLookupCalls += 1;

        return {
          id: 7,
          clinicId: 3,
          username: "shared-user",
          passwordHash: "shared-hash",
          authProId: null,
          role: "clinic_owner",
        };
      },
      verifyPassword: async (password: string, passwordHash: string) => ({
        valid: password === "secret" && passwordHash === "shared-hash",
        needsRehash: false,
      }),
      generateSessionToken: () => "admin-priority-token",
      hashSessionToken: (token: string) => `hash:${token}`,
      createAdminSession: async () => {},
      writeAdminAuditLog: async () => {},
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        payload: {
          identifier: "shared-user",
          password: "secret",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        role: "admin",
        redirectTo: "/dashboard/admin",
      });
      assert.equal(clinicLookupCalls, 0);
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicAuthNativeRoutes login unificado prioriza admin ante colisión email/username entre roles",
  async () => {
    let clinicLookupCalls = 0;

    const app = await createTestApp({
      now: () => 0,
      getAdminUserByIdentifier: async (identifier: string) => {
        if (identifier === "shared@vetneb.com") {
          return {
            id: 10,
            username: "VETNEB",
            email: "shared@vetneb.com",
            passwordHash: "shared-hash",
          };
        }

        return null;
      },
      getClinicUserByIdentifier: async () => {
        clinicLookupCalls += 1;

        return {
          id: 7,
          clinicId: 3,
          username: "shared@vetneb.com",
          passwordHash: "shared-hash",
          authProId: null,
          role: "clinic_owner",
        };
      },
      verifyPassword: async (password: string, passwordHash: string) => ({
        valid: password === "secret" && passwordHash === "shared-hash",
        needsRehash: false,
      }),
      generateSessionToken: () => "admin-priority-email-token",
      hashSessionToken: (token: string) => `hash:${token}`,
      createAdminSession: async () => {},
      writeAdminAuditLog: async () => {},
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        payload: {
          identifier: "shared@vetneb.com",
          password: "secret",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        role: "admin",
        redirectTo: "/dashboard/admin",
      });
      assert.equal(clinicLookupCalls, 0);
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicAuthNativeRoutes bloquea login con origin no permitido",
  async () => {
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: {
          origin: "https://evil.example",
        },
        payload: {
          username: "vetneb",
          password: "secret",
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
  "clinicAuthNativeRoutes expone /me con sesión válida por cookie",
  async () => {
    const lastAccessCalls: string[] = [];

    const app = await createTestApp({
      now: () => Date.UTC(2026, 3, 23, 0, 0, 0),
      hashSessionToken: (token: string) => `hash:${token}`,
      getActiveSessionByToken: async (tokenHash: string) => {
        assert.equal(tokenHash, "hash:session-token");

        return {
          clinicUserId: 9,
          expiresAt: new Date(Date.UTC(2026, 3, 23, 1, 0, 0)),
        };
      },
      getClinicUserById: async (clinicUserId: number) => {
        assert.equal(clinicUserId, 9);

        return {
          id: 9,
          clinicId: 5,
          username: "doctor",
          authProId: null,
          role: "clinic_staff",
        };
      },
      updateSessionLastAccess: async (tokenHash: string) => {
        lastAccessCalls.push(tokenHash);
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.cookieName}=session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(
        response.headers["access-control-allow-origin"],
        "http://localhost:3000",
      );

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        clinicUser: {
          id: 9,
          clinicId: 5,
          username: "doctor",
          authProId: null,
          role: "clinic_staff",
        },
        permissions: getClinicPermissions("clinic_staff"),
      });

      assert.deepEqual(lastAccessCalls, ["hash:session-token"]);
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicAuthNativeRoutes logout elimina sesión y limpia cookie",
  async () => {
    const deletedHashes: string[] = [];

    const app = await createTestApp({
      now: () => Date.UTC(2026, 3, 23, 0, 0, 0),
      hashSessionToken: (token: string) => `hash:${token}`,
      getActiveSessionByToken: async () => ({
        clinicUserId: 11,
        expiresAt: new Date(Date.UTC(2026, 3, 23, 1, 0, 0)),
      }),
      getClinicUserById: async () => ({
        id: 11,
        clinicId: 7,
        username: "owner",
        authProId: "AUTH-1",
        role: "clinic_owner",
      }),
      updateSessionLastAccess: async () => {},
      deleteActiveSession: async (tokenHash: string) => {
        deletedHashes.push(tokenHash);
      },
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.cookieName}=session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        message: "Sesión cerrada correctamente",
      });

      assert.deepEqual(deletedHashes, ["hash:session-token"]);

      const setCookie = getSetCookieHeader(response);
      assert.ok(setCookie.includes(`${ENV.cookieName}=`));
      assert.ok(setCookie.includes("Max-Age=0"));
    } finally {
      await app.close();
    }
  },
);
test("clinicAuthNativeRoutes responde preflight OPTIONS permitido sin autenticar", async () => {
  const app = await createTestApp({
    getActiveSessionByToken: async () => {
      throw new Error("preflight OPTIONS no debe autenticar sesión clinic");
    },
  });

  try {
    for (const url of ["/api/auth/login", "/api/auth/me", "/api/auth/logout"]) {
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
        "GET,POST,OPTIONS",
      );
      assert.equal(
        response.headers["access-control-allow-headers"],
        "content-type,x-requested-with",
      );
    }
  } finally {
    await app.close();
  }
});

test("clinicAuthNativeRoutes bloquea preflight OPTIONS con origin no permitido", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/auth/login",
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

test("clinicAuthNativeRoutes responde 401 para username inexistente", async () => {
  const app = await createTestApp({
    getClinicUserByUsername: async () => null,
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        username: "noexiste",
        password: "noexiste",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Usuario o contraseña inválidos",
    });
  } finally {
    await app.close();
  }
});

test("clinicAuthNativeRoutes responde 401 para password inválida", async () => {
  const app = await createTestApp({
    getClinicUserByUsername: async () => ({
      id: 7,
      clinicId: 3,
      username: "vetneb",
      passwordHash: "stored-hash",
      authProId: null,
      role: "clinic_staff",
    }),
    verifyPassword: async () => ({
      valid: false,
      needsRehash: false,
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        username: "vetneb",
        password: "incorrecta",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Usuario o contraseña inválidos",
    });
  } finally {
    await app.close();
  }
});

test("clinicAuthNativeRoutes login fallido incrementa store persistente", async () => {
  const currentTime = Date.UTC(2026, 4, 8, 0, 0, 0);
  const { rows, store } = createPersistentRateLimitStoreHarness({
    now: () => currentTime,
  });

  const app = await createTestApp({
    now: () => currentTime,
    loginRateLimitStore: store,
    getClinicUserByUsername: async () => null,
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      remoteAddress: "203.0.113.50",
      payload: {
        username: "vetneb",
        password: "incorrecta",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(rows.get(hashRateLimitKey("203.0.113.50"))?.count, 1);
  } finally {
    await app.close();
  }
});

test("clinicAuthNativeRoutes bloquea login al superar límite persistente", async () => {
  const currentTime = Date.UTC(2026, 4, 8, 0, 0, 0);
  const { store } = createPersistentRateLimitStoreHarness({
    now: () => currentTime,
  });

  const app = await createTestApp({
    now: () => currentTime,
    loginRateLimitStore: store,
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: 2,
    getClinicUserByUsername: async () => null,
  });

  try {
    const first = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      remoteAddress: "203.0.113.51",
      payload: {
        username: "vetneb",
        password: "bad-1",
      },
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      remoteAddress: "203.0.113.51",
      payload: {
        username: "vetneb",
        password: "bad-2",
      },
    });
    const third = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      remoteAddress: "203.0.113.51",
      payload: {
        username: "vetneb",
        password: "bad-3",
      },
    });

    assert.equal(first.statusCode, 401);
    assert.equal(second.statusCode, 401);
    assert.equal(third.statusCode, 429);
    assert.deepEqual(JSON.parse(third.body), {
      success: false,
      error: LOGIN_RATE_LIMIT_ERROR_MESSAGE,
    });
    assert.equal(third.headers["ratelimit-limit"], "2");
    assert.equal(third.headers["ratelimit-remaining"], "0");
  } finally {
    await app.close();
  }
});

test("clinicAuthNativeRoutes recrea app y store persistente sin resetear contador", async () => {
  const currentTime = Date.UTC(2026, 4, 8, 0, 0, 0);
  const rows = new Map<string, PersistentRateLimitRow>();
  const firstHarness = createPersistentRateLimitStoreHarness({
    rows,
    now: () => currentTime,
  });
  const firstApp = await createTestApp({
    now: () => currentTime,
    loginRateLimitStore: firstHarness.store,
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: 1,
    getClinicUserByUsername: async () => null,
  });

  try {
    const first = await firstApp.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      remoteAddress: "203.0.113.52",
      payload: {
        username: "vetneb",
        password: "bad-1",
      },
    });

    assert.equal(first.statusCode, 401);
  } finally {
    await firstApp.close();
  }

  const secondHarness = createPersistentRateLimitStoreHarness({
    rows,
    now: () => currentTime,
  });
  const secondApp = await createTestApp({
    now: () => currentTime,
    loginRateLimitStore: secondHarness.store,
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: 1,
    getClinicUserByUsername: async () => {
      throw new Error("rate limited request must not query clinic user");
    },
  });

  try {
    const second = await secondApp.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      remoteAddress: "203.0.113.52",
      payload: {
        username: "vetneb",
        password: "bad-2",
      },
    });

    assert.equal(second.statusCode, 429);
  } finally {
    await secondApp.close();
  }
});

test("clinicAuthNativeRoutes reinicia ventana persistente cuando resetAt venció", async () => {
  let currentTime = Date.UTC(2026, 4, 8, 0, 0, 0);
  const rows = new Map<string, PersistentRateLimitRow>();
  const firstHarness = createPersistentRateLimitStoreHarness({
    rows,
    now: () => currentTime,
  });
  const firstApp = await createTestApp({
    now: () => currentTime,
    loginRateLimitStore: firstHarness.store,
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: 1,
    getClinicUserByUsername: async () => null,
  });

  try {
    const first = await firstApp.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      remoteAddress: "203.0.113.53",
      payload: {
        username: "vetneb",
        password: "bad-1",
      },
    });

    assert.equal(first.statusCode, 401);
  } finally {
    await firstApp.close();
  }

  currentTime += 61_000;

  const secondHarness = createPersistentRateLimitStoreHarness({
    rows,
    now: () => currentTime,
  });
  const secondApp = await createTestApp({
    now: () => currentTime,
    loginRateLimitStore: secondHarness.store,
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: 1,
    getClinicUserByUsername: async () => null,
  });

  try {
    const second = await secondApp.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      remoteAddress: "203.0.113.53",
      payload: {
        username: "vetneb",
        password: "bad-2",
      },
    });

    assert.equal(second.statusCode, 401);
    assert.equal(rows.get(hashRateLimitKey("203.0.113.53"))?.count, 1);
  } finally {
    await secondApp.close();
  }
});

test("clinicAuthNativeRoutes responde 400 para credenciales faltantes", async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        username: "vetneb",
      },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Usuario y contrasena son obligatorios",
    });
  } finally {
    await app.close();
  }
});

test("clinicAuthNativeRoutes mantiene 401 aunque falle recordLoginFailedAttempt", async () => {
  const app = await createTestApp({
    getClinicUserByUsername: async () => null,
    recordLoginFailedAttempt: async () => {
      throw new Error("record failed attempt write failed");
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
      },
      payload: {
        username: "noexiste",
        password: "noexiste",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Usuario o contraseña inválidos",
    });
    assert.equal(
      response.body.toLowerCase().includes("record failed attempt write failed"),
      false,
    );
    assert.equal(
      response.body.toLowerCase().includes("error interno del servidor"),
      false,
    );
  } finally {
    await app.close();
  }
});

test("clinicAuthNativeRoutes persiste failed login sin secretos", async () => {
  const attempts: Array<Record<string, unknown>> = [];

  const app = await createTestApp({
    now: () => Date.UTC(2026, 4, 8, 0, 0, 0),
    getClinicUserByUsername: async () => null,
    recordLoginFailedAttempt: async (input: Record<string, unknown>) => {
      attempts.push(input);
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        origin: "http://localhost:3000",
        "user-agent": "vetneb-test-agent",
      },
      remoteAddress: "203.0.113.45",
      payload: {
        username: " vetneb ",
        password: "SUPER-SECRET-PASSWORD",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(attempts.length, 1);

    assert.equal(attempts[0].surface, "clinic");
    assert.equal(attempts[0].username, "vetneb");
    assert.equal(attempts[0].reason, "invalid_credentials");
    assert.equal(attempts[0].userAgent, "vetneb-test-agent");
    assert.ok(attempts[0].createdAt instanceof Date);

    const serializedAttempt = JSON.stringify(attempts[0]).toLowerCase();

    assert.equal(
      serializedAttempt.includes("super-secret-password".toLowerCase()),
      false,
    );
    assert.equal(serializedAttempt.includes("passwordhash"), false);
    assert.equal(serializedAttempt.includes("tokenhash"), false);
    assert.equal(serializedAttempt.includes("cookie"), false);
  } finally {
    await app.close();
  }
});

test(
  "clinicAuthNativeRoutes clínica registrada con hash argon2 puede iniciar sesión",
  async () => {
    const { hashPassword, verifyPassword } = await import(
      "../server/lib/auth-security.ts"
    );

    const storedHash = await hashPassword("clave-inicial-segura");
    const sessionCalls: Array<{
      clinicUserId: number;
      tokenHash: string;
      expiresAt: Date;
    }> = [];

    const app = await createTestApp({
      now: () => Date.UTC(2026, 4, 1, 0, 0, 0),
      getClinicUserByUsername: async (username: string) => {
        if (username === "clinica-registrada") {
          return {
            id: 99,
            clinicId: 7,
            username: "clinica-registrada",
            passwordHash: storedHash,
            authProId: null,
            role: "clinic_owner",
          };
        }
        return null;
      },
      verifyPassword,
      generateSessionToken: () => "real-session-token",
      hashSessionToken: (token: string) => `hash:${token}`,
      createActiveSession: async (input: {
        clinicUserId: number;
        tokenHash: string;
        expiresAt: Date;
      }) => {
        sessionCalls.push(input);
      },
      writeAuditLog: async () => {},
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { origin: "http://localhost:3000" },
        payload: { username: "clinica-registrada", password: "clave-inicial-segura" },
      });

      assert.equal(response.statusCode, 200);

      const body = JSON.parse(response.body);

      assert.equal(body.success, true);
      assert.equal(body.clinicUser.id, 99);
      assert.equal(body.clinicUser.clinicId, 7);
      assert.equal(body.clinicUser.username, "clinica-registrada");
      assert.equal(body.clinicUser.role, "clinic_owner");
      assert.equal(body.clinicUser.passwordHash, undefined);

      assert.equal(sessionCalls.length, 1);
      assert.equal(sessionCalls[0].clinicUserId, 99);
      assert.equal(sessionCalls[0].tokenHash, "hash:real-session-token");

      const setCookie = getSetCookieHeader(response);

      assert.ok(setCookie.includes(`${ENV.cookieName}=`));
      assert.ok(setCookie.includes("HttpOnly"));
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicAuthNativeRoutes password incorrecto rechaza clínica registrada",
  async () => {
    const { hashPassword, verifyPassword } = await import(
      "../server/lib/auth-security.ts"
    );

    const storedHash = await hashPassword("clave-correcta-123");

    const app = await createTestApp({
      getClinicUserByUsername: async (username: string) => {
        if (username === "clinica-registrada") {
          return {
            id: 99,
            clinicId: 7,
            username: "clinica-registrada",
            passwordHash: storedHash,
            authProId: null,
            role: "clinic_owner",
          };
        }
        return null;
      },
      verifyPassword,
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { origin: "http://localhost:3000" },
        payload: { username: "clinica-registrada", password: "clave-incorrecta" },
      });

      assert.equal(response.statusCode, 401);

      const body = JSON.parse(response.body);

      assert.equal(body.success, false);
      assert.ok(typeof body.error === "string" && body.error.length > 0);
    } finally {
      await app.close();
    }
  },
);
