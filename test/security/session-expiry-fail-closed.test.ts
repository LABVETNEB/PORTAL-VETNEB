import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../../server/lib/env.ts");
const { clinicAuthNativeRoutes } = await import("../../server/routes/auth.fastify.ts");
const { adminAuthNativeRoutes } = await import("../../server/routes/admin-auth.fastify.ts");
const { particularAuthNativeRoutes } = await import("../../server/routes/particular-auth.fastify.ts");
const { particularAuditNativeRoutes } = await import("../../server/routes/particular-audit.fastify.ts");
const { particularStudyTrackingNativeRoutes } = await import(
  "../../server/routes/particular-study-tracking.fastify.ts"
);
const { adminAuditNativeRoutes } = await import("../../server/routes/admin-audit.fastify.ts");
const { authenticateFastifyAdmin } = await import("../../server/lib/fastify-admin-auth.ts");
const {
  getAdminSessionLastAccessRefreshIntervalMs,
  isSessionExpired,
  isSessionIdle,
  SESSION_CLOCK_SKEW_TOLERANCE_MS,
} = await import("../../server/lib/session-expiry.ts");

const NOW = Date.UTC(2026, 10, 12, 12, 0, 0);
const MINUTE = 60_000;
const IDLE_MS = ENV.adminSessionIdleTimeoutMs;
const FUTURE = new Date(NOW + 60 * MINUTE);

type SessionRow = { expiresAt: Date | null; lastAccess: Date | null };

type Counters = {
  deletes: string[];
  lastAccessUpdates: string[];
  protectedReads: number;
  userLookups: number;
};

const CLINIC_USER = { id: 11, clinicId: 7, username: "clinic-user", authProId: null, role: "clinic_owner" as const };
const ADMIN_USER = { id: 91, username: "ADMIN" };
const PARTICULAR_TOKEN = {
  id: 501,
  clinicId: 7,
  reportId: 301,
  tokenLast4: "ABCD",
  tutorLastName: "Synthetic",
  petName: "Luna",
  petAge: "7",
  petBreed: "Mixed",
  petSex: "F",
  petSpecies: "Canina",
  sampleLocation: "Oreja",
  sampleEvolution: "2 semanas",
  detailsLesion: "Nodular",
  extractionDate: new Date("2026-01-10T00:00:00.000Z"),
  shippingDate: new Date("2026-01-11T00:00:00.000Z"),
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date("2026-01-10T00:00:00.000Z"),
  updatedAt: new Date("2026-01-12T00:00:00.000Z"),
  createdByAdminId: 91,
  createdByClinicUserId: null,
};

function newCounters(): Counters {
  return { deletes: [], lastAccessUpdates: [], protectedReads: 0, userLookups: 0 };
}

