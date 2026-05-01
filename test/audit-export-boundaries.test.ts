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
  adminAuditNativeRoutes,
} = await import("../server/routes/admin-audit.fastify.ts");
const {
  clinicAuditNativeRoutes,
} = await import("../server/routes/clinic-audit.fastify.ts");
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
    metadata: { source: "audit-export-boundaries" },
    createdAt: new Date("2026-04-22T09:00:00.000Z"),
    ...overrides,
  };
}

function buildCsv(items: Array<Record<string, unknown>>) {
  return [
    "\uFEFFid,event,clinicId,actorReportAccessTokenId,targetReportAccessTokenId",
    ...items.map((item) =>
      [
        item.id,
        item.event,
        item.clinicId ?? "",
        item.actorReportAccessTokenId ?? "",
        item.targetReportAccessTokenId ?? "",
      ].join(","),
    ),
  ].join("\n");
}

async function createAdminAuditApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(adminAuditNativeRoutes as any, {
    prefix: "/api/admin/audit-log",
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => ({
      adminUserId: 1,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-04-23T00:00:00.000Z"),
    }),
    getAdminUserById: async () => ({
      id: 1,
      username: "ADMIN",
    }),
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    listAuditLog: async () => ({
      items: [createAuditItem()],
      total: 1,
    }),
    buildAdminAuditListFilters: (query: Record<string, unknown>) => ({
      errors: [],
      filters: {
        event: typeof query.event === "string" ? query.event : undefined,
        actorType:
          typeof query.actorType === "string" ? query.actorType : undefined,
        clinicId: query.clinicId ? Number(query.clinicId) : undefined,
        reportId: query.reportId ? Number(query.reportId) : undefined,
        limit: Number(query.limit ?? 50),
        offset: Number(query.offset ?? 0),
      },
    }),
    buildAdminAuditCsv: buildCsv,
    buildAdminAuditCsvFilename: () => "admin-audit-log-test.csv",
    now: () => new Date("2026-04-24T00:00:00.000Z").getTime(),
    ...overrides,
  });

  return app;
}

async function createClinicAuditApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(clinicAuditNativeRoutes as any, {
    prefix: "/api/clinic/audit-log",
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => ({
      clinicUserId: 10,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-04-23T00:00:00.000Z"),
    }),
    getClinicUserById: async () => ({
      id: 10,
      clinicId: 3,
      username: "clinic-owner",
      authProId: null,
      role: "clinic_owner",
    }),
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    listAuditLog: async () => ({
      items: [createAuditItem()],
      total: 1,
    }),
    buildClinicAuditListFilters: (
      query: Record<string, unknown>,
      clinicId: number,
    ) => ({
      errors: [],
      filters: {
        event: typeof query.event === "string" ? query.event : undefined,
        actorType:
          typeof query.actorType === "string" ? query.actorType : undefined,
        clinicId,
        reportId: query.reportId ? Number(query.reportId) : undefined,
        actorAdminUserId: undefined,
        limit: Number(query.limit ?? 50),
        offset: Number(query.offset ?? 0),
      },
    }),
    buildAdminAuditCsv: buildCsv,
    now: () => new Date("2026-04-24T00:00:00.000Z").getTime(),
    ...overrides,
  });

  return app;
}

async function createParticularAuditApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(particularAuditNativeRoutes as any, {
    prefix: "/api/particular/audit-log",
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
    listParticularAuditLog: async () => ({
      items: [createAuditItem()],
      total: 1,
    }),
    buildParticularAuditListFilters: (query: Record<string, unknown>) => ({
      errors: [],
      filters: {
        event: typeof query.event === "string" ? query.event : undefined,
        actorType:
          typeof query.actorType === "string" ? query.actorType : undefined,
        reportId: query.reportId ? Number(query.reportId) : undefined,
        clinicId: undefined,
        actorAdminUserId: undefined,
        actorClinicUserId: undefined,
        actorReportAccessTokenId: undefined,
        targetReportAccessTokenId: undefined,
        limit: Number(query.limit ?? 50),
        offset: Number(query.offset ?? 0),
      },
    }),
    buildAuditCsv: buildCsv,
    buildParticularAuditCsvFilename: () =>
      "particular-audit-log-test.csv",
    now: () => new Date("2026-04-24T00:00:00.000Z").getTime(),
    ...overrides,
  });

  return app;
}

