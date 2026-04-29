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

test(
  "publicProfessionalsNativeRoutes devuelve 403 cuando origin no esta permitido",
  async () => {
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search",
        headers: {
          origin: "https://evil.example.com",
        },
      });

      assert.equal(response.statusCode, 403);
      assert.equal(response.headers["access-control-allow-origin"], undefined);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: "Origin no permitido",
        path: "/api/public/professionals/search",
      });
    } finally {
      await app.close();
    }
  },
);
test(
  "publicProfessionalsNativeRoutes responde detail con payload estable y helper público",
  async () => {
    let requestedClinicId: number | null = null;
    let signedPath: string | null = null;

    const app = await createTestApp({
      searchPublicProfessionals: async () => {
        throw new Error("detail route must not call searchPublicProfessionals");
      },
      getPublicProfessionalByClinicId: async (clinicId: number) => {
        requestedClinicId = clinicId;

        return {
          clinicId,
          displayName: "Clinica Sur",
          avatarStoragePath: "avatars/11.webp",
          aboutText: "Histopatologia veterinaria avanzada",
          specialtyText: "Histopatologia",
          servicesText: "Biopsias y citologias",
          email: "sur@example.com",
          phone: "3411111111",
          locality: "Rosario",
          country: "AR",
          updatedAt: new Date("2026-04-24T12:00:00.000Z"),
          profileQualityScore: 0.95,
        };
      },
      createSignedStorageUrl: async (path: string) => {
        signedPath = path;
        return `signed:${path}`;
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/public/professionals/11",
      });

      assert.equal(response.statusCode, 200);
      assert.equal(requestedClinicId, 11);
      assert.equal(signedPath, "avatars/11.webp");

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        professional: {
          clinicId: 11,
          displayName: "Clinica Sur",
          avatarUrl: "signed:avatars/11.webp",
          specialtyText: "Histopatologia",
          servicesText: "Biopsias y citologias",
          email: "sur@example.com",
          phone: "3411111111",
          locality: "Rosario",
          country: "AR",
          aboutText: "Histopatologia veterinaria avanzada",
          updatedAt: "2026-04-24T12:00:00.000Z",
          relevance: {
            rank: 0,
            similarity: 0,
            score: 0,
          },
          profileQualityScore: 0.95,
        },
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "publicProfessionalsNativeRoutes search normaliza filtros y no llama helper de detail",
  async () => {
    let receivedInput:
      | {
          query?: string;
          locality?: string;
          country?: string;
          limit: number;
          offset: number;
        }
      | null = null;

    const app = await createTestApp({
      searchPublicProfessionals: async (input: {
        query?: string;
        locality?: string;
        country?: string;
        limit: number;
        offset: number;
      }) => {
        receivedInput = input;

        return {
          rows: [],
          total: 0,
          limit: input.limit,
          offset: input.offset,
        };
      },
      getPublicProfessionalByClinicId: async () => {
        throw new Error("search route must not call getPublicProfessionalByClinicId");
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search?q=%20Histo%20&query=ignored&locality=%20Cordoba%20&country=%20AR%20&limit=999&offset=-10",
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(receivedInput, {
        query: "Histo",
        locality: "Cordoba",
        country: "AR",
        limit: 50,
        offset: 0,
      });

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        count: 0,
        total: 0,
        professionals: [],
        filters: {
          query: "Histo",
          locality: "Cordoba",
          country: "AR",
        },
        pagination: {
          limit: 50,
          offset: 0,
        },
      });
    } finally {
      await app.close();
    }
  },
);
test(
  "publicProfessionalsNativeRoutes mantiene headers RateLimit separados para search y detail",
  async () => {
    const app = await createTestApp({
      now: () => 1_000,
      searchRateLimitWindowMs: 30_000,
      searchRateLimitMaxAttempts: 2,
      detailRateLimitWindowMs: 45_000,
      detailRateLimitMaxAttempts: 3,
      getPublicProfessionalByClinicId: async (clinicId: number) => ({
        clinicId,
        displayName: "Clinica Rate Limit",
        avatarStoragePath: null,
        aboutText: "Detalle publico para rate limit",
        specialtyText: "Histopatologia",
        servicesText: "Diagnostico histopatologico",
        email: "rate@example.com",
        phone: "3414444444",
        locality: "Rosario",
        country: "AR",
        updatedAt: new Date("2026-04-27T12:00:00.000Z"),
        profileQualityScore: 0.88,
      }),
    });

    try {
      const searchResponse = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search",
        remoteAddress: "198.51.100.10",
      });

      const detailResponse = await app.inject({
        method: "GET",
        url: "/api/public/professionals/11",
        remoteAddress: "198.51.100.10",
      });

      assert.equal(searchResponse.statusCode, 200);
      assert.equal(searchResponse.headers["ratelimit-policy"], "2;w=30");
      assert.equal(searchResponse.headers["ratelimit-limit"], "2");
      assert.equal(searchResponse.headers["ratelimit-remaining"], "1");
      assert.equal(searchResponse.headers["ratelimit-reset"], "30");

      assert.equal(detailResponse.statusCode, 200);
      assert.equal(detailResponse.headers["ratelimit-policy"], "3;w=45");
      assert.equal(detailResponse.headers["ratelimit-limit"], "3");
      assert.equal(detailResponse.headers["ratelimit-remaining"], "2");
      assert.equal(detailResponse.headers["ratelimit-reset"], "45");
    } finally {
      await app.close();
    }
  },
);

