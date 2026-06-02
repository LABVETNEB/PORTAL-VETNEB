import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const { AUDIT_EVENTS } = await import("../server/lib/audit.ts");
const { adminReportWorkflowNativeRoutes } = await import(
  "../server/routes/admin-report-workflow.fastify.ts"
);

type AdminReportWorkflowNativeRoutesOptions = import(
  "../server/routes/admin-report-workflow.fastify.ts"
).AdminReportWorkflowNativeRoutesOptions;
type AdminReportWorkflowItem = import(
  "../server/db-report-workflow.ts"
).AdminReportWorkflowItem;

function createWorkflowItem(
  overrides: Partial<AdminReportWorkflowItem> = {},
): AdminReportWorkflowItem {
  return {
    id: 55,
    clinicId: 3,
    clinicName: "Clínica Centro",
    patientName: "Luna",
    fileName: "luna.pdf",
    studyType: null,
    uploadDate: "2026-05-20T09:00:00.000Z",
    createdAt: "2026-05-20T09:00:00.000Z",
    workflowStage: "sample_received",
    specialStainRequested: false,
    specialStainAt: null,
    workflowUpdatedAt: null,
    ...overrides,
  };
}

function buildDeps(
  overrides: Partial<AdminReportWorkflowNativeRoutesOptions> = {},
): AdminReportWorkflowNativeRoutesOptions {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionWithUser: async () => ({
      session: {
        adminUserId: 1,
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        lastAccess: new Date("2026-05-20T09:00:00.000Z"),
      },
      adminUser: { id: 1, username: "ADMIN" },
    }),
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    listAdminReportWorkflowItems: async () => [createWorkflowItem()],
    getAdminReportWorkflowItem: async () => createWorkflowItem(),
    updateAdminReportWorkflowStage: async (_id, stage, now) =>
      createWorkflowItem({
        workflowStage: stage,
        workflowUpdatedAt: now.toISOString(),
      }),
    updateAdminReportSpecialStain: async (_id, requested, now) =>
      createWorkflowItem({
        specialStainRequested: requested,
        specialStainAt: requested ? now.toISOString() : null,
        workflowUpdatedAt: now.toISOString(),
      }),
    writeAuditLog: async () => {},
    now: () => Date.parse("2026-05-26T12:00:00.000Z"),
    ...overrides,
  };
}

async function createApp(
  overrides: Partial<AdminReportWorkflowNativeRoutesOptions> = {},
) {
  const app = Fastify();

  await app.register(adminReportWorkflowNativeRoutes, {
    prefix: "/api/admin/report-workflow",
    ...buildDeps(overrides),
  });

  return app;
}

const adminHeaders = {
  cookie: `${ENV.adminCookieName}=admin-session-token`,
};

test("admin report workflow requiere autenticación admin para lectura y mutación", async () => {
  const app = await createApp({
    getAdminSessionWithUser: async () => null,
  });

  try {
    const getResponse = await app.inject({
      method: "GET",
      url: "/api/admin/report-workflow",
      headers: adminHeaders,
    });
    const patchResponse = await app.inject({
      method: "PATCH",
      url: "/api/admin/report-workflow/55/stage",
      headers: adminHeaders,
      payload: { stage: "processing" },
    });

    assert.equal(getResponse.statusCode, 401);
    assert.equal(patchResponse.statusCode, 401);
    assert.equal(JSON.parse(getResponse.body).success, false);
  } finally {
    await app.close();
  }
});

test("GET workflow lista informes globales con estado default y límite de veinte", async () => {
  const listCalls: Array<{ limit: number; offset: number }> = [];
  const app = await createApp({
    listAdminReportWorkflowItems: async (input) => {
      listCalls.push(input);
      return Array.from({ length: 21 }, (_unused, index) =>
        createWorkflowItem({ id: index + 1 }),
      );
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/report-workflow?limit=20&offset=0",
      headers: adminHeaders,
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(listCalls, [{ limit: 21, offset: 0 }]);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.reports.length, 20);
    assert.equal(body.reports[0].workflowStage, "sample_received");
    assert.equal(body.reports[0].studyType, null);
    assert.deepEqual(body.pagination, {
      limit: 20,
      offset: 0,
      hasMore: true,
    });
  } finally {
    await app.close();
  }
});

test("PATCH stage permite una etapa válida y registra auditoría admin", async () => {
  const updateCalls: Array<Record<string, unknown>> = [];
  const auditCalls: Array<Record<string, unknown>> = [];
  const app = await createApp({
    updateAdminReportWorkflowStage: async (id, stage, now) => {
      updateCalls.push({ id, stage, now });
      return createWorkflowItem({
        workflowStage: stage,
        workflowUpdatedAt: now.toISOString(),
      });
    },
    writeAuditLog: async (_request, input) => {
      auditCalls.push(input as Record<string, unknown>);
    },
  });

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/admin/report-workflow/55/stage",
      headers: {
        ...adminHeaders,
        origin: "http://localhost:3000",
      },
      payload: { stage: "report_development" },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].id, 55);
    assert.equal(updateCalls[0].stage, "report_development");
    assert.equal(JSON.parse(response.body).report.workflowStage, "report_development");
    assert.equal(auditCalls.length, 1);
    assert.equal(auditCalls[0].event, AUDIT_EVENTS.REPORT_WORKFLOW_STAGE_CHANGED);
    assert.equal(auditCalls[0].reportId, 55);
  } finally {
    await app.close();
  }
});

