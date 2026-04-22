import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { createFastifyApp } = await import("../server/fastify-app.ts");

test(
  "createFastifyApp monta una app Express mediante la capa de compatibilidad",
  async () => {
    const app = await createFastifyApp(() => {
      const legacyApp = express();

      legacyApp.get("/", (_req, res) => {
        res.setHeader("x-legacy-bridge", "ok");
        res.status(204).end();
      });

      return legacyApp;
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/",
      });

      assert.equal(response.statusCode, 204);
      assert.equal(response.headers["x-legacy-bridge"], "ok");
      assert.equal(response.body, "");
    } finally {
      await app.close();
    }
  },
);