test(
  "publicProfessionalsNativeRoutes no comparte bucket de rate limit entre search y detail",
  async () => {
    let now = 10_000;
    let searchCalls = 0;
    let detailCalls = 0;

    const app = await createTestApp({
      now: () => now,
      searchRateLimitWindowMs: 60_000,
      searchRateLimitMaxAttempts: 1,
      detailRateLimitWindowMs: 90_000,
      detailRateLimitMaxAttempts: 1,
      searchPublicProfessionals: async () => {
        searchCalls += 1;

        return {
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        };
      },
      getPublicProfessionalByClinicId: async (clinicId: number) => {
        detailCalls += 1;

        return {
          clinicId,
          displayName: "Clinica Bucket Separado",
          avatarStoragePath: null,
          aboutText: "Detalle publico con bucket separado",
          specialtyText: "Histopatologia",
          servicesText: "Diagnostico histopatologico",
          email: "bucket@example.com",
          phone: "3415555555",
          locality: "Cordoba",
          country: "AR",
          updatedAt: new Date("2026-04-28T12:00:00.000Z"),
          profileQualityScore: 0.92,
        };
      },
    });

    try {
      const firstSearch = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search",
        remoteAddress: "203.0.113.122",
      });

      const secondSearch = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search",
        remoteAddress: "203.0.113.122",
      });

      const firstDetail = await app.inject({
        method: "GET",
        url: "/api/public/professionals/22",
        remoteAddress: "203.0.113.122",
      });

      const secondDetail = await app.inject({
        method: "GET",
        url: "/api/public/professionals/22",
        remoteAddress: "203.0.113.122",
      });

      assert.equal(firstSearch.statusCode, 200);
      assert.equal(firstSearch.headers["ratelimit-policy"], "1;w=60");
      assert.equal(firstSearch.headers["ratelimit-limit"], "1");
      assert.equal(firstSearch.headers["ratelimit-remaining"], "0");

      assert.equal(secondSearch.statusCode, 429);
      assert.equal(secondSearch.headers["ratelimit-policy"], "1;w=60");
      assert.equal(secondSearch.headers["ratelimit-limit"], "1");
      assert.equal(secondSearch.headers["ratelimit-remaining"], "0");
      assert.deepEqual(JSON.parse(secondSearch.body), {
        success: false,
        error: "Demasiadas consultas al directorio público. Intente más tarde.",
      });

      assert.equal(firstDetail.statusCode, 200);
      assert.equal(firstDetail.headers["ratelimit-policy"], "1;w=90");
      assert.equal(firstDetail.headers["ratelimit-limit"], "1");
      assert.equal(firstDetail.headers["ratelimit-remaining"], "0");

      assert.equal(secondDetail.statusCode, 429);
      assert.equal(secondDetail.headers["ratelimit-policy"], "1;w=90");
      assert.equal(secondDetail.headers["ratelimit-limit"], "1");
      assert.equal(secondDetail.headers["ratelimit-remaining"], "0");
      assert.deepEqual(JSON.parse(secondDetail.body), {
        success: false,
        error: "Demasiadas consultas al perfil público. Intente más tarde.",
      });

      assert.equal(searchCalls, 1);
      assert.equal(detailCalls, 1);

      now = 101_000;

      const detailAfterReset = await app.inject({
        method: "GET",
        url: "/api/public/professionals/22",
        remoteAddress: "203.0.113.122",
      });

      assert.equal(detailAfterReset.statusCode, 200);
      assert.equal(detailAfterReset.headers["ratelimit-remaining"], "0");
      assert.equal(detailCalls, 2);
    } finally {
      await app.close();
    }
  },
);
test(
  "publicProfessionalsNativeRoutes aplica CORS permitido de forma consistente en search y detail",
  async () => {
    const app = await createTestApp({
      getPublicProfessionalByClinicId: async (clinicId: number) => ({
        clinicId,
        displayName: "Clinica CORS",
        avatarStoragePath: null,
        aboutText: "Perfil publico para CORS",
        specialtyText: "Histopatologia",
        servicesText: "Diagnostico histopatologico",
        email: "cors@example.com",
        phone: "3416666666",
        locality: "Rosario",
        country: "AR",
        updatedAt: new Date("2026-04-29T12:00:00.000Z"),
        profileQualityScore: 0.93,
      }),
    });

    try {
      const searchResponse = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search",
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const detailResponse = await app.inject({
        method: "GET",
        url: "/api/public/professionals/31",
        headers: {
          origin: "http://localhost:3000",
        },
      });

      for (const response of [searchResponse, detailResponse]) {
        assert.equal(response.statusCode, 200);
        assert.equal(
          response.headers["access-control-allow-origin"],
          "http://localhost:3000",
        );
        assert.equal(response.headers["access-control-allow-credentials"], "true");
        assert.equal(response.headers.vary, "Origin");
        assert.equal(
          response.headers["access-control-expose-headers"],
          "RateLimit-Policy, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset",
        );
        assert.notEqual(response.headers["ratelimit-policy"], undefined);
        assert.notEqual(response.headers["ratelimit-limit"], undefined);
        assert.notEqual(response.headers["ratelimit-remaining"], undefined);
        assert.notEqual(response.headers["ratelimit-reset"], undefined);
      }
    } finally {
      await app.close();
    }
  },
);

