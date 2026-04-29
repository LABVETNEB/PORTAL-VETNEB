import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {
  buildPublicProfessionalsRouteFixtureStubs,
} from "./helpers/public-professionals-fixtures.ts";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { publicProfessionalsNativeRoutes } = await import(
  "../server/routes/public-professionals.fastify.ts"
);

const allowedOrigin = "http://localhost:3000";

async function buildHeaderApp() {
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
    ...buildPublicProfessionalsRouteFixtureStubs(),
  });

  return app;
}

function assertJsonContentType(headers: Record<string, unknown>) {
  assert.match(
    String(headers["content-type"]),
    /^application\/json(; charset=utf-8)?$/i,
  );
}

function assertNoSetCookie(headers: Record<string, unknown>) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(headers, "set-cookie"),
    false,
    "la respuesta publica no debe setear cookies",
  );
}

function assertNoPermissiveCors(headers: Record<string, unknown>) {
  assert.equal(headers["access-control-allow-origin"], undefined);
  assert.equal(headers["access-control-allow-credentials"], undefined);
  assert.equal(headers["access-control-expose-headers"], undefined);
}

function assertRateLimitHeaders(
  headers: Record<string, unknown>,
  expected: {
    policy: string;
    limit: string;
    remaining: string;
    reset: string;
  },
) {
  assert.equal(headers["ratelimit-policy"], expected.policy);
  assert.equal(headers["ratelimit-limit"], expected.limit);
  assert.equal(headers["ratelimit-remaining"], expected.remaining);
  assert.equal(headers["ratelimit-reset"], expected.reset);
}

function assertNoRateLimitHeaders(headers: Record<string, unknown>) {
  assert.equal(headers["ratelimit-policy"], undefined);
  assert.equal(headers["ratelimit-limit"], undefined);
  assert.equal(headers["ratelimit-remaining"], undefined);
  assert.equal(headers["ratelimit-reset"], undefined);
}

test("profesionales públicos responde JSON y sin cookies en search detail y errores públicos", async () => {
  const app = await buildHeaderApp();

  try {
    const search = await app.inject({
      method: "GET",
      url: "/api/public/professionals/search",
      remoteAddress: "198.51.100.129",
    });

    const detail = await app.inject({
      method: "GET",
      url: "/api/public/professionals/123",
      remoteAddress: "198.51.100.130",
    });

    const invalidDetail = await app.inject({
      method: "GET",
      url: "/api/public/professionals/not-a-number",
      remoteAddress: "198.51.100.131",
    });

    const missingDetail = await app.inject({
      method: "GET",
      url: "/api/public/professionals/404",
      remoteAddress: "198.51.100.132",
    });

    const blockedOrigin = await app.inject({
      method: "GET",
      url: "/api/public/professionals/search",
      headers: {
        origin: "https://blocked.example",
      },
      remoteAddress: "198.51.100.133",
    });

    const aliasNotFound = await app.inject({
      method: "GET",
      url: "/api/professionals/search",
      remoteAddress: "198.51.100.134",
    });

    for (const response of [
      search,
      detail,
      invalidDetail,
      missingDetail,
      blockedOrigin,
      aliasNotFound,
    ]) {
      assertJsonContentType(response.headers);
      assertNoSetCookie(response.headers);
    }

    assert.equal(search.statusCode, 200);
    assert.equal(detail.statusCode, 200);
    assert.equal(invalidDetail.statusCode, 400);
    assert.equal(missingDetail.statusCode, 404);
    assert.equal(blockedOrigin.statusCode, 403);
    assert.equal(aliasNotFound.statusCode, 404);
  } finally {
    await app.close();
  }
});

test("profesionales públicos expone CORS permitido solo en rutas reales con Origin permitido", async () => {
  const app = await buildHeaderApp();

  try {
    const search = await app.inject({
      method: "GET",
      url: "/api/public/professionals/search",
      headers: {
        origin: allowedOrigin,
      },
      remoteAddress: "198.51.100.135",
    });

    const detail = await app.inject({
      method: "GET",
      url: "/api/public/professionals/123",
      headers: {
        origin: allowedOrigin,
      },
      remoteAddress: "198.51.100.136",
    });

    const aliasNotFound = await app.inject({
      method: "GET",
      url: "/api/professionals/search",
      headers: {
        origin: allowedOrigin,
      },
      remoteAddress: "198.51.100.137",
    });

    assert.equal(search.statusCode, 200);
    assert.equal(detail.statusCode, 200);
    assert.equal(aliasNotFound.statusCode, 404);

    for (const response of [search, detail]) {
      assert.equal(response.headers["access-control-allow-origin"], allowedOrigin);
      assert.equal(response.headers["access-control-allow-credentials"], "true");
      assert.equal(
        response.headers["access-control-expose-headers"],
        "RateLimit-Policy, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset",
      );
      assert.equal(response.headers.vary, "Origin");
    }

    assertNoPermissiveCors(aliasNotFound.headers);
  } finally {
    await app.close();
  }
});

