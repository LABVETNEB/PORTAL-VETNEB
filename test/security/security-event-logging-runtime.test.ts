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
const { createMemoryRateLimitStore } = await import("../../server/lib/rate-limit-store.ts");
const { ENV } = await import("../../server/lib/env.ts");
const { assertRequestIdHeader } = await import("../helpers/api-request-id-contract.ts");

// SEC-06 parte 1 (PR-SEC-07): the production app is built with
// `logger: false`, so `request.log.*` is a no-op. These specs boot the real
// factory and read what actually reaches the process output.

const ORIGIN = "http://localhost:3000";
const NOW = Date.parse("2026-11-12T12:00:00.000Z");
const FUTURE = new Date(NOW + 3_600_000);

// Synthetic sensitive material: none of it may reach a log line.
const SECRET_PASSWORD = "Synthetic-Pass-SEC07!";
const SECRET_NEW_PASSWORD = "Synthetic-New-Pass-SEC07!";
const SECRET_PARTICULAR_TOKEN = "PART-SYNTH-TOKEN-SEC07-9f8e7d";
const SECRET_SESSION_TOKEN = "synthetic-session-token-sec07";
const CLINICAL_MARKER = "Paciente Firulais biopsia";
const STORE_ERROR_MESSAGE =
  `store down postgresql://u:p@db.example.com:5432/prod ${CLINICAL_MARKER} ${SECRET_PASSWORD}`;

type Channel = "log" | "warn" | "error";
type CapturedLine = { channel: Channel; raw: string; parsed: Record<string, unknown> | null };

async function captureOutput<T>(run: () => Promise<T>) {
  const lines: CapturedLine[] = [];
  const rawWrites: string[] = [];
  const originals = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    stdout: process.stdout.write,
    stderr: process.stderr.write,
  };

  for (const channel of ["log", "warn", "error"] as const) {
    console[channel] = (...args: unknown[]) => {
      const raw = args.map(String).join(" ");
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        parsed = null;
      }
      lines.push({ channel, raw, parsed });
    };
  }

  const recordWrite = (chunk: unknown) => {
    rawWrites.push(String(chunk));
    return true;
  };
  process.stdout.write = recordWrite as typeof process.stdout.write;
  process.stderr.write = recordWrite as typeof process.stderr.write;

  try {
    const result = await run();
    return { result, lines, rawWrites };
  } finally {
    console.log = originals.log;
    console.warn = originals.warn;
    console.error = originals.error;
    process.stdout.write = originals.stdout;
    process.stderr.write = originals.stderr;
  }
}

type StoreOperation = "get" | "set" | "increment" | "consume" | "delete";

function createFailingStore(failing: ReadonlySet<StoreOperation>) {
  const memory = createMemoryRateLimitStore();
  const fail = (operation: StoreOperation) => {
    if (failing.has(operation)) {
      throw new Error(STORE_ERROR_MESSAGE);
    }
  };

  return {
    get: async (key: string) => {
      fail("get");
      return memory.get(key);
    },
    set: async (key: string, entry: { count: number; resetAt: number }) => {
      fail("set");
      return memory.set(key, entry);
    },
    increment: async (key: string, entry: { count: number; resetAt: number }, now?: number) => {
      fail("increment");
      return memory.increment!(key, entry, now);
    },
    consume: async (key: string, input: { windowMs: number; now: number; units?: number }) => {
      fail("consume");
      return memory.consume!(key, input);
    },
    delete: async (key: string) => {
      fail("delete");
      return memory.delete?.(key);
    },
  };
}

const allStoreOperations = new Set<StoreOperation>(["get", "set", "increment", "consume", "delete"]);

function failingRecorder() {
  return async () => {
    throw new Error(STORE_ERROR_MESSAGE);
  };
}

