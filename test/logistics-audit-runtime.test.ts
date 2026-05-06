import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

import type {
  GenerateHeuristicRoutePlanInput,
  GenerateHeuristicRoutePlanResult,
  RouteEvent,
  RoutePlan,
  RoutePlanLifecycleAction,
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
const { logisticsRouteEventsNativeRoutes } = await import(
  "../server/routes/logistics-route-events.fastify.ts"
);

const VALID_ORIGIN = "http://localhost:3000";
const SESSION_TOKEN = "clinic-session-token";
const SESSION_COOKIE = `${ENV.cookieName}=${SESSION_TOKEN}`;

function asRecord(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function buildRoutePlan(overrides: Partial<RoutePlan> = {}): RoutePlan {
  return {
    id: 501,
    clinicId: 7,
    serviceDate: new Date("2026-05-05T00:00:00.000Z"),
    status: "released",
    planningMode: "manual",
    objective: "distance",
    totalPlannedKm: 12,
    totalPlannedMin: 90,
    createdByType: "clinic",
    createdById: 9,
    createdAt: new Date("2026-05-04T12:00:00.000Z"),
    updatedAt: new Date("2026-05-04T12:10:00.000Z"),
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

function buildRouteEvent(overrides: Partial<RouteEvent> = {}): RouteEvent {
  return {
    id: 900,
    clinicId: 7,
    routePlanId: 501,
    routeStopId: 701,
    eventType: "route.released",
    eventTime: new Date("2026-05-05T13:00:00.000Z"),
    payload: {
      note: "released by clinic",
    },
    lat: -34.6037,
    lng: -58.3816,
    source: "clinic",
    createdAt: new Date("2026-05-05T13:01:00.000Z"),
    ...overrides,
  };
}

function sharedAuthDeps() {
  return {
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
  };
}

test("logistics route plan lifecycle runtime writes audit metadata after successful transition", async () => {
  const app = Fastify();
  const auditCalls: unknown[] = [];
  const transitionCalls: Array<{
    routePlanId: number;
    clinicId: number;
    action: RoutePlanLifecycleAction;
  }> = [];

  await app.register(logisticsRoutePlansNativeRoutes, {
    prefix: "/api/logistics/route-plans",
    ...sharedAuthDeps(),
    createRoutePlan: async () => null,
    getClinicScopedRoutePlan: async () => null,
    listClinicRoutePlans: async () => [],
    updateClinicScopedRoutePlan: async () => null,
    createRouteStopForClinicRoutePlan: async () => null,
    listRouteStopsForClinicRoutePlan: async () => [],
    updateClinicScopedRouteStop: async () => null,
    transitionClinicScopedRoutePlanStatus: async (
      routePlanId,
      clinicId,
      action,
    ) => {
      transitionCalls.push({
        routePlanId,
        clinicId,
        action,
      });

      return {
        routePlan: buildRoutePlan({
          id: routePlanId,
          clinicId,
          status: "released",
        }),
      };
    },
    generateHeuristicRoutePlan: async (
      _input: GenerateHeuristicRoutePlanInput,
    ): Promise<GenerateHeuristicRoutePlanResult> => ({
      reason: "no_visits",
    }),
    writeAuditLog: async (_request, input) => {
      auditCalls.push(input);
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/logistics/route-plans/501/release",
      headers: {
        cookie: SESSION_COOKIE,
        origin: VALID_ORIGIN,
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.routePlan.id, 501);
    assert.equal(body.routePlan.clinicId, 7);
    assert.equal(body.routePlan.status, "released");

    assert.deepEqual(transitionCalls, [
      {
        routePlanId: 501,
        clinicId: 7,
        action: "release",
      },
    ]);

    assert.equal(auditCalls.length, 1);

    const auditInput = asRecord(auditCalls[0]);
    const metadata = asRecord(auditInput.metadata);

    assert.equal(auditInput.event, "logistics.route_plan.lifecycle_changed");
    assert.equal(auditInput.clinicId, 7);
    assert.equal(metadata.routePlanId, 501);
    assert.equal(metadata.action, "release");
    assert.equal(metadata.status, "released");
  } finally {
    await app.close();
  }
});

test("logistics route events runtime writes audit metadata after successful event creation", async () => {
  const app = Fastify();
  const auditCalls: unknown[] = [];
  const createCalls: unknown[] = [];

  await app.register(logisticsRouteEventsNativeRoutes, {
    prefix: "/api/logistics/route-events",
    ...sharedAuthDeps(),
    createRouteEvent: async (input) => {
      createCalls.push(input);

      return buildRouteEvent({
        clinicId: input.clinicId,
        routePlanId: input.routePlanId ?? null,
        routeStopId: input.routeStopId ?? null,
        eventType: input.eventType,
        eventTime: input.eventTime ?? new Date("2026-05-05T13:00:00.000Z"),
        payload: input.payload ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        source: input.source ?? "system",
      });
    },
    listClinicRouteEvents: async () => [],
    listRouteEventsForClinicRoutePlan: async () => [],
    listIncrementalClinicRouteEvents: async () => [],
    writeAuditLog: async (_request, input) => {
      auditCalls.push(input);
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/logistics/route-events/",
      headers: {
        cookie: SESSION_COOKIE,
        origin: VALID_ORIGIN,
        "content-type": "application/json",
      },
      payload: JSON.stringify({
        routePlanId: 501,
        routeStopId: 701,
        eventType: "route.released",
        eventTime: "2026-05-05T13:00:00.000Z",
        payload: {
          note: "released by clinic",
        },
        lat: -34.6037,
        lng: -58.3816,
        source: "clinic",
      }),
    });

    assert.equal(response.statusCode, 201);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.routeEvent.id, 900);
    assert.equal(body.routeEvent.clinicId, 7);
    assert.equal(body.routeEvent.routePlanId, 501);
    assert.equal(body.routeEvent.routeStopId, 701);
    assert.equal(body.routeEvent.eventType, "route.released");
    assert.equal(body.routeEvent.source, "clinic");

    assert.equal(createCalls.length, 1);

    const createInput = asRecord(createCalls[0]);

    assert.equal(createInput.clinicId, 7);
    assert.equal(createInput.routePlanId, 501);
    assert.equal(createInput.routeStopId, 701);
    assert.equal(createInput.eventType, "route.released");
    assert.equal(createInput.source, "clinic");

    assert.equal(auditCalls.length, 1);

    const auditInput = asRecord(auditCalls[0]);
    const metadata = asRecord(auditInput.metadata);

    assert.equal(auditInput.event, "logistics.route_event.created");
    assert.equal(auditInput.clinicId, 7);
    assert.equal(metadata.routeEventId, 900);
    assert.equal(metadata.routePlanId, 501);
    assert.equal(metadata.routeStopId, 701);
    assert.equal(metadata.eventType, "route.released");
    assert.equal(metadata.source, "clinic");
  } finally {
    await app.close();
  }
});