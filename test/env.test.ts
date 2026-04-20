import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");

test("ENV expone un contrato base consistente", () => {
  assert.ok(["development", "test", "production"].includes(ENV.nodeEnv));
  assert.equal(typeof ENV.isDevelopment, "boolean");
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
