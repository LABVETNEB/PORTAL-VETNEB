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
const {
  particularAuditNativeRoutes,
} = await import("../server/routes/particular-audit.fastify.ts");

function createAuditItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    event: "report.public_accessed",
    action: "report.public_accessed",
    entity: "report_access_token",
    entityId: 7,
    actorType: "public_report_access_token",
    actorAdminUserId: null,
    actorClinicUserId: null,
    actorReportAccessTokenId: 7,
    clinicId: 3,
    reportId: 55,
    targetAdminUserId: null,
    targetClinicUserId: null,
    targetReportAccessTokenId: 7,
    requestId: "req-1",
    requestMethod: "GET",
    requestPath: "/api/public/report-access/[REDACTED]",
    ipAddress: "127.0.0.1",
    userAgent: "node:test",
    metadata: { source: "public-report-access" },
    createdAt: new Date("2026-04-22T09:00:00.000Z"),
    ...overrides,
  };
}

function createAuthStubs(overrides: Record<string, unknown> = {}) {
  return {
    deleteParticularSession: async () => {},
    getParticularSessionByToken: async () => ({
      particularTokenId: 7,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-04-23T00:00:00.000Z"),
    }),
    getParticularTokenById: async () => ({
      id: 7,
      clinicId: 3,
      reportId: 55,
      isActive: true,
    }),
    updateParticularSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    ...overrides,
  };
}

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(particularAuditNativeRoutes as any, {
    prefix: "/api/particular/audit-log",
    ...createAuthStubs(),
    listParticularAuditLog: async () => ({
      items: [createAuditItem()],
      total: 1,
    }),
    buildParticularAuditListFilters: async () => {
      throw new Error("buildParticularAuditListFilters debe ser síncrono");
    },
    buildAuditCsv: () => "\uFEFFid,event\n101,report.public_accessed",
    buildParticularAuditCsvFilename: () =>
      "particular-audit-log-2026-04-22.csv",
    now: () => new Date("2026-04-24T00:00:00.000Z").getTime(),
    ...overrides,
  });

  return app;
}

function buildFilters(query: Record<string, unknown>) {
  const limit = Number(query.limit ?? 50);
  const offset = Number(query.offset ?? 0);

  if (query.event === "bad") {
    return {
      errors: ["event invalido"],
      filters: {
        limit,
        offset,
      },
    };
  }

  return {
    errors: [],
    filters: {
      event:
        typeof query.event === "string" && query.event.length > 0
          ? query.event
          : undefined,
      actorType:
        typeof query.actorType === "string" && query.actorType.length > 0
          ? query.actorType
          : undefined,
      reportId: query.reportId ? Number(query.reportId) : undefined,
      limit,
      offset,
    },
  };
}

