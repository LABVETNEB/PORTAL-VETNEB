import test from "node:test";
import assert from "node:assert/strict";
import { readSourceFile } from "../helpers/tracked-source-files.ts";

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