function buildClinicAuthOptions(input: {
  failing: ReadonlySet<StoreOperation>;
  commitFailure?: boolean;
  auditCalls?: unknown[];
}) {
  const sessions = new Map([[`hash:${SECRET_SESSION_TOKEN}`, { clinicUserId: 7, expiresAt: FUTURE }]]);
  const user = {
    id: 7,
    clinicId: 3,
    username: "clinica-sintetica",
    role: "clinic_owner",
    passwordHash: "legacy:clinic",
    authProId: null,
    clinicName: "Clinica Sintetica",
  };

  return {
    now: () => NOW,
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: 10,
    loginRateLimitStore: createFailingStore(input.failing),
    createActiveSession: async () => {},
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async (tokenHash: string) => sessions.get(tokenHash) ?? null,
    getClinicUserById: async (id: number) => (id === 7 ? user : null),
    getClinicUserByUsername: async () => null,
    getClinicUserByIdentifier: async () => null,
    updateSessionLastAccess: async () => {},
    upsertClinicUser: async () => {},
    changeClinicUserPasswordAndRevokeOtherSessions: async () => {
      if (input.commitFailure) {
        throw new Error(STORE_ERROR_MESSAGE);
      }
      return { revokedSessionCount: 0 };
    },
    generateSessionToken: () => SECRET_SESSION_TOKEN,
    hashPassword: async (password: string) => `hashed:${password}`,
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: async (password: string, hash: string) => ({
      valid: hash === "legacy:clinic" && password === SECRET_PASSWORD,
      needsRehash: false,
    }),
    writeAuditLog: async (_request: unknown, call: unknown) => {
      input.auditCalls?.push(call);
    },
    recordLoginFailedAttempt: failingRecorder(),
  };
}

function buildAdminAuthOptions(failing: ReadonlySet<StoreOperation>) {
  return {
    now: () => NOW,
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: 10,
    loginRateLimitStore: createFailingStore(failing),
    createAdminSession: async () => {},
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    getAdminUserByUsername: async () => null,
    updateAdminSessionLastAccess: async () => {},
    generateSessionToken: () => SECRET_SESSION_TOKEN,
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: async () => ({ valid: false, needsRehash: false }),
    writeAuditLog: async () => {},
    recordLoginFailedAttempt: failingRecorder(),
  };
}

function buildParticularAuthOptions(input: {
  failing: ReadonlySet<StoreOperation>;
  tokenExists: boolean;
}) {
  const token = {
    id: 41,
    clinicId: 3,
    tokenLast4: "7d00",
    tutorName: CLINICAL_MARKER,
    petName: CLINICAL_MARKER,
    isActive: true,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
  } as unknown as ParticularToken;

  return {
    now: () => NOW,
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: 10,
    loginRateLimitStore: createFailingStore(input.failing),
    createParticularSession: async () => ({}),
    deleteParticularSession: async () => {},
    getParticularSessionByToken: async () => null,
    getParticularTokenById: async () => (input.tokenExists ? token : null),
    getParticularTokenByTokenHash: async () => (input.tokenExists ? token : null),
    updateParticularSessionLastAccess: async () => {},
    updateParticularTokenLastLogin: async () => {},
    getClinicScopedReportById: async () => null,
    createSignedReportUrl: async () => "https://storage.invalid/object/sign/x?token=abc",
    createSignedReportDownloadUrl: async () => "https://storage.invalid/object/sign/x?token=abc",
    generateSessionToken: () => SECRET_SESSION_TOKEN,
    hashSessionToken: (token: string) => `hash:${token}`,
    recordLoginFailedAttempt: failingRecorder(),
  };
}

function securityEvents(lines: CapturedLine[]) {
  return lines
    .filter((line) => line.parsed && line.parsed.event !== "HTTP_REQUEST_COMPLETED")
    .map((line) => ({
      channel: line.channel,
      level: line.parsed!.level,
      event: line.parsed!.event,
      requestId: line.parsed!.requestId,
      context: line.parsed!.context as Record<string, unknown>,
    }));
}

function assertNoSensitiveOutput(lines: CapturedLine[], rawWrites: string[]) {
  const output = [...lines.map((line) => line.raw), ...rawWrites].join("\n");

  for (const secret of [
    SECRET_PASSWORD,
    SECRET_NEW_PASSWORD,
    SECRET_PARTICULAR_TOKEN,
    SECRET_SESSION_TOKEN,
    `hash:${SECRET_SESSION_TOKEN}`,
    CLINICAL_MARKER,
    "postgresql://",
    "db.example.com",
    "store down",
    "object/sign",
    ENV.cookieName,
  ]) {
    assert.equal(output.includes(secret), false, `log output must not contain ${secret}`);
  }
}

