import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { z } from "zod";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const {
  publicProfessionalsNativeRoutes,
} = await import("../server/routes/public-professionals.fastify.ts");

const relevanceContract = z.object({
  rank: z.number(),
  similarity: z.number(),
  score: z.number(),
});

const professionalContract = z.object({
  clinicId: z.number().int().positive(),
  displayName: z.string().min(1),
  avatarUrl: z.string().nullable(),
  specialtyText: z.string().nullable(),
  servicesText: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  locality: z.string().nullable(),
  country: z.string().nullable(),
  aboutText: z.string().nullable(),
  updatedAt: z.string().datetime(),
  relevance: relevanceContract,
  profileQualityScore: z.number(),
});

const searchResponseContract = z.object({
  success: z.literal(true),
  count: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  professionals: z.array(professionalContract),
  filters: z.object({
    query: z.string().optional(),
    locality: z.string().optional(),
    country: z.string().optional(),
  }),
  pagination: z.object({
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  }),
});

const detailResponseContract = z.object({
  success: z.literal(true),
  professional: professionalContract,
});

const publicErrorContract = z.object({
  success: z.literal(false),
  error: z.string().min(1),
  path: z.string().optional(),
}).strict();

type SearchInput = {
  query?: string;
  locality?: string;
  country?: string;
  limit: number;
  offset: number;
};

async function createContractApp() {
  const app = Fastify();

  await app.register(publicProfessionalsNativeRoutes as any, {
    prefix: "/api/public/professionals",
    searchPublicProfessionals: async (input: SearchInput) => ({
      rows: [
        {
          clinicId: 7,
          displayName: "Clinica Contrato",
          avatarStoragePath: "avatars/7.webp",
          aboutText: "Contrato publico estable",
          specialtyText: "Histopatologia",
          servicesText: "Biopsias y citologias",
          email: "contrato@example.com",
          phone: "3410000000",
          locality: input.locality ?? "Rosario",
          country: input.country ?? "AR",
          updatedAt: new Date("2026-05-01T12:00:00.000Z"),
          profileQualityScore: 0.91,
          rank: 0.7,
          similarity: 0.6,
          score: 1.3,
        },
      ],
      total: 1,
      limit: input.limit,
      offset: input.offset,
    }),
    getPublicProfessionalByClinicId: async (clinicId: number) => {
      if (clinicId !== 7) {
        return null;
      }

      return {
        clinicId,
        displayName: "Clinica Contrato",
        avatarStoragePath: "avatars/7.webp",
        aboutText: "Detalle publico estable",
        specialtyText: "Histopatologia",
        servicesText: "Biopsias y citologias",
        email: "contrato@example.com",
        phone: "3410000000",
        locality: "Rosario",
        country: "AR",
        updatedAt: new Date("2026-05-01T12:00:00.000Z"),
        profileQualityScore: 0.91,
      };
    },
    createSignedStorageUrl: async (path: string) => `signed:${path}`,
  });

  return app;
}

function parseJsonBody(response: { body: string }) {
  return JSON.parse(response.body) as unknown;
}

test("api contract smoke valida shape de search publico de profesionales", async () => {
  const app = await createContractApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/public/professionals/search?q=histo&locality=Rosario&country=AR&limit=5&offset=0",
    });

    assert.equal(response.statusCode, 200);

    const body = searchResponseContract.parse(parseJsonBody(response));

    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.equal(body.total, 1);
    assert.equal(body.professionals[0]?.clinicId, 7);
    assert.equal(body.professionals[0]?.avatarUrl, "signed:avatars/7.webp");
    assert.deepEqual(body.filters, {
      query: "histo",
      locality: "Rosario",
      country: "AR",
    });
    assert.deepEqual(body.pagination, {
      limit: 5,
      offset: 0,
    });
  } finally {
    await app.close();
  }
});

test("api contract smoke valida shape de detail publico de profesionales", async () => {
  const app = await createContractApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/public/professionals/7",
    });

    assert.equal(response.statusCode, 200);

    const body = detailResponseContract.parse(parseJsonBody(response));

    assert.equal(body.success, true);
    assert.equal(body.professional.clinicId, 7);
    assert.equal(body.professional.displayName, "Clinica Contrato");
    assert.equal(body.professional.avatarUrl, "signed:avatars/7.webp");
    assert.deepEqual(body.professional.relevance, {
      rank: 0,
      similarity: 0,
      score: 0,
    });
  } finally {
    await app.close();
  }
});

test("api contract smoke valida shape de errores publicos sin campos internos", async () => {
  const app = await createContractApp();

  try {
    const invalidIdResponse = await app.inject({
      method: "GET",
      url: "/api/public/professionals/not-a-number",
    });

    assert.equal(invalidIdResponse.statusCode, 400);

    const invalidIdBody = publicErrorContract.parse(parseJsonBody(invalidIdResponse));

    assert.deepEqual(invalidIdBody, {
      success: false,
      error: "ID de clinica invalido",
    });

    const blockedCorsResponse = await app.inject({
      method: "GET",
      url: "/api/public/professionals/search",
      headers: {
        origin: "https://evil.example.com",
      },
    });

    assert.equal(blockedCorsResponse.statusCode, 403);

    const blockedCorsBody = publicErrorContract.parse(parseJsonBody(blockedCorsResponse));

    assert.deepEqual(blockedCorsBody, {
      success: false,
      error: "Origin no permitido",
      path: "/api/public/professionals/search",
    });
  } finally {
    await app.close();
  }
});
