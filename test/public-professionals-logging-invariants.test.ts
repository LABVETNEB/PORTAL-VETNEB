import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { publicProfessionalsNativeRoutes } = await import(
  "../server/routes/public-professionals.fastify.ts"
);

function buildProfessionalRow() {
  return {
    clinicId: 130,
    displayName: "Clinica Logging",
    avatarStoragePath: null,
    aboutText: "Perfil publico para logging",
    specialtyText: "Histopatologia",
    servicesText: "Biopsias",
    email: "logging@example.com",
    phone: "3411300130",
    locality: "Rosario",
    country: "AR",
    updatedAt: new Date("2026-04-29T21:00:00.000Z"),
    profileQualityScore: 0.91,
    rank: 0.4,
    similarity: 0.3,
    score: 0.7,
  };
}

function buildPublicProfessionalsRouteStubs() {
  return {
    searchPublicProfessionals: async () => ({
      rows: [buildProfessionalRow()],
      total: 1,
      limit: 20,
      offset: 0,
    }),
    getPublicProfessionalByClinicId: async (clinicId: number) =>
      clinicId === 130 ? buildProfessionalRow() : null,
    createSignedStorageUrl: async (path: string) => `signed:${path}`,
    searchRateLimitWindowMs: 60_000,
    searchRateLimitMaxAttempts: 1,
    detailRateLimitWindowMs: 60_000,
    detailRateLimitMaxAttempts: 1,
    now: () => 10_000,
  };
}

async function buildLoggingApp(
  overrides: Partial<ReturnType<typeof buildPublicProfessionalsRouteStubs>> = {},
) {
  const app = Fastify({
    logger: false,
  });

  await app.register(publicProfessionalsNativeRoutes, {
    prefix: "/api/public/professionals",
    ...buildPublicProfessionalsRouteStubs(),
    ...overrides,
  });

  return app;
}

async function captureConsoleLogs<T>(callback: () => Promise<T>) {
  const originalLog = console.log;
  const logs: string[] = [];

  console.log = (...args: unknown[]) => {
    logs.push(args.map((arg) => String(arg)).join(" "));
  };

  try {
    const result = await callback();
    return {
      result,
      logs,
    };
  } finally {
    console.log = originalLog;
  }
}

function assertSingleLogLine(logs: string[]) {
  assert.equal(logs.length, 1);
  return logs[0];
}

function assertRequestLogShape(
  line: string,
  expected: {
    method: string;
    path: string;
    status: number;
    rateLimited?: boolean;
  },
) {
  assert.match(
    line,
    new RegExp(
      String.raw`^\[\d{4}-\d{2}-\d{2}T.*Z\] ${expected.method} ${expected.path.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      )} ${expected.status} \d+\.\dms${expected.rateLimited ? " RATE_LIMITED" : ""}$`,
    ),
  );
}

test("public professionals logging registra search y detail con método path status y duración", async () => {
  const app = await buildLoggingApp();

  try {
    const searchCapture = await captureConsoleLogs(async () =>
      app.inject({
        method: "GET",
        url: "/api/public/professionals/search?q=histo",
        remoteAddress: "198.51.100.130",
      }),
    );

    const detailCapture = await captureConsoleLogs(async () =>
      app.inject({
        method: "GET",
        url: "/api/public/professionals/130",
        remoteAddress: "198.51.100.131",
      }),
    );

    assert.equal(searchCapture.result.statusCode, 200);
    assertRequestLogShape(assertSingleLogLine(searchCapture.logs), {
      method: "GET",
      path: "/api/public/professionals/search?q=histo",
      status: 200,
    });

    assert.equal(detailCapture.result.statusCode, 200);
    assertRequestLogShape(assertSingleLogLine(detailCapture.logs), {
      method: "GET",
      path: "/api/public/professionals/130",
      status: 200,
    });
  } finally {
    await app.close();
  }
});

