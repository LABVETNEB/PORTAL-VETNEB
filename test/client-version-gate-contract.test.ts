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

// Los tests de arriba ejercitan el gate como funcion aislada o chequean la
// posicion textual del addHook en el archivo fuente, pero ninguno bootea la
// app Fastify real para confirmar que, en runtime, el hook efectivamente
// intercepta antes de que las rutas de auth respondan. Estos escenarios
// reproducen el smoke de produccion: bootean createFastifyApp() (con stubs
// solo para los 3 grupos de auth; el resto de los plugins cae a sus
// defaults reales pero nunca se invocan) y pegan con app.inject() igual que
// un cliente real.
//
// El boot ocurre en un subproceso (spawnSync) para poder armar
// CLIENT_MIN_VERSION en ENV, que env.ts congela en import. Para que el
// subproceso NO pueda colgar el runner en CI Linux:
//   - se stubean los factories de health/service para que /health y
//     /api/health no disparen probes reales de DB/storage/red (la causa del
//     hang: checkStorageHealth hace un fetch saliente a la URL de Supabase);
//   - el child cierra la app en finally e imprime JSON compacto y luego
//     llama process.exit() tras vaciar stdout, terminando de forma
//     deterministica sin depender de que el event loop se drene;
//   - el padre usa spawnSync con timeout explicito + killSignal, y si el
//     child se cuelga lo mata y falla con stdout/stderr utiles.
type RuntimeScenario = {
  method: string;
  path: string;
  headers?: Record<string, string>;
  payload?: Record<string, unknown>;
};

type RuntimeScenarioResult = {
  statusCode: number;
  body: Record<string, unknown> | null;
};

