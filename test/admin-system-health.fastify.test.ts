import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const { adminSystemHealthNativeRoutes } = await import(
  "../server/routes/admin-system-health.fastify.ts"
);

function buildExpectedContactSnapshot() {
  const explicitRecipients = Array.from(
    new Set(
      ENV.contactTo
        .flatMap((value) => value.split(/[;,]/g))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
  const fallbackRecipients = ENV.isProduction
    ? []
    : Array.from(
      new Set(
        [ENV.gmailApi.enabled ? ENV.gmailApi.from : ENV.smtp.from]
          .flatMap((value) => value.split(/[;,]/g))
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );
  const recipients = explicitRecipients.length > 0
    ? explicitRecipients
    : fallbackRecipients;
  const emailTransportReady = ENV.gmailApi.enabled || ENV.smtp.enabled;
  const contactReady = emailTransportReady && (
    ENV.isProduction ? explicitRecipients.length > 0 : recipients.length > 0
  );

  return {
    contact_email: contactReady ? "configured" : "degraded",
    contact_email_recipients: recipients,
    contact_email_recipient_count: recipients.length,
    contact_to_configured: explicitRecipients.length > 0,
    smtp_from_configured: ENV.smtp.from.trim().length > 0,
    gmail_api_from_configured: ENV.gmailApi.from.trim().length > 0,
  };
}

function isLocalOrLanHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();

  if (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1") {
    return true;
  }

  return normalized.startsWith("192.168.");
}

function buildExpectedCorsSnapshot() {
  const origins = Array.from(
    new Set(
      ENV.corsOrigins.map((origin) => origin.trim()).filter(Boolean),
    ),
  );
  const hasLocalOrLanOrigins = origins.some((origin) => {
    try {
      return isLocalOrLanHostname(new URL(origin).hostname);
    } catch {
      return false;
    }
  });

  return {
    cors: origins.length > 0 ? "configured" : "not_configured",
    cors_origins: origins,
    cors_origin_count: origins.length,
    cors_has_local_or_lan_origins: hasLocalOrLanOrigins,
    node_env: ENV.nodeEnv,
  };
}

test("admin system health requiere sesión admin", async () => {
  const app = Fastify();

  await app.register(adminSystemHealthNativeRoutes, {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getSystemHealthSnapshot: async () => ({
      statusCode: 200,
      payload: {
        success: true,
        status: "ok",
        checks: {
          database: "up",
          storage: "up",
        },
      },
    }),
    getBackendVersion: () => "test-version",
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/",
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Admin no autenticado",
    });
  } finally {
    await app.close();
  }
});

test("admin system health expone servicios, runtime y versión para admin autenticado", async () => {
  const app = Fastify();
  let updatedLastAccess = false;

  await app.register(adminSystemHealthNativeRoutes, {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => ({
      adminUserId: 1,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-04-23T00:00:00.000Z"),
    }),
    getAdminUserById: async () => ({
      id: 1,
      username: "VETNEB",
    }),
    updateAdminSessionLastAccess: async () => {
      updatedLastAccess = true;
    },
    hashSessionToken: (token: string) => `hash:${token}`,
    getSystemHealthSnapshot: async () => ({
      statusCode: 200,
      payload: {
        success: true,
        status: "ok",
        checks: {
          database: "up",
          storage: "up",
        },
        uptimeSeconds: 123,
        responseTimeMs: 5,
        timestamp: "2026-05-07T00:00:00.000Z",
      },
    }),
    getBackendVersion: () => "2.1.0-test",
    now: () => Date.UTC(2026, 4, 7, 0, 0, 0),
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.status, "ok");
    assert.equal(body.version, "2.1.0-test");
    assert.deepEqual(body.services, {
      database: "up",
      storage: "up",
      smtp: ENV.smtp.enabled ? "configured" : "not_configured",
      gmail_api: ENV.gmailApi.enabled ? "configured" : "not_configured",
      email_transport: ENV.gmailApi.enabled
        ? "gmail_api"
        : ENV.smtp.enabled
          ? "smtp"
          : "not_configured",
      ...buildExpectedContactSnapshot(),
      ...buildExpectedCorsSnapshot(),
    });
    assert.deepEqual(body.checkedBy, {
      adminUserId: 1,
      username: "VETNEB",
    });
    assert.equal(typeof body.runtime.uptimeSeconds, "number");
    assert.equal(typeof body.runtime.memory.rssMb, "number");
    assert.equal(body.health.status, "ok");
    assert.equal(updatedLastAccess, true);
  } finally {
    await app.close();
  }
});
