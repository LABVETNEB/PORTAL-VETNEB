import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const { logisticsSlaNativeRoutes } = await import(
  "../server/routes/logistics-sla.fastify.ts"
);

type SlaPolicyCall = {
  clinicId: number;
  targetType?: string;
  limit?: number;
  offset?: number;
};

type SlaInstanceCall = {
  clinicId: number;
  status?: string;
  targetType?: string;
  targetId?: number;
  limit?: number;
  offset?: number;
};

function createSlaPolicyFixture() {
  return {
    id: 11,
    clinicId: 3,
    name: "Field visit default SLA",
    scope: "clinic",
    targetType: "field_visit",
    targetStatus: "done",
    maxDurationMinutes: 120,
    breachSeverity: "warning",
    isActive: true,
    createdAt: new Date("2026-05-01T10:00:00.000Z"),
    updatedAt: new Date("2026-05-01T10:05:00.000Z"),
  };
}

function createSlaInstanceFixture() {
  return {
    id: 21,
    clinicId: 3,
    policyId: 11,
    targetType: "field_visit",
    targetId: 55,
    status: "active",
    startedAt: new Date("2026-05-01T10:00:00.000Z"),
    dueAt: new Date("2026-05-01T12:00:00.000Z"),
    breachedAt: null,
    resolvedAt: null,
    pausedAt: null,
    metadata: {
      source: "integration-test",
    },
    createdAt: new Date("2026-05-01T10:00:00.000Z"),
    updatedAt: new Date("2026-05-01T10:05:00.000Z"),
  };
}

function createCookie() {
  return `${ENV.cookieName}=session-token`;
}

async function createIntegrationApp() {
  const app = Fastify();
  const policyCalls: SlaPolicyCall[] = [];
  const instanceCalls: SlaInstanceCall[] = [];
  const overdueCalls: Array<{
    clinicId: number;
    dueAtOrBefore: Date;
    targetType?: string;
    limit?: number;
    offset?: number;
  }> = [];
  const summaryCalls: number[] = [];
  const deletedSessionHashes: string[] = [];
  const updatedSessionHashes: string[] = [];

  await app.register(logisticsSlaNativeRoutes as any, {
    prefix: "/api/logistics/sla",
    now: () => Date.UTC(2026, 4, 5, 0, 0, 0),
    deleteActiveSession: async (tokenHash: string) => {
      deletedSessionHashes.push(tokenHash);
    },
    getActiveSessionByToken: async (tokenHash: string) => {
      if (tokenHash !== "hash:session-token") {
        return null;
      }

      return {
        clinicUserId: 9,
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        lastAccess: new Date("2026-05-04T23:00:00.000Z"),
      };
    },
    getClinicUserById: async (clinicUserId: number) => {
      if (clinicUserId !== 9) {
        return null;
      }

      return {
        id: 9,
        clinicId: 3,
        username: "doctor",
        authProId: "AUTH-9",
      };
    },
    updateSessionLastAccess: async (tokenHash: string) => {
      updatedSessionHashes.push(tokenHash);
    },
    hashSessionToken: (token: string) => `hash:${token}`,
    listActiveClinicSlaPolicies: async (params: SlaPolicyCall) => {
      policyCalls.push(params);
      return [createSlaPolicyFixture() as any];
    },
    listClinicSlaInstances: async (params: SlaInstanceCall) => {
      instanceCalls.push(params);
      return [createSlaInstanceFixture() as any];
    },
    listOverdueActiveClinicSlaInstances: async (params: {
      clinicId: number;
      dueAtOrBefore: Date;
      targetType?: string;
      limit?: number;
      offset?: number;
    }) => {
      overdueCalls.push(params);
      return [createSlaInstanceFixture() as any];
    },
    getClinicSlaSummary: async (clinicId: number) => {
      summaryCalls.push(clinicId);
      return {
        clinicId,
        total: 5,
        active: 2,
        paused: 1,
        breached: 1,
        resolved: 1,
        canceled: 0,
      };
    },
  });

  return {
    app,
    policyCalls,
    instanceCalls,
    overdueCalls,
    summaryCalls,
    deletedSessionHashes,
    updatedSessionHashes,
  };
}

