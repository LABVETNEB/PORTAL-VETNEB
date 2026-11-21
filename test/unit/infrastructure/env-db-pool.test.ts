import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function readDatabaseMaxConnectionsFromChild(overrides: Record<string, string>) {
  const env: Record<string, string> = {
    NODE_ENV: "test",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    SUPABASE_DB_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    PARTICULAR_TOKEN_TTL_DAYS: "90",
    DATABASE_MAX_CONNECTIONS: "",
    ...overrides,
  };
  const script = [
    'const { ENV } = await import("./server/lib/env.ts");',
    "process.stdout.write(JSON.stringify(ENV.databaseMaxConnections));",
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
    { cwd: resolve(process.cwd()), env, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as number;
}

test("ENV.databaseMaxConnections usa default 3 cuando no se configura", () => {
  const value = readDatabaseMaxConnectionsFromChild({
    DATABASE_MAX_CONNECTIONS: "",
  });
  assert.equal(value, 3);
});

test("ENV.databaseMaxConnections parsea valor valido dentro del rango", () => {
  const value = readDatabaseMaxConnectionsFromChild({
    DATABASE_MAX_CONNECTIONS: "5",
  });
  assert.equal(value, 5);
});

test("ENV.databaseMaxConnections limita valor alto al techo de 10", () => {
  const value = readDatabaseMaxConnectionsFromChild({
    DATABASE_MAX_CONNECTIONS: "50",
  });
  assert.equal(value, 10);
});

test("ENV.databaseMaxConnections limita valor 1 al piso de 1", () => {
  const value = readDatabaseMaxConnectionsFromChild({
    DATABASE_MAX_CONNECTIONS: "1",
  });
  assert.equal(value, 1);
});

function readSignedUrlTtl(value: string | undefined) {
  const env: Record<string, string> = {
    NODE_ENV: "test",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    SUPABASE_DB_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    PARTICULAR_TOKEN_TTL_DAYS: "90",
  };
  if (value !== undefined) {
    env.SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS = value;
  }
  const script = [
    'const { ENV } = await import("./server/lib/env.ts");',
    "process.stdout.write(JSON.stringify(ENV.signedUrlExpiresInSeconds));",
  ].join("\n");

  return spawnSync(
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
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

test("SEC-10: TTL de URLs firmadas usa 900 s por defecto", () => {
  const result = readSignedUrlTtl(undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout), 900);
});

test("SEC-10: TTL de URLs firmadas acepta valor dentro de la cota y exactamente el máximo", () => {
  for (const [input, expected] of [
    ["60", 60],
    ["900", 900],
  ] as const) {
    const result = readSignedUrlTtl(input);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout), expected);
  }
});

test("SEC-10: TTL de URLs firmadas rechaza valores inválidos o sobre la cota sin truncar ni filtrar valores", () => {
  for (const input of ["901", "86400", "0", "-5", "1.5", "abc", "Infinity", "NaN"]) {
    const result = readSignedUrlTtl(input);
    assert.notEqual(result.status, 0, `debió fallar con ${input}`);
    assert.match(result.stderr, /SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS/);
    assert.doesNotMatch(result.stderr, /service-role-key|postgres:postgres/);
  }
});
