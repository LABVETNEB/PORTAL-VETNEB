import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../../../../server/lib/env.ts");
const { createFastifyApp } = await import("../../../../server/fastify-app.ts");
type RateLimitStore = import("../../../../server/lib/rate-limit-store.ts").RateLimitStore;

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);
const none = async () => [];
const budget = (): RateLimitStore => ({
  get: () => undefined,
  set: () => {},
  consume: (_key, input) => ({ count: 0, resetAt: input.now + input.windowMs }),
});

async function createApp() {
  return createFastifyApp({
    clinicGlobalSearchRoutes: {
      deleteActiveSession: async () => {},
      getActiveSessionByToken: async () => ({ clinicUserId: 1, expiresAt: FUTURE, lastAccess: new Date() }),
      getClinicUserById: async () => ({ id: 1, clinicId: 11, username: "u", role: "clinic_staff" }),
      updateSessionLastAccess: async () => {},
      hashSessionToken: (token) => `hash:${token}`,
      searchRepository: { report: none, particular_token: none, tracking_case: none },
      searchRateLimitStore: budget(),
    },
    adminGlobalSearchRoutes: {
      deleteAdminSession: async () => {},
      getAdminSessionByToken: async () => ({ id: 1, adminUserId: 1, expiresAt: FUTURE, lastAccess: new Date() }),
      getAdminUserById: async (id) => ({ id, username: "admin" }),
      updateAdminSessionLastAccess: async () => {},
      hashSessionToken: (token) => `hash:${token}`,
      searchRepository: {
        clinic: none,
        report: none,
        particular_token: none,
        tracking_case: none,
        clinic_user: none,
      },
      searchRateLimitStore: budget(),
    },
  });
}

/**
 * The browser sends this preflight before every cross-origin search because
 * `apiFetch` adds the client-version header (`x-vetneb-client-version`). If the
 * preflight does not allow it the browser blocks the request and the UI shows
 * the generic «No se pudo completar la búsqueda».
 */
test("GLOBAL-SEARCH preflight: permite los headers que el cliente realmente envía", async () => {
  const app = await createApp();
  try {
    const origin = ENV.corsOrigins[0];
    assert.ok(origin, "development always allows the local origins");

    for (const url of ["/api/admin/search", "/api/search"]) {
      const response = await app.inject({
        method: "OPTIONS",
        url,
        headers: {
          origin,
          "access-control-request-method": "GET",
          "access-control-request-headers": "x-vetneb-client-version",
        },
      });

      assert.equal(response.statusCode, 204, url);
      assert.equal(response.headers["access-control-allow-origin"], origin, url);
      assert.equal(response.headers["access-control-allow-credentials"], "true", url);
      const allowed = String(response.headers["access-control-allow-headers"] ?? "")
        .toLowerCase()
        .split(",")
        .map((name) => name.trim());
      assert.ok(allowed.includes("x-vetneb-client-version"), `${url} allows x-vetneb-client-version`);
    }
  } finally {
    await app.close();
  }
});

test("GLOBAL-SEARCH preflight: un origen ajeno sigue rechazado y sin headers CORS", async () => {
  const app = await createApp();
  try {
    for (const url of ["/api/admin/search", "/api/search"]) {
      const response = await app.inject({
        method: "OPTIONS",
        url,
        headers: {
          origin: "https://evil.example",
          "access-control-request-method": "GET",
          "access-control-request-headers": "x-vetneb-client-version",
        },
      });

      assert.equal(response.statusCode, 403, url);
      assert.equal(response.headers["access-control-allow-origin"], undefined, url);
      assert.equal(response.headers["access-control-allow-headers"], undefined, url);
    }
  } finally {
    await app.close();
  }
});
