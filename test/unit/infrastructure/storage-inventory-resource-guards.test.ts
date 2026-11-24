import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

import {
  buildFailedStorageOrphanInventory,
  runStorageOrphanInventory,
  type StorageOrphanInventoryDependencies,
} from "../../../server/storage-orphan-inventory.ts";
import { createSingleFlightGuard } from "../../../server/lib/single-flight-guard.ts";

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
const {
  ReferenceLookupTimeoutError,
  createReferencedPathLookup,
} = await import("../../../server/db-maintenance.ts");

const T0 = Date.parse("2026-11-24T12:00:00.000Z");
const OLD = "2026-11-20T00:00:00.000Z";
const KEY = "clinics/7/1700000000001-000000000001-informe.pdf";
const KEY_2 = "clinics/7/1700000000002-000000000002-informe.pdf";

function inventoryWith(
  clock: { t: number },
  overrides: Partial<StorageOrphanInventoryDependencies> & {
    keys?: string[];
    onList?: () => void;
  },
) {
  return runStorageOrphanInventory({
    now: () => clock.t,
    limits: { maxDurationMs: 30 },
    listing: {
      listPage: async () => {
        overrides.onList?.();
        return {
          objects: (overrides.keys ?? [KEY]).map((key) => ({ key, createdAt: OLD })),
          nextCursor: null,
        };
      },
    },
    lookupReferencedPaths: overrides.lookupReferencedPaths ?? (async () => new Set()),
  });
}

const case_deadline_0 = async () => {
  const clock = { t: T0 };
  let calls = 0;
  const result = await inventoryWith(clock, {
    lookupReferencedPaths: async () => {
      calls += 1;
      clock.t += calls === 2 ? 500 : 1;
      return new Set();
    },
  });

  assert.equal(result.status, "complete");
  assert.equal(result.complete, true);
  assert.equal(result.deadlineExceeded, true);
  assert.equal(result.durationMs, 501);
  assert.equal(result.observed.orphanCandidates, 1);
  assert.equal(result.observed.unverified, 0);
  assert.equal(result.deletionSafety, "not_assessed");
};

const case_deadline_1 = async () => {
  const clock = { t: T0 };
  const result = await inventoryWith(clock, {
    lookupReferencedPaths: async () => {
      clock.t += 500;
      return new Set([KEY]);
    },
  });

  assert.equal(result.status, "complete");
  assert.equal(result.deadlineExceeded, true);
  assert.equal(result.observed.referenced, 1);
  assert.equal(result.observed.orphanCandidates, 0);
};

const case_deadline_2 = async () => {
  const clock = { t: T0 };
  let lookups = 0;
  const result = await inventoryWith(clock, {
    onList: () => {
      clock.t += 500;
    },
    lookupReferencedPaths: async () => {
      lookups += 1;
      return new Set();
    },
  });

  assert.equal(result.status, "truncated");
  assert.equal(result.complete, false);
  assert.equal(result.truncationReason, "deadline");
  assert.equal(result.deadlineExceeded, true);
  assert.equal(result.observed.unverified, 1);
  assert.equal(result.observed.orphanCandidates, 0);
  assert.equal(lookups, 0);
};

const case_deadline_3 = async () => {
  const clock = { t: T0 };
  const result = await inventoryWith(clock, {
    keys: ["clinics/7/archivo-no-reconocido.txt"],
    onList: () => {
      clock.t += 500;
    },
  });

  assert.equal(result.status, "complete");
  assert.equal(result.deadlineExceeded, true);
  assert.equal(result.durationMs, 500);
  assert.equal(result.observed.unrecognized, 1);
};