test("logistics SLA integration rejects unauthenticated reads before DB helpers", async () => {
  const { app, policyCalls, instanceCalls, overdueCalls, summaryCalls } = await createIntegrationApp();

  try {
    const overdueResponse = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/overdue",
    });

    assert.equal(overdueResponse.statusCode, 401);
    assert.deepEqual(JSON.parse(overdueResponse.body), {
      success: false,
      error: "No autenticado",
    });

    const summaryResponse = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/summary",
    });

    assert.equal(summaryResponse.statusCode, 401);
    assert.deepEqual(JSON.parse(summaryResponse.body), {
      success: false,
      error: "No autenticado",
    });

    const policiesResponse = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/policies",
    });

    assert.equal(policiesResponse.statusCode, 401);
    assert.deepEqual(JSON.parse(policiesResponse.body), {
      success: false,
      error: "No autenticado",
    });

    const instancesResponse = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/instances",
    });

    assert.equal(instancesResponse.statusCode, 401);
    assert.deepEqual(JSON.parse(instancesResponse.body), {
      success: false,
      error: "No autenticado",
    });

    assert.deepEqual(policyCalls, []);
    assert.deepEqual(instanceCalls, []);
    assert.deepEqual(overdueCalls, []);
    assert.deepEqual(summaryCalls, []);
  } finally {
    await app.close();
  }
});


test("logistics SLA integration handles CORS preflight without DB helpers", async () => {
  const { app, policyCalls, instanceCalls, overdueCalls, summaryCalls } = await createIntegrationApp();

  try {
    const allowedResponse = await app.inject({
      method: "OPTIONS",
      url: "/api/logistics/sla/summary",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-headers": "content-type,x-test-header",
      },
    });

    assert.equal(allowedResponse.statusCode, 204);
    assert.equal(allowedResponse.headers["access-control-allow-origin"], "http://localhost:3000");
    assert.equal(allowedResponse.headers["access-control-allow-credentials"], "true");
    assert.equal(allowedResponse.headers["access-control-allow-methods"], "GET,OPTIONS");
    assert.equal(allowedResponse.headers["access-control-allow-headers"], "content-type,x-test-header");

    const blockedResponse = await app.inject({
      method: "OPTIONS",
      url: "/api/logistics/sla/summary",
      headers: {
        origin: "https://blocked.example",
      },
    });

    assert.equal(blockedResponse.statusCode, 403);
    assert.deepEqual(JSON.parse(blockedResponse.body), {
      success: false,
      error: "Origen no permitido",
    });

    assert.deepEqual(policyCalls, []);
    assert.deepEqual(instanceCalls, []);
    assert.deepEqual(overdueCalls, []);
    assert.deepEqual(summaryCalls, []);
  } finally {
    await app.close();
  }
});

test("logistics SLA integration lists overdue active instances with clinic scope and cutoff", async () => {
  const { app, overdueCalls } = await createIntegrationApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/overdue?dueAtOrBefore=2026-05-01T12:30:00.000Z&targetType=field_visit&limit=4&offset=1",
      headers: {
        cookie: createCookie(),
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.equal(body.dueAtOrBefore, "2026-05-01T12:30:00.000Z");
    assert.deepEqual(body.pagination, {
      limit: 4,
      offset: 1,
    });
    assert.equal(body.instances[0].id, 21);
    assert.equal(body.instances[0].dueAt, "2026-05-01T12:00:00.000Z");

    assert.equal(overdueCalls.length, 1);
    assert.equal(overdueCalls[0].clinicId, 3);
    assert.equal(overdueCalls[0].dueAtOrBefore.toISOString(), "2026-05-01T12:30:00.000Z");
    assert.equal(overdueCalls[0].targetType, "field_visit");
    assert.equal(overdueCalls[0].limit, 4);
    assert.equal(overdueCalls[0].offset, 1);
  } finally {
    await app.close();
  }
});

