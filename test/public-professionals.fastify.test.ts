import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const {
  publicProfessionalsNativeRoutes,
} = await import("../server/routes/public-professionals.fastify.ts");

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(publicProfessionalsNativeRoutes as any, {
    prefix: "/api/public/professionals",
    searchPublicProfessionals: async () => ({
      rows: [],
      total: 0,
      limit: 20,
      offset: 0,
    }),
    getPublicProfessionalByClinicId: async () => null,
    createSignedStorageUrl: async (path: string) => `signed:${path}`,
    ...overrides,
  });

  return app;
}

test(
  "publicProfessionalsNativeRoutes responde search con payload estable y CORS permitido",
  async () => {
    const app = await createTestApp({
      searchPublicProfessionals: async ({
        query,
        locality,
        country,
        limit,
        offset,
      }: {
        query?: string;
        locality?: string;
        country?: string;
        limit: number;
        offset: number;
      }) => {
        assert.equal(query, "cardio");
        assert.equal(locality, "Rosario");
        assert.equal(country, "AR");
        assert.equal(limit, 5);
        assert.equal(offset, 2);

        return {
          rows: [
            {
              clinicId: 7,
              displayName: "Clinica Norte",
              avatarStoragePath: "avatars/7.webp",
              aboutText: "Cardiologia veterinaria",
              specialtyText: "Cardiologia",
              servicesText: "Ecocardiograma",
              email: "norte@example.com",
              phone: "3410000000",
              locality: "Rosario",
              country: "AR",
              updatedAt: new Date("2026-04-23T00:00:00.000Z"),
              profileQualityScore: 0.9,
              rank: 0.75,
              similarity: 0.65,
              score: 1.4,
            },
          ],
          total: 1,
          limit,
          offset,
        };
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search?q=cardio&locality=Rosario&country=AR&limit=5&offset=2",
        headers: {
          origin: "http://localhost:3000",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(
        response.headers["access-control-allow-origin"],
        "http://localhost:3000",
      );
      assert.equal(response.headers["access-control-allow-credentials"], "true");
      assert.equal(response.headers["ratelimit-limit"], "10");

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        count: 1,
        total: 1,
        professionals: [
          {
            clinicId: 7,
            displayName: "Clinica Norte",
            avatarUrl: "signed:avatars/7.webp",
            specialtyText: "Cardiologia",
            servicesText: "Ecocardiograma",
            email: "norte@example.com",
            phone: "3410000000",
            locality: "Rosario",
            country: "AR",
            aboutText: "Cardiologia veterinaria",
            updatedAt: "2026-04-23T00:00:00.000Z",
            relevance: {
              rank: 0.75,
              similarity: 0.65,
              score: 1.4,
            },
            profileQualityScore: 0.9,
          },
        ],
        filters: {
          query: "cardio",
          locality: "Rosario",
          country: "AR",
        },
        pagination: {
          limit: 5,
          offset: 2,
        },
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "publicProfessionalsNativeRoutes devuelve 400 cuando clinicId es invalido",
  async () => {
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/public/professionals/abc",
      });

      assert.equal(response.statusCode, 400);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: "ID de clinica invalido",
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "publicProfessionalsNativeRoutes aplica rate limit nativo fijo por IP",
  async () => {
    let now = 0;

    const app = await createTestApp({
      now: () => now,
      searchRateLimitWindowMs: 60_000,
      searchRateLimitMaxAttempts: 2,
    });

    try {
      const first = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search",
        remoteAddress: "203.0.113.10",
      });

      const second = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search",
        remoteAddress: "203.0.113.10",
      });

      const third = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search",
        remoteAddress: "203.0.113.10",
      });

      assert.equal(first.statusCode, 200);
      assert.equal(first.headers["ratelimit-limit"], "2");
      assert.equal(first.headers["ratelimit-remaining"], "1");

      assert.equal(second.statusCode, 200);
      assert.equal(second.headers["ratelimit-limit"], "2");
      assert.equal(second.headers["ratelimit-remaining"], "0");

      assert.equal(third.statusCode, 429);
      assert.equal(third.headers["ratelimit-limit"], "2");
      assert.equal(third.headers["ratelimit-remaining"], "0");
      assert.deepEqual(JSON.parse(third.body), {
        success: false,
        error: "Demasiadas consultas al directorio público. Intente más tarde.",
      });

      now = 61_000;

      const fourth = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search",
        remoteAddress: "203.0.113.10",
      });

      assert.equal(fourth.statusCode, 200);
      assert.equal(fourth.headers["ratelimit-remaining"], "1");
    } finally {
      await app.close();
    }
  },
);
