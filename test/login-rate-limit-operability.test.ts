import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type {
  RateLimitEntry,
  RateLimitStore,
} from "../server/lib/rate-limit-store.ts";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const {
  buildLoginRateLimitKey,
  buildMissingCredentialsLoginRateLimitKey,
  LOGIN_RATE_LIMIT_ERROR_MESSAGE,
} = await import("../server/lib/login-rate-limit.ts");
const {
  clinicAuthNativeRoutes,
} = await import("../server/routes/auth.fastify.ts");
const {
  adminAuthNativeRoutes,
} = await import("../server/routes/admin-auth.fastify.ts");
const {
  particularAuthNativeRoutes,
} = await import("../server/routes/particular-auth.fastify.ts");
const REQUIRED_429_HEADERS = [
  "retry-after",
  "ratelimit-policy",
  "ratelimit-limit",
  "ratelimit-remaining",
  "ratelimit-reset",
] as const;

function assertLogin429Headers(
  response: { headers: Record<string, unknown> },
  expectedLimit: string,
) {
  for (const headerName of REQUIRED_429_HEADERS) {
    assert.notEqual(
      response.headers[headerName],
      undefined,
      `429 must include ${headerName}`,
    );
  }

  assert.equal(response.headers["ratelimit-policy"], `${expectedLimit};w=60`);
  assert.equal(response.headers["ratelimit-limit"], expectedLimit);
  assert.equal(response.headers["ratelimit-remaining"], "0");
  assert.equal(response.headers["ratelimit-reset"], "60");
  assert.equal(response.headers["retry-after"], "60");
}

function createTrackingStore() {
  const entries = new Map<string, RateLimitEntry>();
  const touchedKeys: string[] = [];

  const store: RateLimitStore = {
    get: (key) => entries.get(key),
    set: (key, entry) => {
      touchedKeys.push(key);
      entries.set(key, entry);
    },
    increment: (key, entry) => {
      touchedKeys.push(key);
      const existing = entries.get(key);
      const updated =
        !existing || existing.resetAt <= 0
          ? {
              count: entry.count + 1,
              resetAt: entry.resetAt,
            }
          : {
              count: existing.count + 1,
              resetAt: existing.resetAt,
            };

      entries.set(key, updated);
      return updated;
    },
    delete: (key) => {
      touchedKeys.push(key);
      entries.delete(key);
    },
  };

  return { entries, store, touchedKeys };
}

function baseClinicDeps(overrides: Record<string, unknown> = {}) {
  return {
    createActiveSession: async () => {},
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    getClinicUserByUsername: async () => null,
    getClinicUserByIdentifier: async () => null,
    updateSessionLastAccess: async () => {},
    upsertClinicUser: async () => {},
    generateSessionToken: () => "clinic-session",
    hashPassword: async () => "rehash",
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: async () => ({ valid: false, needsRehash: false }),
    createAdminSession: async () => {},
    getAdminUserByUsername: async () => null,
    getAdminUserByIdentifier: async () => null,
    writeAdminAuditLog: async () => {},
    createParticularSession: async () => {},
    getParticularTokenByTokenHash: async () => null,
    updateParticularTokenLastLogin: async () => {},
    writeAuditLog: async () => {},
    recordLoginFailedAttempt: async () => {},
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: 2,
    now: () => 0,
    ...overrides,
  };
}

function baseAdminDeps(overrides: Record<string, unknown> = {}) {
  return {
    createAdminSession: async () => {},
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    getAdminUserByUsername: async () => null,
    updateAdminSessionLastAccess: async () => {},
    generateSessionToken: () => "admin-session",
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: async () => ({ valid: false, needsRehash: false }),
    writeAuditLog: async () => {},
    recordLoginFailedAttempt: async () => {},
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: 2,
    now: () => 0,
    ...overrides,
  };
}

function baseParticularDeps(overrides: Record<string, unknown> = {}) {
  return {
    createParticularSession: async () => {},
    deleteParticularSession: async () => {},
    getParticularSessionByToken: async () => null,
    getParticularTokenById: async () => null,
    getParticularTokenByTokenHash: async () => null,
    updateParticularSessionLastAccess: async () => {},
    updateParticularTokenLastLogin: async () => {},
    getReportById: async () => null,
    createSignedReportUrl: async (storagePath: string) => `preview:${storagePath}`,
    createSignedReportDownloadUrl: async (storagePath: string) => `download:${storagePath}`,
    generateSessionToken: () => "particular-session",
    hashSessionToken: (token: string) => `hash:${token}`,
    recordLoginFailedAttempt: async () => {},
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: 2,
    now: () => 0,
    ...overrides,
  };
}