async function buildApp(session: SessionRow | null, clock: { value: number }, counters: Counters) {
  const app = Fastify();
  const now = () => clock.value;
  const row = (extra: Record<string, unknown>) => (session ? { ...session, ...extra } : null);

  await app.register(clinicAuthNativeRoutes, {
    prefix: "/api/auth",
    now,
    getActiveSessionByToken: async () => row({ clinicUserId: CLINIC_USER.id }),
    deleteActiveSession: async (hash: string) => void counters.deletes.push(hash),
    getClinicUserById: async () => {
      counters.userLookups += 1;
      return CLINIC_USER;
    },
    updateSessionLastAccess: async (hash: string) => void counters.lastAccessUpdates.push(hash),
    hashSessionToken: (token: string) => `clinic:${token}`,
  } as any);

  await app.register(adminAuthNativeRoutes as any, {
    prefix: "/api/admin/auth",
    now,
    getAdminSessionByToken: async () => row({ adminUserId: ADMIN_USER.id }),
    deleteAdminSession: async (hash: string) => void counters.deletes.push(hash),
    getAdminUserById: async () => {
      counters.userLookups += 1;
      return ADMIN_USER;
    },
    updateAdminSessionLastAccess: async (hash: string) => void counters.lastAccessUpdates.push(hash),
    hashSessionToken: (token: string) => `admin:${token}`,
  });

  const particularAuth = {
    now,
    getParticularSessionByToken: async () => row({ particularTokenId: PARTICULAR_TOKEN.id }),
    deleteParticularSession: async (hash: string) => void counters.deletes.push(hash),
    getParticularTokenById: async () => {
      counters.userLookups += 1;
      return PARTICULAR_TOKEN;
    },
    updateParticularSessionLastAccess: async (hash: string) => void counters.lastAccessUpdates.push(hash),
    hashSessionToken: (token: string) => `particular:${token}`,
  };

  await app.register(particularAuthNativeRoutes as any, { prefix: "/api/particular/auth", ...particularAuth });

  await app.register(particularAuditNativeRoutes as any, {
    prefix: "/api/particular/audit-log",
    ...particularAuth,
    buildParticularAuditListFilters: () => ({ filters: { limit: 50, offset: 0 }, errors: [] }),
    listParticularAuditLog: async () => {
      counters.protectedReads += 1;
      return { items: [], total: 0 };
    },
  });

  await app.register(particularStudyTrackingNativeRoutes as any, {
    prefix: "/api/particular/study-tracking",
    ...particularAuth,
    getParticularStudyTrackingCase: async () => {
      counters.protectedReads += 1;
      return null;
    },
    listStudyTrackingNotifications: async () => [],
  });

  await app.register(adminAuditNativeRoutes as any, {
    prefix: "/api/admin/audit-log",
    now,
    getAdminSessionByToken: async () => row({ adminUserId: ADMIN_USER.id }),
    deleteAdminSession: async (hash: string) => void counters.deletes.push(hash),
    getAdminUserById: async () => ADMIN_USER,
    updateAdminSessionLastAccess: async (hash: string) => void counters.lastAccessUpdates.push(hash),
    hashSessionToken: (token: string) => `admin:${token}`,
    buildAdminAuditListFilters: () => ({ filters: { limit: 50, offset: 0 }, errors: [] }),
    listAuditLog: async () => {
      counters.protectedReads += 1;
      return { items: [], total: 0 };
    },
    buildAdminAuditCsv: () => "",
    buildAdminAuditCsvFilename: () => "audit.csv",
  });

  return app;
}

type Actor = {
  name: string;
  cookieName: string;
  protectedUrl: string;
  meUrl: string;
  clearsCookieOnReject: boolean;
};

function buildActors(): Actor[] {
  return [
  { name: "clinic", cookieName: ENV.cookieName, protectedUrl: "/api/auth/me", meUrl: "/api/auth/me", clearsCookieOnReject: true },
  { name: "admin", cookieName: ENV.adminCookieName, protectedUrl: "/api/admin/audit-log", meUrl: "/api/admin/auth/me", clearsCookieOnReject: true },
  { name: "particular", cookieName: ENV.particularCookieName, protectedUrl: "/api/particular/audit-log", meUrl: "/api/particular/auth/me", clearsCookieOnReject: true },
  ];
}

const ACTORS = buildActors();

async function call(app: FastifyInstance, actor: Actor, url: string) {
  const response = await app.inject({
    method: "GET",
    url,
    headers: { cookie: `${actor.cookieName}=synthetic-session-token` },
  });
  const setCookie = String(response.headers["set-cookie"] ?? "");

  return { status: response.statusCode, setCookie };
}

function activeAdminLastAccess(offsetMs = 0) {
  return new Date(NOW - offsetMs);
}