function runGateRuntimeScenarios(
  envOverrides: Record<string, string>,
  scenarios: RuntimeScenario[],
): RuntimeScenarioResult[] {
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
    'const { createFastifyApp } = await import("./server/fastify-app.ts");',
    "console.log = () => {};",
    "const run = async () => {",
    "  const app = await createFastifyApp({",
    // Health/service stub: /health y /api/health no deben tocar DB/storage/red
    // reales (el probe de storage es un fetch saliente que cuelga en CI).
    '    getNativeHealthCheckResponse: async () => ({ statusCode: 200, payload: { success: true, status: "ok" } }),',
    '    getServiceInfoPayload: () => ({ success: true, service: "portal-vetneb-api", environment: "test" }),',
    "  clinicAuthRoutes: {",
    "    createActiveSession: async () => {},",
    "    deleteActiveSession: async () => {},",
    "    getActiveSessionByToken: async () => null,",
    "    getClinicUserById: async () => null,",
    "    getClinicUserByUsername: async () => null,",
    "    updateSessionLastAccess: async () => {},",
    "    upsertClinicUser: async () => {},",
    '    generateSessionToken: () => "session-token",',
    '    hashPassword: async () => "rehash-password",',
    '    hashSessionToken: (token) => "hash:" + token,',
    "    verifyPassword: async () => ({ valid: false, needsRehash: false }),",
    "    writeAuditLog: async () => {},",
    "  },",
    "  adminAuthRoutes: {",
    "    createAdminSession: async () => {},",
    "    deleteAdminSession: async () => {},",
    "    getAdminSessionByToken: async () => null,",
    "    getAdminUserById: async () => null,",
    "    getAdminUserByUsername: async () => null,",
    "    updateAdminSessionLastAccess: async () => {},",
    '    generateSessionToken: () => "admin-session-token",',
    '    hashSessionToken: (token) => "hash:" + token,',
    "    verifyPassword: async () => ({ valid: false, needsRehash: false }),",
    "    writeAuditLog: async () => {},",
    "  },",
    "  particularAuthRoutes: {",
    "    createParticularSession: async () => {},",
    "    deleteParticularSession: async () => {},",
    "    getParticularSessionByToken: async () => null,",
    "    getParticularTokenById: async () => null,",
    "    getParticularTokenByTokenHash: async () => null,",
    "    updateParticularSessionLastAccess: async () => {},",
    "    updateParticularTokenLastLogin: async () => {},",
    "    getReportById: async () => null,",
    '    createSignedReportUrl: async (p) => "signed-preview:" + p,',
    '    createSignedReportDownloadUrl: async (p, f) => "signed-download:" + p + ":" + (f ?? ""),',
    '    generateSessionToken: () => "particular-session-token",',
    '    hashSessionToken: (token) => "hash:" + token,',
    "  },",
    "  });",
    "  const results = [];",
    `  const scenarios = ${JSON.stringify(scenarios)};`,
    "  try {",
    "    for (const scenario of scenarios) {",
    "      const response = await app.inject({",
    "        method: scenario.method,",
    "        url: scenario.path,",
    "        headers: scenario.headers ?? {},",
    "        payload: scenario.payload,",
    "      });",
    "      let body = null;",
    "      try { body = JSON.parse(response.body); } catch {}",
    "      results.push({ statusCode: response.statusCode, body });",
    "    }",
    "  } finally {",
    "    await app.close();",
    "  }",
    "  return results;",
    "};",
    "run().then(",
    "  (results) => {",
    "    process.stdout.write(JSON.stringify(results), () => process.exit(0));",
    "  },",
    "  (error) => {",
    "    process.stderr.write(String((error && error.stack) || error));",
    "    process.exit(1);",
    "  },",
    ");",
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
      // Timeout defensivo: si el child se cuelga (handle/socket abierto en CI
      // Linux), spawnSync lo mata con killSignal en vez de colgar el runner.
      timeout: 120000,
      killSignal: "SIGKILL",
      maxBuffer: 16 * 1024 * 1024,
    },
  );

  if (result.error) {
    throw new Error(
      `version-gate runtime child no termino limpio: ${
        result.error.message ?? String(result.error)
      } (signal=${result.signal ?? "null"} status=${result.status ?? "null"})\n` +
        `stdout=${result.stdout ?? ""}\nstderr=${result.stderr ?? ""}`,
    );
  }

  if (result.signal) {
    throw new Error(
      `version-gate runtime child terminado por signal ${result.signal} (posible timeout)\n` +
        `stdout=${result.stdout ?? ""}\nstderr=${result.stderr ?? ""}`,
    );
  }

  assert.equal(
    result.status,
    0,
    `version-gate runtime child status ${result.status}\nstdout=${
      result.stdout ?? ""
    }\nstderr=${result.stderr ?? ""}`,
  );

  return JSON.parse(result.stdout) as RuntimeScenarioResult[];
}

test(
  "gate en runtime real (createFastifyApp + inject): GET /api/auth/me sin header devuelve 426 antes de auth",
  () => {
    const [result] = runGateRuntimeScenarios(
      { CLIENT_MIN_VERSION: "1.2.0", APP_VERSION: "1.2.0" },
      [{ method: "GET", path: "/api/auth/me" }],
    );

    assert.equal(result.statusCode, 426);
    assert.equal(result.body?.code, CLIENT_VERSION_UNSUPPORTED_CODE);
  },
);

test(
  "gate en runtime real: GET /api/auth/me con version vieja tambien devuelve 426",
  () => {
    const [result] = runGateRuntimeScenarios(
      { CLIENT_MIN_VERSION: "1.2.0", APP_VERSION: "1.2.0" },
      [
        {
          method: "GET",
          path: "/api/auth/me",
          headers: { [CLIENT_VERSION_HEADER]: "1.1.0" },
        },
      ],
    );

    assert.equal(result.statusCode, 426);
    assert.equal(result.body?.code, CLIENT_VERSION_UNSUPPORTED_CODE);
  },
);

