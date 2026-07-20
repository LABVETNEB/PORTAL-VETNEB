import test from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import type { InjectOptions } from "light-my-request";

import type {
  CreateRouteEventInput,
  ListRouteEventsParams,
  RouteEvent,
} from "../../../../server/db-logistics.ts";
import type { ClinicUserRole } from "../../../../drizzle/schema.ts";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../../../../server/lib/env.ts");
const { logisticsRouteEventsNativeRoutes } = await import(
  "../../../../server/routes/logistics-route-events.fastify.ts"
);

const VALID_ORIGIN = "http://localhost:3000";
const BLOCKED_ORIGIN = "https://evil.example.com";
const SESSION_TOKEN = "route-events-session";
const SESSION_COOKIE = `${ENV.cookieName}=${SESSION_TOKEN}`;
const CLINIC_ID = 7;

type RoutePlanListParams = Omit<
  ListRouteEventsParams,
  "clinicId" | "routePlanId"
>;

type AuditCall = {
  event: string;
  clinicId?: number | null;
  metadata?: unknown;
};

type Recorder = {
  createCalls: CreateRouteEventInput[];
  listCalls: ListRouteEventsParams[];
  routePlanCalls: Array<{
    routePlanId: number;
    clinicId: number;
    params?: RoutePlanListParams;
  }>;
  pollCalls: Array<{ clinicId: number; afterId: number; limit?: number }>;
  auditCalls: AuditCall[];
  order: string[];
};

function buildRouteEvent(overrides: Partial<RouteEvent> = {}): RouteEvent {
  return {
    id: 501,
    clinicId: CLINIC_ID,
    routePlanId: 11,
    routeStopId: 22,
    eventType: "stop.arrived",
    eventTime: new Date("2026-07-20T10:00:00.000Z"),
    payload: { note: "llegada" },
    lat: -34.6,
    lng: -58.4,
    source: "clinic",
    createdAt: new Date("2026-07-20T10:00:01.000Z"),
    ...overrides,
  } as RouteEvent;
}

async function buildRuntimeApp(
  options: {
    role?: ClinicUserRole;
    createRouteEvent?: (
      input: CreateRouteEventInput,
    ) => Promise<RouteEvent | null | undefined>;
    listClinicRouteEvents?: (
      params: ListRouteEventsParams,
    ) => Promise<RouteEvent[]>;
    listRouteEventsForClinicRoutePlan?: (
      routePlanId: number,
      clinicId: number,
      params?: RoutePlanListParams,
    ) => Promise<RouteEvent[]>;
    listIncrementalClinicRouteEvents?: (
      clinicId: number,
      afterId: number,
      limit?: number,
    ) => Promise<RouteEvent[]>;
    writeAuditLog?: () => Promise<void>;
  } = {},
): Promise<{ app: FastifyInstance; recorder: Recorder }> {
  const app = Fastify();
  const recorder: Recorder = {
    createCalls: [],
    listCalls: [],
    routePlanCalls: [],
    pollCalls: [],
    auditCalls: [],
    order: [],
  };

  await app.register(logisticsRouteEventsNativeRoutes, {
    prefix: "/api/logistics/route-events",
    now: () => Date.UTC(2026, 6, 20, 12, 0, 0),
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async (tokenHash: string) =>
      tokenHash === `hash:${SESSION_TOKEN}`
        ? {
            clinicUserId: 9,
            expiresAt: new Date("2099-01-01T00:00:00.000Z"),
            lastAccess: new Date("2026-07-20T11:59:00.000Z"),
          }
        : null,
    getClinicUserById: async (clinicUserId: number) =>
      clinicUserId === 9
        ? {
            id: 9,
            clinicId: CLINIC_ID,
            username: "clinic-owner",
            authProId: null,
            role: options.role ?? "clinic_owner",
          }
        : null,
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    createRouteEvent: async (input) => {
      recorder.createCalls.push(input);
      recorder.order.push("createRouteEvent");

      if (options.createRouteEvent) {
        return options.createRouteEvent(input);
      }

      return buildRouteEvent({
        clinicId: input.clinicId,
        routePlanId: input.routePlanId ?? null,
        routeStopId: input.routeStopId ?? null,
        eventType: input.eventType,
        eventTime: input.eventTime ?? new Date("2026-07-20T10:00:00.000Z"),
        payload: input.payload ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        source: input.source ?? "clinic",
      });
    },
    listClinicRouteEvents: async (params) => {
      recorder.listCalls.push(params);
      return options.listClinicRouteEvents
        ? options.listClinicRouteEvents(params)
        : [];
    },
    listRouteEventsForClinicRoutePlan: async (
      routePlanId,
      clinicId,
      params,
    ) => {
      recorder.routePlanCalls.push({ routePlanId, clinicId, params });
      return options.listRouteEventsForClinicRoutePlan
        ? options.listRouteEventsForClinicRoutePlan(
            routePlanId,
            clinicId,
            params,
          )
        : [];
    },
    listIncrementalClinicRouteEvents: async (clinicId, afterId, limit) => {
      recorder.pollCalls.push({ clinicId, afterId, limit });
      return options.listIncrementalClinicRouteEvents
        ? options.listIncrementalClinicRouteEvents(clinicId, afterId, limit)
        : [];
    },
    writeAuditLog: async (_req, input) => {
      recorder.auditCalls.push({
        event: input.event,
        clinicId: input.clinicId,
        metadata: input.metadata,
      });
      recorder.order.push("writeAuditLog");

      if (options.writeAuditLog) {
        await options.writeAuditLog();
      }
    },
  });

  return { app, recorder };
}

