import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const { createFastifyApp } = await import("../server/fastify-app.ts");

function buildAdminAuthRouteStubs() {
  return {
    createAdminSession: async () => {},
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    getAdminUserByUsername: async () => null,
    updateAdminSessionLastAccess: async () => {},
    generateSessionToken: () => "admin-session-token",
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: async () => ({
      valid: false,
      needsRehash: false,
    }),
    writeAuditLog: async () => {},
  };
}

function buildClinicAuthRouteStubs() {
  return {
    createActiveSession: async () => {},
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    getClinicUserByUsername: async () => null,
    updateSessionLastAccess: async () => {},
    upsertClinicUser: async () => {},
    generateSessionToken: () => "session-token",
    hashPassword: async () => "rehash-password",
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: async () => ({
      valid: false,
      needsRehash: false,
    }),
    writeAuditLog: async () => {},
  };
}

function buildParticularAuthRouteStubs() {
  return {
    createParticularSession: async () => {},
    deleteParticularSession: async () => {},
    getParticularSessionByToken: async () => null,
    getParticularTokenById: async () => null,
    getParticularTokenByTokenHash: async () => null,
    updateParticularSessionLastAccess: async () => {},
    updateParticularTokenLastLogin: async () => {},
    getReportById: async () => null,
    createSignedReportUrl: async (storagePath: string) => `signed-preview:${storagePath}`,
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => `signed-download:${storagePath}:${fileName ?? ""}`,
    generateSessionToken: () => "particular-session-token",
    hashSessionToken: (token: string) => `hash:${token}`,
  };
}

