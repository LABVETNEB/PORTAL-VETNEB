import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const {
  LOGIN_RATE_LIMIT_CODE,
  LOGIN_RATE_LIMIT_ERROR_MESSAGE,
} = await import("../../server/lib/login-rate-limit.ts");
const {
  createMemoryRateLimitStore,
} = await import("../../server/lib/rate-limit-store.ts");
const {
  clinicAuthNativeRoutes,
} = await import("../../server/routes/auth.fastify.ts");
const {
  particularAuthNativeRoutes,
} = await import("../../server/routes/particular-auth.fastify.ts");

const REMOTE_IP = "203.0.113.90";
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 3;

async function createClinicApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(clinicAuthNativeRoutes as any, {
    prefix: "/api/auth",
    createActiveSession: async () => {},
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    getClinicUserByUsername: async () => null,
    getClinicUserByIdentifier: async () => null,
    updateSessionLastAccess: async () => {},
    upsertClinicUser: async () => {},
    generateSessionToken: () => "session-token",
    hashPassword: async () => "hash",
    hashSessionToken: (t: string) => `h:${t}`,
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
    loginRateLimitWindowMs: WINDOW_MS,
    loginRateLimitMaxAttempts: MAX_ATTEMPTS,
    ...overrides,
  });

  return app;
}

async function createParticularApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(particularAuthNativeRoutes as any, {
    prefix: "/api/particular/auth",
    createParticularSession: async () => {},
    deleteParticularSession: async () => {},
    getParticularSessionByToken: async () => null,
    getParticularTokenById: async () => null,
    getParticularTokenByTokenHash: async () => null,
    updateParticularSessionLastAccess: async () => {},
    updateParticularTokenLastLogin: async () => {},
    getReportById: async () => null,
    createSignedReportUrl: async (s: string) => `url:${s}`,
    createSignedReportDownloadUrl: async (s: string) => `dl:${s}`,
    generateSessionToken: () => "particular-token",
    hashSessionToken: (t: string) => `h:${t}`,
    recordLoginFailedAttempt: async () => {},
    loginRateLimitWindowMs: WINDOW_MS,
    loginRateLimitMaxAttempts: MAX_ATTEMPTS,
    ...overrides,
  });

  return app;
}

test("intentos fallidos en login clinica no bloquean login particular con store compartido", async () => {
  const sharedStore = createMemoryRateLimitStore();

  const clinicApp = await createClinicApp({
    loginRateLimitStore: sharedStore,
  });
  const particularApp = await createParticularApp({
    loginRateLimitStore: sharedStore,
  });

  try {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      const r = await clinicApp.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { username: "clinica@vetneb.com", password: "mala" },
      });
      assert.equal(r.statusCode, 401, `clinic attempt ${i + 1} must be 401`);
    }

    const blocked = await clinicApp.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { username: "clinica@vetneb.com", password: "mala" },
    });
    assert.equal(blocked.statusCode, 429, "clinic must be 429 after exhausting limit");

    const particularAttempt = await particularApp.inject({
      method: "POST",
      url: "/api/particular/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { token: "token-invalido" },
    });
    assert.notEqual(
      particularAttempt.statusCode,
      429,
      "particular login must NOT be blocked by clinic failures (realm isolation)",
    );
    assert.equal(particularAttempt.statusCode, 401);
  } finally {
    await clinicApp.close();
    await particularApp.close();
  }
});

test("intentos fallidos en login particular no bloquean login clinica con store compartido", async () => {
  const sharedStore = createMemoryRateLimitStore();

  const clinicApp = await createClinicApp({
    loginRateLimitStore: sharedStore,
  });
  const particularApp = await createParticularApp({
    loginRateLimitStore: sharedStore,
  });

  try {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      const r = await particularApp.inject({
        method: "POST",
        url: "/api/particular/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { token: "token-malo" },
      });
      assert.equal(r.statusCode, 401, `particular attempt ${i + 1} must be 401`);
    }

    const blocked = await particularApp.inject({
      method: "POST",
      url: "/api/particular/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { token: "token-malo" },
    });
    assert.equal(blocked.statusCode, 429, "particular must be 429 after exhausting limit");

    const clinicAttempt = await clinicApp.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { username: "clinica@vetneb.com", password: "mala" },
    });
    assert.notEqual(
      clinicAttempt.statusCode,
      429,
      "clinic login must NOT be blocked by particular failures (realm isolation)",
    );
    assert.equal(clinicAttempt.statusCode, 401);
  } finally {
    await clinicApp.close();
    await particularApp.close();
  }
});

