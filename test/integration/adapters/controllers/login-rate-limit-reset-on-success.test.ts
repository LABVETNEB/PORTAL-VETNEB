/**
 * Tests: reset de rate limit en login exitoso.
 *
 * Verifica que un login exitoso limpia el contador de rate limit,
 * de forma que el usuario no queda bloqueado por fallos previos.
 * Cubre los flujos unified/clinic, admin y particular.
 */

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
  LOGIN_RATE_LIMIT_ERROR_MESSAGE,
} = await import("../../../../server/lib/login-rate-limit.ts");
const {
  createMemoryRateLimitStore,
} = await import("../../../../server/lib/rate-limit-store.ts");
const {
  clinicAuthNativeRoutes,
} = await import("../../../../server/routes/auth.fastify.ts");
const {
  adminAuthNativeRoutes,
} = await import("../../../../server/routes/admin-auth.fastify.ts");
const {
  particularAuthNativeRoutes,
} = await import("../../../../server/routes/particular-auth.fastify.ts");

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 3;
const REMOTE_IP = "203.0.113.77";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeClinicDeps(overrides: Record<string, unknown> = {}) {
  return {
    createActiveSession: async () => {},
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    getClinicUserByUsername: async () => null,
    getClinicUserByIdentifier: async () => null,
    updateSessionLastAccess: async () => {},
    upsertClinicUser: async () => {},
    generateSessionToken: () => "tok",
    hashPassword: async (p: string) => `h:${p}`,
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
  };
}

function makeAdminDeps(overrides: Record<string, unknown> = {}) {
  return {
    createAdminSession: async () => {},
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    getAdminUserByUsername: async () => null,
    updateAdminSessionLastAccess: async () => {},
    generateSessionToken: () => "tok",
    hashSessionToken: (t: string) => `h:${t}`,
    verifyPassword: async () => ({ valid: false, needsRehash: false }),
    writeAuditLog: async () => {},
    recordLoginFailedAttempt: async () => {},
    loginRateLimitWindowMs: WINDOW_MS,
    loginRateLimitMaxAttempts: MAX_ATTEMPTS,
    ...overrides,
  };
}

function makeParticularDeps(overrides: Record<string, unknown> = {}) {
  return {
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
    generateSessionToken: () => "tok",
    hashSessionToken: (t: string) => `h:${t}`,
    recordLoginFailedAttempt: async () => {},
    loginRateLimitWindowMs: WINDOW_MS,
    loginRateLimitMaxAttempts: MAX_ATTEMPTS,
    ...overrides,
  };
}

// ─── Unified/Clinic ──────────────────────────────────────────────────────────

test("login exitoso (unified) resetea el rate limit — usuario puede fallar de nuevo desde cero", async () => {
  const store = createMemoryRateLimitStore();

  let callCount = 0;
  const clinicUser = {
    id: 1,
    clinicId: 10,
    username: "user@vetneb.com",
    passwordHash: "hash",
    authProId: null,
    role: "clinic_staff",
  };

  // Simular: tras N-1 fallos, el usuario acierta (válido). Luego puede seguir fallando sin quedar bloqueado.
  const app = Fastify();
  await app.register(clinicAuthNativeRoutes as any, {
    prefix: "/api/auth",
    ...makeClinicDeps({
      loginRateLimitStore: store,
      getClinicUserByIdentifier: async () => {
        callCount += 1;
        return callCount === MAX_ATTEMPTS ? clinicUser : null;
      },
      verifyPassword: async () => ({ valid: callCount === MAX_ATTEMPTS, needsRehash: false }),
      createActiveSession: async () => {},
      writeAuditLog: async () => {},
    }),
  });

  try {
    // N-1 fallos
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      const r = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { identifier: "user@vetneb.com", password: "mal" },
      });
      assert.equal(r.statusCode, 401, `intento ${i} debe ser 401`);
    }

    // Login exitoso en intento MAX_ATTEMPTS
    const success = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { identifier: "user@vetneb.com", password: "buena" },
    });
    assert.equal(success.statusCode, 200, "login exitoso debe ser 200");
    assert.ok(
      (success.headers["ratelimit-remaining"] as string) === String(MAX_ATTEMPTS),
      "tras login exitoso, remaining debe volver al máximo",
    );

    // Tras el éxito, el store debe estar limpio — el usuario puede fallar N veces más
    callCount = 0; // reset para que los siguientes vuelvan a fallar
    for (let i = 1; i <= MAX_ATTEMPTS - 1; i += 1) {
      const r = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { identifier: "user@vetneb.com", password: "mal" },
      });
      assert.equal(r.statusCode, 401, `intento post-éxito ${i} debe ser 401, no 429`);
      assert.notEqual(r.statusCode, 429, "no debe quedar bloqueado por fallos previos al éxito");
    }
  } finally {
    await app.close();
  }
});

