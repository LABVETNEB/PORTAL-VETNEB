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
  adminAuthNativeRoutes,
} = await import("../server/routes/admin-auth.fastify.ts");

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(adminAuthNativeRoutes as any, {
    prefix: "/api/admin/auth",
    createAdminSession: async () => {},
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    getAdminUserByUsername: async () => null,
    updateAdminSessionLastAccess: async () => {},
    generateSessionToken: () => "admin-session-token",
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
  "adminAuthNativeRoutes login exitoso conserva payload, cookie y auditoria",
  async () => {
    const sessionCalls: Array<{
      adminUserId: number;
      tokenHash: string;
      expiresAt: Date;
    }> = [];
    const auditCalls: Array<Record<string, unknown>> = [];

    const app = await createTestApp({
      now: () => 0,
      getAdminUserByUsername: async (username: string) => {
        assert.equal(username, "VETNEB");

        return {
          id: 1,
          username: "VETNEB",
          passwordHash: "stored-hash",
        };
      },
      verifyPassword: async (password: string, passwordHash: string) => {
        assert.equal(password, "31731490Neb");
        assert.equal(passwordHash, "stored-hash");

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
        sessionCalls.push(input);
      },
      writeAuditLog: async (_req: unknown, input: Record<string, unknown>) => {
        auditCalls.push(input);
      },
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/admin/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        payload: {
          username: " VETNEB ",
          password: "31731490Neb",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(
        response.headers["access-control-allow-origin"],
        "http://localhost:3000",
      );
      assert.equal(response.headers["access-control-allow-credentials"], "true");

      const setCookie = getSetCookieHeader(response);
      assert.ok(setCookie.includes(`${ENV.adminCookieName}=admin-token-123`));
      assert.ok(setCookie.includes("Path=/"));
      assert.ok(setCookie.includes("HttpOnly"));

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        admin: {
          id: 1,
          username: "VETNEB",
        },
      });

      assert.equal(sessionCalls.length, 1);
      assert.equal(sessionCalls[0].adminUserId, 1);
      assert.equal(sessionCalls[0].tokenHash, "hash:admin-token-123");
      assert.equal(
        sessionCalls[0].expiresAt.getTime(),
        ENV.sessionTtlHours * 60 * 60 * 1000,
      );

      assert.equal(auditCalls.length, 1);
      assert.equal(auditCalls[0].event, AUDIT_EVENTS.ADMIN_LOGIN_SUCCEEDED);
      assert.equal(auditCalls[0].targetAdminUserId, 1);
    } finally {
      await app.close();
    }
  },
);

test(
  "adminAuthNativeRoutes bloquea login con origin no permitido",
  async () => {
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/admin/auth/login",
        headers: {
          origin: "https://evil.example",
        },
        payload: {
          username: "VETNEB",
          password: "31731490Neb",
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
  "adminAuthNativeRoutes expone /me con sesión admin válida por cookie",
  async () => {
    const lastAccessCalls: string[] = [];

    const app = await createTestApp({
      now: () => Date.UTC(2026, 3, 24, 0, 0, 0),
      hashSessionToken: (token: string) => `hash:${token}`,
      getAdminSessionByToken: async (tokenHash: string) => {
        assert.equal(tokenHash, "hash:admin-session-token");

        return {
          adminUserId: 7,
          expiresAt: new Date(Date.UTC(2026, 3, 24, 1, 0, 0)),
          lastAccess: new Date(Date.UTC(2026, 3, 23, 23, 0, 0)),
        };
      },
      getAdminUserById: async (adminUserId: number) => {
        assert.equal(adminUserId, 7);

        return {
          id: 7,
          username: "ADMIN",
        };
      },
      updateAdminSessionLastAccess: async (tokenHash: string) => {
        lastAccessCalls.push(tokenHash);
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/auth/me",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(
        response.headers["access-control-allow-origin"],
        "http://localhost:3000",
      );

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        admin: {
          id: 7,
          username: "ADMIN",
        },
      });

      assert.deepEqual(lastAccessCalls, ["hash:admin-session-token"]);
    } finally {
      await app.close();
    }
  },
);

test(
  "adminAuthNativeRoutes logout elimina sesión y limpia cookie",
  async () => {
    const deletedHashes: string[] = [];

    const app = await createTestApp({
      now: () => Date.UTC(2026, 3, 24, 0, 0, 0),
      hashSessionToken: (token: string) => `hash:${token}`,
      getAdminSessionByToken: async () => ({
        adminUserId: 3,
        expiresAt: new Date(Date.UTC(2026, 3, 24, 1, 0, 0)),
        lastAccess: new Date(Date.UTC(2026, 3, 23, 23, 0, 0)),
      }),
      getAdminUserById: async () => ({
        id: 3,
        username: "VETNEB",
      }),
      updateAdminSessionLastAccess: async () => {},
      deleteAdminSession: async (tokenHash: string) => {
        deletedHashes.push(tokenHash);
      },
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/admin/auth/logout",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        message: "Sesión admin cerrada correctamente",
      });

      assert.deepEqual(deletedHashes, ["hash:admin-session-token"]);

      const setCookie = getSetCookieHeader(response);
      assert.ok(setCookie.includes(`${ENV.adminCookieName}=`));
      assert.ok(setCookie.includes("Max-Age=0"));
    } finally {
      await app.close();
    }
  },
);

test(
  "adminAuthNativeRoutes aplica rate limit de login sobre intentos fallidos",
  async () => {
    const app = await createTestApp({
      now: () => 0,
      loginRateLimitWindowMs: 60_000,
      loginRateLimitMaxAttempts: 2,
      getAdminUserByUsername: async () => ({
        id: 1,
        username: "VETNEB",
        passwordHash: "stored-hash",
      }),
      verifyPassword: async () => ({
        valid: false,
        needsRehash: false,
      }),
    });

    try {
      const first = await app.inject({
        method: "POST",
        url: "/api/admin/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        remoteAddress: "203.0.113.20",
        payload: {
          username: "VETNEB",
          password: "bad-1",
        },
      });

      const second = await app.inject({
        method: "POST",
        url: "/api/admin/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        remoteAddress: "203.0.113.20",
        payload: {
          username: "VETNEB",
          password: "bad-2",
        },
      });

      const third = await app.inject({
        method: "POST",
        url: "/api/admin/auth/login",
        headers: {
          origin: "http://localhost:3000",
        },
        remoteAddress: "203.0.113.20",
        payload: {
          username: "VETNEB",
          password: "bad-3",
        },
      });

      assert.equal(first.statusCode, 401);
      assert.equal(second.statusCode, 401);
      assert.equal(third.statusCode, 429);
      assert.equal(third.headers["ratelimit-limit"], "2");
      assert.equal(third.headers["ratelimit-remaining"], "0");
      assert.deepEqual(JSON.parse(third.body), {
        success: false,
        error: LOGIN_RATE_LIMIT_ERROR_MESSAGE,
      });
    } finally {
      await app.close();
    }
  },
);
test("adminAuthNativeRoutes responde preflight OPTIONS permitido sin autenticar", async () => {
  const app = await createTestApp({
    getAdminSessionByToken: async () => {
      throw new Error("preflight OPTIONS no debe autenticar sesión admin");
    },
    getAdminUserByUsername: async () => {
      throw new Error("preflight OPTIONS no debe consultar usuario admin");
    },
  });

  try {
    for (const url of [
      "/api/admin/auth/login",
      "/api/admin/auth/me",
      "/api/admin/auth/logout",
    ]) {
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
      assert.equal(
        response.headers["access-control-expose-headers"],
        "RateLimit-Policy, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset",
      );
      assert.equal(response.headers["set-cookie"], undefined);
    }
  } finally {
    await app.close();
  }
});

test("adminAuthNativeRoutes bloquea preflight OPTIONS con origin no permitido", async () => {
  const app = await createTestApp({
    getAdminSessionByToken: async () => {
      throw new Error("preflight OPTIONS bloqueado no debe autenticar sesión admin");
    },
    getAdminUserByUsername: async () => {
      throw new Error("preflight OPTIONS bloqueado no debe consultar usuario admin");
    },
  });

  try {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/admin/auth/login",
      headers: {
        origin: "https://evil.example",
        "access-control-request-headers": "content-type",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
    assert.equal(response.headers["set-cookie"], undefined);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Origen no permitido",
    });
  } finally {
    await app.close();
  }
});