test("rate limit clinica sigue funcionando dentro del mismo flujo", async () => {
  const app = await createClinicApp();

  try {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      const r = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { username: "x@x.com", password: "mal" },
      });
      assert.equal(r.statusCode, 401);
    }

    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { username: "x@x.com", password: "mal" },
    });
    assert.equal(r.statusCode, 429);
    assert.deepEqual(JSON.parse(r.body), {
      success: false,
      error: LOGIN_RATE_LIMIT_ERROR_MESSAGE,
      code: LOGIN_RATE_LIMIT_CODE,
      retryAfterSeconds: 60,
    });
  } finally {
    await app.close();
  }
});

test("rate limit particular sigue funcionando dentro del mismo flujo", async () => {
  const app = await createParticularApp();

  try {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      const r = await app.inject({
        method: "POST",
        url: "/api/particular/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { token: "tok-malo" },
      });
      assert.equal(r.statusCode, 401);
    }

    const r = await app.inject({
      method: "POST",
      url: "/api/particular/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { token: "tok-malo" },
    });
    assert.equal(r.statusCode, 429);
    assert.deepEqual(JSON.parse(r.body), {
      success: false,
      error: LOGIN_RATE_LIMIT_ERROR_MESSAGE,
      code: LOGIN_RATE_LIMIT_CODE,
      retryAfterSeconds: 60,
    });
  } finally {
    await app.close();
  }
});

test("respuesta 429 no filtra informacion sensible en login clinica", async () => {
  const app = await createClinicApp();

  try {
    for (let i = 0; i < MAX_ATTEMPTS + 1; i += 1) {
      await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { username: "u@v.com", password: "pass" },
      });
    }

    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { username: "u@v.com", password: "pass" },
    });

    assert.equal(r.statusCode, 429);

    const body = JSON.parse(r.body) as Record<string, unknown>;
    const raw = JSON.stringify(body).toLowerCase();

    assert.ok(!raw.includes("password"), "429 must not leak password");
    assert.ok(!raw.includes("hash"), "429 must not leak hash");
    assert.ok(!raw.includes("token"), "429 must not leak token");
    assert.ok(!raw.includes("cookie"), "429 must not leak cookie");
    assert.ok(!raw.includes("secret"), "429 must not leak secret");

    const setCookie = r.headers["set-cookie"];
    assert.ok(
      !setCookie,
      "429 must not set session cookie",
    );

    assert.ok(r.headers["ratelimit-limit"], "429 must include RateLimit-Limit");
    assert.ok(r.headers["ratelimit-remaining"] !== undefined, "429 must include RateLimit-Remaining");
    assert.equal(r.headers["ratelimit-remaining"], "0");
  } finally {
    await app.close();
  }
});

test("respuesta 429 no filtra informacion sensible en login particular", async () => {
  const app = await createParticularApp();

  try {
    for (let i = 0; i < MAX_ATTEMPTS + 1; i += 1) {
      await app.inject({
        method: "POST",
        url: "/api/particular/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { token: "tok" },
      });
    }

    const r = await app.inject({
      method: "POST",
      url: "/api/particular/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { token: "tok" },
    });

    assert.equal(r.statusCode, 429);

    const body = JSON.parse(r.body) as Record<string, unknown>;
    const raw = JSON.stringify(body).toLowerCase();

    assert.ok(!raw.includes("hash"), "429 must not leak hash");
    assert.ok(!raw.includes("cookie"), "429 must not leak cookie");
    assert.ok(!raw.includes("secret"), "429 must not leak secret");

    const setCookie = r.headers["set-cookie"];
    assert.ok(
      !setCookie,
      "429 must not set particular session cookie",
    );

    assert.ok(r.headers["ratelimit-limit"], "429 must include RateLimit-Limit");
    assert.equal(r.headers["ratelimit-remaining"], "0");
  } finally {
    await app.close();
  }
});

test("IP desconocida no colapsa realm login con realm particular", async () => {
  const sharedStore = createMemoryRateLimitStore();

  const clinicApp = await createClinicApp({ loginRateLimitStore: sharedStore });
  const particularApp = await createParticularApp({ loginRateLimitStore: sharedStore });

  try {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await clinicApp.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { origin: "http://localhost:3000" },
        payload: { username: "u@v.com", password: "mal" },
      });
    }

    const clinicBlocked = await clinicApp.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "http://localhost:3000" },
      payload: { username: "u@v.com", password: "mal" },
    });
    assert.equal(clinicBlocked.statusCode, 429, "clinic:unknown must be rate-limited");

    const particularAttempt = await particularApp.inject({
      method: "POST",
      url: "/api/particular/auth/login",
      headers: { origin: "http://localhost:3000" },
      payload: { token: "tok-invalido" },
    });
    assert.notEqual(
      particularAttempt.statusCode,
      429,
      "particular:unknown must NOT be blocked by clinic:unknown exhaustion",
    );
    assert.equal(particularAttempt.statusCode, 401);
  } finally {
    await clinicApp.close();
    await particularApp.close();
  }
});