const case_deadline_4 = async () => {
  const clock = { t: T0 };
  const result = await runStorageOrphanInventory({
    now: () => clock.t,
    limits: { maxDurationMs: 30, referenceBatchSize: 1 },
    listing: {
      listPage: async () => ({
        objects: [KEY, KEY_2].map((key) => ({ key, createdAt: OLD })),
        nextCursor: null,
      }),
    },
    lookupReferencedPaths: async () => {
      clock.t += 100;
      return new Set();
    },
  });

  assert.equal(result.status, "truncated");
  assert.equal(result.complete, false);
  assert.equal(result.deadlineExceeded, true);
  assert.equal(result.observed.unverified, 2);
  assert.equal(result.observed.orphanCandidates, 0);
};

const case_deadline_5 = async () => {
  const clock = { t: T0 };
  const result = await inventoryWith(clock, {
    lookupReferencedPaths: async () => {
      clock.t += 2;
      return new Set();
    },
  });

  assert.equal(result.status, "complete");
  assert.equal(result.complete, true);
  assert.equal(result.deadlineExceeded, false);
  assert.equal(result.durationMs, 4);
};

const case_deadline_6 = async () => {
  const clock = { t: T0 };
  const failed = await inventoryWith(clock, {
    lookupReferencedPaths: async () => {
      clock.t += 40;
      throw new Error("detalle interno");
    },
  });
  const base = buildFailedStorageOrphanInventory(new Date(T0), "listing_failed");

  assert.equal(failed.status, "failed");
  assert.equal(failed.durationMs, 40);
  assert.equal(failed.deadlineExceeded, true);
  assert.equal(base.durationMs, 0);
  assert.equal(base.deadlineExceeded, false);
};

const case_guard_0 = async () => {
  const guard = createSingleFlightGuard();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let secondRan = false;

  const first = guard.runExclusive(async () => {
    await gate;
    return "uno";
  });
  const second = await guard.runExclusive(async () => {
    secondRan = true;
    return "dos";
  });

  assert.deepEqual(second, { admitted: false });
  assert.equal(secondRan, false);

  release();
  assert.deepEqual(await first, { admitted: true, value: "uno" });
  assert.deepEqual(await guard.runExclusive(async () => "tres"), {
    admitted: true,
    value: "tres",
  });
};

const case_guard_1 = async () => {
  const guard = createSingleFlightGuard();

  const thrown = await guard
    .runExclusive(async () => {
      throw new Error("falla");
    })
    .catch((error: unknown) => error);

  assert.equal(thrown instanceof Error, true);
  assert.equal((await guard.runExclusive(async () => 1)).admitted, true);

  let releaseHung: () => void = () => {};
  let overlapped = false;
  let running = 0;
  const hung = guard.runExclusive(async () => {
    running += 1;
    await new Promise<void>((resolve) => {
      releaseHung = resolve;
    });
    running -= 1;
  });

  await new Promise((resolve) => setTimeout(resolve, 20));

  const late = await guard.runExclusive(async () => {
    overlapped = running > 0;
  });

  assert.deepEqual(late, { admitted: false });
  assert.equal(overlapped, false, "nunca dos ejecuciones activas a la vez");

  releaseHung();
  await hung;
  assert.equal((await guard.runExclusive(async () => 3)).admitted, true);
};

const ORIGIN = "https://portal-vetneb-frontend-staging.onrender.com";
const SNAPSHOT = {
  dryRun: true as const,
  generatedAt: "2026-05-07T00:00:00.000Z",
  candidates: [],
  totals: { candidateRecords: 0, supportedCandidateRecords: 0, unsupportedGroups: 0 },
};
const headers = { cookie: `${ENV.adminCookieName}=admin-session-token`, origin: ORIGIN };

