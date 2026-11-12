import assert from "node:assert/strict";
import test from "node:test";
import type { ParticularToken } from "../../drizzle/schema.ts";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { createFastifyApp } = await import("../../server/fastify-app.ts");
const { createMemoryRateLimitStore, createPersistentRateLimitStore } = await import(
  "../../server/lib/rate-limit-store.ts"
);
const {
  LOGIN_RATE_LIMIT_CODE,
  LOGIN_RATE_LIMIT_UNAVAILABLE_CODE,
  LOGIN_RATE_LIMIT_UNAVAILABLE_MESSAGE,
} = await import("../../server/lib/login-rate-limit.ts");
const { ENV } = await import("../../server/lib/env.ts");
const { assertRequestIdHeader } = await import("../helpers/api-request-id-contract.ts");

// PR-SEC-08 (SEC-06 parte 2): every login and password-change attempt is
// charged to the shared store BEFORE credentials are checked. If the charge
// cannot be made the request ends with a sanitized 503: no credential check,
// no session, no cookie. All identities and values below are synthetic.

type RateLimitStore = ReturnType<typeof createMemoryRateLimitStore>;
type StoreOperation = "get" | "set" | "increment" | "consume" | "delete";

const ORIGIN = "http://localhost:3000";
const NOW = Date.parse("2026-11-12T12:00:00.000Z");
const FUTURE = new Date(NOW + 3_600_000);
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 3;
const SECRET_PASSWORD = "Synthetic-Pass-SEC08!";
const SECRET_NEW_PASSWORD = "Synthetic-New-Pass-SEC08!";
const WRONG_PASSWORD = "Synthetic-Wrong-SEC08";
const SECRET_PARTICULAR_TOKEN = "PART-SYNTH-TOKEN-SEC08-1a2b3c";
const SECRET_SESSION_TOKEN = "synthetic-session-token-sec08";
const CLINICAL_MARKER = "Paciente Sintetico citologia";
const STORE_ERROR_MESSAGE = `store down postgresql://u:p@db.example.com:5432/prod ${CLINICAL_MARKER}`;
const UNAVAILABLE_BODY = {
  success: false,
  error: LOGIN_RATE_LIMIT_UNAVAILABLE_MESSAGE,
  code: LOGIN_RATE_LIMIT_UNAVAILABLE_CODE,
  retryAfterSeconds: 30,
};

type CapturedLine = { raw: string; parsed: Record<string, unknown> | null };

async function captureOutput<T>(run: () => Promise<T>) {
  const lines: CapturedLine[] = [];
  const originals = { log: console.log, warn: console.warn, error: console.error };

  for (const channel of ["log", "warn", "error"] as const) {
    console[channel] = (...args: unknown[]) => {
      const raw = args.map(String).join(" ");
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        parsed = null;
      }
      lines.push({ raw, parsed });
    };
  }

  try {
    return { result: await run(), lines };
  } finally {
    console.log = originals.log;
    console.warn = originals.warn;
    console.error = originals.error;
  }
}

function securityEvents(lines: CapturedLine[]) {
  return lines
    .filter((line) => line.parsed && line.parsed.event !== "HTTP_REQUEST_COMPLETED")
    .map((line) => ({
      event: line.parsed!.event,
      level: line.parsed!.level,
      requestId: line.parsed!.requestId,
    }));
}

function controlledStore(input: {
  failing?: ReadonlySet<StoreOperation>;
  failWhen?: (key: string) => boolean;
} = {}) {
  const memory = createMemoryRateLimitStore();
  const charges: string[] = [];
  const fail = (operation: StoreOperation, key: string) => {
    if (input.failing?.has(operation) || input.failWhen?.(key)) {
      throw new Error(STORE_ERROR_MESSAGE);
    }
  };
  const store: RateLimitStore = {
    get: async (key) => {
      fail("get", key);
      return memory.get(key);
    },
    set: async (key, entry) => {
      fail("set", key);
      return memory.set(key, entry);
    },
    increment: async (key, entry, now) => {
      fail("increment", key);
      return memory.increment!(key, entry, now);
    },
    consume: async (key, consumeInput) => {
      fail("consume", key);
      charges.push(key);
      return memory.consume!(key, consumeInput);
    },
    delete: async (key) => {
      fail("delete", key);
      return memory.delete!(key);
    },
  };

  return { store, charges, memory };
}

