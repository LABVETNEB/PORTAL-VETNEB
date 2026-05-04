import test from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import type { InjectOptions } from "light-my-request";

import type {
  GenerateHeuristicRoutePlanInput,
  GenerateHeuristicRoutePlanResult,
  RoutePlan,
  RouteStop,
} from "../server/db-logistics.ts";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const { logisticsRoutePlansNativeRoutes } = await import(
  "../server/routes/logistics-route-plans.fastify.ts"
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
    objective: "sla",
    totalPlannedKm: 12.345,
    totalPlannedMin: 98,
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
    fieldVisitId: 20,
    sequence: 1,
    etaStart: new Date("2026-05-05T12:30:00.000Z"),
    etaEnd: new Date("2026-05-05T12:45:00.000Z"),
    plannedKmFromPrev: 4.2,
    plannedMinFromPrev: 18,
    actualArrival: null,
    actualDeparture: null,
    actualKmFromPrev: null,
    status: "pending",
    createdAt: new Date("2026-05-04T12:00:00.000Z"),
    updatedAt: new Date("2026-05-04T12:00:00.000Z"),
    ...overrides,
  };
}

async function buildRoutePlansRuntimeApp(input?: {
  generateHeuristicRoutePlan?: (
    routePlanInput: GenerateHeuristicRoutePlanInput,
  ) => Promise<GenerateHeuristicRoutePlanResult>;
}): Promise<{
  app: FastifyInstance;
  generateCalls: GenerateHeuristicRoutePlanInput[];
}> {
  const app = Fastify();
  const generateCalls: GenerateHeuristicRoutePlanInput[] = [];

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
            authProId: null,
          }
        : null,
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    createRoutePlan: async () => null,
    getClinicScopedRoutePlan: async () => null,
    listClinicRoutePlans: async () => [],
    updateClinicScopedRoutePlan: async () => null,
    createRouteStopForClinicRoutePlan: async () => null,
    listRouteStopsForClinicRoutePlan: async () => [],
    updateClinicScopedRouteStop: async () => null,
    transitionClinicScopedRoutePlanStatus: async () => ({
      reason: "not_found" as const,
    }),
    generateHeuristicRoutePlan:
      input?.generateHeuristicRoutePlan ??
      (async (routePlanInput: GenerateHeuristicRoutePlanInput) => {
        generateCalls.push(routePlanInput);

        return {
          routePlan: buildRoutePlan({
            clinicId: routePlanInput.clinicId,
            serviceDate: routePlanInput.serviceDate,
            objective: routePlanInput.objective ?? "distance",
            createdById: routePlanInput.createdById ?? null,
          }),
          routeStops: [
            buildRouteStop({
              fieldVisitId: 20,
              sequence: 1,
            }),
            buildRouteStop({
              id: 702,
              fieldVisitId: 10,
              sequence: 2,
              etaStart: new Date("2026-05-05T13:00:00.000Z"),
              etaEnd: new Date("2026-05-05T13:15:00.000Z"),
              plannedKmFromPrev: 8.145,
              plannedMinFromPrev: 35,
            }),
          ],
          warnings: [
            "Visits without valid coordinates were planned with fallback leg minutes: 10",
          ],
        };
      }),
  });

  return {
    app,
    generateCalls,
  };
}

function jsonPostInput(
  payload: Record<string, unknown>,
  origin = VALID_ORIGIN,
): InjectOptions {
  return {
    method: "POST",
    url: "/api/logistics/route-plans/heuristic",
    headers: {
      cookie: SESSION_COOKIE,
      origin,
      "content-type": "application/json",
    },
    payload: JSON.stringify(payload),
  };
}