test("public professionals logging sanitiza token y reportAccessToken en query params", async () => {
  const app = await buildLoggingApp();

  try {
    const capture = await captureConsoleLogs(async () =>
      app.inject({
        method: "GET",
        url: "/api/public/professionals/search?q=histo&token=super-secret-token&reportAccessToken=another-secret",
        remoteAddress: "198.51.100.132",
      }),
    );

    assert.equal(capture.result.statusCode, 200);

    const line = assertSingleLogLine(capture.logs);

    assert.match(
      line,
      /^\[\d{4}-\d{2}-\d{2}T.*Z\] GET \/api\/public\/professionals\/search\?q=histo&token=\[REDACTED\]&reportAccessToken=\[REDACTED\] 200 \d+\.\dms$/,
    );
    assert.equal(line.includes("super-secret-token"), false);
    assert.equal(line.includes("another-secret"), false);
  } finally {
    await app.close();
  }
});

test("public professionals logging marca RATE_LIMITED en respuestas 429 de search y detail", async () => {
  const app = await buildLoggingApp();

  try {
    await captureConsoleLogs(async () =>
      app.inject({
        method: "GET",
        url: "/api/public/professionals/search",
        remoteAddress: "198.51.100.133",
      }),
    );

    const searchLimitedCapture = await captureConsoleLogs(async () =>
      app.inject({
        method: "GET",
        url: "/api/public/professionals/search",
        remoteAddress: "198.51.100.133",
      }),
    );

    await captureConsoleLogs(async () =>
      app.inject({
        method: "GET",
        url: "/api/public/professionals/130",
        remoteAddress: "198.51.100.134",
      }),
    );

    const detailLimitedCapture = await captureConsoleLogs(async () =>
      app.inject({
        method: "GET",
        url: "/api/public/professionals/130",
        remoteAddress: "198.51.100.134",
      }),
    );

    assert.equal(searchLimitedCapture.result.statusCode, 429);
    assertRequestLogShape(assertSingleLogLine(searchLimitedCapture.logs), {
      method: "GET",
      path: "/api/public/professionals/search",
      status: 429,
      rateLimited: true,
    });

    assert.equal(detailLimitedCapture.result.statusCode, 429);
    assertRequestLogShape(assertSingleLogLine(detailLimitedCapture.logs), {
      method: "GET",
      path: "/api/public/professionals/130",
      status: 429,
      rateLimited: true,
    });
  } finally {
    await app.close();
  }
});

test("public professionals logging no expone datos internos de helpers en errores 500", async () => {
  const sensitiveMessage = "db-password=very-secret reportAccessToken=raw-secret";

  const app = await buildLoggingApp({
    searchPublicProfessionals: async () => {
      throw new Error(sensitiveMessage);
    },
  });

  try {
    const capture = await captureConsoleLogs(async () =>
      app.inject({
        method: "GET",
        url: "/api/public/professionals/search?token=query-secret",
        remoteAddress: "198.51.100.135",
      }),
    );

    assert.equal(capture.result.statusCode, 500);

    const line = assertSingleLogLine(capture.logs);

    assert.match(
      line,
      /^\[\d{4}-\d{2}-\d{2}T.*Z\] GET \/api\/public\/professionals\/search\?token=\[REDACTED\] 500 \d+\.\dms$/,
    );
    assert.equal(line.includes("db-password"), false);
    assert.equal(line.includes("very-secret"), false);
    assert.equal(line.includes("raw-secret"), false);
    assert.equal(line.includes("query-secret"), false);
  } finally {
    await app.close();
  }
});

test("public professionals logging registra CORS bloqueado sin headers ni payload interno", async () => {
  const app = await buildLoggingApp();

  try {
    const capture = await captureConsoleLogs(async () =>
      app.inject({
        method: "GET",
        url: "/api/public/professionals/search?token=blocked-origin-secret",
        headers: {
          origin: "https://blocked.example",
        },
        remoteAddress: "198.51.100.136",
      }),
    );

    assert.equal(capture.result.statusCode, 403);

    const line = assertSingleLogLine(capture.logs);

    assert.match(
      line,
      /^\[\d{4}-\d{2}-\d{2}T.*Z\] GET \/api\/public\/professionals\/search\?token=\[REDACTED\] 403 \d+\.\dms$/,
    );
    assert.equal(line.includes("blocked-origin-secret"), false);
    assert.equal(line.includes("https://blocked.example"), false);
    assert.equal(line.includes("Origin no permitido"), false);
  } finally {
    await app.close();
  }
});
