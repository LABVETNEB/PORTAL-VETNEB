import test from "node:test";
import assert from "node:assert/strict";

import {
  createRoutePlansCacheUseCases,
  type LogisticsRoutePlansCacheRepository,
  type RoutePlansCacheUseCases,
} from "../../../../server/features/logistics/application/index.ts";

// Tipos de stub propios del test: el caso de uso es unit-testable sin Fastify,
// sin DB, sin el cache canónico y sin tipos concretos del schema. Los snapshots
// son opacos para application; aquí se fijan estructuras mínimas propias.
type StubListParams = {
  clinicId: number;
  status?: string;
  planningMode?: string;
  objective?: string;
  limit: number;
  offset: number;
};

type StubRoutePlan = { id: number; clinicId: number };
type StubRouteStop = { id: number; routePlanId: number; sequence: number };
type StubListSnapshot = { kind: "list"; count: number };
type StubMetricsSnapshot = { kind: "metrics"; routePlanId: number };

type CacheStub = LogisticsRoutePlansCacheRepository<
  StubListSnapshot,
  StubMetricsSnapshot
> & {
  calls: {
    getList: Array<{ key: string; now: number }>;
    setList: Array<{ key: string; snapshot: StubListSnapshot; now: number }>;
    clearListByClinic: number[];
    getMetrics: Array<{ key: string; now: number }>;
    setMetrics: Array<{ key: string; snapshot: StubMetricsSnapshot; now: number }>;
    clearMetricsByPlan: Array<{ clinicId: number; routePlanId: number }>;
  };
};

function createCacheStub(behavior?: {
  listSnapshot?: StubListSnapshot | null;
  metricsSnapshot?: StubMetricsSnapshot | null;
}): CacheStub {
  const calls: CacheStub["calls"] = {
    getList: [],
    setList: [],
    clearListByClinic: [],
    getMetrics: [],
    setMetrics: [],
    clearMetricsByPlan: [],
  };

  return {
    calls,
    getRoutePlansListSnapshot: (key, now) => {
      calls.getList.push({ key, now });
      return behavior?.listSnapshot ?? null;
    },
    setRoutePlansListSnapshot: (key, snapshot, now) => {
      calls.setList.push({ key, snapshot, now });
    },
    clearRoutePlansListByClinic: (clinicId) => {
      calls.clearListByClinic.push(clinicId);
    },
    getRoutePlanMetricsSnapshot: (key, now) => {
      calls.getMetrics.push({ key, now });
      return behavior?.metricsSnapshot ?? null;
    },
    setRoutePlanMetricsSnapshot: (key, snapshot, now) => {
      calls.setMetrics.push({ key, snapshot, now });
    },
    clearRoutePlanMetricsByPlan: (clinicId, routePlanId) => {
      calls.clearMetricsByPlan.push({ clinicId, routePlanId });
    },
  };
}

function createRepositoryStub(behavior?: {
  routePlans?: StubRoutePlan[];
  routePlan?: StubRoutePlan | null;
  routeStops?: StubRouteStop[];
  listError?: Error;
  getError?: Error;
}) {
  const listCalls: StubListParams[] = [];
  const getCalls: Array<{ id: number; clinicId: number }> = [];
  const listStopsCalls: Array<{ routePlanId: number; clinicId: number }> = [];

  return {
    listCalls,
    getCalls,
    listStopsCalls,
    listClinicRoutePlans: async (params: StubListParams) => {
      listCalls.push(params);

      if (behavior?.listError) {
        throw behavior.listError;
      }

      return behavior?.routePlans ?? [];
    },
    getClinicScopedRoutePlan: async (id: number, clinicId: number) => {
      getCalls.push({ id, clinicId });

      if (behavior?.getError) {
        throw behavior.getError;
      }

      return behavior?.routePlan === undefined
        ? { id, clinicId }
        : behavior.routePlan;
    },
    listRouteStopsForClinicRoutePlan: async (
      routePlanId: number,
      clinicId: number,
    ) => {
      listStopsCalls.push({ routePlanId, clinicId });
      return behavior?.routeStops ?? [];
    },
  };
}

