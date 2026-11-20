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
process.env.PARTICULAR_TOKEN_TTL_DAYS = "90";

const { ENV } = await import("../../server/lib/env.ts");
const { isParticularTokenExpired } = await import("../../server/lib/session-expiry.ts");
const { particularAuthNativeRoutes } = await import("../../server/routes/particular-auth.fastify.ts");
const { particularAuditNativeRoutes } = await import("../../server/routes/particular-audit.fastify.ts");
const { particularStudyTrackingNativeRoutes } = await import(
  "../../server/routes/particular-study-tracking.fastify.ts"
);

const DAY = 24 * 60 * 60 * 1000;
const TTL_DAYS = 90;
const NOW = Date.UTC(2026, 10, 12, 12, 0, 0);
const LOGIN_ORIGIN = "http://localhost:3000";

type TokenRow = {
  id: number;
  clinicId: number;
  reportId: number | null;
  isActive: boolean;
  createdAt: Date | null | undefined;
};

function tokenCreatedAgo(ms: number, extra: Partial<TokenRow> = {}): TokenRow {
  return {
    id: 7,
    clinicId: 3,
    reportId: 55,
    isActive: true,
    createdAt: new Date(NOW - ms),
    ...extra,
  };
}

type Counters = { deletes: string[]; reads: number };

async function buildApp(token: TokenRow | null, counters: Counters) {
  const app = Fastify();
  const deps = {
    now: () => NOW,
    getParticularSessionByToken: async () => ({
      particularTokenId: 7,
      expiresAt: new Date(NOW + 60 * 60 * 1000),
      lastAccess: new Date(NOW),
    }),
    deleteParticularSession: async (hash: string) => void counters.deletes.push(hash),
    getParticularTokenById: async () => token,
    updateParticularSessionLastAccess: async () => {},
    hashSessionToken: (value: string) => `particular:${value}`,
  };

  await app.register(particularAuthNativeRoutes as any, {
    prefix: "/api/particular/auth",
    ...deps,
    getReportById: async () => ({
      id: 55,
      clinicId: 3,
      storagePath: "reports/synthetic.pdf",
      fileName: "synthetic.pdf",
    }),
    createSignedReportUrl: async () => "https://signed.example/preview",
  });
  await app.register(particularAuditNativeRoutes as any, {
    prefix: "/api/particular/audit-log",
    ...deps,
    buildParticularAuditListFilters: () => ({ filters: { limit: 50, offset: 0 }, errors: [] }),
    listParticularAuditLog: async () => {
      counters.reads += 1;
      return { items: [], total: 0 };
    },
  });
  await app.register(particularStudyTrackingNativeRoutes as any, {
    prefix: "/api/particular/study-tracking",
    ...deps,
    getParticularStudyTrackingCase: async () => {
      counters.reads += 1;
      return null;
    },
    listStudyTrackingNotifications: async () => [],
  });

  return app;
}

const surfaces = [
  { name: "particular-auth", url: "/api/particular/auth/me" },
  { name: "particular-audit", url: "/api/particular/audit-log" },
  { name: "particular-study-tracking", url: "/api/particular/study-tracking/me" },
];

async function getWithSession(app: FastifyInstance, url: string) {
  const response = await app.inject({
    method: "GET",
    url,
    headers: { cookie: `${ENV.particularCookieName}=synthetic-session-token` },
  });

  return {
    status: response.statusCode,
    body: response.body,
    setCookie: String(response.headers["set-cookie"] ?? ""),
  };
}

test("isParticularTokenExpired: vigente, borde exacto y vencido", () => {
  const createdAt = new Date(NOW - TTL_DAYS * DAY);

  assert.equal(isParticularTokenExpired(createdAt, TTL_DAYS, NOW - 1), false);
  assert.equal(isParticularTokenExpired(createdAt, TTL_DAYS, NOW), true);
  assert.equal(isParticularTokenExpired(createdAt, TTL_DAYS, NOW + 1), true);
  assert.equal(isParticularTokenExpired(new Date(NOW - 89 * DAY), TTL_DAYS, NOW), false);
  assert.equal(isParticularTokenExpired(new Date(NOW - 91 * DAY), TTL_DAYS, NOW), true);
});

test("isParticularTokenExpired: fecha, TTL o reloj inválidos fallan cerrado", () => {
  const valid = new Date(NOW - DAY);

  assert.equal(isParticularTokenExpired(null, TTL_DAYS, NOW), true);
  assert.equal(isParticularTokenExpired(undefined, TTL_DAYS, NOW), true);
  assert.equal(isParticularTokenExpired(new Date("invalid"), TTL_DAYS, NOW), true);
  assert.equal(isParticularTokenExpired("2026-11-11" as unknown as Date, TTL_DAYS, NOW), true);
  assert.equal(isParticularTokenExpired(valid, 0, NOW), true);
  assert.equal(isParticularTokenExpired(valid, -1, NOW), true);
  assert.equal(isParticularTokenExpired(valid, Number.NaN, NOW), true);
  assert.equal(isParticularTokenExpired(valid, Number.POSITIVE_INFINITY, NOW), true);
  assert.equal(isParticularTokenExpired(valid, TTL_DAYS, Number.NaN), true);
});