test(
  "createFastifyApp expone root y health nativos y mantiene el bridge Express bajo /api",
  async () => {
    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/bridge", (_req, res) => {
          res.setHeader("x-legacy-bridge", "ok");
          res.status(204).end();
        });

        return legacyApp as any;
      },
      getServiceInfoPayload: () => ({
        success: true,
        service: "portal-vetneb-api",
        environment: "test",
      }),
      getNativeHealthCheckResponse: async () => ({
        statusCode: 200,
        payload: {
          success: true,
          status: "ok",
          checks: {
            database: "up",
            storage: "up",
          },
          uptimeSeconds: 123,
          responseTimeMs: 1,
          timestamp: "2026-04-22T00:00:00.000Z",
        },
      }),
      adminAuthRoutes: buildAdminAuthRouteStubs(),
      clinicAuthRoutes: buildClinicAuthRouteStubs(),
      particularAuthRoutes: buildParticularAuthRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
    });

    try {
      const rootResponse = await app.inject({
        method: "GET",
        url: "/",
      });

      assert.equal(rootResponse.statusCode, 200);

      const healthResponse = await app.inject({
        method: "GET",
        url: "/health",
      });
      assert.equal(healthResponse.statusCode, 200);
      assert.equal(healthResponse.headers["x-legacy-bridge"], undefined);

      const apiHealthResponse = await app.inject({
        method: "GET",
        url: "/api/health",
      });

      assert.equal(apiHealthResponse.statusCode, 200);
      assert.equal(apiHealthResponse.headers["x-legacy-bridge"], undefined);

      const legacyResponse = await app.inject({
        method: "GET",
        url: "/api/bridge",
      });

      assert.equal(legacyResponse.statusCode, 204);
      assert.equal(legacyResponse.headers["x-legacy-bridge"], "ok");
      assert.equal(legacyResponse.body, "");
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/admin/auth al router nativo antes del bridge Express",
  async () => {
    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/admin/auth/me", (_req, res) => {
          res.setHeader("x-legacy-bridge", "should-not-run");
          res.status(418).json({
            success: false,
          });
        });

        return legacyApp as any;
      },
      adminAuthRoutes: {
        ...buildAdminAuthRouteStubs(),
        getAdminSessionByToken: async () => ({
          adminUserId: 7,
          expiresAt: new Date(Date.UTC(2026, 3, 24, 1, 0, 0)),
          lastAccess: new Date(Date.UTC(2026, 3, 23, 23, 0, 0)),
        }),
        getAdminUserById: async () => ({
          id: 7,
          username: "ADMIN",
        }),
        updateAdminSessionLastAccess: async () => {},
      },
      clinicAuthRoutes: buildClinicAuthRouteStubs(),
      particularAuthRoutes: buildParticularAuthRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/auth/me",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);
      assert.ok([200, 401].includes(response.statusCode));

      if (response.statusCode === 200) {
        assert.deepEqual(JSON.parse(response.body), {
          success: true,
          admin: {
            id: 7,
            username: "ADMIN",
          },
        });
      }
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/auth al router nativo antes del bridge Express",
  async () => {
    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/auth/me", (_req, res) => {
          res.setHeader("x-legacy-bridge", "should-not-run");
          res.status(418).json({
            success: false,
          });
        });

        return legacyApp as any;
      },
      adminAuthRoutes: buildAdminAuthRouteStubs(),
      clinicAuthRoutes: {
        ...buildClinicAuthRouteStubs(),
        getActiveSessionByToken: async () => ({
          clinicUserId: 9,
          expiresAt: new Date(Date.UTC(2026, 3, 23, 1, 0, 0)),
        }),
        getClinicUserById: async () => ({
          id: 9,
          clinicId: 5,
          username: "doctor",
          authProId: null,
          role: "clinic_staff",
        }),
        updateSessionLastAccess: async () => {},
      },
      particularAuthRoutes: buildParticularAuthRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          cookie: `${ENV.cookieName}=session-token`,
        },
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);
      assert.ok([200, 401].includes(response.statusCode));

      if (response.statusCode === 200) {
        assert.deepEqual(JSON.parse(response.body), {
          success: true,
          clinicUser: {
            id: 9,
            clinicId: 5,
            username: "doctor",
            authProId: null,
            role: "clinic_staff",
          },
          permissions: {
            canManageClinicUsers: false,
            canUploadReports: true,
          },
        });
      }
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/particular/auth al router nativo antes del bridge Express",
  async () => {
    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/particular/auth/me", (_req, res) => {
          res.setHeader("x-legacy-bridge", "should-not-run");
          res.status(418).json({
            success: false,
          });
        });

        return legacyApp as any;
      },
      adminAuthRoutes: buildAdminAuthRouteStubs(),
      clinicAuthRoutes: buildClinicAuthRouteStubs(),
      particularAuthRoutes: {
        ...buildParticularAuthRouteStubs(),
        getParticularSessionByToken: async () => ({
          particularTokenId: 7,
          expiresAt: new Date(Date.UTC(2026, 3, 24, 1, 0, 0)),
          lastAccess: new Date(Date.UTC(2026, 3, 23, 23, 0, 0)),
        }),
        getParticularTokenById: async () => ({
          id: 7,
          clinicId: 3,
          reportId: 55,
          tokenLast4: "ABCD",
          tutorLastName: "Gomez",
          petName: "Luna",
          petAge: "8 años",
          petBreed: "Caniche",
          petSex: "Hembra",
          petSpecies: "Canina",
          sampleLocation: "Pabellón auricular",
          sampleEvolution: "15 días",
          detailsLesion: "Lesión nodular pequeña",
          extractionDate: new Date("2026-04-20T00:00:00.000Z"),
          shippingDate: new Date("2026-04-21T00:00:00.000Z"),
          isActive: true,
          lastLoginAt: new Date("2026-04-22T10:00:00.000Z"),
          createdAt: new Date("2026-04-20T12:00:00.000Z"),
          updatedAt: new Date("2026-04-22T12:00:00.000Z"),
          createdByAdminId: 1,
          createdByClinicUserId: null,
        }),
        updateParticularSessionLastAccess: async () => {},
        getReportById: async () => ({
          id: 55,
          clinicId: 3,
          storagePath: "reports/report-55.pdf",
          uploadDate: new Date("2026-04-22T09:00:00.000Z"),
          studyType: "Histopatología",
          patientName: "Luna",
          fileName: "luna-report.pdf",
          createdAt: new Date("2026-04-22T09:00:00.000Z"),
          updatedAt: new Date("2026-04-22T09:30:00.000Z"),
        }),
      },
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/particular/auth/me",
        headers: {
          cookie: `${ENV.particularCookieName}=particular-session-token`,
        },
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);
      assert.ok([200, 401].includes(response.statusCode));

      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        assert.equal(body.success, true);
        assert.equal(body.particular.id, 7);
        assert.equal(body.particular.clinicId, 3);
        assert.equal(body.particular.report.id, 55);
      }
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/public/professionals al router nativo antes del bridge Express",
  async () => {
    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/public/professionals/search", (_req, res) => {
          res.setHeader("x-legacy-bridge", "should-not-run");
          res.status(418).json({
            success: false,
          });
        });

        return legacyApp as any;
      },
      adminAuthRoutes: buildAdminAuthRouteStubs(),
      clinicAuthRoutes: buildClinicAuthRouteStubs(),
      particularAuthRoutes: buildParticularAuthRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search",
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);

      if (response.body) {
        assert.deepEqual(JSON.parse(response.body), {
          success: true,
          count: 0,
          total: 0,
          professionals: [],
          filters: {
            query: null,
            locality: null,
            country: null,
          },
          pagination: {
            limit: 20,
            offset: 0,
          },
        });
      }
    } finally {
      await app.close();
    }
  },
);