test("logistics heuristic route plan endpoint returns persisted plan, stops, and planning metadata", async () => {
  const { app, generateCalls } = await buildRoutePlansRuntimeApp();

  try {
    const response = await app.inject(
      jsonPostInput({
        serviceDate: "2026-05-05T00:00:00.000Z",
        fieldVisitIds: [20, "10", 20],
        routeStart: "2026-05-05T12:00:00.000Z",
        startLocation: {
          lat: -34.6037,
          lng: -58.3816,
        },
        objective: "sla",
        travelSpeedKmh: 42,
        fallbackLegMinutes: 17,
      }),
    );

    assert.equal(response.statusCode, 201);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.routePlan.id, 501);
    assert.equal(body.routePlan.clinicId, 7);
    assert.equal(body.routePlan.planningMode, "heuristic");
    assert.equal(body.routePlan.objective, "sla");
    assert.equal(body.routePlan.createdById, 9);
    assert.equal(body.routeStops.length, 2);
    assert.deepEqual(
      body.routeStops.map((routeStop: { fieldVisitId: number }) => routeStop.fieldVisitId),
      [20, 10],
    );
    assert.equal(body.planning.mode, "heuristic");
    assert.equal(body.planning.objective, "sla");
    assert.equal(body.planning.fieldVisitCount, 2);
    assert.deepEqual(body.planning.warnings, [
      "Visits without valid coordinates were planned with fallback leg minutes: 10",
    ]);

    assert.equal(generateCalls.length, 1);
    assert.equal(generateCalls[0]?.clinicId, 7);
    assert.equal(generateCalls[0]?.createdByType, "clinic");
    assert.equal(generateCalls[0]?.createdById, 9);
    assert.deepEqual(generateCalls[0]?.fieldVisitIds, [20, 10]);
    assert.equal(generateCalls[0]?.objective, "sla");
    assert.equal(generateCalls[0]?.travelSpeedKmh, 42);
    assert.equal(generateCalls[0]?.fallbackLegMinutes, 17);
    assert.deepEqual(generateCalls[0]?.startLocation, {
      lat: -34.6037,
      lng: -58.3816,
    });
    assert.equal(
      generateCalls[0]?.routeStart?.toISOString(),
      "2026-05-05T12:00:00.000Z",
    );
  } finally {
    await app.close();
  }
});

test("logistics heuristic route plan endpoint rejects invalid fieldVisitIds before DB calls", async () => {
  const { app, generateCalls } = await buildRoutePlansRuntimeApp();

  try {
    const response = await app.inject(
      jsonPostInput({
        serviceDate: "2026-05-05T00:00:00.000Z",
        fieldVisitIds: [],
      }),
    );

    assert.equal(response.statusCode, 400);

    const body = JSON.parse(response.body);

    assert.equal(body.success, false);
    assert.equal(body.error, "fieldVisitIds debe incluir al menos una visita");
    assert.equal(generateCalls.length, 0);
  } finally {
    await app.close();
  }
});

test("logistics heuristic route plan endpoint returns missing clinic-scoped visit ids", async () => {
  const missingCalls: GenerateHeuristicRoutePlanInput[] = [];

  const { app } = await buildRoutePlansRuntimeApp({
    generateHeuristicRoutePlan: async (routePlanInput) => {
      missingCalls.push(routePlanInput);

      return {
        reason: "field_visits_not_found",
        missingFieldVisitIds: [99],
      };
    },
  });

  try {
    const response = await app.inject(
      jsonPostInput({
        serviceDate: "2026-05-05T00:00:00.000Z",
        fieldVisitIds: [99],
      }),
    );

    assert.equal(response.statusCode, 404);

    const body = JSON.parse(response.body);

    assert.equal(body.success, false);
    assert.equal(body.error, "Una o mas visitas no existen para la clinica");
    assert.deepEqual(body.missingFieldVisitIds, [99]);

    assert.equal(missingCalls.length, 1);
    assert.equal(missingCalls[0]?.clinicId, 7);
    assert.deepEqual(missingCalls[0]?.fieldVisitIds, [99]);
  } finally {
    await app.close();
  }
});

test("logistics heuristic route plan endpoint rejects untrusted origins before auth and DB calls", async () => {
  const { app, generateCalls } = await buildRoutePlansRuntimeApp();

  try {
    const response = await app.inject(
      jsonPostInput(
        {
          serviceDate: "2026-05-05T00:00:00.000Z",
          fieldVisitIds: [20],
        },
        "https://evil.example",
      ),
    );

    assert.equal(response.statusCode, 403);

    const body = JSON.parse(response.body);

    assert.equal(body.success, false);
    assert.equal(body.error, "Origen no permitido");
    assert.equal(generateCalls.length, 0);
  } finally {
    await app.close();
  }
});