async function buildApp(options: {
  inventory: () => Promise<ReturnType<typeof buildFailedStorageOrphanInventory>>;
  authenticated?: boolean;
}) {
  const app = Fastify();
  const counters = { snapshots: 0, inventories: 0 };

  await app.register(adminSystemMaintenanceNativeRoutes, {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () =>
      options.authenticated === false
        ? null
        : {
            adminUserId: 1,
            expiresAt: new Date("2099-01-01T00:00:00.000Z"),
            lastAccess: new Date("2026-05-06T23:35:00.000Z"),
          },
    getAdminUserById: async () => ({ id: 1, username: "VETNEB" }),
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    now: () => Date.UTC(2026, 4, 7, 0, 0, 0),
    getMaintenancePurgeDryRunSnapshot: async () => {
      counters.snapshots += 1;
      return SNAPSHOT;
    },
    getStorageOrphanInventory: async () => {
      counters.inventories += 1;
      return options.inventory();
    },
  });

  return { app, counters };
}

function post(app: Awaited<ReturnType<typeof buildApp>>["app"], payload?: object) {
  return app.inject({
    method: "POST",
    url: "/purge-dry-run",
    headers,
    ...(payload ? { payload } : {}),
  });
}

const case_ruta_0 = async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started: () => void = () => {};
  const startedSignal = new Promise<void>((resolve) => {
    started = resolve;
  });
  const { app, counters } = await buildApp({
    inventory: async () => {
      started();
      await gate;
      return buildFailedStorageOrphanInventory(new Date(), "listing_failed");
    },
  });

  try {
    const first = post(app, { includeStorageOrphans: true });
    await startedSignal;

    const rejected = await post(app, { includeStorageOrphans: true });
    const plain = await post(app);

    assert.equal(rejected.statusCode, 429);
    assert.equal(rejected.headers["retry-after"], "30");
    assert.equal(rejected.headers["cache-control"], "no-store");
    assert.deepEqual(JSON.parse(rejected.body), {
      success: false,
      error: "Ya hay un inventario de Storage en curso",
      code: "storage_orphan_inventory_in_progress",
    });
    assert.equal(counters.inventories, 1);
    assert.equal(counters.snapshots, 2, "el rechazado no consulto el snapshot");
    assert.equal(plain.statusCode, 200);

    release();
    assert.equal((await first).statusCode, 200);

    const third = await post(app, { includeStorageOrphans: true });

    assert.equal(third.statusCode, 200);
    assert.equal(counters.inventories, 2);
  } finally {
    release();
    await app.close();
  }
};

const case_ruta_1 = async () => {
  let mode: "throw" | "ok" = "throw";
  const { app, counters } = await buildApp({
    inventory: async () => {
      if (mode === "throw") {
        throw new Error("falla interna con detalle");
      }
      return buildFailedStorageOrphanInventory(new Date(), "listing_failed");
    },
  });
  const unauthorized = await buildApp({
    authenticated: false,
    inventory: async () => buildFailedStorageOrphanInventory(new Date(), "listing_failed"),
  });

  try {
    const first = await post(app, { includeStorageOrphans: true });
    const body = JSON.parse(first.body);

    assert.equal(first.statusCode, 200);
    assert.equal(body.storageOrphanInventory.failureReason, "inventory_unavailable");
    assert.equal(first.body.includes("detalle"), false);

    mode = "ok";
    assert.equal((await post(app, { includeStorageOrphans: true })).statusCode, 200);

    const denied = await post(unauthorized.app, { includeStorageOrphans: true });

    assert.equal(denied.statusCode, 401);
    assert.equal(unauthorized.counters.inventories, 0);
    assert.equal(unauthorized.counters.snapshots, 0);
    assert.equal(counters.inventories, 2);
  } finally {
    await app.close();
    await unauthorized.app.close();
  }
};

const case_ruta_2 = async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let startedCount = 0;
  const inventory = async () => {
    startedCount += 1;
    await gate;
    return buildFailedStorageOrphanInventory(new Date(), "listing_failed");
  };
  const a = await buildApp({ inventory });
  const b = await buildApp({ inventory });

  try {
    const first = post(a.app, { includeStorageOrphans: true });
    const second = post(b.app, { includeStorageOrphans: true });

    while (startedCount < 2) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    release();

    assert.equal((await first).statusCode, 200);
    assert.equal((await second).statusCode, 200);
  } finally {
    release();
    await a.app.close();
    await b.app.close();
  }
};