function postInput(
  payload: unknown,
  overrides: { origin?: string; cookie?: string | null } = {},
): InjectOptions {
  const headers: Record<string, string> = {
    origin: overrides.origin ?? VALID_ORIGIN,
    "content-type": "application/json",
  };

  if (overrides.cookie !== null) {
    headers.cookie = overrides.cookie ?? SESSION_COOKIE;
  }

  return {
    method: "POST",
    url: "/api/logistics/route-events/",
    headers,
    payload: JSON.stringify(payload),
  };
}

function getInput(url: string): InjectOptions {
  return {
    method: "GET",
    url,
    headers: { cookie: SESSION_COOKIE, origin: VALID_ORIGIN },
  };
}

const VALID_BODY = {
  routePlanId: 11,
  routeStopId: 22,
  eventType: "stop.arrived",
  eventTime: "2026-07-20T10:00:00.000Z",
  payload: { note: "llegada", nested: { ok: true } },
  lat: -34.6,
  lng: -58.4,
  source: "clinic",
};

// ---------------------------------------------------------------- POST /

test("POST route event responde 201 y delega el input exacto en el puerto", async () => {
  const { app, recorder } = await buildRuntimeApp();

  try {
    const response = await app.inject(postInput(VALID_BODY));
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 201);
    assert.equal(body.success, true);
    assert.equal(body.message, "Evento logistico registrado correctamente");
    assert.equal(recorder.createCalls.length, 1);
    assert.deepEqual(recorder.createCalls[0], {
      clinicId: CLINIC_ID,
      routePlanId: 11,
      routeStopId: 22,
      eventType: "stop.arrived",
      eventTime: new Date("2026-07-20T10:00:00.000Z"),
      payload: { note: "llegada", nested: { ok: true } },
      lat: -34.6,
      lng: -58.4,
      source: "clinic",
    });
  } finally {
    await app.close();
  }
});

test("POST route event reemplaza el clinicId del body por el tenant autenticado", async () => {
  const { app, recorder } = await buildRuntimeApp();

  try {
    const response = await app.inject(
      postInput({ ...VALID_BODY, clinicId: 999 }),
    );

    assert.equal(response.statusCode, 201);
    assert.equal(recorder.createCalls[0]?.clinicId, CLINIC_ID);
    assert.equal(JSON.parse(response.body).routeEvent.clinicId, CLINIC_ID);
  } finally {
    await app.close();
  }
});

test("POST route event preserva el payload libre completo y la serialización", async () => {
  const { app, recorder } = await buildRuntimeApp();

  try {
    const response = await app.inject(postInput(VALID_BODY));
    const { routeEvent } = JSON.parse(response.body);

    assert.deepEqual(recorder.createCalls[0]?.payload, {
      note: "llegada",
      nested: { ok: true },
    });
    assert.deepEqual(Object.keys(routeEvent), [
      "id",
      "clinicId",
      "routePlanId",
      "routeStopId",
      "eventType",
      "eventTime",
      "payload",
      "lat",
      "lng",
      "source",
      "createdAt",
    ]);
    assert.equal(routeEvent.eventTime, "2026-07-20T10:00:00.000Z");
    assert.equal(routeEvent.createdAt, "2026-07-20T10:00:01.000Z");
    assert.deepEqual(routeEvent.payload, { note: "llegada", nested: { ok: true } });
  } finally {
    await app.close();
  }
});