test("login 429 includes recoverable headers on clinic unified admin and particular surfaces", async () => {
  const scenarios = [
    {
      name: "clinic",
      prefix: "/api/auth",
      route: clinicAuthNativeRoutes,
      deps: baseClinicDeps(),
      payload: { username: "clinic-user", password: "bad" },
    },
    {
      name: "unified",
      prefix: "/api/auth",
      route: clinicAuthNativeRoutes,
      deps: baseClinicDeps(),
      payload: { identifier: "clinic-user", password: "bad" },
    },
    {
      name: "admin",
      prefix: "/api/admin/auth",
      route: adminAuthNativeRoutes,
      deps: baseAdminDeps(),
      payload: { username: "admin-user", password: "bad" },
    },
    {
      name: "particular",
      prefix: "/api/particular/auth",
      route: particularAuthNativeRoutes,
      deps: baseParticularDeps(),
      payload: { token: "bad-particular-token" },
    },
  ] as const;

  for (const scenario of scenarios) {
    const app = Fastify();
    await app.register(scenario.route as any, {
      prefix: scenario.prefix,
      ...scenario.deps,
    });

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await app.inject({
          method: "POST",
          url: `${scenario.prefix}/login`,
          headers: { origin: "http://localhost:3000" },
          remoteAddress: "203.0.113.90",
          payload: scenario.payload,
        });
        assert.equal(response.statusCode, 401, scenario.name);
      }

      const blocked = await app.inject({
        method: "POST",
        url: `${scenario.prefix}/login`,
        headers: { origin: "http://localhost:3000" },
        remoteAddress: "203.0.113.90",
        payload: scenario.payload,
      });

      assert.equal(blocked.statusCode, 429, scenario.name);
      assertLogin429Headers(blocked, "2");
      assert.deepEqual(JSON.parse(blocked.body), {
        success: false,
        error: LOGIN_RATE_LIMIT_ERROR_MESSAGE,
      });
    } finally {
      await app.close();
    }
  }
});

test("empty unified identifier uses missing bucket and does not query real users", async () => {
  const { store, touchedKeys } = createTrackingStore();
  const attempts: Array<Record<string, unknown>> = [];
  const app = Fastify();

  await app.register(clinicAuthNativeRoutes as any, {
    prefix: "/api/auth",
    ...baseClinicDeps({
      loginRateLimitStore: store,
      getAdminUserByIdentifier: async () => {
        throw new Error("empty identifier must not query admin users");
      },
      getClinicUserByIdentifier: async () => {
        throw new Error("empty identifier must not query clinic users");
      },
      getParticularTokenByTokenHash: async () => {
        throw new Error("empty identifier must not query particular tokens");
      },
      recordLoginFailedAttempt: async (input: Record<string, unknown>) => {
        attempts.push(input);
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: "203.0.113.91",
      payload: { identifier: "", password: "present" },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(
      touchedKeys.includes(
        buildMissingCredentialsLoginRateLimitKey({
          surface: "unified",
          ipAddress: "203.0.113.91",
        }),
      ),
      true,
    );
    assert.equal(
      touchedKeys.includes(
        buildLoginRateLimitKey({
          surface: "unified",
          identifier: "unknown",
          ipAddress: "203.0.113.91",
        }),
      ),
      false,
    );
    assert.equal(attempts[0]?.reason, "missing_credentials");
    assert.equal(attempts[0]?.username, null);
  } finally {
    await app.close();
  }
});

test("empty admin username uses missing bucket and does not query admin users", async () => {
  const { store, touchedKeys } = createTrackingStore();
  const attempts: Array<Record<string, unknown>> = [];
  const app = Fastify();

  await app.register(adminAuthNativeRoutes as any, {
    prefix: "/api/admin/auth",
    ...baseAdminDeps({
      loginRateLimitStore: store,
      getAdminUserByUsername: async () => {
        throw new Error("empty username must not query admin users");
      },
      recordLoginFailedAttempt: async (input: Record<string, unknown>) => {
        attempts.push(input);
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: "203.0.113.92",
      payload: { username: "", password: "present" },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(
      touchedKeys.includes(
        buildMissingCredentialsLoginRateLimitKey({
          surface: "admin",
          ipAddress: "203.0.113.92",
        }),
      ),
      true,
    );
    assert.equal(
      touchedKeys.includes(
        buildLoginRateLimitKey({
          surface: "admin",
          identifier: "unknown",
          ipAddress: "203.0.113.92",
        }),
      ),
      false,
    );
    assert.equal(attempts[0]?.reason, "missing_credentials");
    assert.equal(attempts[0]?.username, null);
  } finally {
    await app.close();
  }
});

test("empty particular token uses missing bucket and does not hash token", async () => {
  const { store, touchedKeys } = createTrackingStore();
  const attempts: Array<Record<string, unknown>> = [];
  const app = Fastify();

  await app.register(particularAuthNativeRoutes as any, {
    prefix: "/api/particular/auth",
    ...baseParticularDeps({
      loginRateLimitStore: store,
      hashSessionToken: () => {
        throw new Error("empty token must not be hashed");
      },
      getParticularTokenByTokenHash: async () => {
        throw new Error("empty token must not query particular tokens");
      },
      recordLoginFailedAttempt: async (input: Record<string, unknown>) => {
        attempts.push(input);
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/particular/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: "203.0.113.93",
      payload: { token: "" },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(
      touchedKeys.includes(
        buildMissingCredentialsLoginRateLimitKey({
          surface: "particular",
          ipAddress: "203.0.113.93",
        }),
      ),
      true,
    );
    assert.equal(
      touchedKeys.includes(
        buildLoginRateLimitKey({
          surface: "particular",
          identifier: "unknown",
          ipAddress: "203.0.113.93",
        }),
      ),
      false,
    );
    assert.equal(attempts[0]?.reason, "missing_credentials");
    assert.equal(attempts[0]?.username, null);
  } finally {
    await app.close();
  }
});