function createProbe() {
  return { credentialChecks: 0, sessions: 0, commits: 0, audits: 0, failedAttempts: [] as string[] };
}

function clinicOptions(store: RateLimitStore, probe = createProbe()) {
  const sessions = new Map([[`hash:${SECRET_SESSION_TOKEN}`, { clinicUserId: 7, expiresAt: FUTURE }]]);
  const user = {
    id: 7,
    clinicId: 3,
    username: "clinica-sintetica",
    role: "clinic_owner",
    passwordHash: "argon:clinic",
    authProId: null,
    clinicName: "Clinica Sintetica",
  };
  const unifiedMiss = async () => {
    probe.credentialChecks += 1;
    return null;
  };

  return {
    probe,
    options: {
      now: () => NOW,
      loginRateLimitWindowMs: WINDOW_MS,
      loginRateLimitMaxAttempts: MAX_ATTEMPTS,
      loginRateLimitStore: store,
      createActiveSession: async () => {
        probe.sessions += 1;
      },
      deleteActiveSession: async () => {},
      getActiveSessionByToken: async (tokenHash: string) => sessions.get(tokenHash) ?? null,
      getClinicUserById: async (id: number) => (id === 7 ? user : null),
      getClinicUserByUsername: async () => user,
      getClinicUserByIdentifier: async () => {
        probe.credentialChecks += 1;
        return user;
      },
      getAdminUserByIdentifier: unifiedMiss,
      getParticularTokenByTokenHash: unifiedMiss,
      updateSessionLastAccess: async () => {},
      upsertClinicUser: async () => {},
      changeClinicUserPasswordAndRevokeOtherSessions: async () => {
        probe.commits += 1;
        return { revokedSessionCount: 0 };
      },
      generateSessionToken: () => SECRET_SESSION_TOKEN,
      hashPassword: async (password: string) => `argon:${password}`,
      hashSessionToken: (token: string) => `hash:${token}`,
      verifyPassword: async (password: string, hash: string) => {
        probe.credentialChecks += 1;
        return { valid: hash === "argon:clinic" && password === SECRET_PASSWORD, needsRehash: false };
      },
      writeAuditLog: async () => {
        probe.audits += 1;
      },
      recordLoginFailedAttempt: async (attempt: { reason: string }) => {
        probe.failedAttempts.push(attempt.reason);
      },
    },
  };
}

function adminOptions(store: RateLimitStore, probe = createProbe()) {
  const sessions = new Map([[`hash:${SECRET_SESSION_TOKEN}`, { adminUserId: 1, expiresAt: FUTURE }]]);
  const admin = { id: 1, username: "admin-sintetico", passwordHash: "argon:admin" };

  return {
    probe,
    options: {
      now: () => NOW,
      loginRateLimitWindowMs: WINDOW_MS,
      loginRateLimitMaxAttempts: MAX_ATTEMPTS,
      loginRateLimitStore: store,
      createAdminSession: async () => {
        probe.sessions += 1;
      },
      deleteAdminSession: async () => {},
      getAdminSessionByToken: async (tokenHash: string) => sessions.get(tokenHash) ?? null,
      getAdminUserById: async (id: number) => (id === 1 ? { id: 1, username: admin.username } : null),
      getAdminUserByUsername: async () => {
        probe.credentialChecks += 1;
        return admin;
      },
      getAdminUserForPasswordChange: async () => {
        probe.credentialChecks += 1;
        return admin;
      },
      changeAdminPasswordAndRevokeOtherSessions: async () => {
        probe.commits += 1;
        return { revokedSessionCount: 0 };
      },
      updateAdminSessionLastAccess: async () => {},
      generateSessionToken: () => SECRET_SESSION_TOKEN,
      hashPassword: async (password: string) => `argon:${password}`,
      hashSessionToken: (token: string) => `hash:${token}`,
      verifyPassword: async (password: string, hash: string) => {
        probe.credentialChecks += 1;
        return { valid: hash === "argon:admin" && password === SECRET_PASSWORD, needsRehash: false };
      },
      writeAuditLog: async () => {
        probe.audits += 1;
      },
      recordLoginFailedAttempt: async (attempt: { reason: string }) => {
        probe.failedAttempts.push(attempt.reason);
      },
    },
  };
}

