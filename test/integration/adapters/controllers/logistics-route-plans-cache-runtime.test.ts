import test from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../../../../server/lib/env.ts");
const { logisticsRoutePlansNativeRoutes } = await import(
  "../../../../server/routes/logistics-route-plans.fastify.ts"
);
const {
  clearRoutePlanMetricsCache,
  clearRoutePlansCache,
} = await import("../../../../server/lib/logistics-route-plans-cache.ts");

const VALID_ORIGIN = "http://localhost:3000";
const SESSION_TOKEN = "clinic-session-token";
const SESSION_COOKIE = `${ENV.cookieName}=${SESSION_TOKEN}`;

function buildRoutePlan() {
  return {
    id: 501,
    clinicId: 7,
    serviceDate: new Date("2026-05-05T00:00:00.000Z"),
    status: "planned" as const,
    planningMode: "heuristic" as const,
    objective: "distance" as const,
    totalPlannedKm: 12,
    totalPlannedMin: 70,
    createdByType: "clinic" as const,
    createdById: 9,
    createdAt: new Date("2026-05-04T12:00:00.000Z"),
    updatedAt: new Date("2026-05-04T12:00:00.000Z"),
  };
}

function buildRouteStop() {
  return {
    id: 701,
    routePlanId: 501,
    fieldVisitId: 10,
    sequence: 1,
    etaStart: new Date("2026-05-05T10:00:00.000Z"),
    etaEnd: new Date("2026-05-05T10:30:00.000Z"),
    plannedKmFromPrev: 4,
    plannedMinFromPrev: 20,
    actualArrival: new Date("2026-05-05T10:05:00.000Z"),
    actualDeparture: new Date("2026-05-05T10:20:00.000Z"),
    actualKmFromPrev: 4.2,
    status: "done" as const,
    createdAt: new Date("2026-05-04T12:00:00.000Z"),
    updatedAt: new Date("2026-05-04T12:00:00.000Z"),
  };
}

function buildAuthHeaders(): Record<string, string> {
  return {
    cookie: SESSION_COOKIE,
    origin: VALID_ORIGIN,
    "content-type": "application/json",
  };
}

async function buildCacheRuntimeApp(input?: {
  throwOnListRouteStops?: boolean;
}): Promise<{
  app: FastifyInstance;
  counters: {
    listRoutePlansCalls: number;
    getRoutePlanCalls: number;
    listRouteStopsCalls: number;
  };
}> {
  clearRoutePlansCache();
  clearRoutePlanMetricsCache();

  const counters = {
    listRoutePlansCalls: 0,
    getRoutePlanCalls: 0,
    listRouteStopsCalls: 0,
  };

  const app = Fastify();

  await app.register(logisticsRoutePlansNativeRoutes, {
    prefix: "/api/logistics/route-plans",
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async (tokenHash: string) =>
      tokenHash === `hash:${SESSION_TOKEN}`
        ? {
            clinicUserId: 9,
            expiresAt: new Date("2099-01-01T00:00:00.000Z"),
            lastAccess: new Date("2026-05-04T00:00:00.000Z"),
          }
        : null,
    getClinicUserById: async (clinicUserId: number) =>
      clinicUserId === 9
        ? {
            id: 9,
            clinicId: 7,
            username: "clinic-user",
            role: "clinic_owner",
            authProId: null,
          }
        : null,
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    createRoutePlan: async () => buildRoutePlan(),
    getClinicScopedRoutePlan: async () => {
      counters.getRoutePlanCalls += 1;
      return buildRoutePlan();
    },
    listClinicRoutePlans: async () => {
      counters.listRoutePlansCalls += 1;
      return [buildRoutePlan()];
    },
    updateClinicScopedRoutePlan: async () => buildRoutePlan(),
    createRouteStopForClinicRoutePlan: async () => buildRouteStop(),
    listRouteStopsForClinicRoutePlan: async () => {
      counters.listRouteStopsCalls += 1;

      if (input?.throwOnListRouteStops) {
        throw new Error("route-stops-db-failure");
      }

      return [buildRouteStop()];
    },
    updateClinicScopedRouteStop: async () => buildRouteStop(),
    transitionClinicScopedRoutePlanStatus: async () => ({
      routePlan: buildRoutePlan(),
    }),
    generateHeuristicRoutePlan: async () => ({
      reason: "route_plan_not_created" as const,
    }),
  });

  return {
    app,
    counters,
  };
}

test("logistics route plans list endpoint caches successful reads with HIT/MISS headers", async () => {
  const { app, counters } = await buildCacheRuntimeApp();

  try {
    const first = await app.inject({
      method: "GET",
      url: "/api/logistics/route-plans/",
      headers: buildAuthHeaders(),
    });
    const second = await app.inject({
      method: "GET",
      url: "/api/logistics/route-plans/",
      headers: buildAuthHeaders(),
    });

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(first.headers["x-logistics-cache"], "MISS");
    assert.equal(second.headers["x-logistics-cache"], "HIT");
    assert.equal(counters.listRoutePlansCalls, 1);
  } finally {
    clearRoutePlansCache();
    clearRoutePlanMetricsCache();
    await app.close();
  }
});

test("logistics route plan metrics endpoint caches successful reads and invalidates after stop update", async () => {
  const { app, counters } = await buildCacheRuntimeApp();
  const metricsUrl =
    "/api/logistics/route-plans/501/metrics?distanceTolerancePercent=20&timeToleranceMin=10&toleranceMin=5";

  try {
    const first = await app.inject({
      method: "GET",
      url: metricsUrl,
      headers: buildAuthHeaders(),
    });
    const second = await app.inject({
      method: "GET",
      url: metricsUrl,
      headers: buildAuthHeaders(),
    });

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(first.headers["x-logistics-cache"], "MISS");
    assert.equal(second.headers["x-logistics-cache"], "HIT");
    assert.equal(counters.getRoutePlanCalls, 1);
    assert.equal(counters.listRouteStopsCalls, 1);

    const patch = await app.inject({
      method: "PATCH",
      url: "/api/logistics/route-plans/501/stops/701",
      headers: buildAuthHeaders(),
      payload: JSON.stringify({ status: "done" }),
    });

    assert.equal(patch.statusCode, 200);

    const third = await app.inject({
      method: "GET",
      url: metricsUrl,
      headers: buildAuthHeaders(),
    });

    assert.equal(third.statusCode, 200);
    assert.equal(third.headers["x-logistics-cache"], "MISS");
    assert.equal(counters.getRoutePlanCalls, 2);
    assert.equal(counters.listRouteStopsCalls, 2);
  } finally {
    clearRoutePlansCache();
    clearRoutePlanMetricsCache();
    await app.close();
  }
});

test("logistics route plan metrics endpoint does not cache errors", async () => {
  const { app, counters } = await buildCacheRuntimeApp({
    throwOnListRouteStops: true,
  });

  try {
    const first = await app.inject({
      method: "GET",
      url: "/api/logistics/route-plans/501/metrics",
      headers: buildAuthHeaders(),
    });
    const second = await app.inject({
      method: "GET",
      url: "/api/logistics/route-plans/501/metrics",
      headers: buildAuthHeaders(),
    });

    assert.equal(first.statusCode, 500);
    assert.equal(second.statusCode, 500);
    assert.equal(first.headers["x-logistics-cache"], undefined);
    assert.equal(second.headers["x-logistics-cache"], undefined);
    assert.equal(counters.getRoutePlanCalls, 2);
    assert.equal(counters.listRouteStopsCalls, 2);
  } finally {
    clearRoutePlansCache();
    clearRoutePlanMetricsCache();
    await app.close();
  }
});
