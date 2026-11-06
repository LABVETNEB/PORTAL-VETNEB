import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../../../../server/lib/env.ts");
const { reportsNativeRoutes } = await import("../../../../server/routes/reports.fastify.ts");
const { adminReportWorkflowNativeRoutes } = await import(
  "../../../../server/routes/admin-report-workflow.fastify.ts"
);
const { parseStrictReportId } = await import("../../../../server/features/reports/domain/index.ts");

type AdminReportWorkflowNativeRoutesOptions = import(
  "../../../../server/routes/admin-report-workflow.fastify.ts"
).AdminReportWorkflowNativeRoutesOptions;
type AdminReportWorkflowItem = import(
  "../../../../server/features/reports/infrastructure/index.ts"
).AdminReportWorkflowItem;

// GLOBAL-SEARCH-3A · by-id reads behind the deep link of a search hit:
// GET /api/reports/:reportId (clinic) and GET /api/admin/report-workflow/:id.

const CLINIC_A = 3;
const CLINIC_B = 4;
const secretFragments = ["storagePath", "storage_path", "previewUrl", "downloadUrl", "signed", "token", "passwordHash"];

function storedReport(overrides: Record<string, unknown> = {}) {
  return {
    id: 55,
    clinicId: CLINIC_A,
    patientName: "Luna Gomez",
    studyType: "citologia",
    uploadDate: new Date("2026-04-20T00:00:00.000Z"),
    fileName: "luna.pdf",
    storagePath: "reports/3/luna.pdf",
    previewUrl: "https://storage.example.test/signed/luna.pdf?token=leak",
    downloadUrl: "https://storage.example.test/signed/luna.pdf?token=leak",
    currentStatus: "ready",
    statusChangedAt: new Date("2026-04-21T00:00:00.000Z"),
    statusChangedByClinicUserId: 9,
    statusChangedByAdminUserId: null,
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    updatedAt: new Date("2026-04-22T12:00:00.000Z"),
    ...overrides,
  };
}

/** Rows of two clinics; the scoped lookup reproduces the repository predicate. */
const storedRows = [storedReport(), storedReport({ id: 77, clinicId: CLINIC_B, patientName: "Ajeno", fileName: "ajeno.pdf" })];

async function createClinicApp(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ reportId: number; clinicId: number }> = [];
  const app = Fastify();
  await app.register(reportsNativeRoutes as never, {
    prefix: "/api/reports",
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async (hash: string) =>
      hash === "hash:clinic-a"
        ? { clinicUserId: 9, expiresAt: new Date("2099-01-01T00:00:00.000Z"), lastAccess: new Date("2026-04-23T00:00:00.000Z") }
        : null,
    getClinicUserById: async () => ({ id: 9, clinicId: CLINIC_A, username: "doctor", authProId: null, role: "clinic_owner" }),
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getReportsByClinicId: async (clinicId: number) => storedRows.filter((row) => row.clinicId === clinicId),
    countReportsByClinicId: async (clinicId: number) => storedRows.filter((row) => row.clinicId === clinicId).length,
    searchReports: async () => [],
    countSearchReports: async () => 0,
    getStudyTypes: async () => [],
    getClinicScopedReportById: async (reportId: number, clinicId: number) => {
      calls.push({ reportId, clinicId });
      return storedRows.find((row) => row.id === reportId && row.clinicId === clinicId) ?? null;
    },
    getReportStatusHistory: async () => [],
    createSignedReportUrl: async (path: string) => `preview:${path}`,
    createSignedReportDownloadUrl: async (path: string) => `download:${path}`,
    now: () => new Date("2026-04-24T00:00:00.000Z").getTime(),
    ...overrides,
  });
  return { app, calls };
}

const clinicCookie = { cookie: `${ENV.cookieName}=clinic-a` };

function workflowItem(overrides: Partial<AdminReportWorkflowItem> = {}): AdminReportWorkflowItem {
  return {
    id: 55,
    clinicId: CLINIC_A,
    clinicName: "Clínica Centro",
    patientName: "Luna",
    fileName: "luna.pdf",
    studyType: "citologia",
    uploadDate: "2026-05-20T09:00:00.000Z",
    createdAt: "2026-05-20T09:00:00.000Z",
    workflowStage: "processing",
    specialStainRequested: true,
    specialStainAt: "2026-05-21T09:00:00.000Z",
    workflowUpdatedAt: "2026-05-21T09:00:00.000Z",
    ...overrides,
  };
}

