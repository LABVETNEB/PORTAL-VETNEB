import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.NODE_ENV ??= "test";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const {
  isClientVersionSupported,
  CLIENT_VERSION_HEADER,
  CLIENT_VERSION_UNSUPPORTED_CODE,
} = await import("../server/middlewares/version-gate.ts");

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

type GateScenarioResult = {
  result: unknown;
  statusCode: number | null;
  payload: Record<string, unknown> | null;
};

function runGateScenario(
  envOverrides: Record<string, string>,
  scenario: {
    method: string;
    path: string;
    headers?: Record<string, string>;
  },
): GateScenarioResult {
  const env = {
    ...process.env,
    NODE_ENV: "test",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    SUPABASE_DB_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    CLIENT_MIN_VERSION: "",
    APP_VERSION: "",
    ...envOverrides,
  };

  const script = [
    'const { requireMinimumClientVersionForFastify } = await import("./server/middlewares/version-gate.ts");',
    `const request = ${JSON.stringify({
      method: scenario.method,
      url: scenario.path,
      headers: scenario.headers ?? {},
    })};`,
    "let statusCode = null;",
    "let payload = null;",
    "const reply = { code(code) { statusCode = code; return this; }, send(body) { payload = body; return this; } };",
    "const result = await requireMinimumClientVersionForFastify(request, reply);",
    "process.stdout.write(JSON.stringify({ result: result === undefined ? null : result, statusCode, payload }));",
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
    {
      cwd: resolve(process.cwd()),
      env,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr);

  return JSON.parse(result.stdout) as GateScenarioResult;
}

test("isClientVersionSupported compara versiones punteadas y exige igualdad exacta para shas", () => {
  assert.equal(isClientVersionSupported("1.2.0", "1.2.0"), true);
  assert.equal(isClientVersionSupported("1.3.0", "1.2.0"), true);
  assert.equal(isClientVersionSupported("1.1.9", "1.2.0"), false);
  assert.equal(isClientVersionSupported("abc123", "abc123"), true);
  assert.equal(isClientVersionSupported("abc123", "def456"), false);
});

test("gate armado: header de version faltante en login bloquea con 426 CLIENT_VERSION_UNSUPPORTED", () => {
  const { statusCode, payload } = runGateScenario(
    { CLIENT_MIN_VERSION: "1.2.0", APP_VERSION: "1.2.0" },
    { method: "POST", path: "/api/auth/login" },
  );

  assert.equal(statusCode, 426);
  assert.deepEqual(payload, {
    success: false,
    code: CLIENT_VERSION_UNSUPPORTED_CODE,
    message:
      "Tu aplicación está desactualizada. Actualizá o reinstalá VETNEB para continuar.",
    minimumClientVersion: "1.2.0",
    clientVersion: "",
  });
});

test("gate armado: version menor a la minima bloquea con 426 en auth/me admin", () => {
  const { statusCode, payload } = runGateScenario(
    { CLIENT_MIN_VERSION: "1.2.0", APP_VERSION: "1.2.0" },
    {
      method: "GET",
      path: "/api/admin/auth/me",
      headers: { [CLIENT_VERSION_HEADER]: "1.1.9" },
    },
  );

  assert.equal(statusCode, 426);
  assert.equal(payload?.code, CLIENT_VERSION_UNSUPPORTED_CODE);
  assert.equal(payload?.clientVersion, "1.1.9");
  assert.equal(payload?.minimumClientVersion, "1.2.0");
});

test("gate armado: version valida o superior preserva comportamiento existente", () => {
  const exact = runGateScenario(
    { CLIENT_MIN_VERSION: "1.2.0", APP_VERSION: "1.2.0" },
    {
      method: "POST",
      path: "/api/particular/auth/login",
      headers: { [CLIENT_VERSION_HEADER]: "1.2.0" },
    },
  );

  assert.equal(exact.statusCode, null);
  assert.equal(exact.result, null);

  const higher = runGateScenario(
    { CLIENT_MIN_VERSION: "1.2.0", APP_VERSION: "1.2.0" },
    {
      method: "GET",
      path: "/api/particular/auth/me",
      headers: { [CLIENT_VERSION_HEADER]: "1.3.0" },
    },
  );

  assert.equal(higher.statusCode, null);
  assert.equal(higher.result, null);
});

test("gate armado: rutas publicas como contact y health nunca se bloquean", () => {
  const contact = runGateScenario(
    { CLIENT_MIN_VERSION: "1.2.0", APP_VERSION: "1.2.0" },
    { method: "POST", path: "/api/contact" },
  );
  const health = runGateScenario(
    { CLIENT_MIN_VERSION: "1.2.0", APP_VERSION: "1.2.0" },
    { method: "GET", path: "/api/health" },
  );

  assert.equal(contact.statusCode, null);
  assert.equal(health.statusCode, null);
});

test("gate desarmado por defecto: sin CLIENT_MIN_VERSION configurado no bloquea aunque falte el header", () => {
  const { statusCode, result } = runGateScenario(
    {},
    { method: "POST", path: "/api/auth/login" },
  );

  assert.equal(statusCode, null);
  assert.equal(result, null);
});

test("client-version-gate hook esta instalado globalmente antes del registro de rutas", () => {
  const fastifyApp = read("server/fastify-app.ts");
  const trustedOriginIndex = fastifyApp.indexOf(
    'app.addHook("onRequest", requireTrustedOriginForFastify);',
  );
  const versionGateIndex = fastifyApp.indexOf(
    'app.addHook("onRequest", requireMinimumClientVersionForFastify);',
  );
  const firstRouteRegistrationIndex = fastifyApp.indexOf(
    "await app.register(appVersionNativeRoutes",
  );

  assert.notEqual(trustedOriginIndex, -1);
  assert.notEqual(versionGateIndex, -1);
  assert.notEqual(firstRouteRegistrationIndex, -1);
  assert.ok(trustedOriginIndex < versionGateIndex);
  assert.ok(versionGateIndex < firstRouteRegistrationIndex);
});
