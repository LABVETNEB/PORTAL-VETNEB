import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const { requireTrustedOrigin } = await import("../server/middlewares/trusted-origin.ts");

function createMockResponse() {
  return {
    statusCode: 200,
    jsonPayload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.jsonPayload = payload;
      return this;
    },
  };
}

function createRequest(method: string, headers?: Record<string, string | undefined>) {
  const normalizedHeaders = new Map<string, string>();

  for (const [key, value] of Object.entries(headers ?? {})) {
    if (typeof value === "string") {
      normalizedHeaders.set(key.toLowerCase(), value);
    }
  }

  return {
    method,
    get(name: string) {
      return normalizedHeaders.get(name.toLowerCase());
    },
  };
}

test("requireTrustedOrigin deja pasar métodos seguros aunque el origin sea externo", () => {
  const req = createRequest("GET", {
    origin: "https://blocked.invalid",
  });

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  requireTrustedOrigin(req as any, res as any, ((error?: unknown) => {
    nextCalls.push(error);
  }) as any);

  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0], undefined);
  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonPayload, undefined);
});

test("requireTrustedOrigin deja pasar métodos inseguros sin origin ni referer", () => {
  const req = createRequest("POST");

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  requireTrustedOrigin(req as any, res as any, ((error?: unknown) => {
    nextCalls.push(error);
  }) as any);

  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0], undefined);
  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonPayload, undefined);
});

test("requireTrustedOrigin deja pasar referer permitido cuando existe allowlist", (t) => {
  const allowedOrigin =
    ENV.corsOrigins[0] ??
    (ENV.isDevelopment ? "http://localhost:3000" : undefined);

  if (!allowedOrigin) {
    t.skip("No hay origen permitido disponible en este entorno");
    return;
  }

  const req = createRequest("POST", {
    referer: `${allowedOrigin}/panel/reportes?x=1`,
  });

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  requireTrustedOrigin(req as any, res as any, ((error?: unknown) => {
    nextCalls.push(error);
  }) as any);

  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0], undefined);
  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonPayload, undefined);
});

test("requireTrustedOrigin bloquea origin no permitido en métodos inseguros", () => {
  const req = createRequest("DELETE", {
    origin: "https://blocked.invalid",
  });

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  requireTrustedOrigin(req as any, res as any, ((error?: unknown) => {
    nextCalls.push(error);
  }) as any);

  assert.equal(nextCalls.length, 0);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "Origen no permitido",
  });
});

test("requireTrustedOrigin ignora referer inválido y deja pasar", () => {
  const req = createRequest("PATCH", {
    referer: "::::referer-invalido::::",
  });

  const res = createMockResponse();
  const nextCalls: unknown[] = [];

  requireTrustedOrigin(req as any, res as any, ((error?: unknown) => {
    nextCalls.push(error);
  }) as any);

  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0], undefined);
  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonPayload, undefined);
});