async function createAdminApp(overrides: Partial<AdminReportWorkflowNativeRoutesOptions> = {}) {
  const lookups: number[] = [];
  const app = Fastify();
  await app.register(adminReportWorkflowNativeRoutes, {
    prefix: "/api/admin/report-workflow",
    deleteAdminSession: async () => {},
    getAdminSessionWithUser: async (hash: string) =>
      hash === "hash:admin"
        ? {
            session: { adminUserId: 1, expiresAt: new Date("2099-01-01T00:00:00.000Z"), lastAccess: new Date() },
            adminUser: { id: 1, username: "ADMIN" },
          }
        : null,
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    listAdminReportWorkflowItems: async () => [workflowItem(), workflowItem({ id: 77, clinicId: CLINIC_B })],
    getAdminReportWorkflowItem: async (id: number) => {
      lookups.push(id);
      return [workflowItem(), workflowItem({ id: 77, clinicId: CLINIC_B })].find((item) => item.id === id) ?? null;
    },
    updateAdminReportWorkflowStage: async () => null,
    updateAdminReportSpecialStain: async () => null,
    writeAuditLog: async () => {},
    now: () => Date.parse("2026-05-26T12:00:00.000Z"),
    ...overrides,
  });
  return { app, lookups };
}

const adminCookie = { cookie: `${ENV.adminCookieName}=admin` };

test("parseStrictReportId admite sólo dígitos canónicos dentro del rango integer", () => {
  assert.deepEqual(
    ["1", "55", "2147483647"].map(parseStrictReportId),
    [1, 55, 2147483647],
  );
  for (const malformed of ["0", "-1", "012", "1e3", " 12 ", "12.0", "0x10", "2147483648", "99999999999", "", "abc"]) {
    assert.equal(parseStrictReportId(malformed), undefined, malformed);
  }
  assert.equal(parseStrictReportId(55), undefined, "the path parameter is always a string");
});

test("clínica: el informe propio devuelve 200 con la forma del ítem de listado y sin secretos", async () => {
  const { app, calls } = await createClinicApp();
  try {
    const single = await app.inject({ method: "GET", url: "/api/reports/55", headers: clinicCookie });
    const list = await app.inject({ method: "GET", url: "/api/reports", headers: clinicCookie });
    assert.equal(single.statusCode, 200);
    const body = single.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.report, list.json().reports[0], "same shape and values as the list item");
    assert.deepEqual(Object.keys(body.report).sort(), [
      "clinicId",
      "createdAt",
      "currentStatus",
      "fileName",
      "hasFile",
      "id",
      "patientName",
      "status",
      "statusChangedAt",
      "studyType",
      "updatedAt",
      "uploadDate",
    ], "exactly the serializeSafeReport projection (clinicName is not selected by the list either)");
    assert.equal(body.report.hasFile, true);
    for (const fragment of secretFragments) {
      assert.equal(single.body.includes(fragment), false, `response leaks ${fragment}`);
    }
    assert.deepEqual(calls.at(0), { reportId: 55, clinicId: CLINIC_A }, "tenant comes from the session");
  } finally {
    await app.close();
  }
});

test("clínica: informe ajeno, inexistente o eliminado es el mismo 404 sin distinguir existencia", async () => {
  const { app, calls } = await createClinicApp();
  try {
    const foreign = await app.inject({ method: "GET", url: "/api/reports/77", headers: clinicCookie });
    const missing = await app.inject({ method: "GET", url: "/api/reports/999999", headers: clinicCookie });
    assert.equal(foreign.statusCode, 404);
    assert.equal(missing.statusCode, 404);
    assert.equal(foreign.body, missing.body, "identical body: no existence oracle");
    assert.deepEqual(
      Object.fromEntries(["content-type", "cache-control"].map((name) => [name, foreign.headers[name]])),
      Object.fromEntries(["content-type", "cache-control"].map((name) => [name, missing.headers[name]])),
    );
    assert.deepEqual(foreign.json(), { success: false, error: "Informe no encontrado" });
    assert.deepEqual(calls.map((call) => call.clinicId), [CLINIC_A, CLINIC_A], "never queried with another tenant");
  } finally {
    await app.close();
  }
});

test("clínica: un clinicId en la query no cambia el tenant", async () => {
  const { app, calls } = await createClinicApp();
  try {
    const response = await app.inject({ method: "GET", url: `/api/reports/77?clinicId=${CLINIC_B}`, headers: clinicCookie });
    assert.equal(response.statusCode, 404);
    assert.deepEqual(calls, [{ reportId: 77, clinicId: CLINIC_A }]);
  } finally {
    await app.close();
  }
});

test("clínica: sin sesión es 401 y el id malformado es 400, sin consultar el repositorio", async () => {
  const { app, calls } = await createClinicApp();
  try {
    const anonymous = await app.inject({ method: "GET", url: "/api/reports/55" });
    assert.equal(anonymous.statusCode, 401);
    const invalidSession = await app.inject({ method: "GET", url: "/api/reports/55", headers: { cookie: `${ENV.cookieName}=other` } });
    assert.equal(invalidSession.statusCode, 401);
    for (const malformed of ["abc", "0", "-5", "1e3", "012", "2147483648"]) {
      const response = await app.inject({ method: "GET", url: `/api/reports/${malformed}`, headers: clinicCookie });
      assert.equal(response.statusCode, 400, malformed);
      assert.deepEqual(response.json(), { success: false, error: "ID de informe invalido" });
    }
    assert.deepEqual(calls, []);
  } finally {
    await app.close();
  }
});