test("logistics SLA integration defaults overdue cutoff to now", async () => {
  const { app, overdueCalls } = await createIntegrationApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/overdue?targetType=field_visit&limit=3&offset=2",
      headers: {
        cookie: createCookie(),
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.dueAtOrBefore, "2026-05-05T00:00:00.000Z");
    assert.deepEqual(body.pagination, {
      limit: 3,
      offset: 2,
    });

    assert.equal(overdueCalls.length, 1);
    assert.equal(overdueCalls[0].clinicId, 3);
    assert.equal(overdueCalls[0].dueAtOrBefore.toISOString(), "2026-05-05T00:00:00.000Z");
    assert.equal(overdueCalls[0].targetType, "field_visit");
    assert.equal(overdueCalls[0].limit, 3);
    assert.equal(overdueCalls[0].offset, 2);
  } finally {
    await app.close();
  }
});

test("logistics SLA integration caps overdue pagination limit and defaults invalid offset", async () => {
  const { app, overdueCalls } = await createIntegrationApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/overdue?limit=1000&offset=-1",
      headers: {
        cookie: createCookie(),
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.deepEqual(body.pagination, {
      limit: 100,
      offset: 0,
    });

    assert.equal(overdueCalls.length, 1);
    assert.equal(overdueCalls[0].clinicId, 3);
    assert.equal(overdueCalls[0].dueAtOrBefore.toISOString(), "2026-05-05T00:00:00.000Z");
    assert.equal(overdueCalls[0].targetType, undefined);
    assert.equal(overdueCalls[0].limit, 100);
    assert.equal(overdueCalls[0].offset, 0);
  } finally {
    await app.close();
  }
});

test("logistics SLA integration rejects invalid overdue filters before DB reads", async () => {
  const { app, overdueCalls } = await createIntegrationApp();

  try {
    const invalidDateResponse = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/overdue?dueAtOrBefore=not-a-date",
      headers: {
        cookie: createCookie(),
      },
    });

    assert.equal(invalidDateResponse.statusCode, 400);
    assert.deepEqual(JSON.parse(invalidDateResponse.body), {
      success: false,
      error: "dueAtOrBefore invalido",
    });

    const invalidTargetTypeResponse = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/overdue?targetType=unknown",
      headers: {
        cookie: createCookie(),
      },
    });

    assert.equal(invalidTargetTypeResponse.statusCode, 400);
    assert.deepEqual(JSON.parse(invalidTargetTypeResponse.body), {
      success: false,
      error: "targetType invalido",
    });

    assert.deepEqual(overdueCalls, []);
  } finally {
    await app.close();
  }
});

test("logistics SLA integration returns clinic-scoped summary", async () => {
  const { app, summaryCalls } = await createIntegrationApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/summary",
      headers: {
        cookie: createCookie(),
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);
    assert.deepEqual(body, {
      success: true,
      summary: {
        clinicId: 3,
        total: 5,
        active: 2,
        paused: 1,
        breached: 1,
        resolved: 1,
        canceled: 0,
      },
    });

    assert.deepEqual(summaryCalls, [3]);
  } finally {
    await app.close();
  }
});