test("login exitoso (unified) no limpia keys de otros identificadores", async () => {
  const store = createMemoryRateLimitStore();

  const userA = {
    id: 1, clinicId: 10, username: "a@vetneb.com",
    passwordHash: "hash", authProId: null, role: "clinic_staff",
  };

  let authenticatingAs = "b@vetneb.com";
  const app = Fastify();
  await app.register(clinicAuthNativeRoutes as any, {
    prefix: "/api/auth",
    ...makeClinicDeps({
      loginRateLimitStore: store,
      getClinicUserByIdentifier: async (id: string) => {
        return id === "a@vetneb.com" ? userA : null;
      },
      verifyPassword: async () => ({
        valid: authenticatingAs === "a@vetneb.com",
        needsRehash: false,
      }),
      createActiveSession: async () => {},
      writeAuditLog: async () => {},
    }),
  });

  try {
    // Usuario B acumula suficientes fallos para quedar bloqueado en su propia key.
    authenticatingAs = "b@vetneb.com";
    for (let i = 1; i <= MAX_ATTEMPTS; i += 1) {
      const r = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { identifier: "b@vetneb.com", password: "mal" },
      });
      assert.equal(r.statusCode, 401, `fallo B ${i} debe consumir su bucket`);
    }

    // Usuario A hace login exitoso
    authenticatingAs = "a@vetneb.com";
    const success = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { identifier: "a@vetneb.com", password: "buena" },
    });
    assert.equal(success.statusCode, 200, "A debe hacer login exitoso");

    // El siguiente intento fallido de B debe seguir bloqueado: el exito de A no borro su key.
    authenticatingAs = "b@vetneb.com";
    const rB = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { identifier: "b@vetneb.com", password: "mal" },
    });
    assert.equal(rB.statusCode, 429, "B debe seguir bloqueado tras sus propios intentos; A no debe haberlos borrado");
  } finally {
    await app.close();
  }
});

// ─── Admin ───────────────────────────────────────────────────────────────────

test("admin login: key incluye surface=admin e identifier, no solo IP", async () => {
  const store = createMemoryRateLimitStore();

  // Dos usuarios admin distintos desde la misma IP no deben interferirse
  const app = Fastify();
  await app.register(adminAuthNativeRoutes as any, {
    prefix: "/api/admin/auth",
    ...makeAdminDeps({ loginRateLimitStore: store }),
  });

  try {
    // Admin A falla MAX_ATTEMPTS veces
    for (let i = 0; i <= MAX_ATTEMPTS; i += 1) {
      await app.inject({
        method: "POST",
        url: "/api/admin/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { username: "admin_a", password: "mal" },
      });
    }

    const blocked = await app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { username: "admin_a", password: "mal" },
    });
    assert.equal(blocked.statusCode, 429, "admin_a debe estar bloqueado");

    // Admin B desde la misma IP NO debe estar bloqueado
    const rB = await app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { username: "admin_b", password: "cualquiera" },
    });
    assert.notEqual(rB.statusCode, 429, "admin_b NO debe estar bloqueado por fallos de admin_a");
    assert.equal(rB.statusCode, 401);
  } finally {
    await app.close();
  }
});