for (const actor of ACTORS) {
  const fresh = activeAdminLastAccess(MINUTE);

  test(`${actor.name}: expiresAt nulo responde 401, limpia cookie, borra la sesión y no consulta usuario ni datos`, async () => {
    const counters = newCounters();
    const app = await buildApp({ expiresAt: null, lastAccess: fresh }, { value: NOW }, counters);

    try {
      for (const url of new Set([actor.meUrl, actor.protectedUrl])) {
        const result = await call(app, actor, url);

        assert.equal(result.status, 401, url);
        assert.match(result.setCookie, new RegExp(`${actor.cookieName}=;`), url);
        assert.match(result.setCookie, /Max-Age=0/, url);
      }

      assert.ok(counters.deletes.length >= 1);
      assert.equal(counters.userLookups, 0);
      assert.equal(counters.protectedReads, 0);
      assert.deepEqual(counters.lastAccessUpdates, []);
    } finally {
      await app.close();
    }
  });

  test(`${actor.name}: expiresAt inválido (Invalid Date) responde 401 sin acceder a datos`, async () => {
    const counters = newCounters();
    const app = await buildApp({ expiresAt: new Date("not-a-date"), lastAccess: fresh }, { value: NOW }, counters);

    try {
      const result = await call(app, actor, actor.protectedUrl);

      assert.equal(result.status, 401);
      assert.equal(counters.userLookups, 0);
      assert.equal(counters.protectedReads, 0);
    } finally {
      await app.close();
    }
  });

  test(`${actor.name}: vencimiento exacto rechazado y un milisegundo antes aceptado`, async () => {
    const atLimit = newCounters();
    const limitApp = await buildApp({ expiresAt: new Date(NOW), lastAccess: fresh }, { value: NOW }, atLimit);
    const before = newCounters();
    const beforeApp = await buildApp({ expiresAt: new Date(NOW + 1), lastAccess: fresh }, { value: NOW }, before);

    try {
      assert.equal((await call(limitApp, actor, actor.protectedUrl)).status, 401);
      assert.equal(atLimit.protectedReads, 0);
      assert.equal((await call(beforeApp, actor, actor.protectedUrl)).status, 200);
    } finally {
      await limitApp.close();
      await beforeApp.close();
    }
  });

  test(`${actor.name}: sesión con expiración futura válida conserva su comportamiento`, async () => {
    const counters = newCounters();
    const app = await buildApp({ expiresAt: FUTURE, lastAccess: fresh }, { value: NOW }, counters);

    try {
      const result = await call(app, actor, actor.protectedUrl);

      assert.equal(result.status, 200);
      assert.equal(result.setCookie, "");
      assert.deepEqual(counters.deletes, []);
    } finally {
      await app.close();
    }
  });
}

test("rutas particulares de seguimiento: expiresAt nulo responde 401 y no lee el caso", async () => {
  const counters = newCounters();
  const app = await buildApp({ expiresAt: null, lastAccess: activeAdminLastAccess() }, { value: NOW }, counters);

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/particular/study-tracking/me",
      headers: { cookie: `${ENV.particularCookieName}=synthetic-session-token` },
    });

    assert.equal(response.statusCode, 401);
    assert.match(String(response.headers["set-cookie"]), /Max-Age=0/);
    assert.equal(counters.protectedReads, 0);
    assert.equal(counters.userLookups, 0);
  } finally {
    await app.close();
  }
});

const ADMIN_ACTOR = ACTORS[1];

async function adminAt(lastAccess: Date | null, expiresAt: Date | null = FUTURE) {
  const counters = newCounters();
  const app = await buildApp({ expiresAt, lastAccess }, { value: NOW }, counters);

  return { counters, app };
}

test("admin: inactividad bajo el umbral conserva acceso", async () => {
  const { app, counters } = await adminAt(new Date(NOW - (IDLE_MS - 1)));

  try {
    assert.equal((await call(app, ADMIN_ACTOR, ADMIN_ACTOR.protectedUrl)).status, 200);
    assert.equal(counters.protectedReads, 1);
  } finally {
    await app.close();
  }
});

for (const [label, lastAccess] of [
  ["exactamente igual al umbral", new Date(NOW - IDLE_MS)],
  ["superior al umbral", new Date(NOW - IDLE_MS - 1)],
  ["muy superior al umbral con cookie todavía vigente", new Date(NOW - 20 * 60 * MINUTE)],
  ["lastAccess nulo", null],
  ["lastAccess inválido", new Date("garbage")],
  ["lastAccess futuro más allá de la tolerancia de reloj", new Date(NOW + SESSION_CLOCK_SKEW_TOLERANCE_MS + 1)],
] as const) {
  test(`admin: inactividad ${label} responde 401, limpia cookie, revoca sesión y no lee datos`, async () => {
    const { app, counters } = await adminAt(lastAccess);

    try {
      const result = await call(app, ADMIN_ACTOR, ADMIN_ACTOR.protectedUrl);

      assert.equal(result.status, 401);
      assert.match(result.setCookie, /Max-Age=0/);
      assert.equal(counters.deletes.length, 1);
      assert.equal(counters.protectedReads, 0);
      assert.deepEqual(counters.lastAccessUpdates, []);
    } finally {
      await app.close();
    }
  });
}

test("admin: lastAccess futuro dentro de la tolerancia de reloj se trata como actividad", async () => {
  const { app } = await adminAt(new Date(NOW + SESSION_CLOCK_SKEW_TOLERANCE_MS));

  try {
    assert.equal((await call(app, ADMIN_ACTOR, ADMIN_ACTOR.protectedUrl)).status, 200);
  } finally {
    await app.close();
  }
});

