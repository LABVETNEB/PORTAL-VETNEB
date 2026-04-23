import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { createFastifyApp } = await import("../server/fastify-app.ts");

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
