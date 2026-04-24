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
    writeAuditLog: async () => {},
    ...overrides,
  });

  return app;
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