function createUseCases(input: {
  repository: ReturnType<typeof createRepositoryStub>;
  cache: CacheStub;
  now?: () => number;
}): RoutePlansCacheUseCases<
  StubRoutePlan,
  StubRouteStop,
  StubListParams,
  StubListSnapshot,
  StubMetricsSnapshot
> {
  return createRoutePlansCacheUseCases({
    repository: input.repository,
    cache: input.cache,
    now: input.now ?? (() => 1_000),
  });
}

const LIST_PARAMS: StubListParams = {
  clinicId: 7,
  status: "planned",
  planningMode: undefined,
  objective: "distance",
  limit: 50,
  offset: 0,
};

const EXPECTED_LIST_KEY =
  "clinic:7|status:planned|planningMode:|objective:distance|limit:50|offset:0";

test("list read-through: MISS consulta el repositorio, serializa una vez y cachea con la misma marca de tiempo", async () => {
  const repository = createRepositoryStub({
    routePlans: [{ id: 1, clinicId: 7 }],
  });
  const cache = createCacheStub();
  let serializeCalls = 0;

  const useCases = createUseCases({ repository, cache, now: () => 5_000 });

  const result = await useCases.getRoutePlansListSnapshot(
    LIST_PARAMS,
    (routePlans) => {
      serializeCalls += 1;
      return { kind: "list", count: routePlans.length };
    },
  );

  assert.deepEqual(result, {
    cacheStatus: "MISS",
    snapshot: { kind: "list", count: 1 },
  });
  assert.equal(serializeCalls, 1);
  assert.deepEqual(repository.listCalls, [LIST_PARAMS]);
  assert.deepEqual(cache.calls.getList, [
    { key: EXPECTED_LIST_KEY, now: 5_000 },
  ]);
  assert.deepEqual(cache.calls.setList, [
    {
      key: EXPECTED_LIST_KEY,
      snapshot: { kind: "list", count: 1 },
      now: 5_000,
    },
  ]);
});

test("list read-through: HIT retorna el snapshot cacheado sin repositorio, sin serializer y sin escritura", async () => {
  const repository = createRepositoryStub();
  const cache = createCacheStub({
    listSnapshot: { kind: "list", count: 3 },
  });

  const useCases = createUseCases({ repository, cache });

  const result = await useCases.getRoutePlansListSnapshot(LIST_PARAMS, () => {
    throw new Error("el serializer no debe ejecutarse en HIT");
  });

  assert.deepEqual(result, {
    cacheStatus: "HIT",
    snapshot: { kind: "list", count: 3 },
  });
  assert.deepEqual(repository.listCalls, []);
  assert.deepEqual(cache.calls.setList, []);
});

test("list read-through: la clave preserva el aislamiento por clinicId y los valores ausentes como vacíos", async () => {
  const repository = createRepositoryStub();
  const cache = createCacheStub();

  const useCases = createUseCases({ repository, cache });

  await useCases.getRoutePlansListSnapshot(
    { clinicId: 9, limit: 25, offset: 50 },
    () => ({ kind: "list", count: 0 }),
  );

  assert.deepEqual(
    cache.calls.getList.map((call) => call.key),
    ["clinic:9|status:|planningMode:|objective:|limit:25|offset:50"],
  );
});

test("list read-through: si el repositorio falla, el error se propaga y no hay cache.set", async () => {
  const repository = createRepositoryStub({
    listError: new Error("list-db-failure"),
  });
  const cache = createCacheStub();
  let serializeCalls = 0;

  const useCases = createUseCases({ repository, cache });

  await assert.rejects(
    useCases.getRoutePlansListSnapshot(LIST_PARAMS, () => {
      serializeCalls += 1;
      return { kind: "list", count: 0 };
    }),
    /list-db-failure/,
  );
  assert.equal(serializeCalls, 0);
  assert.deepEqual(cache.calls.setList, []);
});

