import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {
  buildPublicProfessionalFixtureRow,
} from "../../../factories/public-professionals.ts";
import {
  buildPublicProfessionalsRouteFixtureStubs,
  type PublicProfessionalsRouteFixtureStubs,
} from "../../../mocks/public-professionals-route.ts";
import { generateFastifyRequestId } from "../../../../server/lib/http/api-request-id.ts";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { publicProfessionalsNativeRoutes } = await import(
  "../../../../server/routes/public-professionals.fastify.ts"
);

async function buildLoggingApp(
  overrides: Partial<PublicProfessionalsRouteFixtureStubs> = {},
) {
  const app = Fastify({
    logger: false,
    genReqId: generateFastifyRequestId,
  });

  await app.register(publicProfessionalsNativeRoutes, {
    prefix: "/api/public/professionals",
    ...buildPublicProfessionalsRouteFixtureStubs({
      row: buildPublicProfessionalFixtureRow({
        clinicId: 130,
        displayName: "Clinica Logging",
        aboutText: "Perfil publico para logging",
        email: "logging@example.com",
        phone: "3411300130",
        updatedAt: new Date("2026-04-29T21:00:00.000Z"),
        profileQualityScore: 0.91,
      }),
    }),
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

function parseRequestLogEvent(line: string) {
  const logEvent = JSON.parse(line) as {
    timestamp: string;
    level: string;
    event: string;
    requestId?: string;
    context: Record<string, unknown>;
  };

  assert.equal(logEvent.event, "HTTP_REQUEST_COMPLETED");
  assert.equal(logEvent.level, "info");
  assert.match(logEvent.timestamp, /^\d{4}-\d{2}-\d{2}T.*Z$/);

  return logEvent;
}

function assertRequestLogShape(
  line: string,
  expected: {
    method: string;
    routeTemplate: string;
    status: number;
    rateLimited?: boolean;
  },
) {
  const { context } = parseRequestLogEvent(line);

  assert.equal(context.method, expected.method);
  assert.equal(context.routeTemplate, expected.routeTemplate);
  assert.equal(context.statusCode, expected.status);
  assert.equal(context.rateLimited, expected.rateLimited ?? false);
  assert.equal(typeof context.durationMs, "number");

  // Contexto cerrado: ninguna dimension derivada de la URL real.
  assert.deepEqual(Object.keys(context).sort(), [
    "durationMs",
    "method",
    "rateLimited",
    "routeTemplate",
    "statusClass",
    "statusCode",
  ]);
  assert.equal("path" in context, false);
  assert.equal("url" in context, false);

  return context;
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
      routeTemplate: "/api/public/professionals/search",
      status: 200,
    });

    assert.equal(detailCapture.result.statusCode, 200);
    const detailLine = assertSingleLogLine(detailCapture.logs);
    const detailContext = assertRequestLogShape(detailLine, {
      method: "GET",
      routeTemplate: "/api/public/professionals/:clinicId",
      status: 200,
    });

    // El clinicId real (130) nunca entra al log: sólo el template.
    assert.equal(detailLine.includes("130"), false);
    assert.equal(JSON.stringify(detailContext).includes("130"), false);

    // El evento siempre lleva un requestId para correlacionar.
    assert.equal(
      typeof parseRequestLogEvent(detailLine).requestId,
      "string",
    );
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

    assertRequestLogShape(line, {
      method: "GET",
      routeTemplate: "/api/public/professionals/search",
      status: 200,
    });
    assert.equal(line.includes("q=histo"), false);
    assert.equal(line.includes("REDACTED"), false);
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
      routeTemplate: "/api/public/professionals/search",
      status: 429,
      rateLimited: true,
    });

    assert.equal(detailLimitedCapture.result.statusCode, 429);
    assertRequestLogShape(assertSingleLogLine(detailLimitedCapture.logs), {
      method: "GET",
      routeTemplate: "/api/public/professionals/:clinicId",
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

    assertRequestLogShape(line, {
      method: "GET",
      routeTemplate: "/api/public/professionals/search",
      status: 500,
    });
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

    assertRequestLogShape(line, {
      method: "GET",
      routeTemplate: "/api/public/professionals/search",
      status: 403,
    });
    assert.equal(line.includes("blocked-origin-secret"), false);
    assert.equal(line.includes("https://blocked.example"), false);
    assert.equal(line.includes("Origin no permitido"), false);
  } finally {
    await app.close();
  }
});
