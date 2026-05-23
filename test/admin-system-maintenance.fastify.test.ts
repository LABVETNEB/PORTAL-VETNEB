import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.CORS_ORIGIN ??=
  "https://portal-vetneb-frontend-staging.onrender.com";

const { ENV } = await import("../server/lib/env.ts");
const { adminSystemMaintenanceNativeRoutes } = await import(
  "../server/routes/admin-system-maintenance.fastify.ts"
);
const STAGING_ORIGIN = "https://portal-vetneb-frontend-staging.onrender.com";

test("admin maintenance purge dry-run requiere sesión admin", async () => {
  const app = Fastify();

  await app.register(adminSystemMaintenanceNativeRoutes, {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getMaintenancePurgeDryRunSnapshot: async () => ({
      dryRun: true,
      generatedAt: "2026-05-07T00:00:00.000Z",
      candidates: [],
      totals: {
        candidateRecords: 0,
        supportedCandidateRecords: 0,
        unsupportedGroups: 0,
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/purge-dry-run",
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

test("admin maintenance purge dry-run devuelve candidatos sin borrar", async () => {
  const app = Fastify();
  let updatedLastAccess = false;

  await app.register(adminSystemMaintenanceNativeRoutes, {
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
    getMaintenancePurgeDryRunSnapshot: async () => ({
      dryRun: true,
      generatedAt: "2026-05-07T00:00:00.000Z",
      candidates: [
        {
          category: "expired_clinic_sessions",
          label: "Sesiones de clínica expiradas",
          count: 2,
          supported: true,
          destructiveAction: "deleteExpiredSessions",
        },
        {
          category: "storage_orphans",
          label: "Archivos huérfanos en Storage",
          count: 0,
          supported: false,
          destructiveAction: null,
          reason: "Storage listing pendiente",
        },
      ],
      totals: {
        candidateRecords: 2,
        supportedCandidateRecords: 2,
        unsupportedGroups: 1,
      },
    }),
    now: () => Date.UTC(2026, 4, 7, 0, 0, 0),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/purge-dry-run",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.dryRun, true);
    assert.deepEqual(body.checkedBy, {
      adminUserId: 1,
      username: "VETNEB",
    });
    assert.equal(body.candidates.length, 2);
    assert.equal(body.totals.candidateRecords, 2);
    assert.equal(body.totals.unsupportedGroups, 1);
    assert.equal(updatedLastAccess, true);
  } finally {
    await app.close();
  }
});

test("admin maintenance purge dry-run responde preflight OPTIONS", async () => {
  const app = Fastify();

  await app.register(adminSystemMaintenanceNativeRoutes, {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getMaintenancePurgeDryRunSnapshot: async () => ({
      dryRun: true,
      generatedAt: "2026-05-07T00:00:00.000Z",
      candidates: [],
      totals: {
        candidateRecords: 0,
        supportedCandidateRecords: 0,
        unsupportedGroups: 0,
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/purge-dry-run",
      headers: {
        origin: STAGING_ORIGIN,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(
      response.headers["access-control-allow-origin"],
      STAGING_ORIGIN,
    );
    assert.equal(response.headers["access-control-allow-credentials"], "true");
    assert.equal(
      response.headers["access-control-allow-methods"],
      "POST,OPTIONS",
    );
  } finally {
    await app.close();
  }
});

test("admin maintenance purge dry-run bloquea origin no permitido", async () => {
  const app = Fastify();

  await app.register(adminSystemMaintenanceNativeRoutes, {
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
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getMaintenancePurgeDryRunSnapshot: async () => ({
      dryRun: true,
      generatedAt: "2026-05-07T00:00:00.000Z",
      candidates: [],
      totals: {
        candidateRecords: 0,
        supportedCandidateRecords: 0,
        unsupportedGroups: 0,
      },
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/purge-dry-run",
      headers: {
        origin: "https://evil.example",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Origen no permitido",
    });
  } finally {
    await app.close();
  }
});