test("list read-through: si serializeSnapshot falla, el error se propaga y no hay cache.set", async () => {
  const repository = createRepositoryStub({
    routePlans: [{ id: 1, clinicId: 7 }],
  });
  const cache = createCacheStub();

  const useCases = createUseCases({ repository, cache });

  await assert.rejects(
    useCases.getRoutePlansListSnapshot(LIST_PARAMS, () => {
      throw new Error("list-serializer-failure");
    }),
    /list-serializer-failure/,
  );
  assert.deepEqual(repository.listCalls, [LIST_PARAMS]);
  assert.deepEqual(cache.calls.setList, []);
});

const METRICS_INPUT = {
  clinicId: 7,
  routePlanId: 501,
  distanceTolerancePercent: " 20 ",
  timeToleranceMin: undefined,
  toleranceMin: 5,
};

const EXPECTED_METRICS_KEY =
  "clinic:7|plan:501|distanceTolerancePercent:20|timeToleranceMin:|toleranceMin:5";

test("metrics read-through: MISS resuelve plan y stops clinic-scoped, serializa una vez y cachea", async () => {
  const repository = createRepositoryStub({
    routePlan: { id: 501, clinicId: 7 },
    routeStops: [{ id: 701, routePlanId: 501, sequence: 1 }],
  });
  const cache = createCacheStub();
  let serializeCalls = 0;

  const useCases = createUseCases({ repository, cache, now: () => 9_000 });

  const result = await useCases.getRoutePlanMetricsSnapshot(
    METRICS_INPUT,
    ({ routePlan, routeStops }) => {
      serializeCalls += 1;
      assert.equal(routeStops.length, 1);
      return { kind: "metrics", routePlanId: routePlan.id };
    },
  );

  assert.deepEqual(result, {
    cacheStatus: "MISS",
    snapshot: { kind: "metrics", routePlanId: 501 },
  });
  assert.equal(serializeCalls, 1);
  assert.deepEqual(repository.getCalls, [{ id: 501, clinicId: 7 }]);
  assert.deepEqual(repository.listStopsCalls, [
    { routePlanId: 501, clinicId: 7 },
  ]);
  assert.deepEqual(cache.calls.getMetrics, [
    { key: EXPECTED_METRICS_KEY, now: 9_000 },
  ]);
  assert.deepEqual(cache.calls.setMetrics, [
    {
      key: EXPECTED_METRICS_KEY,
      snapshot: { kind: "metrics", routePlanId: 501 },
      now: 9_000,
    },
  ]);
});

test("metrics read-through: HIT retorna el snapshot cacheado sin repositorio, sin serializer y sin escritura", async () => {
  const repository = createRepositoryStub();
  const cache = createCacheStub({
    metricsSnapshot: { kind: "metrics", routePlanId: 501 },
  });

  const useCases = createUseCases({ repository, cache });

  const result = await useCases.getRoutePlanMetricsSnapshot(
    METRICS_INPUT,
    () => {
      throw new Error("el serializer no debe ejecutarse en HIT");
    },
  );

  assert.deepEqual(result, {
    cacheStatus: "HIT",
    snapshot: { kind: "metrics", routePlanId: 501 },
  });
  assert.deepEqual(repository.getCalls, []);
  assert.deepEqual(repository.listStopsCalls, []);
  assert.deepEqual(cache.calls.setMetrics, []);
});

test("metrics read-through: la clave preserva el aislamiento por clinicId y por routePlanId con tolerancias normalizadas", async () => {
  const repository = createRepositoryStub({
    routePlan: { id: 42, clinicId: 3 },
  });
  const cache = createCacheStub();

  const useCases = createUseCases({ repository, cache });

  await useCases.getRoutePlanMetricsSnapshot(
    {
      clinicId: 3,
      routePlanId: 42,
      distanceTolerancePercent: { invalid: true },
      timeToleranceMin: Number.NaN,
      toleranceMin: "7",
    },
    ({ routePlan }) => ({ kind: "metrics", routePlanId: routePlan.id }),
  );

  assert.deepEqual(
    cache.calls.getMetrics.map((call) => call.key),
    ["clinic:3|plan:42|distanceTolerancePercent:|timeToleranceMin:|toleranceMin:7"],
  );
});