test("admin: sesión absolutamente vencida se rechaza aunque lastAccess sea reciente", async () => {
  const { app, counters } = await adminAt(new Date(NOW - MINUTE), new Date(NOW - 1));

  try {
    assert.equal((await call(app, ADMIN_ACTOR, ADMIN_ACTOR.protectedUrl)).status, 401);
    assert.equal(counters.protectedReads, 0);
  } finally {
    await app.close();
  }
});

test("admin: lastAccess se refresca con el intervalo acotado por el umbral de inactividad", async () => {
  const interval = getAdminSessionLastAccessRefreshIntervalMs(IDLE_MS);

  assert.ok(interval < IDLE_MS);
  assert.ok(interval <= 10 * MINUTE);

  const stale = await adminAt(new Date(NOW - interval));
  const recent = await adminAt(new Date(NOW - interval + 1));

  try {
    assert.equal((await call(stale.app, ADMIN_ACTOR, ADMIN_ACTOR.protectedUrl)).status, 200);
    assert.equal(stale.counters.lastAccessUpdates.length, 1);
    assert.equal((await call(recent.app, ADMIN_ACTOR, ADMIN_ACTOR.protectedUrl)).status, 200);
    assert.equal(recent.counters.lastAccessUpdates.length, 0);
  } finally {
    await stale.app.close();
    await recent.app.close();
  }
});

test("clínica y particular no tienen timeout de inactividad (sólo expiración absoluta)", async () => {
  for (const actor of [ACTORS[0], ACTORS[2]]) {
    const counters = newCounters();
    const app = await buildApp(
      { expiresAt: FUTURE, lastAccess: new Date(NOW - 20 * 60 * MINUTE) },
      { value: NOW },
      counters,
    );

    try {
      assert.equal((await call(app, actor, actor.protectedUrl)).status, 200, actor.name);
    } finally {
      await app.close();
    }
  }
});

test("admin: el contexto por request no reutiliza una sesión que venció entre solicitudes", async () => {
  const clock = { value: NOW };
  const deleted: string[] = [];
  const deps = {
    deleteAdminSession: async (hash: string) => void deleted.push(hash),
    getAdminSessionByToken: async () => ({
      adminUserId: ADMIN_USER.id,
      expiresAt: FUTURE,
      lastAccess: new Date(NOW),
    }),
    getAdminUserById: async () => ADMIN_USER,
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `admin:${token}`,
    now: () => clock.value,
  };
  const makeRequest = () =>
    ({
      id: "synthetic-request",
      headers: { cookie: `${ENV.adminCookieName}=synthetic-session-token` },
    }) as any;
  const makeReply = () => {
    const reply = {
      statusCode: 200,
      code(code: number) {
        reply.statusCode = code;
        return reply;
      },
      header() {
        return reply;
      },
      send() {
        return reply;
      },
    };

    return reply;
  };

  const first = makeReply();
  assert.ok(await authenticateFastifyAdmin(makeRequest(), first as any, deps));
  assert.equal(first.statusCode, 200);

  clock.value = NOW + IDLE_MS;
  const second = makeReply();
  assert.equal(await authenticateFastifyAdmin(makeRequest(), second as any, deps), null);
  assert.equal(second.statusCode, 401);
  assert.equal(deleted.length, 1);
});

test("admin: idleTimeoutMs inyectado reemplaza el umbral por defecto", async () => {
  const deps = (idleTimeoutMs: number) => ({
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => ({
      adminUserId: ADMIN_USER.id,
      expiresAt: FUTURE,
      lastAccess: new Date(NOW - 10 * MINUTE),
    }),
    getAdminUserById: async () => ADMIN_USER,
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `admin:${token}`,
    now: () => NOW,
    idleTimeoutMs,
  });
  const request = () =>
    ({ id: "r", headers: { cookie: `${ENV.adminCookieName}=synthetic-session-token` } }) as any;
  const reply = () => {
    const state = { code: 200 };

    return Object.assign(state, {
      code(c: number) {
        state.code = c;
        return state;
      },
      header() {
        return state;
      },
      send() {
        return state;
      },
    });
  };

  const tight = reply();
  assert.equal(await authenticateFastifyAdmin(request(), tight as any, deps(10 * MINUTE)), null);
  assert.equal(tight.code, 401);

  const loose = reply();
  assert.ok(await authenticateFastifyAdmin(request(), loose as any, deps(10 * MINUTE + 1)));
});