function particularOptions(store: RateLimitStore, probe = createProbe()) {
  const token = {
    id: 41,
    clinicId: 3,
    tokenLast4: "3b3c",
    tutorName: CLINICAL_MARKER,
    petName: CLINICAL_MARKER,
    isActive: true,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
  } as unknown as ParticularToken;

  return {
    probe,
    options: {
      now: () => NOW,
      loginRateLimitWindowMs: WINDOW_MS,
      loginRateLimitMaxAttempts: MAX_ATTEMPTS,
      loginRateLimitStore: store,
      createParticularSession: async () => {
        probe.sessions += 1;
        return {};
      },
      deleteParticularSession: async () => {},
      getParticularSessionByToken: async () => null,
      getParticularTokenById: async () => token,
      getParticularTokenByTokenHash: async (tokenHash: string) => {
        probe.credentialChecks += 1;
        return tokenHash === `hash:${SECRET_PARTICULAR_TOKEN}` ? token : null;
      },
      updateParticularSessionLastAccess: async () => {},
      updateParticularTokenLastLogin: async () => {},
      getClinicScopedReportById: async () => null,
      createSignedReportUrl: async () => "https://storage.invalid/object/sign/x",
      createSignedReportDownloadUrl: async () => "https://storage.invalid/object/sign/x",
      generateSessionToken: () => SECRET_SESSION_TOKEN,
      hashSessionToken: (value: string) => `hash:${value}`,
      recordLoginFailedAttempt: async (attempt: { reason: string }) => {
        probe.failedAttempts.push(attempt.reason);
      },
    },
  };
}

type Surface = {
  name: string;
  build: (store: RateLimitStore) => {
    probe: ReturnType<typeof createProbe>;
    appOptions: Parameters<typeof createFastifyApp>[0];
  };
  url: string;
  payload: (secret: string) => Record<string, string>;
  cookie?: string;
  event: string;
};

const sessionCookie = `${ENV.cookieName}=${SECRET_SESSION_TOKEN}`;
const adminSessionCookie = `admin_session_id=${SECRET_SESSION_TOKEN}`;

const surfaces: Surface[] = [
  {
    name: "clinic login",
    build: (store) => {
      const { probe, options } = clinicOptions(store);
      return { probe, appOptions: { clinicAuthRoutes: options } };
    },
    url: "/api/auth/login",
    payload: (secret) => ({ username: "clinica-sintetica", password: secret }),
    event: "AUTH_LOGIN_RATE_LIMIT_GET_FAILED",
  },
  {
    name: "unified login",
    build: (store) => {
      const { probe, options } = clinicOptions(store);
      return { probe, appOptions: { clinicAuthRoutes: options } };
    },
    url: "/api/auth/login",
    payload: (secret) => ({ identifier: "clinica-sintetica", password: secret }),
    event: "AUTH_LOGIN_RATE_LIMIT_GET_FAILED",
  },
  {
    name: "admin login",
    build: (store) => {
      const { probe, options } = adminOptions(store);
      return { probe, appOptions: { adminAuthRoutes: options } };
    },
    url: "/api/admin/auth/login",
    payload: (secret) => ({ username: "admin-sintetico", password: secret }),
    event: "ADMIN_LOGIN_RATE_LIMIT_GET_FAILED",
  },
  {
    name: "particular login",
    build: (store) => {
      const { probe, options } = particularOptions(store);
      return { probe, appOptions: { particularAuthRoutes: options } };
    },
    url: "/api/particular/auth/login",
    payload: (secret) => ({
      token: secret === SECRET_PASSWORD ? SECRET_PARTICULAR_TOKEN : `PART-WRONG-${secret}`,
    }),
    event: "PARTICULAR_LOGIN_RATE_LIMIT_GET_FAILED",
  },
  {
    name: "clinic password change",
    build: (store) => {
      const { probe, options } = clinicOptions(store);
      return { probe, appOptions: { clinicAuthRoutes: options } };
    },
    url: "/api/auth/change-password",
    payload: (secret) => ({ currentPassword: secret, newPassword: SECRET_NEW_PASSWORD }),
    cookie: sessionCookie,
    event: "AUTH_PASSWORD_CHANGE_RATE_LIMIT_GET_FAILED",
  },
  {
    name: "admin password change",
    build: (store) => {
      const { probe, options } = adminOptions(store);
      return { probe, appOptions: { adminAuthRoutes: options } };
    },
    url: "/api/admin/auth/change-password",
    payload: (secret) => ({ currentPassword: secret, newPassword: SECRET_NEW_PASSWORD }),
    cookie: adminSessionCookie,
    event: "ADMIN_PASSWORD_CHANGE_RATE_LIMIT_GET_FAILED",
  },
];