function fakeRunner(behaviour: {
  select?: () => Promise<string[]>;
}) {
  const events: string[] = [];
  const runner = async <T,>(
    work: (tx: {
      setLocalStatementTimeout(ms: number): Promise<void>;
      selectReferencedPaths(paths: string[]): Promise<string[]>;
    }) => Promise<T>,
  ) => {
    events.push("begin");
    try {
      const value = await work({
        setLocalStatementTimeout: async (ms) => {
          events.push(`timeout:${ms}`);
        },
        selectReferencedPaths: async () => {
          events.push("select");
          return behaviour.select ? behaviour.select() : [];
        },
      });
      events.push("commit");
      return value;
    } catch (error) {
      events.push("rollback");
      throw error;
    }
  };

  return { runner, events };
}

const case_refs_0 = async () => {
  const { runner, events } = fakeRunner({ select: async () => [KEY] });
  const lookup = createReferencedPathLookup(runner, 1234);

  assert.deepEqual([...(await lookup([KEY, KEY_2]))], [KEY]);
  assert.deepEqual(events, ["begin", "timeout:1234", "select", "commit"]);

  events.length = 0;
  assert.equal((await lookup([])).size, 0);
  assert.deepEqual(events, []);
};

const case_refs_1 = async () => {
  for (const rejection of [
    Object.assign(new Error("canceling statement"), { code: "57014" }),
    Object.assign(new Error("Failed query"), { cause: { code: "57014" } }),
  ]) {
    const { runner, events } = fakeRunner({
      select: async () => {
        throw rejection;
      },
    });
    const lookup = createReferencedPathLookup(runner);

    const timeout = await lookup([KEY]).catch((error: unknown) => error);

    assert.equal(timeout instanceof ReferenceLookupTimeoutError, true);
    assert.equal(events.at(-1), "rollback");

    const result = await runStorageOrphanInventory({
      listing: {
        listPage: async () => ({ objects: [{ key: KEY, createdAt: OLD }], nextCursor: null }),
      },
      lookupReferencedPaths: lookup,
    });

    assert.equal(result.status, "failed");
    assert.equal(result.failureReason, "reference_check_failed");
    assert.equal(result.failureErrorName, "ReferenceLookupTimeoutError");
    assert.equal(result.observed.orphanCandidates, 0);
  }
};

const case_refs_2 = async () => {
  const boom = new Error("otro");
  const { runner } = fakeRunner({
    select: async () => {
      throw boom;
    },
  });

  let caught: unknown;

  try {
    await createReferencedPathLookup(runner)([KEY]);
  } catch (error) {
    caught = error;
  }

  assert.equal(caught, boom);
};

test("SEC-09E deadline: casos A/B/C/D, pendientes, dentro y fuera de presupuesto, y fallo con duracion", async () => {
  await case_deadline_0();
  await case_deadline_1();
  await case_deadline_2();
  await case_deadline_3();
  await case_deadline_4();
  await case_deadline_5();
  await case_deadline_6();
});

test("SEC-09E guarda: admision unica, rechazo sin trabajo, liberacion normal, ante excepcion y sin takeover mientras el trabajo sigue activo", async () => {
  await case_guard_0();
  await case_guard_1();
});

test("SEC-09E ruta: 429 inmediato sin consultas, liberacion ante excepcion, no autorizado sin guarda y alcance por registro", async () => {
  await case_ruta_0();
  await case_ruta_1();
  await case_ruta_2();
});

test("SEC-09E referencias (simulado): timeout local, 57014 explicito, inventario failed y errores ajenos sin reclasificar", async () => {
  await case_refs_0();
  await case_refs_1();
  await case_refs_2();
});