test("admin audit export conserva alcance global y no inyecta scope de sesión", async () => {
  const calls: Array<Record<string, unknown>> = [];

  const app = await createAdminAuditApp({
    listAuditLog: async (filters: Record<string, unknown>) => {
      calls.push(filters);
      return {
        items: [createAuditItem({ clinicId: 3 })],
        total: 1,
      };
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/audit-log/export.csv?event=report.public_accessed&limit=5&offset=20",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["content-disposition"],
      'attachment; filename="admin-audit-log-test.csv"',
    );
    assert.match(String(response.headers["content-type"]), /text\/csv/);
    assert.match(response.body, /^﻿id,event,clinicId/);
    assert.deepEqual(calls, [
      {
        event: "report.public_accessed",
        actorType: undefined,
        clinicId: undefined,
        reportId: undefined,
        limit: 10000,
        offset: 0,
      },
    ]);
  } finally {
    await app.close();
  }
});

test("clinic audit export fuerza clinicId autenticado y descarta clinicId de query", async () => {
  const buildCalls: Array<Record<string, unknown>> = [];
  const listCalls: Array<Record<string, unknown>> = [];

  const app = await createClinicAuditApp({
    buildClinicAuditListFilters: (
      query: Record<string, unknown>,
      clinicId: number,
    ) => {
      buildCalls.push({ query, clinicId });

      return {
        errors: [],
        filters: {
          event: typeof query.event === "string" ? query.event : undefined,
          actorType: undefined,
          clinicId,
          reportId: query.reportId ? Number(query.reportId) : undefined,
          actorAdminUserId: undefined,
          limit: Number(query.limit ?? 50),
          offset: Number(query.offset ?? 0),
        },
      };
    },
    listAuditLog: async (filters: Record<string, unknown>) => {
      listCalls.push(filters);
      return {
        items: [createAuditItem({ clinicId: filters.clinicId })],
        total: 1,
      };
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/clinic/audit-log/export.csv?clinicId=999&event=report.public_accessed&reportId=55&limit=5&offset=20",
      headers: {
        cookie: `${ENV.cookieName}=clinic-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.match(
      String(response.headers["content-disposition"]),
      /^attachment; filename="clinic-audit-log-\d{4}-\d{2}-\d{2}T.+Z\.csv"$/,
    );
    assert.match(response.body, /^﻿id,event,clinicId/);
    assert.equal(buildCalls.length, 1);
    assert.equal(buildCalls[0].clinicId, 3);
    assert.equal((buildCalls[0].query as Record<string, unknown>).clinicId, "999");
    assert.deepEqual(listCalls, [
      {
        event: "report.public_accessed",
        actorType: undefined,
        clinicId: 3,
        reportId: 55,
        actorAdminUserId: undefined,
        limit: 10000,
        offset: 0,
      },
    ]);
  } finally {
    await app.close();
  }
});

test("particular audit export fuerza scope por token autenticado", async () => {
  const calls: Array<Record<string, unknown>> = [];

  const app = await createParticularAuditApp({
    listParticularAuditLog: async (
      filters: Record<string, unknown>,
      particularTokenId: number,
    ) => {
      calls.push({ filters, particularTokenId });

      return {
        items: [
          createAuditItem({
            actorReportAccessTokenId: particularTokenId,
            targetReportAccessTokenId: particularTokenId,
          }),
        ],
        total: 1,
      };
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/particular/audit-log/export.csv?clinicId=999&actorReportAccessTokenId=999&targetReportAccessTokenId=999&reportId=55&limit=5&offset=20",
      headers: {
        cookie: `${ENV.particularCookieName}=particular-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["content-disposition"],
      'attachment; filename="particular-audit-log-test.csv"',
    );
    assert.match(response.body, /^﻿id,event,clinicId/);
    assert.deepEqual(calls, [
      {
        particularTokenId: 7,
        filters: {
          event: undefined,
          actorType: undefined,
          reportId: 55,
          clinicId: undefined,
          actorAdminUserId: undefined,
          actorClinicUserId: undefined,
          actorReportAccessTokenId: undefined,
          targetReportAccessTokenId: undefined,
          limit: 10000,
          offset: 0,
        },
      },
    ]);
  } finally {
    await app.close();
  }
});

test("audit exports rechazan cookies de dominios cruzados antes de listar", async () => {
  const cases = [
    {
      label: "admin export rechaza cookie clinic",
      createApp: () =>
        createAdminAuditApp({
          getAdminSessionByToken: async () => null,
          listAuditLog: async () => {
            throw new Error("admin export con cookie cruzada no debe listar");
          },
        }),
      url: "/api/admin/audit-log/export.csv",
      cookie: `${ENV.cookieName}=clinic-session-token`,
      expectedStatus: 401,
    },
    {
      label: "clinic export rechaza cookie admin",
      createApp: () =>
        createClinicAuditApp({
          getActiveSessionByToken: async () => null,
          listAuditLog: async () => {
            throw new Error("clinic export con cookie cruzada no debe listar");
          },
        }),
      url: "/api/clinic/audit-log/export.csv",
      cookie: `${ENV.adminCookieName}=admin-session-token`,
      expectedStatus: 401,
    },
    {
      label: "particular export rechaza cookie admin",
      createApp: () =>
        createParticularAuditApp({
          getParticularSessionByToken: async () => null,
          listParticularAuditLog: async () => {
            throw new Error(
              "particular export con cookie cruzada no debe listar",
            );
          },
        }),
      url: "/api/particular/audit-log/export.csv",
      cookie: `${ENV.adminCookieName}=admin-session-token`,
      expectedStatus: 401,
    },
  ];

  for (const scenario of cases) {
    const app = await scenario.createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: scenario.url,
        headers: {
          cookie: scenario.cookie,
        },
      });

      assert.equal(response.statusCode, scenario.expectedStatus, scenario.label);
    } finally {
      await app.close();
    }
  }
});