function inject(app: Awaited<ReturnType<typeof createFastifyApp>>, surface: Surface, secret: string) {
  return app.inject({
    method: "POST",
    url: surface.url,
    headers: { origin: ORIGIN, ...(surface.cookie ? { cookie: surface.cookie } : {}) },
    payload: surface.payload(secret),
  });
}

function assertUnavailable(
  response: Awaited<ReturnType<typeof inject>>,
  label: string,
) {
  assert.equal(response.statusCode, 503, label);
  assert.equal(response.headers["retry-after"], "30", label);
  assert.equal(response.headers["set-cookie"], undefined, `${label} must not set cookies`);
  assert.equal(response.headers["ratelimit-remaining"], undefined, `${label} must not invent a quota`);
  const { requestId, ...body } = JSON.parse(response.body) as Record<string, unknown>;
  assert.deepEqual(body, UNAVAILABLE_BODY, label);
  assert.equal(requestId, assertRequestIdHeader(response, label), `${label} correlates the body`);
  for (const leak of ["store down", "postgresql://", "db.example.com", CLINICAL_MARKER, SECRET_PASSWORD]) {
    assert.equal(response.body.includes(leak), false, `${label} body leaks ${leak}`);
  }
}

for (const surface of surfaces) {
  test(`${surface.name}: store caido antes de autenticar responde 503 sanitizado, sin verificar credenciales ni crear sesion`, async () => {
    const { store } = controlledStore({ failing: new Set(["get", "set", "increment", "consume", "delete"]) });
    const { probe, appOptions } = surface.build(store);
    const app = await createFastifyApp(appOptions);

    try {
      const { result, lines } = await captureOutput(() => inject(app, surface, SECRET_PASSWORD));

      assertUnavailable(result, surface.name);
      assert.deepEqual(
        { credentialChecks: probe.credentialChecks, sessions: probe.sessions, commits: probe.commits, audits: probe.audits },
        { credentialChecks: 0, sessions: 0, commits: 0, audits: 0 },
      );
      assert.deepEqual(probe.failedAttempts, [], "an unchecked attempt is not a failed credential");

      const requestId = assertRequestIdHeader(result, surface.name);
      assert.deepEqual(securityEvents(lines), [{ event: surface.event, level: "error", requestId }]);
      assert.equal(lines.some((line) => line.raw.includes("store down")), false);
      assert.equal(lines.some((line) => line.raw.includes(SECRET_PASSWORD)), false);
    } finally {
      await app.close();
    }
  });

  test(`${surface.name}: lectura disponible pero cobro del intento fallido nunca autentica, ni siquiera mas alla del limite`, async () => {
    const { store } = controlledStore({ failing: new Set(["consume", "increment"]) });
    const { probe, appOptions } = surface.build(store);
    const app = await createFastifyApp(appOptions);

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS + 3; attempt += 1) {
        const secret = attempt === MAX_ATTEMPTS + 3 ? SECRET_PASSWORD : WRONG_PASSWORD;
        const { result } = await captureOutput(() => inject(app, surface, secret));

        assertUnavailable(result, `${surface.name} attempt ${attempt}`);
      }

      assert.equal(probe.credentialChecks, 0);
      assert.equal(probe.sessions, 0);
      assert.equal(probe.commits, 0);
    } finally {
      await app.close();
    }
  });
}