function assertCorrelated(
  events: ReturnType<typeof securityEvents>,
  response: Parameters<typeof assertRequestIdHeader>[0],
) {
  const requestId = assertRequestIdHeader(response, "security event response");

  for (const event of events) {
    assert.equal(event.requestId, requestId, `${String(event.event)} must carry the request id`);
    assert.deepEqual(event.context.errorName, "Error");
    assert.equal(event.channel === "error" ? "error" : "warn", event.level);
  }
}

test("causa raiz: request.log del app productivo descarta el evento (logger: false)", async () => {
  const app = await createFastifyApp();
  app.get("/api/sec07-probe", async (request) => {
    request.log.error({ code: "SEC07_PROBE_EVENT" }, "probe");
    request.log.warn({ code: "SEC07_PROBE_EVENT" }, "probe");
    return { ok: true };
  });

  try {
    const { result, lines, rawWrites } = await captureOutput(() =>
      app.inject({ method: "GET", url: "/api/sec07-probe" }),
    );

    assert.equal(result.statusCode, 200);
    const output = [...lines.map((line) => line.raw), ...rawWrites].join("\n");
    assert.equal(output.includes("SEC07_PROBE_EVENT"), false);
  } finally {
    await app.close();
  }
});

test("login de clinica con store caido emite eventos reales, correlacionados y redactados", async () => {
  const app = await createFastifyApp({
    clinicAuthRoutes: buildClinicAuthOptions({ failing: allStoreOperations }),
  });

  try {
    const { result, lines, rawWrites } = await captureOutput(() =>
      app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { origin: ORIGIN },
        payload: { identifier: "clinica-sintetica", password: SECRET_PASSWORD },
      }),
    );

    // PR-SEC-08: the attempt cannot be charged, so credentials are never checked.
    assert.equal(result.statusCode, 503);
    assert.equal(result.headers["set-cookie"], undefined);
    const events = securityEvents(lines);
    assert.deepEqual(
      events.map((event) => [event.event, event.level]),
      [["AUTH_LOGIN_RATE_LIMIT_GET_FAILED", "error"]],
    );
    assert.deepEqual(events[0].context, {
      route: "/api/auth/login",
      errorName: "Error",
    });
    assertCorrelated(events, result);
    assertNoSensitiveOutput(lines, rawWrites);

    const completion = lines.find((line) => line.parsed?.event === "HTTP_REQUEST_COMPLETED");
    assert.equal((completion?.parsed?.context as Record<string, unknown>)?.statusCode, 503);
  } finally {
    await app.close();
  }
});

test("login de clinica sin credenciales con store caido registra el fallo del rate limit", async () => {
  const app = await createFastifyApp({
    clinicAuthRoutes: buildClinicAuthOptions({ failing: allStoreOperations }),
  });

  try {
    const { result, lines, rawWrites } = await captureOutput(() =>
      app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { origin: ORIGIN },
        payload: {},
      }),
    );

    assert.equal(result.statusCode, 400);
    const events = securityEvents(lines);
    assert.deepEqual(
      events.map((event) => [event.event, event.level]),
      [
        ["AUTH_LOGIN_MISSING_CREDENTIALS_RATE_LIMIT_FAILED", "error"],
        ["AUTH_LOGIN_FAILED_ATTEMPT_RECORD_FAILED", "warn"],
      ],
    );
    assertCorrelated(events, result);
    assertNoSensitiveOutput(lines, rawWrites);
  } finally {
    await app.close();
  }
});