test("metrics read-through: plan fuera del scope retorna route_plan_not_found sin cacheStatus, sin serializer y sin escritura", async () => {
  const repository = createRepositoryStub({
    routePlan: null,
  });
  const cache = createCacheStub();
  let serializeCalls = 0;

  const useCases = createUseCases({ repository, cache });

  const result = await useCases.getRoutePlanMetricsSnapshot(
    METRICS_INPUT,
    () => {
      serializeCalls += 1;
      return { kind: "metrics", routePlanId: 0 };
    },
  );

  assert.deepEqual(result, { reason: "route_plan_not_found" });
  assert.equal(result.cacheStatus, undefined);
  assert.equal(serializeCalls, 0);
  assert.deepEqual(cache.calls.setMetrics, []);
});

test("metrics read-through: si el repositorio falla, el error se propaga y no hay cache.set", async () => {
  const repository = createRepositoryStub({
    getError: new Error("metrics-db-failure"),
  });
  const cache = createCacheStub();

  const useCases = createUseCases({ repository, cache });

  await assert.rejects(
    useCases.getRoutePlanMetricsSnapshot(METRICS_INPUT, () => ({
      kind: "metrics",
      routePlanId: 0,
    })),
    /metrics-db-failure/,
  );
  assert.deepEqual(cache.calls.setMetrics, []);
});

test("metrics read-through: si serializeSnapshot falla, el error se propaga y no hay cache.set", async () => {
  const repository = createRepositoryStub({
    routePlan: { id: 501, clinicId: 7 },
  });
  const cache = createCacheStub();

  const useCases = createUseCases({ repository, cache });

  await assert.rejects(
    useCases.getRoutePlanMetricsSnapshot(METRICS_INPUT, () => {
      throw new Error("metrics-serializer-failure");
    }),
    /metrics-serializer-failure/,
  );
  assert.deepEqual(cache.calls.setMetrics, []);
});

test("invalidateAfterRoutePlanCreated invalida solo el listado de la clínica", () => {
  const cache = createCacheStub();
  const useCases = createUseCases({
    repository: createRepositoryStub(),
    cache,
  });

  useCases.invalidateAfterRoutePlanCreated(7);

  assert.deepEqual(cache.calls.clearListByClinic, [7]);
  assert.deepEqual(cache.calls.clearMetricsByPlan, []);
});

test("invalidateAfterRoutePlanMutation invalida listado por clínica y métricas por plan, en ese orden", () => {
  const cache = createCacheStub();
  const order: string[] = [];
  cache.clearRoutePlansListByClinic = (clinicId) => {
    order.push(`list:${clinicId}`);
  };
  cache.clearRoutePlanMetricsByPlan = (clinicId, routePlanId) => {
    order.push(`metrics:${clinicId}:${routePlanId}`);
  };

  const useCases = createUseCases({
    repository: createRepositoryStub(),
    cache,
  });

  useCases.invalidateAfterRoutePlanMutation(7, 501);

  assert.deepEqual(order, ["list:7", "metrics:7:501"]);
});

test("invalidateAfterRouteStopMutation invalida solo las métricas del plan mutado", () => {
  const cache = createCacheStub();
  const useCases = createUseCases({
    repository: createRepositoryStub(),
    cache,
  });

  useCases.invalidateAfterRouteStopMutation(7, 501);

  assert.deepEqual(cache.calls.clearListByClinic, []);
  assert.deepEqual(cache.calls.clearMetricsByPlan, [
    { clinicId: 7, routePlanId: 501 },
  ]);
});