test("helpers de expiración: bordes fail-closed", () => {
  assert.equal(isSessionExpired(null, NOW), true);
  assert.equal(isSessionExpired(undefined, NOW), true);
  assert.equal(isSessionExpired(new Date(Number.NaN), NOW), true);
  assert.equal(isSessionExpired(new Date(NOW), NOW), true);
  assert.equal(isSessionExpired(new Date(NOW - 1), NOW), true);
  assert.equal(isSessionExpired(new Date(NOW + 1), NOW), false);
  assert.equal(isSessionIdle(null, NOW, IDLE_MS), true);
  assert.equal(isSessionIdle(new Date(NOW - IDLE_MS), NOW, IDLE_MS), true);
  assert.equal(isSessionIdle(new Date(NOW - IDLE_MS + 1), NOW, IDLE_MS), false);
});

function readEnvFromChild(overrides: Record<string, string | undefined>) {
  const env: Record<string, string | undefined> = {
    ...process.env,
    NODE_ENV: "test",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    SUPABASE_DB_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    DOTENV_CONFIG_PATH: resolve(process.cwd(), "test", ".sec09-nonexistent.env"),
    SESSION_TTL_HOURS: undefined,
    ADMIN_SESSION_IDLE_TIMEOUT_MINUTES: undefined,
    ...overrides,
  };
  const script = [
    'const { ENV } = await import("./server/lib/env.ts");',
    "process.stdout.write(JSON.stringify({ ttl: ENV.sessionTtlHours, idle: ENV.adminSessionIdleTimeoutMs }));",
  ].join("\n");
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--experimental-specifier-resolution=node",
      "--input-type=module",
      "-e",
      script,
    ],
    { cwd: resolve(process.cwd()), env: env as NodeJS.ProcessEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

  return result.status === 0
    ? { ok: true as const, value: JSON.parse(result.stdout) as { ttl: number; idle: number } }
    : { ok: false as const, stderr: result.stderr };
}

test("SESSION_TTL_HOURS: default 24 h y valores válidos dentro de la cota", () => {
  const defaults = readEnvFromChild({});

  assert.ok(defaults.ok);
  assert.equal(defaults.value.ttl, 24);
  assert.equal(defaults.value.idle, 30 * MINUTE);

  for (const [raw, expected] of [["24", 24], ["8", 8], ["1", 1], ["0.5", 0.5], ["1.5", 1.5]] as const) {
    const result = readEnvFromChild({ SESSION_TTL_HOURS: raw });

    assert.ok(result.ok, raw);
    assert.equal(result.value.ttl, expected, raw);
    assert.ok(Number.isInteger(result.value.ttl * 60 * 60), `${raw} produce Max-Age entero`);
  }
});

test("SESSION_TTL_HOURS: valores fuera de cota o no válidos abortan el arranque", () => {
  for (const raw of ["24.5", "25", "720", "0", "-1", "abc", "Infinity", "-Infinity", "NaN", "1.1", ""]) {
    const result = readEnvFromChild({ SESSION_TTL_HOURS: raw });

    assert.equal(result.ok, false, `SESSION_TTL_HOURS=${JSON.stringify(raw)} debe rechazarse`);
    assert.match(String(result.ok ? "" : result.stderr), /SESSION_TTL_HOURS/);
  }
});

test("ADMIN_SESSION_IDLE_TIMEOUT_MINUTES: configurable, acotado y sin limitación silenciosa", () => {
  for (const [raw, expectedMinutes] of [["5", 5], ["30", 30], ["60", 60], ["1440", 1440], ["", 30]] as const) {
    const result = readEnvFromChild({ ADMIN_SESSION_IDLE_TIMEOUT_MINUTES: raw });

    assert.ok(result.ok, raw);
    assert.equal(result.value.idle, expectedMinutes * MINUTE, raw);
  }

  for (const raw of ["0", "4", "1441", "-5", "1.5", "abc", "Infinity", "NaN"]) {
    const result = readEnvFromChild({ ADMIN_SESSION_IDLE_TIMEOUT_MINUTES: raw });

    assert.equal(result.ok, false, `ADMIN_SESSION_IDLE_TIMEOUT_MINUTES=${raw} debe rechazarse`);
  }
});
