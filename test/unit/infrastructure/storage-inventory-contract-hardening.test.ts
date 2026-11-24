import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

import {
  buildFailedStorageOrphanInventory,
  runStorageOrphanInventory,
  type StorageOrphanInventoryDependencies,
} from "../../../server/storage-orphan-inventory.ts";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.CORS_ORIGIN ??=
  "https://portal-vetneb-frontend-staging.onrender.com";

const { ENV } = await import("../../../server/lib/env.ts");
const { adminSystemMaintenanceNativeRoutes } = await import(
  "../../../server/routes/admin-system-maintenance.fastify.ts"
);
const { getStorageOrphanInventory } = await import(
  "../../../server/db-maintenance.ts"
);

const WALL = Date.parse("2026-11-24T12:00:00.000Z");
const OLD = "2026-11-20T00:00:00.000Z";
const KEY = "clinics/7/1700000000001-000000000001-informe.pdf";
const KEY_2 = "clinics/7/1700000000002-000000000002-informe.pdf";

type Overrides = Partial<StorageOrphanInventoryDependencies>;

function run(objects: unknown[], overrides: Overrides = {}) {
  return runStorageOrphanInventory({
    now: () => WALL,
    monotonicNow: () => 0,
    listing: {
      listPage: async () => ({ objects, nextCursor: null }) as never,
    },
    lookupReferencedPaths: async () => new Set(),
    ...overrides,
  });
}

function assertFailedClosed(
  result: Awaited<ReturnType<typeof run>>,
  reason: string,
) {
  assert.equal(result.status, "failed");
  assert.equal(result.complete, false);
  assert.equal(result.failureReason, reason);
  assert.equal(result.observed.orphanCandidates, 0);
  assert.deepEqual(result.candidates, []);
  assert.equal(result.deletionSafety, "not_assessed");
  assert.equal(result.durationMeasured, true);
}