test("ENV.particularTokenTtlDays: refleja el valor configurado (90 días)", () => {
  assert.equal(ENV.particularTokenTtlDays, TTL_DAYS);
});

for (const surface of surfaces) {
  test(`${surface.name}: token vigente conserva el acceso`, async () => {
    const counters: Counters = { deletes: [], reads: 0 };
    const app = await buildApp(tokenCreatedAgo(89 * DAY), counters);

    try {
      const result = await getWithSession(app, surface.url);

      assert.notEqual(result.status, 401);
      assert.deepEqual(counters.deletes, []);
    } finally {
      await app.close();
    }
  });

  test(`${surface.name}: sesión viva cuyo token venció responde 401, borra la sesión y no lee datos`, async () => {
    for (const age of [TTL_DAYS * DAY, TTL_DAYS * DAY + 1, 91 * DAY, 400 * DAY]) {
      const counters: Counters = { deletes: [], reads: 0 };
      const app = await buildApp(tokenCreatedAgo(age), counters);

      try {
        const result = await getWithSession(app, surface.url);

        assert.equal(result.status, 401, `edad ${age} ms`);
        assert.deepEqual(counters.deletes, ["particular:synthetic-session-token"]);
        assert.equal(counters.reads, 0);
        assert.match(result.setCookie, /Max-Age=0|Expires=Thu, 01 Jan 1970/);
        assert.equal(result.body.includes("synthetic-session-token"), false);
      } finally {
        await app.close();
      }
    }
  });

  test(`${surface.name}: un milisegundo antes del vencimiento sigue vigente`, async () => {
    const counters: Counters = { deletes: [], reads: 0 };
    const app = await buildApp(tokenCreatedAgo(TTL_DAYS * DAY - 1), counters);

    try {
      const result = await getWithSession(app, surface.url);

      assert.notEqual(result.status, 401);
      assert.deepEqual(counters.deletes, []);
    } finally {
      await app.close();
    }
  });

  test(`${surface.name}: createdAt inválido o ausente falla cerrado`, async () => {
    for (const createdAt of [new Date("invalid"), null, undefined]) {
      const counters: Counters = { deletes: [], reads: 0 };
      const app = await buildApp(tokenCreatedAgo(DAY, { createdAt }), counters);

      try {
        const result = await getWithSession(app, surface.url);

        assert.equal(result.status, 401);
        assert.equal(counters.reads, 0);
        assert.deepEqual(counters.deletes, ["particular:synthetic-session-token"]);
      } finally {
        await app.close();
      }
    }
  });

  test(`${surface.name}: token inactivo o inexistente (cookie reutilizada tras revocación) responde 401`, async () => {
    for (const token of [tokenCreatedAgo(DAY, { isActive: false }), null]) {
      const counters: Counters = { deletes: [], reads: 0 };
      const app = await buildApp(token, counters);

      try {
        const result = await getWithSession(app, surface.url);

        assert.equal(result.status, 401);
        assert.equal(counters.reads, 0);
        assert.deepEqual(counters.deletes, ["particular:synthetic-session-token"]);
      } finally {
        await app.close();
      }
    }
  });
}

test("particular-auth: informe de otra clínica sigue respondiendo 404 con token vigente", async () => {
  const counters: Counters = { deletes: [], reads: 0 };
  const app = await buildApp(tokenCreatedAgo(DAY, { clinicId: 9 }), counters);

  try {
    const result = await getWithSession(app, "/api/particular/auth/report/preview-url");

    assert.equal(result.status, 404);
  } finally {
    await app.close();
  }
});

async function buildLoginApp(
  lookup: (tokenHash: string) => Promise<TokenRow | null>,
  calls: { sessions: number; lastLogins: number; failures: number },
) {
  const app = Fastify();

  await app.register(particularAuthNativeRoutes as any, {
    prefix: "/api/particular/auth",
    now: () => NOW,
    createParticularSession: async () => void (calls.sessions += 1),
    deleteParticularSession: async () => {},
    getParticularSessionByToken: async () => null,
    getParticularTokenById: async () => tokenCreatedAgo(DAY),
    getParticularTokenByTokenHash: lookup,
    updateParticularSessionLastAccess: async () => {},
    updateParticularTokenLastLogin: async () => void (calls.lastLogins += 1),
    getReportById: async () => null,
    createSignedReportUrl: async () => "https://signed.example/preview",
    createSignedReportDownloadUrl: async () => "https://signed.example/download",
    generateSessionToken: () => "synthetic-new-session",
    hashSessionToken: (value: string) => `particular:${value}`,
    recordLoginFailedAttempt: async () => void (calls.failures += 1),
  });

  return app;
}

