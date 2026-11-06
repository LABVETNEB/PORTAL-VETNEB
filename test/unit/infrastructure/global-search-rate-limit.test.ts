import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_GLOBAL_SEARCH_KINDS,
  CLINIC_GLOBAL_SEARCH_KINDS,
  globalSearchQueryUnits,
} from "../../../server/features/global-search/index.ts";
import {
  buildGlobalSearchRateLimitKey,
  GLOBAL_SEARCH_RATE_LIMIT_ERROR_MESSAGE,
  GLOBAL_SEARCH_RATE_LIMIT_POLICY,
  GLOBAL_SEARCH_RATE_LIMIT_UNAVAILABLE_MESSAGE,
} from "../../../server/lib/global-search-rate-limit.ts";
import { LOGIN_RATE_LIMIT_MAX_ATTEMPTS, LOGIN_RATE_LIMIT_WINDOW_MS } from "../../../server/lib/login-rate-limit.ts";
import { CONTACT_RATE_LIMIT_MAX_ATTEMPTS, CONTACT_RATE_LIMIT_WINDOW_MS } from "../../../server/lib/contact-rate-limit.ts";
import {
  consumeRateLimitAttempt,
  createMemoryRateLimitStore,
  createPersistentRateLimitStore,
  hashRateLimitKey,
  type PersistentRateLimitStoreAdapter,
} from "../../../server/lib/rate-limit-store.ts";

test("GLOBAL-SEARCH-3C: la política por superficie tiene ráfaga y ventana sostenida", () => {
  assert.deepEqual(GLOBAL_SEARCH_RATE_LIMIT_POLICY, {
    clinic: [
      { name: "burst", windowMs: 10_000, max: 60 },
      { name: "sustained", windowMs: 600_000, max: 600 },
    ],
    admin: [
      { name: "burst", windowMs: 10_000, max: 100 },
      { name: "sustained", windowMs: 600_000, max: 1000 },
    ],
  });
});

test("GLOBAL-SEARCH-3C: la clave identifica actor y ventana, nunca la consulta", () => {
  const clinicA = buildGlobalSearchRateLimitKey({ surface: "clinic", clinicId: 11, userId: 101 }, "burst");

  assert.equal(clinicA, "global-search:v1:clinic:11:user:101:burst");
  assert.equal(
    buildGlobalSearchRateLimitKey({ surface: "admin", userId: 1 }, "sustained"),
    "global-search:v1:admin:user:1:sustained",
  );

  const keys = new Set([
    clinicA,
    buildGlobalSearchRateLimitKey({ surface: "clinic", clinicId: 11, userId: 101 }, "sustained"),
    buildGlobalSearchRateLimitKey({ surface: "clinic", clinicId: 22, userId: 101 }, "burst"),
    buildGlobalSearchRateLimitKey({ surface: "clinic", clinicId: 11, userId: 102 }, "burst"),
    buildGlobalSearchRateLimitKey({ surface: "admin", userId: 101 }, "burst"),
  ]);
  assert.equal(keys.size, 5, "actor, tenant, surface and window each split the budget");

  for (const key of keys) {
    assert.doesNotMatch(key, /login|contact|cursor|q=|kinds/);
    assert.notEqual(hashRateLimitKey(key), key);
  }
});

test("GLOBAL-SEARCH-3C: el costo es la cantidad de consultas de entidad", () => {
  assert.equal(globalSearchQueryUnits({ q: "rex" }, CLINIC_GLOBAL_SEARCH_KINDS), 3);
  assert.equal(globalSearchQueryUnits({ q: "rex" }, ADMIN_GLOBAL_SEARCH_KINDS), 5);
  assert.equal(globalSearchQueryUnits({ q: "rex", kinds: "report" }, CLINIC_GLOBAL_SEARCH_KINDS), 1);
  assert.equal(globalSearchQueryUnits({ q: "rex", kinds: "report,clinic" }, ADMIN_GLOBAL_SEARCH_KINDS), 2);
  assert.equal(globalSearchQueryUnits({ q: "rex", status: "READY" }, ADMIN_GLOBAL_SEARCH_KINDS), 1);
  assert.equal(
    globalSearchQueryUnits({ q: "rex", kinds: "report", cursor: "x".repeat(40), limit: "25" }, CLINIC_GLOBAL_SEARCH_KINDS),
    1,
  );
  assert.equal(globalSearchQueryUnits({ q: "r" }, CLINIC_GLOBAL_SEARCH_KINDS), 1, "a rejected query still costs one");
  assert.equal(globalSearchQueryUnits({ q: "rex", kinds: "clinic" }, CLINIC_GLOBAL_SEARCH_KINDS), 1);
});