test("los limites normales se conservan: 401 con cuota decreciente, luego 429 aun con la credencial correcta", async () => {
  for (const surface of surfaces.filter((candidate) => !candidate.cookie)) {
    const { store } = controlledStore();
    const { probe, appOptions } = surface.build(store);
    const app = await createFastifyApp(appOptions);

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const { result } = await captureOutput(() => inject(app, surface, WRONG_PASSWORD));

        assert.equal(result.statusCode, 401, `${surface.name} attempt ${attempt}`);
        assert.equal(result.headers["ratelimit-limit"], String(MAX_ATTEMPTS));
        assert.equal(result.headers["ratelimit-remaining"], String(MAX_ATTEMPTS - attempt));
        assert.equal(result.headers["retry-after"], undefined);
      }

      // The particular key is the token itself: only the same token shares the bucket.
      const blockedSecret = surface.name === "particular login" ? WRONG_PASSWORD : SECRET_PASSWORD;
      const checksBeforeBlock = probe.credentialChecks;
      const { result: blocked } = await captureOutput(() => inject(app, surface, blockedSecret));

      assert.equal(blocked.statusCode, 429, surface.name);
      assert.equal(blocked.headers["ratelimit-remaining"], "0");
      assert.equal(blocked.headers["retry-after"], "60");
      assert.equal(blocked.headers["set-cookie"], undefined);
      assert.equal(JSON.parse(blocked.body).code, LOGIN_RATE_LIMIT_CODE);
      assert.equal(probe.credentialChecks, checksBeforeBlock, `${surface.name} 429 must not check credentials`);
      assert.equal(probe.sessions, 0);
      assert.equal(probe.failedAttempts.at(-1), "rate_limited");
    } finally {
      await app.close();
    }
  }
});

test("el ultimo intento permitido con credencial correcta autentica y resetea la cuota", async () => {
  // Particular is excluded: a wrong token and the right token are different buckets.
  for (const surface of surfaces.filter((candidate) => !candidate.cookie && candidate.name !== "particular login")) {
    const { store } = controlledStore();
    const { probe, appOptions } = surface.build(store);
    const app = await createFastifyApp(appOptions);

    try {
      for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
        await captureOutput(() => inject(app, surface, WRONG_PASSWORD));
      }

      const { result } = await captureOutput(() => inject(app, surface, SECRET_PASSWORD));

      assert.equal(result.statusCode, 200, surface.name);
      assert.equal(result.headers["ratelimit-remaining"], String(MAX_ATTEMPTS));
      assert.equal(probe.sessions, 1);

      const { result: afterReset } = await captureOutput(() => inject(app, surface, WRONG_PASSWORD));
      assert.equal(afterReset.statusCode, 401);
      assert.equal(afterReset.headers["ratelimit-remaining"], String(MAX_ATTEMPTS - 1));
    } finally {
      await app.close();
    }
  }
});

test("intentos concurrentes: solo MAX_ATTEMPTS llegan a verificar credenciales", async () => {
  const { store } = controlledStore();
  const surface = surfaces.find((candidate) => candidate.name === "admin login")!;
  const { probe, appOptions } = surface.build(store);
  const app = await createFastifyApp(appOptions);

  try {
    const { result: responses } = await captureOutput(() =>
      Promise.all(Array.from({ length: 12 }, () => inject(app, surface, WRONG_PASSWORD))),
    );
    const statuses = responses.map((response) => response.statusCode).sort();

    assert.deepEqual(statuses.filter((status) => status === 401).length, MAX_ATTEMPTS);
    assert.deepEqual(statuses.filter((status) => status === 429).length, 12 - MAX_ATTEMPTS);
    // admin login = lookup + verify per checked attempt.
    assert.equal(probe.credentialChecks, MAX_ATTEMPTS * 2);
  } finally {
    await app.close();
  }
});