test("clínica: la cookie admin no autentica la lectura por id de clínica", async () => {
  const { app } = await createClinicApp();
  try {
    const response = await app.inject({ method: "GET", url: "/api/reports/55", headers: adminCookie });
    assert.equal(response.statusCode, 401);
  } finally {
    await app.close();
  }
});

test("clínica: las rutas estáticas y de subrecurso siguen resolviendo antes que /:reportId", async () => {
  const { app } = await createClinicApp();
  try {
    const studyTypes = await app.inject({ method: "GET", url: "/api/reports/study-types", headers: clinicCookie });
    const search = await app.inject({ method: "GET", url: "/api/reports/search?query=luna", headers: clinicCookie });
    const history = await app.inject({ method: "GET", url: "/api/reports/55/history", headers: clinicCookie });
    const preview = await app.inject({ method: "GET", url: "/api/reports/55/preview-url", headers: clinicCookie });
    const download = await app.inject({ method: "GET", url: "/api/reports/55/download-url", headers: clinicCookie });
    assert.deepEqual(
      [studyTypes, search, history, preview, download].map((response) => response.statusCode),
      [200, 200, 200, 200, 200],
    );
    assert.ok("studyTypes" in studyTypes.json());
    assert.ok("reports" in search.json());
    assert.equal(preview.json().previewUrl, "preview:reports/3/luna.pdf");
    const foreignPreview = await app.inject({ method: "GET", url: "/api/reports/77/preview-url", headers: clinicCookie });
    assert.equal(foreignPreview.statusCode, 404);
  } finally {
    await app.close();
  }
});

test("clínica: preflight OPTIONS de /:reportId responde sin autenticar", async () => {
  const { app } = await createClinicApp();
  try {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/reports/55",
      headers: { origin: "http://localhost:3000", "access-control-request-method": "GET" },
    });
    assert.equal(response.statusCode, 204);
    assert.equal(response.headers["access-control-allow-methods"], "GET,OPTIONS");
  } finally {
    await app.close();
  }
});

test("admin: el ítem por id devuelve 200 con la forma del listado, etapa y tinción especial", async () => {
  const { app, lookups } = await createAdminApp();
  try {
    const single = await app.inject({ method: "GET", url: "/api/admin/report-workflow/77", headers: adminCookie });
    const list = await app.inject({ method: "GET", url: "/api/admin/report-workflow", headers: adminCookie });
    assert.equal(single.statusCode, 200);
    const body = single.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.report, list.json().reports.find((item: { id: number }) => item.id === 77));
    assert.deepEqual(
      {
        workflowStage: body.report.workflowStage,
        specialStainRequested: body.report.specialStainRequested,
        specialStainAt: body.report.specialStainAt,
      },
      { workflowStage: "processing", specialStainRequested: true, specialStainAt: "2026-05-21T09:00:00.000Z" },
    );
    for (const fragment of secretFragments) {
      assert.equal(single.body.includes(fragment), false, `response leaks ${fragment}`);
    }
    assert.deepEqual(lookups, [77]);
  } finally {
    await app.close();
  }
});

test("admin: inexistente 404, malformado 400, sin sesión o con cookie de clínica 401", async () => {
  const { app, lookups } = await createAdminApp();
  try {
    const missing = await app.inject({ method: "GET", url: "/api/admin/report-workflow/999999", headers: adminCookie });
    assert.equal(missing.statusCode, 404);
    assert.deepEqual(missing.json(), { success: false, error: "Informe no encontrado" });
    for (const malformed of ["abc", "0", "1e3", "012", "2147483648"]) {
      const response = await app.inject({ method: "GET", url: `/api/admin/report-workflow/${malformed}`, headers: adminCookie });
      assert.equal(response.statusCode, 400, malformed);
    }
    const anonymous = await app.inject({ method: "GET", url: "/api/admin/report-workflow/55" });
    const clinicSession = await app.inject({ method: "GET", url: "/api/admin/report-workflow/55", headers: clinicCookie });
    assert.equal(anonymous.statusCode, 401);
    assert.equal(clinicSession.statusCode, 401);
    assert.deepEqual(lookups, [999999], "only the well-formed authenticated request reached the repository");
  } finally {
    await app.close();
  }
});

test("admin: las mutaciones por id siguen registradas y protegidas por origen confiable", async () => {
  const { app } = await createAdminApp();
  try {
    const patch = await app.inject({
      method: "PATCH",
      url: "/api/admin/report-workflow/55/stage",
      headers: { ...adminCookie, origin: "https://evil.example.test" },
      payload: { stage: "processing" },
    });
    assert.equal(patch.statusCode, 403);
    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/api/admin/report-workflow/55",
      headers: { origin: "http://localhost:3000", "access-control-request-method": "GET" },
    });
    assert.equal(preflight.statusCode, 204);
  } finally {
    await app.close();
  }
});
