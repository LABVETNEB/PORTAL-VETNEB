import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { publicProfessionalsNativeRoutes } = await import(
  "../server/routes/public-professionals.fastify.ts"
);

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function extractPluginBody(source: string): string {
  const marker = "export const publicProfessionalsNativeRoutes";
  const start = source.indexOf(marker);

  assert.notEqual(start, -1, "falta publicProfessionalsNativeRoutes");

  return source.slice(start);
}

function extractRegisteredMethods(source: string): Array<{
  method: string;
  path: string;
}> {
  return [
    ...source.matchAll(
      /\bapp\.(get|post|patch|put|delete|head|options)\s*<[\s\S]*?>?\s*\(\s*"([^"]+)"/g,
    ),
  ].map((match) => ({
    method: match[1].toUpperCase(),
    path: match[2],
  }));
}

function buildPublicProfessionalsRouteStubs() {
  return {
    searchPublicProfessionals: async () => ({
      rows: [],
      total: 0,
      limit: 20,
      offset: 0,
    }),
    getPublicProfessionalByClinicId: async () => null,
    createSignedStorageUrl: async (path: string) => `signed:${path}`,
    searchRateLimitMaxAttempts: 1_000,
    detailRateLimitMaxAttempts: 1_000,
  };
}

async function buildSurfaceApp() {
  const app = Fastify({
    logger: false,
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      success: false,
      error: "Ruta no encontrada",
      path: request.url,
    });
  });

  await app.register(publicProfessionalsNativeRoutes, {
    prefix: "/api/public/professionals",
    ...buildPublicProfessionalsRouteStubs(),
  });

  return app;
}

test("router público de profesionales conserva solo endpoints GET search y detail", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");
  const pluginBody = extractPluginBody(source);
  const routes = extractRegisteredMethods(pluginBody);

  assert.deepEqual(routes, [
    {
      method: "GET",
      path: "/search",
    },
    {
      method: "GET",
      path: "/:clinicId",
    },
  ]);

  for (const forbiddenMethod of [
    "POST",
    "PATCH",
    "PUT",
    "DELETE",
    "HEAD",
    "OPTIONS",
  ]) {
    assert.equal(
      routes.some((route) => route.method === forbiddenMethod),
      false,
      `el router público no debe exponer ${forbiddenMethod}`,
    );
  }
});

test("createFastifyApp monta profesionales públicos solo bajo prefix canónico", () => {
  const source = readSource("server/fastify-app.ts");
  const registrationMatches = [
    ...source.matchAll(
      /app\.register\(publicProfessionalsNativeRoutes,\s*\{[\s\S]*?prefix:\s*"([^"]+)"/g,
    ),
  ];
  const prefixes = registrationMatches.map((match) => match[1]);

  assert.deepEqual(prefixes, ["/api/public/professionals"]);

  for (const forbiddenPrefix of [
    "/api/professionals",
    "/api/public/clinics",
    "/api/public/clinics/professionals",
    "/api/clinics/public",
    "/public/professionals",
  ]) {
    assert.equal(
      source.includes(`prefix: "${forbiddenPrefix}"`),
      false,
      `no debe existir alias ${forbiddenPrefix}`,
    );
  }
});

test("superficie pública responde search y detail solo en prefix canónico", async () => {
  const app = await buildSurfaceApp();

  try {
    const search = await app.inject({
      method: "GET",
      url: "/api/public/professionals/search",
    });

    const detail = await app.inject({
      method: "GET",
      url: "/api/public/professionals/123",
    });

    const aliasSearchUrl = "/api/professionals/search";
    const aliasDetailUrl = "/api/professionals/123";

    const aliasSearch = await app.inject({
      method: "GET",
      url: aliasSearchUrl,
    });

    const aliasDetail = await app.inject({
      method: "GET",
      url: aliasDetailUrl,
    });

    assert.equal(search.statusCode, 200);
    assert.equal(detail.statusCode, 404);
    assert.deepEqual(JSON.parse(detail.body), {
      success: false,
      error: "Perfil publico no encontrado",
    });

    assert.equal(aliasSearch.statusCode, 404);
    assert.deepEqual(JSON.parse(aliasSearch.body), {
      success: false,
      error: "Ruta no encontrada",
      path: aliasSearchUrl,
    });

    assert.equal(aliasDetail.statusCode, 404);
    assert.deepEqual(JSON.parse(aliasDetail.body), {
      success: false,
      error: "Ruta no encontrada",
      path: aliasDetailUrl,
    });
  } finally {
    await app.close();
  }
});

test("superficie pública no acepta métodos mutantes en profesionales públicos", async () => {
  const app = await buildSurfaceApp();

  try {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"] as const) {
      const searchResponse = await app.inject({
        method,
        url: "/api/public/professionals/search",
      });

      const detailResponse = await app.inject({
        method,
        url: "/api/public/professionals/123",
      });

      assert.equal(
        [404, 405].includes(searchResponse.statusCode),
        true,
        `${method} search debe estar bloqueado por superficie pública`,
      );
      assert.equal(
        [404, 405].includes(detailResponse.statusCode),
        true,
        `${method} detail debe estar bloqueado por superficie pública`,
      );

      assert.notEqual(searchResponse.statusCode, 200);
      assert.notEqual(detailResponse.statusCode, 200);
    }
  } finally {
    await app.close();
  }
});

test("superficie pública no expone aliases de profesionales públicos", async () => {
  const app = await buildSurfaceApp();

  try {
    for (const url of [
      "/api/public/clinics/search",
      "/api/public/clinics/123",
      "/api/public/clinics/professionals/search",
      "/api/public/clinics/professionals/123",
      "/api/clinics/public/search",
      "/api/clinics/public/123",
      "/public/professionals/search",
      "/public/professionals/123",
    ]) {
      const response = await app.inject({
        method: "GET",
        url,
      });

      assert.equal(response.statusCode, 404);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: "Ruta no encontrada",
        path: url,
      });
    }
  } finally {
    await app.close();
  }
});