test("POST route event audita después del append y en ese orden", async () => {
  const { app, recorder } = await buildRuntimeApp();

  try {
    const response = await app.inject(postInput(VALID_BODY));

    assert.equal(response.statusCode, 201);
    assert.deepEqual(recorder.order, ["createRouteEvent", "writeAuditLog"]);
    assert.equal(recorder.auditCalls.length, 1);
    assert.equal(recorder.auditCalls[0]?.clinicId, CLINIC_ID);
    assert.deepEqual(recorder.auditCalls[0]?.metadata, {
      routeEventId: 501,
      routePlanId: 11,
      routeStopId: 22,
      eventType: "stop.arrived",
      source: "clinic",
    });
  } finally {
    await app.close();
  }
});

test("POST route event no audita cuando el append devuelve ausencia (404 actual)", async () => {
  const { app, recorder } = await buildRuntimeApp({
    createRouteEvent: async () => null,
  });

  try {
    const response = await app.inject(postInput(VALID_BODY));

    assert.equal(response.statusCode, 404);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Plan de ruta o parada no encontrada",
    });
    assert.equal(recorder.createCalls.length, 1);
    assert.equal(recorder.auditCalls.length, 0);
    assert.deepEqual(recorder.order, ["createRouteEvent"]);
  } finally {
    await app.close();
  }
});

test("POST route event propaga el error del puerto y no audita", async () => {
  const { app, recorder } = await buildRuntimeApp({
    createRouteEvent: async () => {
      throw new Error("fallo de append");
    },
  });

  try {
    const response = await app.inject(postInput(VALID_BODY));

    assert.equal(response.statusCode, 500);
    assert.equal(recorder.createCalls.length, 1);
    assert.equal(recorder.auditCalls.length, 0);
  } finally {
    await app.close();
  }
});

test("POST route event rechaza payload inválido con 400 antes del puerto", async () => {
  const { app, recorder } = await buildRuntimeApp();

  try {
    const missingType = await app.inject(
      postInput({ routePlanId: 11, source: "clinic" }),
    );
    const invalidPlan = await app.inject(
      postInput({ eventType: "stop.arrived", routePlanId: 0 }),
    );
    const invalidPayload = await app.inject(
      postInput({ eventType: "stop.arrived", payload: "texto" }),
    );

    assert.equal(missingType.statusCode, 400);
    assert.deepEqual(JSON.parse(missingType.body), {
      success: false,
      error: "eventType es obligatorio",
    });
    assert.equal(invalidPlan.statusCode, 400);
    assert.equal(
      JSON.parse(invalidPlan.body).error,
      "routePlanId debe ser un entero positivo",
    );
    assert.equal(invalidPayload.statusCode, 400);
    assert.equal(
      JSON.parse(invalidPayload.body).error,
      "payload debe ser objeto o null",
    );
    assert.equal(recorder.createCalls.length, 0);
    assert.equal(recorder.auditCalls.length, 0);
  } finally {
    await app.close();
  }
});

test("POST route event responde 401 sin sesión", async () => {
  const { app, recorder } = await buildRuntimeApp();

  try {
    const response = await app.inject(postInput(VALID_BODY, { cookie: null }));

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "No autenticado",
    });
    assert.equal(recorder.createCalls.length, 0);
  } finally {
    await app.close();
  }
});

test("POST route event responde 403 por trusted-origin antes de autenticar", async () => {
  const { app, recorder } = await buildRuntimeApp();

  try {
    const response = await app.inject(
      postInput(VALID_BODY, { origin: BLOCKED_ORIGIN }),
    );

    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.body).error, "Origen no permitido");
    assert.equal(recorder.createCalls.length, 0);
    assert.equal(recorder.auditCalls.length, 0);
  } finally {
    await app.close();
  }
});