test(
  "gate en runtime real: GET /api/auth/me con version valida llega a auth normal (401 sin sesion)",
  () => {
    const [result] = runGateRuntimeScenarios(
      { CLIENT_MIN_VERSION: "1.2.0", APP_VERSION: "1.2.0" },
      [
        {
          method: "GET",
          path: "/api/auth/me",
          headers: { [CLIENT_VERSION_HEADER]: "1.2.0" },
        },
      ],
    );

    assert.equal(result.statusCode, 401);
    assert.equal(result.body?.error, "No autenticado");
  },
);

test(
  "gate en runtime real: POST /api/auth/login sin header y con version vieja devuelve 426; version valida llega a auth normal",
  () => {
    const credentials = { username: "doctor", password: "wrong-password" };
    const [withoutHeader, oldVersion, validVersion] = runGateRuntimeScenarios(
      { CLIENT_MIN_VERSION: "1.2.0", APP_VERSION: "1.2.0" },
      [
        { method: "POST", path: "/api/auth/login", payload: credentials },
        {
          method: "POST",
          path: "/api/auth/login",
          headers: { [CLIENT_VERSION_HEADER]: "1.1.0" },
          payload: credentials,
        },
        {
          method: "POST",
          path: "/api/auth/login",
          headers: { [CLIENT_VERSION_HEADER]: "1.2.0" },
          payload: credentials,
        },
      ],
    );

    assert.equal(withoutHeader.statusCode, 426);
    assert.equal(withoutHeader.body?.code, CLIENT_VERSION_UNSUPPORTED_CODE);
    assert.equal(oldVersion.statusCode, 426);
    assert.equal(oldVersion.body?.code, CLIENT_VERSION_UNSUPPORTED_CODE);
    assert.equal(validVersion.statusCode, 401);
  },
);

test(
  "gate en runtime real: se mantiene cobertura admin y particular (me + login)",
  () => {
    const [
      adminMeBlocked,
      adminMeValid,
      adminLoginBlocked,
      particularMeBlocked,
      particularMeValid,
      particularLoginBlocked,
    ] = runGateRuntimeScenarios(
      { CLIENT_MIN_VERSION: "1.2.0", APP_VERSION: "1.2.0" },
      [
        { method: "GET", path: "/api/admin/auth/me" },
        {
          method: "GET",
          path: "/api/admin/auth/me",
          headers: { [CLIENT_VERSION_HEADER]: "1.2.0" },
        },
        {
          method: "POST",
          path: "/api/admin/auth/login",
          payload: { username: "admin", password: "wrong-password" },
        },
        { method: "GET", path: "/api/particular/auth/me" },
        {
          method: "GET",
          path: "/api/particular/auth/me",
          headers: { [CLIENT_VERSION_HEADER]: "1.2.0" },
        },
        {
          method: "POST",
          path: "/api/particular/auth/login",
          payload: { identifier: "token-value", password: "token-value" },
        },
      ],
    );

    assert.equal(adminMeBlocked.statusCode, 426);
    assert.equal(adminMeValid.statusCode, 401);
    assert.equal(adminLoginBlocked.statusCode, 426);
    assert.equal(particularMeBlocked.statusCode, 426);
    assert.equal(particularMeValid.statusCode, 401);
    assert.equal(particularLoginBlocked.statusCode, 426);
  },
);

test(
  "gate en runtime real: rutas publicas (app-version, health, contact) nunca se bloquean sin header",
  () => {
    const [appVersion, health, apiHealth, contact] = runGateRuntimeScenarios(
      { CLIENT_MIN_VERSION: "1.2.0", APP_VERSION: "1.2.0" },
      [
        { method: "GET", path: "/api/app-version" },
        { method: "GET", path: "/health" },
        { method: "GET", path: "/api/health" },
        { method: "POST", path: "/api/contact", payload: {} },
      ],
    );

    assert.notEqual(appVersion.statusCode, 426);
    assert.notEqual(health.statusCode, 426);
    assert.notEqual(apiHealth.statusCode, 426);
    assert.notEqual(contact.statusCode, 426);
  },
);