test("particularAuditNativeRoutes expone GET / con scope por token particular", async () => {
  const calls: Array<Record<string, unknown>> = [];

  const app = await createTestApp({
    buildParticularAuditListFilters: buildFilters,
    listParticularAuditLog: async (
      filters: Record<string, unknown>,
      particularTokenId: number,
    ) => {
      calls.push({ filters, particularTokenId });
      return {
        items: [createAuditItem()],
        total: 1,
      };
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/particular/audit-log?event=report.public_accessed&reportId=55&limit=5&offset=2",
      headers: {
        cookie: `${ENV.particularCookieName}=particular-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(calls, [
      {
        particularTokenId: 7,
        filters: {
          event: "report.public_accessed",
          actorType: undefined,
          reportId: 55,
          limit: 5,
          offset: 2,
        },
      },
    ]);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.equal(body.items[0].actorReportAccessTokenId, 7);
    assert.equal(body.items[0].targetReportAccessTokenId, 7);
    assert.deepEqual(body.pagination, {
      limit: 5,
      offset: 2,
      total: 1,
    });
    assert.deepEqual(body.filters, {
      event: "report.public_accessed",
      actorType: null,
      reportId: 55,
      particularTokenId: 7,
      from: null,
      to: null,
    });
  } finally {
    await app.close();
  }
});

test("particularAuditNativeRoutes exporta GET /export.csv con scope por token particular", async () => {
  const calls: Array<Record<string, unknown>> = [];

  const app = await createTestApp({
    buildParticularAuditListFilters: buildFilters,
    listParticularAuditLog: async (
      filters: Record<string, unknown>,
      particularTokenId: number,
    ) => {
      calls.push({ filters, particularTokenId });
      return {
        items: [createAuditItem()],
        total: 1,
      };
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/particular/audit-log/export.csv?reportId=55&limit=5&offset=2",
      headers: {
        cookie: `${ENV.particularCookieName}=particular-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["content-disposition"],
      'attachment; filename="particular-audit-log-2026-04-22.csv"',
    );
    assert.match(String(response.headers["content-type"]), /text\/csv/);
    assert.match(response.body, /^﻿id,event/);
    assert.deepEqual(calls, [
      {
        particularTokenId: 7,
        filters: {
          event: undefined,
          actorType: undefined,
          reportId: 55,
          limit: 10000,
          offset: 0,
        },
      },
    ]);
  } finally {
    await app.close();
  }
});

test("particularAuditNativeRoutes devuelve 400 cuando filtros son invalidos", async () => {
  const app = await createTestApp({
    buildParticularAuditListFilters: buildFilters,
    listParticularAuditLog: async () => {
      throw new Error("filtros invalidos no deben consultar audit log");
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/particular/audit-log?event=bad",
      headers: {
        cookie: `${ENV.particularCookieName}=particular-session-token`,
      },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "event invalido",
    });
  } finally {
    await app.close();
  }
});

test("particularAuditNativeRoutes bloquea GET / sin cookie particular", async () => {
  const app = await createTestApp({
    getParticularSessionByToken: async () => {
      throw new Error("sin cookie particular no debe buscar sesion");
    },
    listParticularAuditLog: async () => {
      throw new Error("sin cookie particular no debe consultar audit log");
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/particular/audit-log",
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Particular no autenticado",
    });
  } finally {
    await app.close();
  }
});

test("particularAuditNativeRoutes limpia cookie cuando la sesion expira", async () => {
  let deletedHash: string | undefined;

  const app = await createTestApp({
    getParticularSessionByToken: async () => ({
      particularTokenId: 7,
      expiresAt: new Date("2026-04-23T00:00:00.000Z"),
      lastAccess: new Date("2026-04-22T00:00:00.000Z"),
    }),
    deleteParticularSession: async (tokenHash: string) => {
      deletedHash = tokenHash;
    },
    listParticularAuditLog: async () => {
      throw new Error("sesion expirada no debe consultar audit log");
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/particular/audit-log",
      headers: {
        cookie: `${ENV.particularCookieName}=particular-session-token`,
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(deletedHash, "hash:particular-session-token");
    assert.match(
      String(response.headers["set-cookie"]),
      new RegExp(`${ENV.particularCookieName}=;`),
    );
  } finally {
    await app.close();
  }
});

test("particularAuditNativeRoutes bloquea token particular inactivo antes de listar", async () => {
  let deletedHash: string | undefined;

  const app = await createTestApp({
    getParticularTokenById: async () => ({
      id: 7,
      clinicId: 3,
      reportId: 55,
      isActive: false,
    }),
    deleteParticularSession: async (tokenHash: string) => {
      deletedHash = tokenHash;
    },
    listParticularAuditLog: async () => {
      throw new Error("token inactivo no debe consultar audit log");
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/particular/audit-log",
      headers: {
        cookie: `${ENV.particularCookieName}=particular-session-token`,
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(deletedHash, "hash:particular-session-token");
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Token particular inválido o inactivo",
    });
  } finally {
    await app.close();
  }
});