test("logistics SLA integration lists active policies with clinic scope, filters and pagination", async () => {
  const { app, policyCalls, updatedSessionHashes } = await createIntegrationApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/policies?targetType=field_visit&limit=5&offset=2",
      headers: {
        cookie: createCookie(),
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.deepEqual(body.pagination, {
      limit: 5,
      offset: 2,
    });

    assert.equal(body.policies[0].id, 11);
    assert.equal(body.policies[0].clinicId, 3);
    assert.equal(body.policies[0].targetType, "field_visit");
    assert.equal(body.policies[0].createdAt, "2026-05-01T10:00:00.000Z");

    assert.deepEqual(policyCalls, [
      {
        clinicId: 3,
        targetType: "field_visit",
        limit: 5,
        offset: 2,
      },
    ]);
    assert.deepEqual(updatedSessionHashes, ["hash:session-token"]);
  } finally {
    await app.close();
  }
});

test("logistics SLA integration caps policies pagination limit and defaults invalid offset", async () => {
  const { app, policyCalls } = await createIntegrationApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/policies?limit=1000&offset=-1",
      headers: {
        cookie: createCookie(),
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.deepEqual(body.pagination, {
      limit: 100,
      offset: 0,
    });

    assert.deepEqual(policyCalls, [
      {
        clinicId: 3,
        targetType: undefined,
        limit: 100,
        offset: 0,
      },
    ]);
  } finally {
    await app.close();
  }
});

test("logistics SLA integration lists instances with validated filters and tenant scope", async () => {
  const { app, instanceCalls } = await createIntegrationApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/instances?status=active&targetType=field_visit&targetId=55&limit=7&offset=3",
      headers: {
        cookie: createCookie(),
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.deepEqual(body.pagination, {
      limit: 7,
      offset: 3,
    });

    assert.equal(body.instances[0].id, 21);
    assert.equal(body.instances[0].clinicId, 3);
    assert.equal(body.instances[0].targetId, 55);
    assert.equal(body.instances[0].status, "active");
    assert.equal(body.instances[0].dueAt, "2026-05-01T12:00:00.000Z");

    assert.deepEqual(instanceCalls, [
      {
        clinicId: 3,
        status: "active",
        targetType: "field_visit",
        targetId: 55,
        limit: 7,
        offset: 3,
      },
    ]);
  } finally {
    await app.close();
  }
});

test("logistics SLA integration caps instances pagination limit and defaults invalid offset", async () => {
  const { app, instanceCalls } = await createIntegrationApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/instances?limit=1000&offset=-1",
      headers: {
        cookie: createCookie(),
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.deepEqual(body.pagination, {
      limit: 100,
      offset: 0,
    });

    assert.deepEqual(instanceCalls, [
      {
        clinicId: 3,
        status: undefined,
        targetType: undefined,
        targetId: undefined,
        limit: 100,
        offset: 0,
      },
    ]);
  } finally {
    await app.close();
  }
});

test("logistics SLA integration rejects invalid filters before DB reads", async () => {
  const { app, policyCalls, instanceCalls } = await createIntegrationApp();

  try {
    const invalidPolicyResponse = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/policies?targetType=unknown",
      headers: {
        cookie: createCookie(),
      },
    });

    assert.equal(invalidPolicyResponse.statusCode, 400);
    assert.deepEqual(JSON.parse(invalidPolicyResponse.body), {
      success: false,
      error: "targetType invalido",
    });

    const invalidStatusResponse = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/instances?status=unknown",
      headers: {
        cookie: createCookie(),
      },
    });

    assert.equal(invalidStatusResponse.statusCode, 400);
    assert.deepEqual(JSON.parse(invalidStatusResponse.body), {
      success: false,
      error: "status invalido",
    });

    const invalidTargetIdResponse = await app.inject({
      method: "GET",
      url: "/api/logistics/sla/instances?targetId=0",
      headers: {
        cookie: createCookie(),
      },
    });

    assert.equal(invalidTargetIdResponse.statusCode, 400);
    assert.deepEqual(JSON.parse(invalidTargetIdResponse.body), {
      success: false,
      error: "targetId debe ser un entero positivo",
    });

    assert.deepEqual(policyCalls, []);
    assert.deepEqual(instanceCalls, []);
  } finally {
    await app.close();
  }
});

