import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const {
  publicProfessionalsNativeRoutes,
} = await import("../../../../server/routes/public-professionals.fastify.ts");

type TimedResult = {
  statusCode: number;
  durationMs: number;
};

type CapacityBudget = {
  totalRequests: number;
  totalDurationMs: number;
  p95Ms: number;
  averageMs: number;
};

const PUBLIC_SEARCH_CAPACITY_BUDGET: CapacityBudget = {
  totalRequests: 120,
  totalDurationMs: 10_000,
  p95Ms: 1_000,
  averageMs: 500,
};

const PUBLIC_DETAIL_CAPACITY_BUDGET: CapacityBudget = {
  totalRequests: 80,
  totalDurationMs: 10_000,
  p95Ms: 1_000,
  averageMs: 500,
};

function percentile(values: number[], percentileValue: number) {
  assert.ok(values.length > 0, "percentile requiere valores");

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((percentileValue / 100) * sorted.length) - 1,
  );

  return sorted[index] ?? 0;
}

function average(values: number[]) {
  assert.ok(values.length > 0, "average requiere valores");

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function assertCapacityBudget(input: {
  surface: "search" | "detail";
  results: TimedResult[];
  totalDurationMs: number;
  budget: CapacityBudget;
}) {
  const durations = input.results.map((result) => result.durationMs);
  const p95Ms = percentile(durations, 95);
  const averageMs = average(durations);

  assert.equal(input.results.length, input.budget.totalRequests);
  assert.equal(
    input.results.every((result) => result.statusCode === 200),
    true,
    `todos los requests ${input.surface} deben responder 200`,
  );

  assert.ok(
    input.totalDurationMs < input.budget.totalDurationMs,
    `${input.surface} load smoke totalDurationMs=${input.totalDurationMs.toFixed(2)} debe ser menor a ${input.budget.totalDurationMs}ms`,
  );

  assert.ok(
    p95Ms < input.budget.p95Ms,
    `${input.surface} load smoke p95Ms=${p95Ms.toFixed(2)} debe ser menor a ${input.budget.p95Ms}ms`,
  );

  assert.ok(
    averageMs < input.budget.averageMs,
    `${input.surface} load smoke averageMs=${averageMs.toFixed(2)} debe ser menor a ${input.budget.averageMs}ms`,
  );
}

async function createPerformanceApp() {
  const app = Fastify();

  await app.register(publicProfessionalsNativeRoutes as any, {
    prefix: "/api/public/professionals",
    searchPublicProfessionals: async ({
      limit,
      offset,
    }: {
      limit: number;
      offset: number;
    }) => ({
      rows: Array.from({ length: Math.min(limit, 5) }, (_, index) => ({
        clinicId: offset + index + 1,
        displayName: `Clinica Perf ${offset + index + 1}`,
        avatarStoragePath: null,
        aboutText: "Perfil publico para smoke de carga",
        specialtyText: "Histopatologia",
        servicesText: "Biopsias y citologias",
        email: "perf@example.com",
        phone: "3410000000",
        locality: "Rosario",
        country: "AR",
        updatedAt: new Date("2026-05-05T12:00:00.000Z"),
        profileQualityScore: 0.9,
        rank: 0.7,
        similarity: 0.6,
        score: 1.3,
      })),
      total: 100,
      limit,
      offset,
    }),
    getPublicProfessionalByClinicId: async (clinicId: number) => ({
      clinicId,
      displayName: `Clinica Detail Perf ${clinicId}`,
      avatarStoragePath: null,
      aboutText: "Detalle publico para smoke de carga",
      specialtyText: "Histopatologia",
      servicesText: "Biopsias y citologias",
      email: "detail-perf@example.com",
      phone: "3411111111",
      locality: "Rosario",
      country: "AR",
      updatedAt: new Date("2026-05-05T12:00:00.000Z"),
      profileQualityScore: 0.91,
    }),
    createSignedStorageUrl: async (path: string) => `signed:${path}`,
    searchRateLimitWindowMs: 60_000,
    searchRateLimitMaxAttempts: 1_000,
    detailRateLimitWindowMs: 60_000,
    detailRateLimitMaxAttempts: 1_000,
  });

  return app;
}

async function timedRequest(input: () => Promise<{ statusCode: number }>): Promise<TimedResult> {
  const startedAt = performance.now();
  const response = await input();

  return {
    statusCode: response.statusCode,
    durationMs: performance.now() - startedAt,
  };
}

test("performance smoke mantiene search publico estable bajo carga concurrente", async () => {
  const app = await createPerformanceApp();

  try {
    const startedAt = performance.now();

    const results = await Promise.all(
      Array.from({ length: PUBLIC_SEARCH_CAPACITY_BUDGET.totalRequests }, (_, index) =>
        timedRequest(() =>
          app.inject({
            method: "GET",
            url: `/api/public/professionals/search?q=histo&limit=5&offset=${index % 10}`,
            remoteAddress: `198.51.100.${index + 1}`,
          }),
        ),
      ),
    );

    assertCapacityBudget({
      surface: "search",
      results,
      totalDurationMs: performance.now() - startedAt,
      budget: PUBLIC_SEARCH_CAPACITY_BUDGET,
    });
  } finally {
    await app.close();
  }
});

test("performance smoke mantiene detail publico estable bajo carga concurrente", async () => {
  const app = await createPerformanceApp();

  try {
    const startedAt = performance.now();

    const results = await Promise.all(
      Array.from({ length: PUBLIC_DETAIL_CAPACITY_BUDGET.totalRequests }, (_, index) =>
        timedRequest(() =>
          app.inject({
            method: "GET",
            url: `/api/public/professionals/${(index % 20) + 1}`,
            remoteAddress: `203.0.113.${index + 1}`,
          }),
        ),
      ),
    );

    assertCapacityBudget({
      surface: "detail",
      results,
      totalDurationMs: performance.now() - startedAt,
      budget: PUBLIC_DETAIL_CAPACITY_BUDGET,
    });
  } finally {
    await app.close();
  }
});

test("public capacity budget guardrail covers bounded public surfaces", () => {
  const publicProfessionals = readFileSync(
    new URL("../../../../server/routes/public-professionals.fastify.ts", import.meta.url),
    "utf8",
  );

  const publicReportAccess = readFileSync(
    new URL("../../../../server/routes/public-report-access.fastify.ts", import.meta.url),
    "utf8",
  );

  assert.match(publicProfessionals, /parsePositiveInt\(request\.query\.limit, 20, 50\)/);
  assert.match(publicProfessionals, /parseOffset\(request\.query\.offset, 0\)/);
  assert.match(publicProfessionals, /searchRateLimitStore\?: RateLimitStore/);
  assert.match(publicProfessionals, /detailRateLimitStore\?: RateLimitStore/);
  assert.match(publicProfessionals, /PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_MAX_ATTEMPTS/);
  assert.match(publicProfessionals, /PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_MAX_ATTEMPTS/);

  assert.match(publicReportAccess, /publicReportAccessRateLimitStore\?: RateLimitStore/);
  assert.match(publicReportAccess, /PUBLIC_REPORT_ACCESS_RATE_LIMIT_MAX_ATTEMPTS/);
  assert.match(publicReportAccess, /await getOrCreateRateLimitEntry\(/);
  assert.match(publicReportAccess, /await incrementRateLimitEntry\(/);
});