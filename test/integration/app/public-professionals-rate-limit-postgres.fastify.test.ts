import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";
import { inArray } from "drizzle-orm";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const databaseUrl =
  process.env.SUPABASE_DB_URL?.trim() ?? process.env.DATABASE_URL?.trim();
const databaseTarget = databaseUrl ? new URL(databaseUrl) : undefined;

if (
  !databaseTarget ||
  !["localhost", "127.0.0.1"].includes(databaseTarget.hostname) ||
  databaseTarget.pathname !== "/portal_vetneb_ci"
) {
  throw new Error(
    "SEC-10 requiere DATABASE_URL o SUPABASE_DB_URL para la DB aislada portal_vetneb_ci",
  );
}

process.env.DATABASE_URL = databaseUrl;
process.env.SUPABASE_DB_URL = databaseUrl;

const { db, closeDbConnection } = await import("../../../server/db.ts");
const { loginRateLimits } = await import("../../../drizzle/schema.ts");
const { publicProfessionalsNativeRoutes } = await import(
  "../../../server/routes/public-professionals.fastify.ts"
);
const { GLOBAL_CEILING_MULTIPLIER, hashRateLimitKey } = await import(
  "../../../server/lib/rate-limit-store.ts"
);

const PREFIX = "/api/public/professionals";
const WINDOW_MS = 60_000;
const IP_MAX = 2;
const CEILING = IP_MAX * GLOBAL_CEILING_MULTIPLIER;
const SEARCH_CEILING_KEY = "ceiling:global:public-professionals-search";
const DETAIL_CEILING_KEY = "ceiling:global:public-professionals-detail";

// Documentation range (TEST-NET-2): synthetic origins only.
const originFor = (index: number) => `198.51.100.${(index % 250) + 1}`;

test("SEC-10: techo global compartido y atómico entre dos instancias sobre PostgreSQL real", async (t) => {
  const clock = { now: Date.now() };
  const calls = { search: 0, detail: 0 };
  const touchedKeys = new Set<string>([SEARCH_CEILING_KEY, DETAIL_CEILING_KEY]);

  const cleanup = async () => {
    await db
      .delete(loginRateLimits)
      .where(inArray(loginRateLimits.keyHash, [...touchedKeys].map(hashRateLimitKey)));
  };

  t.after(async () => {
    try {
      await cleanup();
    } finally {
      await closeDbConnection();
    }
  });

  for (let index = 0; index < 250; index += 1) {
    for (const scope of ["search", "detail"]) {
      touchedKeys.add(
        `public-professionals:public-professionals-${scope}:ip:${originFor(index)}`,
      );
    }
  }
  await cleanup();

  /** One backend instance with the real default (persistent) store: nothing injected. */
  const instance = async () => {
    const app = Fastify();
    await app.register(publicProfessionalsNativeRoutes, {
      prefix: PREFIX,
      searchPublicProfessionals: async () => {
        calls.search += 1;
        return { rows: [], total: 0, limit: 20, offset: 0 };
      },
      getPublicProfessionalByClinicId: async () => {
        calls.detail += 1;
        return null;
      },
      createSignedStorageUrl: async (path: string) => `signed:${path}`,
      searchRateLimitWindowMs: WINDOW_MS,
      searchRateLimitMaxAttempts: IP_MAX,
      detailRateLimitWindowMs: WINDOW_MS,
      detailRateLimitMaxAttempts: IP_MAX,
      now: () => clock.now,
    });
    return app;
  };

  const instanceA = await instance();
  const instanceB = await instance();
  t.after(async () => {
    await instanceA.close();
    await instanceB.close();
  });

  const hit = (app: typeof instanceA, path: string, index: number) =>
    app.inject({
      method: "GET",
      url: `${PREFIX}${path}`,
      remoteAddress: originFor(index),
    });

  await t.test("alternar instancias con orígenes distintos agota un único presupuesto", async () => {
    for (let index = 0; index < CEILING; index += 1) {
      const response = await hit(index % 2 === 0 ? instanceA : instanceB, "/search", index);
      assert.equal(response.statusCode, 200, `solicitud ${index + 1}`);
    }

    // CEILING + 1 con un origen nuevo: ambas instancias deben rechazar.
    const overA = await hit(instanceA, "/search", CEILING);
    const overB = await hit(instanceB, "/search", CEILING + 1);

    assert.equal(overA.statusCode, 429);
    assert.equal(overB.statusCode, 429);
    assert.deepEqual(overA.json(), {
      success: false,
      error: overB.json().error,
    });
    assert.equal(overA.headers["ratelimit-remaining"], "0");
    assert.equal(calls.search, CEILING, "el handler no corre sobre el techo");
  });

  await t.test("detalle tiene presupuesto independiente de búsqueda", async () => {
    const response = await hit(instanceB, "/12", 3);

    assert.equal(response.statusCode, 404);
    assert.equal(calls.detail, 1);
  });

  await t.test("la ventana se renueva y ambas instancias vuelven a servir", async () => {
    clock.now += WINDOW_MS + 1;

    const a = await hit(instanceA, "/search", 7);
    const b = await hit(instanceB, "/search", 8);

    assert.equal(a.statusCode, 200);
    assert.equal(b.statusCode, 200);
  });
});
