import test from "node:test";
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
} = await import("../server/routes/public-professionals.fastify.ts");

type TimedResult = {
  statusCode: number;
  durationMs: number;
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
    const totalRequests = 120;
    const startedAt = performance.now();

    const results = await Promise.all(
      Array.from({ length: totalRequests }, (_, index) =>
        timedRequest(() =>
          app.inject({
            method: "GET",
            url: `/api/public/professionals/search?q=histo&limit=5&offset=${index % 10}`,
            remoteAddress: `198.51.100.${index + 1}`,
          }),
        ),
      ),
    );

    const totalDurationMs = performance.now() - startedAt;
    const durations = results.map((result) => result.durationMs);
    const p95Ms = percentile(durations, 95);
    const averageMs = average(durations);

    assert.equal(results.length, totalRequests);
    assert.equal(
      results.every((result) => result.statusCode === 200),
      true,
      "todos los requests search deben responder 200",
    );

    assert.ok(
      totalDurationMs < 10_000,
      `search load smoke totalDurationMs=${totalDurationMs.toFixed(2)} debe ser menor a 10000ms`,
    );

    assert.ok(
      p95Ms < 1_000,
      `search load smoke p95Ms=${p95Ms.toFixed(2)} debe ser menor a 1000ms`,
    );

    assert.ok(
      averageMs < 500,
      `search load smoke averageMs=${averageMs.toFixed(2)} debe ser menor a 500ms`,
    );
  } finally {
    await app.close();
  }
});

test("performance smoke mantiene detail publico estable bajo carga concurrente", async () => {
  const app = await createPerformanceApp();

  try {
    const totalRequests = 80;
    const startedAt = performance.now();

    const results = await Promise.all(
      Array.from({ length: totalRequests }, (_, index) =>
        timedRequest(() =>
          app.inject({
            method: "GET",
            url: `/api/public/professionals/${(index % 20) + 1}`,
            remoteAddress: `203.0.113.${index + 1}`,
          }),
        ),
      ),
    );

    const totalDurationMs = performance.now() - startedAt;
    const durations = results.map((result) => result.durationMs);
    const p95Ms = percentile(durations, 95);
    const averageMs = average(durations);

    assert.equal(results.length, totalRequests);
    assert.equal(
      results.every((result) => result.statusCode === 200),
      true,
      "todos los requests detail deben responder 200",
    );

    assert.ok(
      totalDurationMs < 10_000,
      `detail load smoke totalDurationMs=${totalDurationMs.toFixed(2)} debe ser menor a 10000ms`,
    );

    assert.ok(
      p95Ms < 1_000,
      `detail load smoke p95Ms=${p95Ms.toFixed(2)} debe ser menor a 1000ms`,
    );

    assert.ok(
      averageMs < 500,
      `detail load smoke averageMs=${averageMs.toFixed(2)} debe ser menor a 500ms`,
    );
  } finally {
    await app.close();
  }
});
