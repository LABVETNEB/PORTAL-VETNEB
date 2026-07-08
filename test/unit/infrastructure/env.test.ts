import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV, resolvePublicSiteUrl } = await import("../../../server/lib/env.ts");

function readGmailApiEnvFromChild(overrides: Record<string, string>) {
  const env = {
    ...process.env,
    NODE_ENV: "test",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    SUPABASE_DB_URL:
      "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    GMAIL_API_CLIENT_ID: "",
    GMAIL_API_CLIENT_SECRET: "",
    GMAIL_API_REFRESH_TOKEN: "",
    GMAIL_API_FROM: "",
    ...overrides,
  };
  const script = [
    'const { ENV } = await import("./server/lib/env.ts");',
    "process.stdout.write(JSON.stringify(ENV.gmailApi));",
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

  return JSON.parse(result.stdout) as {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    from: string;
  };
}

test("ENV expone un contrato base consistente", () => {
  assert.ok(["development", "test", "production"].includes(ENV.nodeEnv));
  assert.equal(typeof ENV.isDevelopment, "boolean");
  assert.equal(typeof ENV.isTest, "boolean");
  assert.equal(typeof ENV.isProduction, "boolean");
  assert.equal(typeof ENV.port, "number");
  assert.equal(Number.isInteger(ENV.port), true);
  assert.equal(ENV.port > 0, true);

  assert.equal(typeof ENV.databaseUrl, "string");
  assert.equal(ENV.databaseUrl.length > 0, true);

  assert.equal(ENV.cookieSecure, ENV.isProduction);
  assert.equal(
    ENV.cookieSameSite,
    ENV.isProduction ? "none" : "lax",
  );
});

test("ENV expone colecciones limpias y strings no vacíos donde corresponde", () => {
  assert.equal(Array.isArray(ENV.corsOrigins), true);
  assert.equal(Array.isArray(ENV.labUploadUsernames), true);
  assert.equal(Array.isArray(ENV.contactTo), true);

  for (const origin of ENV.corsOrigins) {
    assert.equal(typeof origin, "string");
    assert.equal(origin.trim(), origin);
    assert.equal(origin.length > 0, true);
  }

  for (const username of ENV.labUploadUsernames) {
    assert.equal(typeof username, "string");
    assert.equal(username.trim(), username);
    assert.equal(username.length > 0, true);
  }

  for (const recipient of ENV.contactTo) {
    assert.equal(typeof recipient, "string");
    assert.equal(recipient.trim(), recipient);
    assert.equal(recipient.length > 0, true);
  }

  assert.equal(typeof ENV.cookieName, "string");
  assert.equal(ENV.cookieName.length > 0, true);

  assert.equal(typeof ENV.adminCookieName, "string");
  assert.equal(ENV.adminCookieName.length > 0, true);

  assert.equal(typeof ENV.particularCookieName, "string");
  assert.equal(ENV.particularCookieName.length > 0, true);
});

test("ENV.smtp mantiene tipos e invariantes esperadas", () => {
  assert.equal(typeof ENV.smtp.enabled, "boolean");
  assert.equal(typeof ENV.smtp.host, "string");
  assert.equal(typeof ENV.smtp.port, "number");
  assert.equal(Number.isInteger(ENV.smtp.port), true);
  assert.equal(ENV.smtp.port > 0, true);
  assert.equal(typeof ENV.smtp.secure, "boolean");
  assert.equal(typeof ENV.smtp.user, "string");
  assert.equal(typeof ENV.smtp.pass, "string");
  assert.equal(typeof ENV.smtp.from, "string");

  if (ENV.smtp.enabled) {
    assert.equal(ENV.smtp.host.length > 0, true);
    assert.equal(ENV.smtp.user.length > 0, true);
    assert.equal(ENV.smtp.pass.length > 0, true);
    assert.equal(ENV.smtp.from.length > 0, true);
  }
});

test("ENV.gmailApi mantiene tipos e invariantes esperadas", () => {
  assert.equal(typeof ENV.gmailApi.enabled, "boolean");
  assert.equal(typeof ENV.gmailApi.clientId, "string");
  assert.equal(typeof ENV.gmailApi.clientSecret, "string");
  assert.equal(typeof ENV.gmailApi.refreshToken, "string");
  assert.equal(typeof ENV.gmailApi.from, "string");

  if (ENV.gmailApi.enabled) {
    assert.equal(ENV.gmailApi.clientId.length > 0, true);
    assert.equal(ENV.gmailApi.clientSecret.length > 0, true);
    assert.equal(ENV.gmailApi.refreshToken.length > 0, true);
    assert.equal(ENV.gmailApi.from.length > 0, true);
  }
});

test("ENV.gmailApi queda deshabilitado cuando faltan variables requeridas", () => {
  const gmailApi = readGmailApiEnvFromChild({
    GMAIL_API_CLIENT_ID: "google-client-id",
    GMAIL_API_CLIENT_SECRET: "google-client-secret",
    GMAIL_API_REFRESH_TOKEN: "",
    GMAIL_API_FROM: "lab.vetneb@gmail.com",
  });

  assert.equal(gmailApi.enabled, false);
  assert.equal(gmailApi.clientId, "google-client-id");
  assert.equal(gmailApi.clientSecret, "google-client-secret");
  assert.equal(gmailApi.refreshToken, "");
  assert.equal(gmailApi.from, "lab.vetneb@gmail.com");
});

test("ENV.gmailApi queda habilitado cuando las variables requeridas estan completas", () => {
  const gmailApi = readGmailApiEnvFromChild({
    GMAIL_API_CLIENT_ID: "google-client-id",
    GMAIL_API_CLIENT_SECRET: "google-client-secret",
    GMAIL_API_REFRESH_TOKEN: "google-refresh-token",
    GMAIL_API_FROM: "lab.vetneb@gmail.com",
  });

  assert.deepEqual(gmailApi, {
    enabled: true,
    clientId: "google-client-id",
    clientSecret: "google-client-secret",
    refreshToken: "google-refresh-token",
    from: "lab.vetneb@gmail.com",
  });
});

// PUBLIC_SITE_URL contract ──────────────────────────────────────────────────────

test("resolvePublicSiteUrl devuelve undefined cuando no está configurada", () => {
  assert.equal(resolvePublicSiteUrl(undefined, "production"), undefined);
  assert.equal(resolvePublicSiteUrl("", "production"), undefined);
});

test("resolvePublicSiteUrl normaliza al origen y elimina el trailing slash", () => {
  assert.equal(
    resolvePublicSiteUrl("https://vetneb.com.ar/", "production"),
    "https://vetneb.com.ar",
  );
  // origin normaliza host y descarta path/query sobrantes.
  assert.equal(
    resolvePublicSiteUrl("https://VETNEB.com.ar", "production"),
    "https://vetneb.com.ar",
  );
});

test("resolvePublicSiteUrl exige https en producción", () => {
  assert.throws(
    () => resolvePublicSiteUrl("http://vetneb.com.ar", "production"),
    /https/,
  );
  assert.throws(
    () => resolvePublicSiteUrl("http://localhost:3001", "production"),
    /https/,
  );
});

test("resolvePublicSiteUrl admite http://localhost solo en development/test", () => {
  assert.equal(
    resolvePublicSiteUrl("http://localhost:3001", "development"),
    "http://localhost:3001",
  );
  assert.equal(
    resolvePublicSiteUrl("http://127.0.0.1:3000/", "test"),
    "http://127.0.0.1:3000",
  );
});

test("resolvePublicSiteUrl hace fail-fast ante un valor inválido", () => {
  assert.throws(() => resolvePublicSiteUrl("no-es-una-url", "production"), /URL/);
});

test("ENV exige CORS_ORIGIN explícito en producción", () => {
  const source = readFileSync(
    resolve(process.cwd(), "server/lib/env.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  assert.ok(source.includes("if (nodeEnv === \"production\" && configuredCorsOrigins.length === 0) {"));
  assert.ok(source.includes("throw new Error(\"CORS_ORIGIN es obligatorio cuando NODE_ENV=production\");"));
});