test("audit exports bloquean resultados que superan el máximo por dominio", async () => {
  const cases = [
    {
      label: "admin",
      createApp: () =>
        createAdminAuditApp({
          listAuditLog: async () => ({
            items: [],
            total: 10001,
          }),
        }),
      url: "/api/admin/audit-log/export.csv",
      cookie: `${ENV.adminCookieName}=admin-session-token`,
    },
    {
      label: "clinic",
      createApp: () =>
        createClinicAuditApp({
          listAuditLog: async () => ({
            items: [],
            total: 10001,
          }),
        }),
      url: "/api/clinic/audit-log/export.csv",
      cookie: `${ENV.cookieName}=clinic-session-token`,
    },
    {
      label: "particular",
      createApp: () =>
        createParticularAuditApp({
          listParticularAuditLog: async () => ({
            items: [],
            total: 10001,
          }),
        }),
      url: "/api/particular/audit-log/export.csv",
      cookie: `${ENV.particularCookieName}=particular-session-token`,
    },
  ];

  for (const scenario of cases) {
    const app = await scenario.createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: scenario.url,
        headers: {
          cookie: scenario.cookie,
        },
      });

      assert.equal(response.statusCode, 400, scenario.label);
      assert.match(
        JSON.parse(response.body).error,
        /Demasiados registros para exportar.*10000/,
        scenario.label,
      );
    } finally {
      await app.close();
    }
  }
});