test("SEC-09F contrato de errores, duracion y relojes del inventario", async (t) => {
await t.test("SEC-09F H1: una entrada de pagina invalida falla cerrado sin lanzar ni exponer contenido", async () => {
  for (const bad of [null, undefined, 7, "texto", {}, { key: 5 }, { key: null }]) {
    const result = await run([{ key: KEY, createdAt: OLD }, bad]);

    assertFailedClosed(result, "invalid_page");
    assert.equal(JSON.stringify(result).includes(KEY), false);
  }
});

await t.test("SEC-09F H1: una respuesta invalida del puerto de referencias falla cerrado y no equivale a ausencia de referencias", async () => {
  const listed = [{ key: KEY, createdAt: OLD }];

  for (const bad of [undefined, null, [], [KEY], {}, { has: () => false }, "x"]) {
    const result = await run(listed, {
      lookupReferencedPaths: async () => bad as never,
    });

    assertFailedClosed(result, "reference_check_failed");
    assert.equal(result.failureErrorName, "InvalidPortResponse");
  }
});

await t.test("SEC-09F H1: una respuesta invalida en la reverificacion no deja candidatos confirmados", async () => {
  let calls = 0;
  const result = await run([{ key: KEY, createdAt: OLD }], {
    lookupReferencedPaths: async () => {
      calls += 1;
      return (calls === 1 ? new Set() : undefined) as never;
    },
  });

  assert.equal(calls, 2);
  assertFailedClosed(result, "reference_check_failed");
});

await t.test("SEC-09F H1: las respuestas validas conservan el comportamiento previo", async () => {
  const clean = await run([
    { key: KEY, createdAt: OLD },
    { key: KEY_2, createdAt: OLD },
  ], {
    lookupReferencedPaths: async (paths) =>
      new Set(paths.filter((path) => path === KEY_2)),
  });

  assert.equal(clean.status, "complete");
  assert.equal(clean.observed.orphanCandidates, 1);
  assert.equal(clean.observed.referenced, 1);

  const thrown = await run([{ key: KEY, createdAt: OLD }], {
    lookupReferencedPaths: async () => {
      throw Object.assign(new Error("detalle interno clinics/7"), { name: "Boom" });
    },
  });

  assertFailedClosed(thrown, "reference_check_failed");
  assert.equal(thrown.failureErrorName, "Boom");
  assert.equal(JSON.stringify(thrown).includes("detalle interno"), false);
});

await t.test("SEC-09F H2: el constructor de fallos informa duracion medida o declara que no hay medicion", () => {
  const synthetic = buildFailedStorageOrphanInventory(new Date(WALL), "listing_failed");
  const measured = buildFailedStorageOrphanInventory(new Date(WALL), "inventory_unavailable", "E", 12.9);
  const late = buildFailedStorageOrphanInventory(new Date(WALL), "inventory_unavailable", "E", 30_000);
  const negative = buildFailedStorageOrphanInventory(new Date(WALL), "inventory_unavailable", "E", -5);
  const invalid = buildFailedStorageOrphanInventory(new Date(WALL), "inventory_unavailable", "E", Number.NaN);

  assert.deepEqual(
    [synthetic.durationMs, synthetic.durationMeasured, synthetic.deadlineExceeded],
    [0, false, false],
  );
  assert.deepEqual(
    [measured.durationMs, measured.durationMeasured, measured.deadlineExceeded],
    [12, true, false],
  );
  assert.deepEqual([late.durationMs, late.deadlineExceeded], [30_000, true]);
  assert.deepEqual([negative.durationMs, negative.durationMeasured], [0, true]);
  assert.deepEqual([invalid.durationMs, invalid.durationMeasured], [0, false]);
  assert.notEqual(synthetic.scope.excluded, buildFailedStorageOrphanInventory(new Date(WALL), "listing_failed").scope.excluded);
});

await t.test("SEC-09F H2: un fallo al inicializar el adaptador mide la duracion desde antes de la operacion", async () => {
  let mono = 100;
  const fast = await getStorageOrphanInventory(new Date(WALL), {
    monotonicNow: () => mono,
    createListing: async () => {
      mono += 7;
      throw new TypeError("detalle interno");
    },
  });
  const slow = await getStorageOrphanInventory(new Date(WALL), {
    monotonicNow: () => mono,
    createListing: async () => {
      mono += 31_000;
      throw new Error("detalle interno");
    },
  });

  assert.deepEqual(
    [fast.status, fast.failureReason, fast.failureErrorName, fast.complete],
    ["failed", "inventory_unavailable", "TypeError", false],
  );
  assert.deepEqual([fast.durationMs, fast.durationMeasured, fast.deadlineExceeded], [7, true, false]);
  assert.deepEqual([slow.durationMs, slow.deadlineExceeded], [31_000, true]);
  assert.equal(JSON.stringify(fast).includes("detalle interno"), false);
});

await t.test("SEC-09F H2: un fallo del nucleo conserva su propia duracion sin sumarle la de la composicion", async () => {
  let mono = 0;
  const result = await getStorageOrphanInventory(new Date(WALL), {
    monotonicNow: () => mono,
    wallNow: () => WALL,
    createListing: async () => {
      mono += 10;
      return {
        listPage: async () => {
          mono += 25;
          throw new Error("detalle interno");
        },
      };
    },
  });

  assert.equal(result.failureReason, "listing_failed");
  assert.deepEqual([result.durationMs, result.durationMeasured], [25, true]);
});

const ORIGIN = "https://portal-vetneb-frontend-staging.onrender.com";

async function postInventory(
  getStorageOrphanInventoryPort: () => Promise<never>,
  monotonicNow: () => number,
) {
  const app = Fastify();

  await app.register(adminSystemMaintenanceNativeRoutes, {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => ({
      adminUserId: 1,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-05-06T23:35:00.000Z"),
    }),
    getAdminUserById: async () => ({ id: 1, username: "VETNEB" }),
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    now: () => Date.UTC(2026, 4, 7, 0, 0, 0),
    monotonicNow,
    getMaintenancePurgeDryRunSnapshot: async () => ({
      dryRun: true as const,
      generatedAt: "2026-05-07T00:00:00.000Z",
      candidates: [],
      totals: { candidateRecords: 0, supportedCandidateRecords: 0, unsupportedGroups: 0 },
    }),
    getStorageOrphanInventory: getStorageOrphanInventoryPort,
  });

  const response = await app.inject({
    method: "POST",
    url: "/purge-dry-run",
    headers: { cookie: `${ENV.adminCookieName}=admin-session-token`, origin: ORIGIN },
    payload: { includeStorageOrphans: true },
  });

  await app.close();
  return response;
}

await t.test("SEC-09F H2: la excepcion de un puerto inyectado en la ruta informa duracion monotonica y deadline coherentes", async () => {
  let mono = 0;
  const response = await postInventory(async () => {
    mono += 45_000;
    throw new RangeError("detalle interno");
  }, () => mono);
  const body = response.json();
  const inventory = body.storageOrphanInventory;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    [inventory.status, inventory.complete, inventory.failureReason, inventory.failureErrorName],
    ["failed", false, "inventory_unavailable", "RangeError"],
  );
  assert.deepEqual(
    [inventory.durationMs, inventory.durationMeasured, inventory.deadlineExceeded],
    [45_000, true, true],
  );
  assert.equal(response.body.includes("detalle interno"), false);
});

await t.test("SEC-09F H3: el reloj de pared que retrocede no altera duracion ni deadline", async () => {
  let wall = WALL;
  let mono = 0;
  const result = await run([{ key: KEY, createdAt: OLD }], {
    now: () => (wall -= 1_000),
    monotonicNow: () => mono,
    lookupReferencedPaths: async () => {
      mono += 5;
      return new Set();
    },
  });

  assert.equal(result.status, "complete");
  assert.deepEqual([result.durationMs, result.deadlineExceeded], [10, false]);
  assert.equal(result.observed.orphanCandidates, 1);
});

await t.test("SEC-09F H3: con el reloj de pared retrocediendo el deadline sigue cortando por tiempo monotonico", async () => {
  let wall = WALL;
  let mono = 0;
  const result = await run([{ key: KEY, createdAt: OLD }], {
    now: () => (wall -= 10_000),
    monotonicNow: () => mono,
    limits: { maxDurationMs: 30 },
    listing: {
      listPage: async () => {
        mono += 500;
        return { objects: [{ key: KEY, createdAt: OLD }], nextCursor: null };
      },
    },
  });

  assert.equal(result.status, "truncated");
  assert.equal(result.truncationReason, "deadline");
  assert.equal(result.observed.unverified, 1);
  assert.equal(result.deadlineExceeded, true);
});

await t.test("SEC-09F H3: un salto brusco hacia adelante del reloj de pared no dispara el deadline", async () => {
  let wall = WALL;
  const result = await run([{ key: KEY, createdAt: OLD }], {
    now: () => {
      wall += 10 * 365 * 24 * 3_600_000;
      return wall;
    },
    monotonicNow: () => 1,
  });

  assert.equal(result.deadlineExceeded, false);
  assert.equal(result.durationMs, 0);
  assert.equal(result.status, "complete");
});

await t.test("SEC-09F H3: la duracion nunca es negativa ni no finita aunque el reloj monotonico retroceda", async () => {
  let mono = 1_000;
  const result = await run([{ key: KEY, createdAt: OLD }], {
    monotonicNow: () => (mono -= 100),
  });
  const nan = await run([{ key: KEY, createdAt: OLD }], {
    monotonicNow: () => Number.NaN,
  });

  assert.equal(result.durationMs, 0);
  assert.equal(nan.durationMs, 0);
  assert.equal(nan.deadlineExceeded, false);
});

await t.test("SEC-09F H3: generatedAt y la antiguedad usan tiempo de calendario, nunca el contador monotonico", async () => {
  const recent = new Date(WALL - 3_600_000).toISOString();
  const result = await run(
    [
      { key: KEY, createdAt: OLD },
      { key: KEY_2, createdAt: recent },
    ],
    { monotonicNow: () => 5 },
  );

  assert.equal(result.generatedAt, new Date(WALL).toISOString());
  assert.equal(result.observed.orphanCandidates, 1);
  assert.equal(result.observed.tooRecent, 1);
  assert.equal(result.observed.unknownAge, 0);
});

await t.test("SEC-09F H3: fallo tardio, inventario completo tardio y truncado con elementos sin verificar", async () => {
  let mono = 0;
  const lateFailure = await run([{ key: KEY, createdAt: OLD }], {
    monotonicNow: () => mono,
    lookupReferencedPaths: async () => {
      mono += 40_000;
      throw new Error("x");
    },
  });
  mono = 0;
  let lookups = 0;
  const lateComplete = await run([{ key: KEY, createdAt: OLD }], {
    monotonicNow: () => mono,
    lookupReferencedPaths: async () => {
      lookups += 1;
      mono += lookups === 1 ? 1 : 40_000;
      return new Set();
    },
  });
  mono = 0;
  const truncated = await run(
    [
      { key: KEY, createdAt: OLD },
      { key: KEY_2, createdAt: OLD },
    ],
    {
      monotonicNow: () => mono,
      limits: { referenceBatchSize: 1 },
      lookupReferencedPaths: async () => {
        mono += 20_000;
        return new Set();
      },
    },
  );

  assert.deepEqual(
    [lateFailure.status, lateFailure.durationMs, lateFailure.deadlineExceeded],
    ["failed", 40_000, true],
  );
  assert.deepEqual(
    [lateComplete.status, lateComplete.complete, lateComplete.deadlineExceeded],
    ["complete", true, true],
  );
  assert.equal(truncated.status, "truncated");
  assert.equal(truncated.truncationReason, "deadline");
  assert.equal(truncated.observed.unverified > 0, true);
  assert.equal(truncated.deadlineExceeded, true);
});

await t.test("SEC-09F H3: sin relojes inyectados la duracion es un entero finito no negativo medido", async () => {
  const result = await runStorageOrphanInventory({
    listing: { listPage: async () => ({ objects: [], nextCursor: null }) },
    lookupReferencedPaths: async () => new Set(),
  });

  assert.equal(Number.isInteger(result.durationMs), true);
  assert.equal(result.durationMs >= 0, true);
  assert.equal(result.durationMeasured, true);
});
});