test("admin login 429 incluye Retry-After header", async () => {
  const app = Fastify();
  await app.register(adminAuthNativeRoutes as any, {
    prefix: "/api/admin/auth",
    ...makeAdminDeps(),
  });

  try {
    // Agotar intentos
    for (let i = 0; i <= MAX_ATTEMPTS; i += 1) {
      await app.inject({
        method: "POST",
        url: "/api/admin/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { username: "admin_test", password: "mal" },
      });
    }

    const r = await app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { username: "admin_test", password: "mal" },
    });

    assert.equal(r.statusCode, 429);
    assert.ok(
      r.headers["retry-after"] !== undefined,
      "429 de admin debe incluir Retry-After header",
    );
    const retryAfter = Number(r.headers["retry-after"]);
    assert.ok(retryAfter > 0, "Retry-After debe ser positivo");
    assert.ok(
      r.headers["ratelimit-limit"] !== undefined,
      "429 de admin debe incluir RateLimit-Limit",
    );
    assert.equal(JSON.parse(r.body).error, LOGIN_RATE_LIMIT_ERROR_MESSAGE);
  } finally {
    await app.close();
  }
});

test("admin login exitoso resetea el rate limit", async () => {
  const store = createMemoryRateLimitStore();

  const adminUser = { id: 1, username: "admin_ok", passwordHash: "hash" };
  let validCredentials = false;

  const app = Fastify();
  await app.register(adminAuthNativeRoutes as any, {
    prefix: "/api/admin/auth",
    ...makeAdminDeps({
      loginRateLimitStore: store,
      getAdminUserByUsername: async () => (validCredentials ? adminUser : null),
      verifyPassword: async () => ({ valid: validCredentials, needsRehash: false }),
      createAdminSession: async () => {},
      writeAuditLog: async () => {},
    }),
  });

  try {
    // MAX_ATTEMPTS - 1 fallos
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      const r = await app.inject({
        method: "POST",
        url: "/api/admin/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { username: "admin_ok", password: "mal" },
      });
      assert.equal(r.statusCode, 401);
    }

    // Login exitoso
    validCredentials = true;
    const success = await app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { username: "admin_ok", password: "buena" },
    });
    assert.equal(success.statusCode, 200);
    assert.equal(
      success.headers["ratelimit-remaining"],
      String(MAX_ATTEMPTS),
      "tras login exitoso, remaining debe ser MAX_ATTEMPTS",
    );

    // Volver a fallar — debe empezar desde 0
    validCredentials = false;
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      const r = await app.inject({
        method: "POST",
        url: "/api/admin/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { username: "admin_ok", password: "mal" },
      });
      assert.equal(r.statusCode, 401, `fallo ${i} post-éxito debe ser 401, no 429`);
    }
  } finally {
    await app.close();
  }
});

// ─── Particular ──────────────────────────────────────────────────────────────

test("particular login 429 incluye Retry-After header", async () => {
  const app = Fastify();
  await app.register(particularAuthNativeRoutes as any, {
    prefix: "/api/particular/auth",
    ...makeParticularDeps(),
  });

  try {
    const TOKEN = "tok-test-particular-abc";

    // Agotar intentos
    for (let i = 0; i <= MAX_ATTEMPTS; i += 1) {
      await app.inject({
        method: "POST",
        url: "/api/particular/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { token: TOKEN },
      });
    }

    const r = await app.inject({
      method: "POST",
      url: "/api/particular/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { token: TOKEN },
    });

    assert.equal(r.statusCode, 429);
    assert.ok(
      r.headers["retry-after"] !== undefined,
      "429 de particular debe incluir Retry-After header",
    );
    const retryAfter = Number(r.headers["retry-after"]);
    assert.ok(retryAfter > 0, "Retry-After debe ser positivo");
    assert.equal(JSON.parse(r.body).error, LOGIN_RATE_LIMIT_ERROR_MESSAGE);
  } finally {
    await app.close();
  }
});