test("PATCH stage rechaza etapas inválidas y devuelve 404 para informe inexistente", async () => {
  let updates = 0;
  const app = await createApp({
    getAdminReportWorkflowItem: async (id) =>
      id === 999 ? null : createWorkflowItem(),
    updateAdminReportWorkflowStage: async () => {
      updates += 1;
      return createWorkflowItem();
    },
  });

  try {
    const invalidResponse = await app.inject({
      method: "PATCH",
      url: "/api/admin/report-workflow/55/stage",
      headers: adminHeaders,
      payload: { stage: "special_stain_requested" },
    });
    const missingResponse = await app.inject({
      method: "PATCH",
      url: "/api/admin/report-workflow/999/stage",
      headers: adminHeaders,
      payload: { stage: "processing" },
    });

    assert.equal(invalidResponse.statusCode, 400);
    assert.deepEqual(JSON.parse(invalidResponse.body).allowedStages, [
      "sample_received",
      "processing",
      "evaluation",
      "report_development",
      "delivered",
    ]);
    assert.equal(missingResponse.statusCode, 404);
    assert.equal(JSON.parse(missingResponse.body).error, "Informe no encontrado");
    assert.equal(updates, 0);
  } finally {
    await app.close();
  }
});

test("PATCH special-stain permite solicitar y resolver la alerta separada", async () => {
  let current = createWorkflowItem();
  const updates: boolean[] = [];
  const auditEvents: string[] = [];
  const app = await createApp({
    getAdminReportWorkflowItem: async () => current,
    updateAdminReportSpecialStain: async (_id, requested, now) => {
      updates.push(requested);
      current = createWorkflowItem({
        specialStainRequested: requested,
        specialStainAt: requested ? now.toISOString() : null,
        workflowUpdatedAt: now.toISOString(),
      });
      return current;
    },
    writeAuditLog: async (_request, input) => {
      auditEvents.push(String(input.event));
    },
  });

  try {
    const requested = await app.inject({
      method: "PATCH",
      url: "/api/admin/report-workflow/55/special-stain",
      headers: adminHeaders,
      payload: { requested: true },
    });
    const resolved = await app.inject({
      method: "PATCH",
      url: "/api/admin/report-workflow/55/special-stain",
      headers: adminHeaders,
      payload: { requested: false },
    });

    assert.equal(requested.statusCode, 200);
    assert.equal(JSON.parse(requested.body).report.specialStainRequested, true);
    assert.equal(resolved.statusCode, 200);
    assert.equal(JSON.parse(resolved.body).report.specialStainRequested, false);
    assert.equal(JSON.parse(resolved.body).report.specialStainAt, null);
    assert.deepEqual(updates, [true, false]);
    assert.deepEqual(auditEvents, [
      AUDIT_EVENTS.REPORT_SPECIAL_STAIN_CHANGED,
      AUDIT_EVENTS.REPORT_SPECIAL_STAIN_CHANGED,
    ]);
  } finally {
    await app.close();
  }
});

test("workflow expone OPTIONS CORS y bloquea mutación desde origen no permitido", async () => {
  let updates = 0;
  const app = await createApp({
    updateAdminReportWorkflowStage: async () => {
      updates += 1;
      return createWorkflowItem({ workflowStage: "processing" });
    },
  });

  try {
    const optionsResponse = await app.inject({
      method: "OPTIONS",
      url: "/api/admin/report-workflow/55/stage",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-headers": "content-type",
      },
    });
    const blockedResponse = await app.inject({
      method: "PATCH",
      url: "/api/admin/report-workflow/55/stage",
      headers: {
        ...adminHeaders,
        origin: "https://evil.example",
      },
      payload: { stage: "processing" },
    });

    assert.equal(optionsResponse.statusCode, 204);
    assert.equal(
      optionsResponse.headers["access-control-allow-origin"],
      "http://localhost:3000",
    );
    assert.equal(
      optionsResponse.headers["access-control-allow-methods"],
      "GET,PATCH,OPTIONS",
    );
    assert.equal(blockedResponse.statusCode, 403);
    assert.equal(updates, 0);
  } finally {
    await app.close();
  }
});