test("POST route event responde 403 por RBAC insuficiente", async () => {
  const { app, recorder } = await buildRuntimeApp({ role: "clinic_staff" });

  try {
    const response = await app.inject(postInput(VALID_BODY));

    assert.equal(response.statusCode, 403);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Permisos insuficientes para logistica",
    });
    assert.equal(recorder.createCalls.length, 0);
    assert.equal(recorder.auditCalls.length, 0);
  } finally {
    await app.close();
  }
});

test("POST route event repetido no deduplica: cada request es un append nuevo", async () => {
  const { app, recorder } = await buildRuntimeApp();

  try {
    const first = await app.inject(postInput(VALID_BODY));
    const second = await app.inject(postInput(VALID_BODY));

    assert.equal(first.statusCode, 201);
    assert.equal(second.statusCode, 201);
    assert.equal(recorder.createCalls.length, 2);
    assert.deepEqual(recorder.createCalls[0], recorder.createCalls[1]);
    assert.equal(recorder.auditCalls.length, 2);
  } finally {
    await app.close();
  }
});

// ----------------------------------------------------------------- GET /

test("GET route events usa el tenant autenticado y los filtros exactos", async () => {
  const { app, recorder } = await buildRuntimeApp({
    listClinicRouteEvents: async () => [buildRouteEvent()],
  });

  try {
    const response = await app.inject(
      getInput(
        "/api/logistics/route-events/?routePlanId=11&routeStopId=22&eventType=stop.arrived&afterId=5&limit=25&offset=10&clinicId=999",
      ),
    );
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(recorder.listCalls.length, 1);
    assert.deepEqual(recorder.listCalls[0], {
      clinicId: CLINIC_ID,
      routePlanId: 11,
      routeStopId: 22,
      eventType: "stop.arrived",
      afterId: 5,
      limit: 25,
      offset: 10,
    });
    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.deepEqual(body.pagination, { limit: 25, offset: 10, afterId: 5 });
    assert.equal(body.routeEvents[0].eventTime, "2026-07-20T10:00:00.000Z");
  } finally {
    await app.close();
  }
});

test("GET route events aplica defaults y el límite máximo actuales", async () => {
  const { app, recorder } = await buildRuntimeApp();

  try {
    await app.inject(getInput("/api/logistics/route-events/"));
    await app.inject(getInput("/api/logistics/route-events/?limit=5000"));

    assert.deepEqual(recorder.listCalls[0], {
      clinicId: CLINIC_ID,
      routePlanId: undefined,
      routeStopId: undefined,
      eventType: undefined,
      afterId: 0,
      limit: 50,
      offset: 0,
    });
    assert.equal(recorder.listCalls[1]?.limit, 100);
  } finally {
    await app.close();
  }
});

test("GET route events devuelve lista vacía con la forma estable", async () => {
  const { app } = await buildRuntimeApp({ listClinicRouteEvents: async () => [] });

  try {
    const response = await app.inject(getInput("/api/logistics/route-events/"));
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(body, {
      success: true,
      count: 0,
      routeEvents: [],
      pagination: { limit: 50, offset: 0, afterId: 0 },
    });
  } finally {
    await app.close();
  }
});

test("GET route events responde 400 ante filtros inválidos sin llamar al puerto", async () => {
  const { app, recorder } = await buildRuntimeApp();

  try {
    const response = await app.inject(
      getInput("/api/logistics/route-events/?eventType=inexistente"),
    );

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "eventType invalido",
    });
    assert.equal(recorder.listCalls.length, 0);
  } finally {
    await app.close();
  }
});

// ------------------------------------------------------------- GET /poll

test("GET poll reenvía clinicId, afterId y limit exactos", async () => {
  const { app, recorder } = await buildRuntimeApp({
    listIncrementalClinicRouteEvents: async () => [
      buildRouteEvent({ id: 77 }),
      buildRouteEvent({ id: 78 }),
    ],
  });

  try {
    const response = await app.inject(
      getInput("/api/logistics/route-events/poll?afterId=70&limit=10"),
    );
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(recorder.pollCalls[0], {
      clinicId: CLINIC_ID,
      afterId: 70,
      limit: 10,
    });
    assert.equal(body.count, 2);
    assert.equal(body.lastEventId, 78);
    assert.deepEqual(body.polling, { afterId: 70, limit: 10 });
    assert.equal(body.routeEvents[1].id, 78);
  } finally {
    await app.close();
  }
});