async function login(app: FastifyInstance, token: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/particular/auth/login",
    headers: { origin: LOGIN_ORIGIN },
    payload: { token },
  });

  return {
    status: response.statusCode,
    body: response.body,
    setCookie: String(response.headers["set-cookie"] ?? ""),
  };
}

test("login: token vencido, inactivo, inexistente o alterado dan 401 indistinguible y no crean sesión", async () => {
  const cases: Array<[string, TokenRow | null]> = [
    ["vencido exacto", tokenCreatedAgo(TTL_DAYS * DAY)],
    ["vencido", tokenCreatedAgo(120 * DAY)],
    ["createdAt inválido", tokenCreatedAgo(DAY, { createdAt: new Date("invalid") })],
    ["inactivo", tokenCreatedAgo(DAY, { isActive: false })],
    ["inexistente o alterado", null],
  ];
  const bodies = new Set<string>();

  for (const [label, row] of cases) {
    const calls = { sessions: 0, lastLogins: 0, failures: 0 };
    const app = await buildLoginApp(async () => row, calls);

    try {
      const result = await login(app, "synthetic-credential-token");

      assert.equal(result.status, 401, label);
      assert.equal(calls.sessions, 0, label);
      assert.equal(calls.lastLogins, 0, label);
      assert.equal(calls.failures, 1, label);
      assert.equal(result.setCookie.includes(ENV.particularCookieName + "=synthetic-new-session"), false, label);
      assert.equal(result.body.includes("synthetic-credential-token"), false, label);
      bodies.add(result.body);
    } finally {
      await app.close();
    }
  }

  assert.equal(bodies.size, 1, "todas las respuestas de rechazo son idénticas");
});

test("login: token vigente (borde de 1 ms) crea sesión y conserva el contrato", async () => {
  const calls = { sessions: 0, lastLogins: 0, failures: 0 };
  const app = await buildLoginApp(async () => tokenCreatedAgo(TTL_DAYS * DAY - 1), calls);

  try {
    const result = await login(app, "synthetic-credential-token");

    assert.notEqual(result.status, 401);
    assert.equal(calls.sessions, 1);
    assert.equal(calls.lastLogins, 1);
    assert.ok(result.setCookie.includes(`${ENV.particularCookieName}=synthetic-new-session`));
  } finally {
    await app.close();
  }
});

function readTtlFromChild(overrides: Record<string, string | undefined>) {
  const env = {
    ...process.env,
    NODE_ENV: "development",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    SUPABASE_DB_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    DOTENV_CONFIG_PATH: resolve(process.cwd(), "test", ".sec11-nonexistent.env"),
    PARTICULAR_TOKEN_TTL_DAYS: undefined,
    ...overrides,
  };
  const script = [
    'const { ENV } = await import("./server/lib/env.ts");',
    "process.stdout.write(JSON.stringify({ ttl: ENV.particularTokenTtlDays }));",
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
    ? { ok: true as const, value: JSON.parse(result.stdout) as { ttl: number } }
    : { ok: false as const, stderr: result.stderr };
}

test("PARTICULAR_TOKEN_TTL_DAYS: ausente o vacío aborta el arranque sin default (proceso aislado)", () => {
  for (const overrides of [{}, { PARTICULAR_TOKEN_TTL_DAYS: "" }, { PARTICULAR_TOKEN_TTL_DAYS: "   " }]) {
    for (const nodeEnv of ["development", "test", "production"]) {
      const result = readTtlFromChild({ ...overrides, NODE_ENV: nodeEnv, CORS_ORIGIN: "https://example.test" });

      assert.equal(result.ok, false, `${JSON.stringify(overrides)} NODE_ENV=${nodeEnv} debe rechazarse`);
      assert.match(String(result.ok ? "" : result.stderr), /PARTICULAR_TOKEN_TTL_DAYS/);
    }
  }
});

test("PARTICULAR_TOKEN_TTL_DAYS: valores válidos se respetan", () => {
  for (const [raw, expected] of [["90", 90], ["1", 1], ["30", 30], ["365", 365], [" 45 ", 45]] as const) {
    const result = readTtlFromChild({ PARTICULAR_TOKEN_TTL_DAYS: raw });

    assert.ok(result.ok, raw);
    assert.equal(result.value.ttl, expected, raw);
  }
});

test("PARTICULAR_TOKEN_TTL_DAYS: valores inválidos abortan el arranque", () => {
  for (const raw of ["0", "-1", "1.5", "366", "abc", "90d", "Infinity", "-Infinity", "NaN"]) {
    const result = readTtlFromChild({ PARTICULAR_TOKEN_TTL_DAYS: raw });

    assert.equal(result.ok, false, `PARTICULAR_TOKEN_TTL_DAYS=${JSON.stringify(raw)} debe rechazarse`);
    assert.match(String(result.ok ? "" : result.stderr), /PARTICULAR_TOKEN_TTL_DAYS/);
  }
});