test(
  "publicProfessionalsNativeRoutes bloquea origin no permitido en search y detail sin headers permisivos",
  async () => {
    let searchCalls = 0;
    let detailCalls = 0;

    const app = await createTestApp({
      searchPublicProfessionals: async () => {
        searchCalls += 1;

        return {
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        };
      },
      getPublicProfessionalByClinicId: async (clinicId: number) => {
        detailCalls += 1;

        return {
          clinicId,
          displayName: "Clinica Bloqueada",
          avatarStoragePath: null,
          aboutText: "No debe ejecutarse con origin bloqueado",
          specialtyText: "Histopatologia",
          servicesText: "Diagnostico histopatologico",
          email: "blocked@example.com",
          phone: "3417777777",
          locality: "Cordoba",
          country: "AR",
          updatedAt: new Date("2026-04-29T13:00:00.000Z"),
          profileQualityScore: 0.9,
        };
      },
    });

    try {
      const searchResponse = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search",
        headers: {
          origin: "https://evil.example.com",
        },
      });

      const detailResponse = await app.inject({
        method: "GET",
        url: "/api/public/professionals/31",
        headers: {
          origin: "https://evil.example.com",
        },
      });

      assert.equal(searchCalls, 0);
      assert.equal(detailCalls, 0);

      assert.equal(searchResponse.statusCode, 403);
      assert.equal(detailResponse.statusCode, 403);

      for (const response of [searchResponse, detailResponse]) {
        assert.equal(response.headers["access-control-allow-origin"], undefined);
        assert.equal(response.headers["access-control-allow-credentials"], undefined);
        assert.equal(response.headers["access-control-expose-headers"], undefined);
        assert.equal(response.headers["ratelimit-policy"], undefined);
        assert.deepEqual(JSON.parse(response.body), {
          success: false,
          error: "Origin no permitido",
          path:
            response === searchResponse
              ? "/api/public/professionals/search"
              : "/api/public/professionals/31",
        });
      }
    } finally {
      await app.close();
    }
  },
);

test(
  "publicProfessionalsNativeRoutes permite requests sin Origin sin headers CORS permisivos",
  async () => {
    const app = await createTestApp({
      getPublicProfessionalByClinicId: async (clinicId: number) => ({
        clinicId,
        displayName: "Clinica Sin Origin",
        avatarStoragePath: null,
        aboutText: "Request server-to-server sin Origin",
        specialtyText: "Histopatologia",
        servicesText: "Diagnostico histopatologico",
        email: "no-origin@example.com",
        phone: "3418888888",
        locality: "Rosario",
        country: "AR",
        updatedAt: new Date("2026-04-29T14:00:00.000Z"),
        profileQualityScore: 0.89,
      }),
    });

    try {
      const searchResponse = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search",
      });

      const detailResponse = await app.inject({
        method: "GET",
        url: "/api/public/professionals/31",
      });

      for (const response of [searchResponse, detailResponse]) {
        assert.equal(response.statusCode, 200);
        assert.equal(response.headers["access-control-allow-origin"], undefined);
        assert.equal(response.headers["access-control-allow-credentials"], undefined);
        assert.equal(response.headers["access-control-expose-headers"], undefined);
        assert.notEqual(response.headers["ratelimit-policy"], undefined);
      }
    } finally {
      await app.close();
    }
  },
);