test("fallo de limpieza tras autenticar con exito: 200, warn correlacionado y la cuota refleja el intento cobrado", async () => {
  const cases = [
    { surface: "clinic login", event: "AUTH_LOGIN_RATE_LIMIT_RESET_FAILED" },
    { surface: "admin login", event: "ADMIN_LOGIN_RATE_LIMIT_RESET_FAILED" },
    { surface: "particular login", event: "PARTICULAR_LOGIN_RATE_LIMIT_RESET_FAILED" },
    { surface: "clinic password change", event: "AUTH_PASSWORD_CHANGE_RATE_LIMIT_RESET_FAILED" },
    { surface: "admin password change", event: "ADMIN_PASSWORD_CHANGE_RATE_LIMIT_RESET_FAILED" },
  ];

  for (const { surface: name, event } of cases) {
    const surface = surfaces.find((candidate) => candidate.name === name)!;
    const { store } = controlledStore({ failing: new Set(["delete"]) });
    const { probe, appOptions } = surface.build(store);
    const app = await createFastifyApp(appOptions);

    try {
      const { result, lines } = await captureOutput(() => inject(app, surface, SECRET_PASSWORD));
      const requestId = assertRequestIdHeader(result, name);

      assert.equal(result.statusCode, 200, name);
      assert.equal(result.headers["ratelimit-remaining"], String(MAX_ATTEMPTS - 1), name);
      assert.equal(probe.sessions + probe.commits, 1, `${name} completes its single effect`);
      assert.deepEqual(securityEvents(lines), [{ event, level: "warn", requestId }]);
      assert.equal(lines.some((line) => line.raw.includes("store down")), false);

      const { result: next } = await captureOutput(() => inject(app, surface, SECRET_PASSWORD));
      assert.equal(next.statusCode, 200, name);
      assert.equal(next.headers["ratelimit-remaining"], String(MAX_ATTEMPTS - 2), `${name} keeps counting`);
    } finally {
      await app.close();
    }
  }
});

test("cleanupExpired del store persistente es mantenimiento: su fallo no bloquea ni abre el limite", async () => {
  const rows = new Map<string, { count: number; resetAt: Date }>();
  const adapter = {
    get: async (keyHash: string) => rows.get(keyHash),
    set: async ({ keyHash, count, resetAt }: { keyHash: string; count: number; resetAt: Date }) => {
      rows.set(keyHash, { count, resetAt });
      return rows.get(keyHash);
    },
    increment: async ({ keyHash, count, resetAt }: { keyHash: string; count: number; resetAt: Date }) => {
      rows.set(keyHash, { count, resetAt });
      return rows.get(keyHash)!;
    },
    consume: async ({ keyHash, resetAt, now }: { keyHash: string; resetAt: Date; now: Date }) => {
      const current = rows.get(keyHash);
      const next =
        !current || current.resetAt <= now
          ? { count: 1, resetAt }
          : { count: current.count + 1, resetAt: current.resetAt };
      rows.set(keyHash, next);
      return next;
    },
    cleanupExpired: async () => {
      throw new Error(STORE_ERROR_MESSAGE);
    },
    delete: async (keyHash: string) => {
      rows.delete(keyHash);
    },
  };
  const surface = surfaces.find((candidate) => candidate.name === "clinic login")!;
  const { probe, appOptions } = surface.build(createPersistentRateLimitStore(adapter, { now: () => NOW }));
  const app = await createFastifyApp(appOptions);

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const { result } = await captureOutput(() => inject(app, surface, WRONG_PASSWORD));
      assert.equal(result.statusCode, 401);
    }

    const { result: blocked } = await captureOutput(() => inject(app, surface, SECRET_PASSWORD));
    assert.equal(blocked.statusCode, 429);
    assert.equal(probe.sessions, 0);

    adapter.consume = async () => {
      throw new Error(STORE_ERROR_MESSAGE);
    };
    rows.clear();
    const { result: unavailable } = await captureOutput(() => inject(app, surface, SECRET_PASSWORD));
    assertUnavailable(unavailable, "persistent consume failure");
    assert.equal(probe.sessions, 0);
  } finally {
    await app.close();
  }
});

test("el fallo del store para un actor no altera el limite de otros actores ni superficies", async () => {
  const { store } = controlledStore({ failWhen: (key) => key.includes(":admin:") });
  const admin = surfaces.find((candidate) => candidate.name === "admin login")!;
  const clinic = surfaces.find((candidate) => candidate.name === "clinic login")!;
  const adminApp = await createFastifyApp(admin.build(store).appOptions);
  const clinicBuild = clinic.build(store);
  const clinicApp = await createFastifyApp(clinicBuild.appOptions);

  try {
    const { result: adminResult } = await captureOutput(() => inject(adminApp, admin, SECRET_PASSWORD));
    assertUnavailable(adminResult, "admin key failure");

    const { result: clinicResult } = await captureOutput(() => inject(clinicApp, clinic, SECRET_PASSWORD));
    assert.equal(clinicResult.statusCode, 200);
    assert.equal(clinicBuild.probe.sessions, 1);
  } finally {
    await adminApp.close();
    await clinicApp.close();
  }
});