test("login de admin con store caido emite eventos reales y no registra exito", async () => {
  const app = await createFastifyApp({
    adminAuthRoutes: buildAdminAuthOptions(allStoreOperations),
  });

  try {
    const { result, lines, rawWrites } = await captureOutput(() =>
      app.inject({
        method: "POST",
        url: "/api/admin/auth/login",
        headers: { origin: ORIGIN },
        payload: { username: "admin-sintetico", password: SECRET_PASSWORD },
      }),
    );

    assert.equal(result.statusCode, 503);
    assert.equal(result.headers["set-cookie"], undefined);
    const events = securityEvents(lines);
    assert.deepEqual(
      events.map((event) => [event.event, event.level]),
      [["ADMIN_LOGIN_RATE_LIMIT_GET_FAILED", "error"]],
    );
    assertCorrelated(events, result);
    assertNoSensitiveOutput(lines, rawWrites);
    assert.equal(
      lines.some((line) => /SUCCE|_OK"/.test(String(line.parsed?.event ?? ""))),
      false,
    );
  } finally {
    await app.close();
  }
});

test("login de particular con store caido emite eventos sin token ni datos clinicos", async () => {
  const app = await createFastifyApp({
    particularAuthRoutes: buildParticularAuthOptions({
      failing: allStoreOperations,
      tokenExists: false,
    }),
  });

  try {
    const { result, lines, rawWrites } = await captureOutput(() =>
      app.inject({
        method: "POST",
        url: "/api/particular/auth/login",
        headers: { origin: ORIGIN },
        payload: { token: SECRET_PARTICULAR_TOKEN },
      }),
    );

    assert.equal(result.statusCode, 503);
    assert.equal(result.headers["set-cookie"], undefined);
    const events = securityEvents(lines);
    assert.deepEqual(
      events.map((event) => [event.event, event.level]),
      [["PARTICULAR_LOGIN_RATE_LIMIT_GET_FAILED", "error"]],
    );
    assertCorrelated(events, result);
    assertNoSensitiveOutput(lines, rawWrites);
  } finally {
    await app.close();
  }
});

test("login exitoso de particular con limpieza de rate limit fallida emite warn y responde 200", async () => {
  const app = await createFastifyApp({
    particularAuthRoutes: buildParticularAuthOptions({
      failing: new Set<StoreOperation>(["delete"]),
      tokenExists: true,
    }),
  });

  try {
    const { result, lines, rawWrites } = await captureOutput(() =>
      app.inject({
        method: "POST",
        url: "/api/particular/auth/login",
        headers: { origin: ORIGIN },
        payload: { token: SECRET_PARTICULAR_TOKEN },
      }),
    );

    assert.equal(result.statusCode, 200);
    const events = securityEvents(lines);
    assert.deepEqual(
      events.map((event) => [event.event, event.level, event.channel]),
      [["PARTICULAR_LOGIN_RATE_LIMIT_RESET_FAILED", "warn", "warn"]],
    );
    assertCorrelated(events, result);
    assertNoSensitiveOutput(lines, rawWrites);
  } finally {
    await app.close();
  }
});

test("cambio de contrasena de clinica que falla registra error correlacionado, 500 sanitizado y sin audit", async () => {
  const auditCalls: unknown[] = [];
  const app = await createFastifyApp({
    clinicAuthRoutes: buildClinicAuthOptions({
      failing: new Set<StoreOperation>(),
      commitFailure: true,
      auditCalls,
    }),
  });

  try {
    const { result, lines, rawWrites } = await captureOutput(() =>
      app.inject({
        method: "POST",
        url: "/api/auth/change-password",
        headers: {
          origin: ORIGIN,
          cookie: `${ENV.cookieName}=${SECRET_SESSION_TOKEN}`,
        },
        payload: {
          currentPassword: SECRET_PASSWORD,
          newPassword: SECRET_NEW_PASSWORD,
        },
      }),
    );

    assert.equal(result.statusCode, 500);
    assert.equal(result.body.includes("store down"), false);
    assert.equal(result.body.includes("postgresql://"), false);
    const events = securityEvents(lines);
    assert.deepEqual(
      events.map((event) => [event.event, event.level]),
      [["AUTH_PASSWORD_CHANGE_COMMIT_FAILED", "error"]],
    );
    assertCorrelated(events, result);
    assertNoSensitiveOutput(lines, rawWrites);
    assert.deepEqual(auditCalls, []);
  } finally {
    await app.close();
  }
});