test("GET poll aplica defaults y límite máximo actuales", async () => {
  const { app, recorder } = await buildRuntimeApp();

  try {
    await app.inject(getInput("/api/logistics/route-events/poll"));
    await app.inject(getInput("/api/logistics/route-events/poll?limit=5000"));

    assert.deepEqual(recorder.pollCalls[0], {
      clinicId: CLINIC_ID,
      afterId: 0,
      limit: 50,
    });
    assert.equal(recorder.pollCalls[1]?.limit, 100);
  } finally {
    await app.close();
  }
});

test("GET poll con lista vacía preserva el cursor recibido", async () => {
  const { app } = await buildRuntimeApp({
    listIncrementalClinicRouteEvents: async () => [],
  });

  try {
    const response = await app.inject(
      getInput("/api/logistics/route-events/poll?afterId=42"),
    );

    assert.deepEqual(JSON.parse(response.body), {
      success: true,
      count: 0,
      lastEventId: 42,
      routeEvents: [],
      polling: { afterId: 42, limit: 50 },
    });
  } finally {
    await app.close();
  }
});

// ------------------------------------------ GET /route-plans/:routePlanId

test("GET route-plan events reenvía routePlanId, tenant y filtros", async () => {
  const { app, recorder } = await buildRuntimeApp({
    listRouteEventsForClinicRoutePlan: async () => [buildRouteEvent()],
  });

  try {
    const response = await app.inject(
      getInput(
        "/api/logistics/route-events/route-plans/11?routeStopId=22&eventType=stop.arrived&afterId=3&limit=15&offset=5",
      ),
    );
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(recorder.routePlanCalls.length, 1);
    assert.equal(recorder.routePlanCalls[0]?.routePlanId, 11);
    assert.equal(recorder.routePlanCalls[0]?.clinicId, CLINIC_ID);
    assert.deepEqual(recorder.routePlanCalls[0]?.params, {
      routeStopId: 22,
      eventType: "stop.arrived",
      afterId: 3,
      limit: 15,
      offset: 5,
    });
    assert.equal(body.routePlanId, 11);
    assert.deepEqual(body.pagination, { limit: 15, offset: 5, afterId: 3 });
    assert.equal(body.routeEvents[0].source, "clinic");
  } finally {
    await app.close();
  }
});

test("GET route-plan events devuelve lista vacía para un plan inexistente", async () => {
  const { app, recorder } = await buildRuntimeApp({
    listRouteEventsForClinicRoutePlan: async () => [],
  });

  try {
    const response = await app.inject(
      getInput("/api/logistics/route-events/route-plans/999999"),
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      success: true,
      count: 0,
      routePlanId: 999999,
      routeEvents: [],
      pagination: { limit: 50, offset: 0, afterId: 0 },
    });
    assert.equal(recorder.routePlanCalls[0]?.routePlanId, 999999);
  } finally {
    await app.close();
  }
});

test("GET route-plan events responde 400 ante routePlanId inválido sin llamar al puerto", async () => {
  const { app, recorder } = await buildRuntimeApp();

  try {
    const response = await app.inject(
      getInput("/api/logistics/route-events/route-plans/abc"),
    );

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "routePlanId invalido",
    });
    assert.equal(recorder.routePlanCalls.length, 0);
  } finally {
    await app.close();
  }
});

// -------------------------------------------------------------- OPTIONS

test("OPTIONS permanece íntegramente en Fastify para las tres rutas", async () => {
  const { app, recorder } = await buildRuntimeApp();

  try {
    for (const url of [
      "/api/logistics/route-events/",
      "/api/logistics/route-events/poll",
      "/api/logistics/route-events/route-plans/11",
    ]) {
      const response = await app.inject({
        method: "OPTIONS",
        url,
        headers: { origin: VALID_ORIGIN },
      });

      assert.equal(response.statusCode, 204);
      assert.equal(
        response.headers["access-control-allow-methods"],
        "GET,POST,OPTIONS",
      );
    }

    const blocked = await app.inject({
      method: "OPTIONS",
      url: "/api/logistics/route-events/",
      headers: { origin: BLOCKED_ORIGIN },
    });

    assert.equal(blocked.statusCode, 403);
    assert.equal(recorder.createCalls.length, 0);
    assert.equal(recorder.listCalls.length, 0);
    assert.equal(recorder.pollCalls.length, 0);
    assert.equal(recorder.routePlanCalls.length, 0);
  } finally {
    await app.close();
  }
});
