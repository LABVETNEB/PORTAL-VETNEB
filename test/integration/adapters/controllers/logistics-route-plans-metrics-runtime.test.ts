import test from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import type { InjectOptions } from "light-my-request";

import type {
  GenerateHeuristicRoutePlanInput,
  GenerateHeuristicRoutePlanResult,
  RoutePlan,
  RouteStop,
} from "../../../../server/features/logistics/infrastructure/db-logistics.ts";

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

const VALID_ORIGIN = "http://localhost:3000";
const SESSION_TOKEN = "clinic-session-token";
const SESSION_COOKIE = `${ENV.cookieName}=${SESSION_TOKEN}`;

function buildRoutePlan(overrides: Partial<RoutePlan> = {}): RoutePlan {
  return {
    id: 501,
    clinicId: 7,
    serviceDate: new Date("2026-05-05T00:00:00.000Z"),
    status: "planned",
    planningMode: "heuristic",
    objective: "distance",
    totalPlannedKm: 12,
    totalPlannedMin: 70,
    createdByType: "clinic",
    createdById: 9,
    createdAt: new Date("2026-05-04T12:00:00.000Z"),
    updatedAt: new Date("2026-05-04T12:00:00.000Z"),
    ...overrides,
  };
}

function buildRouteStop(overrides: Partial<RouteStop> = {}): RouteStop {
  return {
    id: 701,
    routePlanId: 501,
    fieldVisitId: 10,
    sequence: 1,
    etaStart: new Date("2026-05-05T10:00:00.000Z"),
    etaEnd: new Date("2026-05-05T10:30:00.000Z"),
    plannedKmFromPrev: 4,
    plannedMinFromPrev: 0,
    actualArrival: new Date("2026-05-05T10:05:00.000Z"),
    actualDeparture: new Date("2026-05-05T10:20:00.000Z"),
    actualKmFromPrev: 4.2,
    status: "done",
    createdAt: new Date("2026-05-04T12:00:00.000Z"),
    updatedAt: new Date("2026-05-04T12:00:00.000Z"),
    ...overrides,
  };
}

async function buildRoutePlansMetricsRuntimeApp(input?: {
  routePlan?: RoutePlan | null;
  routeStops?: RouteStop[];
}): Promise<FastifyInstance> {
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
    createRoutePlan: async () => null,
    getClinicScopedRoutePlan: async (_routePlanId, clinicId) => {
      if (clinicId !== 7) {
        return null;
      }

      return input && "routePlan" in input ? input.routePlan : buildRoutePlan();
    },
    listClinicRoutePlans: async () => [],
    updateClinicScopedRoutePlan: async () => null,
    createRouteStopForClinicRoutePlan: async () => null,
    listRouteStopsForClinicRoutePlan: async () =>
      input?.routeStops ?? [
        buildRouteStop(),
        buildRouteStop({
          id: 702,
          fieldVisitId: 20,
          sequence: 2,
          etaStart: new Date("2026-05-05T10:40:00.000Z"),
          etaEnd: new Date("2026-05-05T11:00:00.000Z"),
          plannedKmFromPrev: 8,
          plannedMinFromPrev: 30,
          actualArrival: new Date("2026-05-05T11:00:00.000Z"),
          actualDeparture: new Date("2026-05-05T11:15:00.000Z"),
          actualKmFromPrev: 11,
          status: "done",
        }),
      ],
    updateClinicScopedRouteStop: async () => null,
    transitionClinicScopedRoutePlanStatus: async () => ({
      reason: "not_found" as const,
    }),
    generateHeuristicRoutePlan: async (
      _routePlanInput: GenerateHeuristicRoutePlanInput,
    ): Promise<GenerateHeuristicRoutePlanResult> => ({
      reason: "route_plan_not_created",
    }),
  });

  return app;
}

function getInput(path: string): InjectOptions {
  return {
    method: "GET",
    url: path,
    headers: {
      cookie: SESSION_COOKIE,
      origin: VALID_ORIGIN,
    },
  };
}

test("logistics route plan metrics endpoint returns clinic-scoped compliance metrics", async () => {
  const app = await buildRoutePlansMetricsRuntimeApp();

  try {
    const response = await app.inject(
      getInput(
        "/api/logistics/route-plans/501/metrics?distanceTolerancePercent=20&timeToleranceMin=10&toleranceMin=5",
      ),
    );

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.routePlan.id, 501);
    assert.equal(body.metrics.totalStops, 2);
    assert.equal(body.metrics.distanceDeviationCount, 1);
    assert.equal(body.metrics.timeDeviationCount, 1);
    assert.equal(body.metrics.outOfSequenceCount, 0);
    assert.equal(body.metrics.windowSummary.complianceRate, 100);
    assert.deepEqual(
      body.metrics.stopMetrics.map((metric: { fieldVisitId: number }) => metric.fieldVisitId),
      [10, 20],
    );
    assert.equal(body.metrics.stopMetrics[1].distance.deltaPercent, 37.5);
    assert.equal(body.metrics.stopMetrics[1].actualMinFromPrev, 55);
    assert.equal(body.metrics.stopMetrics[1].minDeltaFromPlan, 25);
    assert.equal(body.metrics.stopMetrics[1].withinTimeTolerance, false);
  } finally {
    await app.close();
  }
});

test("logistics route plan metrics endpoint returns 404 for non clinic-scoped route plans", async () => {
  const app = await buildRoutePlansMetricsRuntimeApp({
    routePlan: null,
  });

  try {
    const response = await app.inject(getInput("/api/logistics/route-plans/999/metrics"));

    assert.equal(response.statusCode, 404);

    const body = JSON.parse(response.body);

    assert.equal(body.success, false);
    assert.equal(body.error, "Plan de ruta no encontrado");
  } finally {
    await app.close();
  }
});

test("logistics route plan metrics endpoint validates tolerance query params", async () => {
  const app = await buildRoutePlansMetricsRuntimeApp();

  try {
    const response = await app.inject(
      getInput("/api/logistics/route-plans/501/metrics?distanceTolerancePercent=-1"),
    );

    assert.equal(response.statusCode, 400);

    const body = JSON.parse(response.body);

    assert.equal(body.success, false);
    assert.equal(body.error, "distanceTolerancePercent debe ser numerico mayor a cero");
  } finally {
    await app.close();
  }
});