test("particular: tokens distintos desde la misma IP no se bloquean entre sí", async () => {
  const store = createMemoryRateLimitStore();

  const app = Fastify();
  await app.register(particularAuthNativeRoutes as any, {
    prefix: "/api/particular/auth",
    ...makeParticularDeps({ loginRateLimitStore: store }),
  });

  try {
    const TOKEN_A = "token-particular-aaa";
    const TOKEN_B = "token-particular-bbb";

    // Token A falla MAX_ATTEMPTS veces (bloqueado)
    for (let i = 0; i <= MAX_ATTEMPTS; i += 1) {
      await app.inject({
        method: "POST",
        url: "/api/particular/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { token: TOKEN_A },
      });
    }

    const blockedA = await app.inject({
      method: "POST",
      url: "/api/particular/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { token: TOKEN_A },
    });
    assert.equal(blockedA.statusCode, 429, "token_a debe estar bloqueado");

    // Token B no debe estar bloqueado
    const rB = await app.inject({
      method: "POST",
      url: "/api/particular/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { token: TOKEN_B },
    });
    assert.notEqual(rB.statusCode, 429, "token_b NO debe estar bloqueado por fallos de token_a");
    assert.equal(rB.statusCode, 401);
  } finally {
    await app.close();
  }
});

test("particular login exitoso resetea el rate limit", async () => {
  const store = createMemoryRateLimitStore();
  const TOKEN = "token-particular-valido-xyz";
  let tokenValid = false;

  const particularToken = {
    id: 1, clinicId: 5, reportId: null,
    isActive: true, token: TOKEN,
  };

  const app = Fastify();
  await app.register(particularAuthNativeRoutes as any, {
    prefix: "/api/particular/auth",
    ...makeParticularDeps({
      loginRateLimitStore: store,
      getParticularTokenByTokenHash: async () => (tokenValid ? particularToken : null),
      createParticularSession: async () => {},
      updateParticularTokenLastLogin: async () => {},
      getParticularTokenById: async () => ({ ...particularToken, token: "" }),
    }),
  });

  try {
    // MAX_ATTEMPTS - 1 fallos
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      const r = await app.inject({
        method: "POST",
        url: "/api/particular/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { token: TOKEN },
      });
      assert.equal(r.statusCode, 401);
    }

    // Login exitoso
    tokenValid = true;
    const success = await app.inject({
      method: "POST",
      url: "/api/particular/auth/login",
      headers: { origin: "http://localhost:3000" },
      remoteAddress: REMOTE_IP,
      payload: { token: TOKEN },
    });
    assert.equal(success.statusCode, 200);
    assert.equal(
      success.headers["ratelimit-remaining"],
      String(MAX_ATTEMPTS),
      "tras login exitoso, remaining debe ser MAX_ATTEMPTS",
    );

    // Volver a fallar — debe empezar desde 0
    tokenValid = false;
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      const r = await app.inject({
        method: "POST",
        url: "/api/particular/auth/login",
        headers: { origin: "http://localhost:3000" },
        remoteAddress: REMOTE_IP,
        payload: { token: TOKEN },
      });
      assert.equal(r.statusCode, 401, `fallo ${i} post-éxito no debe ser 429`);
    }
  } finally {
    await app.close();
  }
});

// ─── Store delete method ─────────────────────────────────────────────────────

test("createMemoryRateLimitStore.delete elimina la entrada correctamente", async () => {
  const { createMemoryRateLimitStore: mk, getOrCreateRateLimitEntry, incrementRateLimitEntry } = await import("../../../../server/lib/rate-limit-store.ts");

  const store = mk();
  const now = Date.now();
  const WINDOW = 60_000;

  // Crear y rellenar una entrada
  const entry = await getOrCreateRateLimitEntry(store, "test-key", WINDOW, now);
  await incrementRateLimitEntry(store, "test-key", entry, now);
  await incrementRateLimitEntry(store, "test-key", { ...entry, count: 1 }, now);

  // Verificar que existe
  const before = await store.get("test-key");
  assert.ok(before !== undefined, "la entrada debe existir antes del delete");
  assert.ok(before!.count >= 1, "la entrada debe tener count > 0");

  // Borrar
  assert.ok(store.delete !== undefined, "el store debe tener método delete");
  await store.delete!("test-key");

  // Verificar que ya no existe
  const after = await store.get("test-key");
  assert.ok(after === undefined, "la entrada debe haber sido eliminada");
});

test("createMemoryRateLimitStore.delete de key inexistente no lanza error", async () => {
  const { createMemoryRateLimitStore: mk } = await import("../../../../server/lib/rate-limit-store.ts");
  const store = mk();

  assert.doesNotReject(async () => {
    await store.delete!("key-que-no-existe");
  });
});