test("profesionales públicos no emite CORS permisivo en Origin bloqueado ni requests sin Origin", async () => {
  const app = await buildHeaderApp();

  try {
    const blockedOrigin = await app.inject({
      method: "GET",
      url: "/api/public/professionals/search",
      headers: {
        origin: "https://blocked.example",
      },
      remoteAddress: "198.51.100.138",
    });

    const withoutOrigin = await app.inject({
      method: "GET",
      url: "/api/public/professionals/search",
      remoteAddress: "198.51.100.139",
    });

    assert.equal(blockedOrigin.statusCode, 403);
    assert.deepEqual(JSON.parse(blockedOrigin.body), {
      success: false,
      error: "Origin no permitido",
      path: "/api/public/professionals/search",
    });
    assertNoPermissiveCors(blockedOrigin.headers);

    assert.equal(withoutOrigin.statusCode, 200);
    assertNoPermissiveCors(withoutOrigin.headers);
  } finally {
    await app.close();
  }
});

test("profesionales públicos emite RateLimit headers solo en rutas reales del directorio", async () => {
  const app = await buildHeaderApp();

  try {
    const search = await app.inject({
      method: "GET",
      url: "/api/public/professionals/search",
      remoteAddress: "198.51.100.140",
    });

    const searchLimited = await app.inject({
      method: "GET",
      url: "/api/public/professionals/search",
      remoteAddress: "198.51.100.140",
    });

    const detail = await app.inject({
      method: "GET",
      url: "/api/public/professionals/123",
      remoteAddress: "198.51.100.141",
    });

    const detailLimited = await app.inject({
      method: "GET",
      url: "/api/public/professionals/123",
      remoteAddress: "198.51.100.141",
    });

    const invalidDetail = await app.inject({
      method: "GET",
      url: "/api/public/professionals/not-a-number",
      remoteAddress: "198.51.100.142",
    });

    const aliasNotFound = await app.inject({
      method: "GET",
      url: "/api/professionals/search",
      remoteAddress: "198.51.100.143",
    });

    assert.equal(search.statusCode, 200);
    assertRateLimitHeaders(search.headers, {
      policy: "1;w=60",
      limit: "1",
      remaining: "0",
      reset: "60",
    });

    assert.equal(searchLimited.statusCode, 429);
    assertRateLimitHeaders(searchLimited.headers, {
      policy: "1;w=60",
      limit: "1",
      remaining: "0",
      reset: "60",
    });

    assert.equal(detail.statusCode, 200);
    assertRateLimitHeaders(detail.headers, {
      policy: "1;w=60",
      limit: "1",
      remaining: "0",
      reset: "60",
    });

    assert.equal(detailLimited.statusCode, 429);
    assertRateLimitHeaders(detailLimited.headers, {
      policy: "1;w=60",
      limit: "1",
      remaining: "0",
      reset: "60",
    });

    assert.equal(invalidDetail.statusCode, 400);
    assertRateLimitHeaders(invalidDetail.headers, {
      policy: "1;w=60",
      limit: "1",
      remaining: "0",
      reset: "60",
    });

    assert.equal(aliasNotFound.statusCode, 404);
    assertNoRateLimitHeaders(aliasNotFound.headers);
  } finally {
    await app.close();
  }
});

test("profesionales públicos no setea cookies en 429 ni aliases 404", async () => {
  const app = await buildHeaderApp();

  try {
    await app.inject({
      method: "GET",
      url: "/api/public/professionals/search",
      remoteAddress: "198.51.100.144",
    });

    const limited = await app.inject({
      method: "GET",
      url: "/api/public/professionals/search",
      remoteAddress: "198.51.100.144",
    });

    const aliasNotFound = await app.inject({
      method: "GET",
      url: "/api/public/clinics/search",
      remoteAddress: "198.51.100.145",
    });

    assert.equal(limited.statusCode, 429);
    assertJsonContentType(limited.headers);
    assertNoSetCookie(limited.headers);

    assert.equal(aliasNotFound.statusCode, 404);
    assertJsonContentType(aliasNotFound.headers);
    assertNoSetCookie(aliasNotFound.headers);
    assertNoPermissiveCors(aliasNotFound.headers);
    assertNoRateLimitHeaders(aliasNotFound.headers);
  } finally {
    await app.close();
  }
});

