import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { readSourceFile } from "../helpers/tracked-source-files.ts";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { publicProfessionalsNativeRoutes } = await import(
  "../../server/routes/public-professionals.fastify.ts"
);

import {
  applyLoginIdentifierCeiling,
  buildLoginIdentifierCeilingKey,
  buildLoginRateLimitKey,
} from "../../server/lib/login-rate-limit.ts";
import {
  consumeGlobalCeiling,
  consumeRateLimitAttempt,
  createMemoryRateLimitStore,
  GLOBAL_CEILING_MULTIPLIER,
} from "../../server/lib/rate-limit-store.ts";

const WINDOW_MS = 15 * 60 * 1000;
const MAX = 3;
const NOW = 1_800_000_000_000;

async function attempt(
  store: ReturnType<typeof createMemoryRateLimitStore>,
  identifier: string,
  ip: string,
  now = NOW,
) {
  const charged = await consumeRateLimitAttempt(
    store,
    buildLoginRateLimitKey({ surface: "clinic", identifier, ipAddress: ip }),
    { windowMs: WINDOW_MS, now },
  );
  return applyLoginIdentifierCeiling(store, charged, {
    identifier,
    windowMs: WINDOW_MS,
    now,
    maxAttempts: MAX,
  });
}

test("rotar la IP no evita el tope por identificador", async () => {
  const store = createMemoryRateLimitStore();
  let blockedAt = -1;

  for (let i = 0; i < MAX * 10; i += 1) {
    const entry = await attempt(store, "victima", `198.51.100.${i + 1}`);
    assert.ok(i < MAX * 5 ? entry.count <= MAX : true);
    if (entry.count > MAX) {
      blockedAt = i;
      break;
    }
  }

  assert.equal(blockedAt, MAX * 5, "bloquea tras el cupo por identificador");
});

test("sin rotar IP el límite por IP sigue aplicando primero", async () => {
  const store = createMemoryRateLimitStore();
  let last = { count: 0, resetAt: 0 };
  for (let i = 0; i < MAX + 1; i += 1) {
    last = await attempt(store, "otro", "198.51.100.5");
  }
  assert.ok(last.count > MAX);
});

test("identificadores distintos no se afectan entre sí", async () => {
  const store = createMemoryRateLimitStore();
  for (let i = 0; i < MAX * 5 + 2; i += 1) {
    await attempt(store, "a", `198.51.100.${i + 1}`);
  }
  const other = await attempt(store, "b", "198.51.100.200");
  assert.ok(other.count <= MAX);
});

test("el identificador se normaliza (mayúsculas y espacios)", () => {
  assert.equal(
    buildLoginIdentifierCeilingKey("  Victima "),
    buildLoginIdentifierCeilingKey("victima"),
  );
});

test("el cupo se renueva al vencer la ventana", async () => {
  const store = createMemoryRateLimitStore();
  for (let i = 0; i < MAX * 5 + 2; i += 1) {
    await attempt(store, "v", `198.51.100.${i + 1}`);
  }
  const later = await attempt(store, "v", "198.51.100.250", NOW + WINDOW_MS + 1);
  assert.ok(later.count <= MAX);
});

test("techo global: se supera con IPs distintas y se renueva", async () => {
  const store = createMemoryRateLimitStore();
  const maxAttempts = 2 * GLOBAL_CEILING_MULTIPLIER;
  let exceeded = null;
  for (let i = 0; i <= maxAttempts; i += 1) {
    exceeded = await consumeGlobalCeiling(store, {
      scope: "contact",
      windowMs: WINDOW_MS,
      now: NOW,
      maxAttempts,
    });
  }
  assert.ok(exceeded, "supera el techo");
  const other = await consumeGlobalCeiling(store, {
    scope: "otro",
    windowMs: WINDOW_MS,
    now: NOW,
    maxAttempts,
  });
  assert.equal(other, null, "los scopes son independientes");
  const renewed = await consumeGlobalCeiling(store, {
    scope: "contact",
    windowMs: WINDOW_MS,
    now: NOW + WINDOW_MS + 1,
    maxAttempts,
  });
  assert.equal(renewed, null);
});

test("profesionales públicos: fallo del store responde 503 sin ejecutar el handler", async () => {
  const failing = {
    get: async () => {
      throw new Error("store down");
    },
    set: async () => {
      throw new Error("store down");
    },
    consume: async () => {
      throw new Error("store down");
    },
  };
  let handlerCalls = 0;
  const app = Fastify();
  await app.register(publicProfessionalsNativeRoutes, {
    prefix: "/api/public/professionals",
    searchRateLimitStore: failing,
    detailRateLimitStore: failing,
    searchPublicProfessionals: async () => {
      handlerCalls += 1;
      return { rows: [], total: 0, limit: 20, offset: 0 };
    },
    getPublicProfessionalByClinicId: async () => {
      handlerCalls += 1;
      return null;
    },
    createSignedStorageUrl: async (path: string) => path,
  });

  try {
    for (const url of ["/api/public/professionals/search", "/api/public/professionals/5"]) {
      const response = await app.inject({ method: "GET", url });
      assert.equal(response.statusCode, 503, url);
      assert.deepEqual(response.json(), {
        success: false,
        error: "Servicio temporalmente no disponible",
      });
    }
    assert.equal(handlerCalls, 0);
  } finally {
    await app.close();
  }
});

test("profesionales públicos: sin store inyectado no hay fallback en memoria", () => {
  const source = readSourceFile("server/routes/public-professionals.fastify.ts");

  assert.doesNotMatch(source, /createMemoryRateLimitStore/);
  assert.match(source, /createPersistentRateLimitStore\(/);
  assert.match(source, /public-professionals:\$\{config\.scope\}:ip:/);
});

test("contrato de fuente: login, contacto y rutas públicas usan los topes", () => {
  const read = (path: string) => readSourceFile(path);
  for (const path of [
    "server/routes/auth.fastify.ts",
    "server/routes/admin-auth.fastify.ts",
    "server/routes/particular-auth.fastify.ts",
  ]) {
    assert.match(read(path), /applyLoginIdentifierCeiling\(/, path);
  }
  for (const path of [
    "server/routes/contact.fastify.ts",
    "server/routes/public-report-access.fastify.ts",
    "server/routes/public-professionals.fastify.ts",
  ]) {
    assert.match(read(path), /consumeGlobalCeiling\(/, path);
  }
});

test("el login exitoso nunca reinicia el techo por identificador", () => {
  for (const path of [
    "server/routes/auth.fastify.ts",
    "server/routes/admin-auth.fastify.ts",
    "server/routes/particular-auth.fastify.ts",
  ]) {
    const source = readSourceFile(path);

    assert.equal(source.includes("buildLoginIdentifierCeilingKey"), false, path);
    assert.match(source, /applyLoginIdentifierCeiling\(/, path);
  }
});