test("GLOBAL-SEARCH-3C: el store en memoria cobra unidades y reinicia la ventana", async () => {
  const store = createMemoryRateLimitStore();

  assert.deepEqual(await consumeRateLimitAttempt(store, "k", { windowMs: 1_000, now: 0, units: 3 }), {
    count: 3,
    resetAt: 1_000,
  });
  assert.deepEqual(await consumeRateLimitAttempt(store, "k", { windowMs: 1_000, now: 999, units: 5 }), {
    count: 8,
    resetAt: 1_000,
  });
  assert.deepEqual(await consumeRateLimitAttempt(store, "k", { windowMs: 1_000, now: 1_000 }), {
    count: 1,
    resetAt: 2_000,
  });
});

test("GLOBAL-SEARCH-3C: un store sin consumo atómico no puede cobrar varias unidades", async () => {
  const store = { get: () => undefined, set: () => {} };

  await assert.rejects(
    consumeRateLimitAttempt(store, "k", { windowMs: 1_000, now: 0, units: 3 }),
    /cannot charge more than one unit/,
  );
  assert.deepEqual(await consumeRateLimitAttempt(createMemoryRateLimitStore(), "k", { windowMs: 1_000, now: 0 }), {
    count: 1,
    resetAt: 1_000,
  });
});

test("GLOBAL-SEARCH-3C: el store persistente envía sólo el hash y las unidades al adaptador", async () => {
  const seen: Array<Record<string, unknown>> = [];
  const adapter: PersistentRateLimitStoreAdapter = {
    get: () => undefined,
    set: () => undefined,
    increment: () => ({ count: 1, resetAt: new Date(0) }),
    consume: (input) => {
      seen.push({ ...input });
      return { count: input.units ?? 1, resetAt: input.resetAt };
    },
  };
  const store = createPersistentRateLimitStore(adapter);
  const key = buildGlobalSearchRateLimitKey({ surface: "clinic", clinicId: 11, userId: 101 }, "burst");

  const entry = await consumeRateLimitAttempt(store, key, { windowMs: 10_000, now: 5_000, units: 3 });

  assert.deepEqual(entry, { count: 3, resetAt: 15_000 });
  assert.deepEqual(seen.map((input) => input.keyHash), [hashRateLimitKey(key)]);
  assert.equal(seen[0]?.units, 3);
  assert.equal(JSON.stringify(seen[0]).includes("clinic:11"), false, "the clear key never reaches storage");

  await consumeRateLimitAttempt(store, "login:v2:clinic:user:ip:1.1.1.1", { windowMs: 1_000, now: 0 });
  assert.equal("units" in (seen[1] ?? {}), false, "login and contact charges keep their exact adapter input");
});

test("GLOBAL-SEARCH-3C: los mensajes no exponen datos y las otras cuotas no cambian", () => {
  for (const message of [GLOBAL_SEARCH_RATE_LIMIT_ERROR_MESSAGE, GLOBAL_SEARCH_RATE_LIMIT_UNAVAILABLE_MESSAGE]) {
    assert.doesNotMatch(message, /cursor|clinic|\d/i);
  }
  assert.equal(LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  assert.equal(LOGIN_RATE_LIMIT_MAX_ATTEMPTS, 10);
  assert.equal(CONTACT_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);
  assert.equal(CONTACT_RATE_LIMIT_MAX_ATTEMPTS, 5);
});
