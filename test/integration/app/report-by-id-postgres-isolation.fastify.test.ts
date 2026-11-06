import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";
import { eq, inArray } from "drizzle-orm";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const databaseUrl =
  process.env.SUPABASE_DB_URL?.trim() ?? process.env.DATABASE_URL?.trim();
const databaseTarget = databaseUrl ? new URL(databaseUrl) : undefined;

if (
  !databaseTarget ||
  !["localhost", "127.0.0.1"].includes(databaseTarget.hostname) ||
  databaseTarget.pathname !== "/portal_vetneb_ci"
) {
  throw new Error(
    "REPORT-BY-ID-DB requiere DATABASE_URL o SUPABASE_DB_URL para la DB aislada portal_vetneb_ci",
  );
}

process.env.DATABASE_URL = databaseUrl;
process.env.SUPABASE_DB_URL = databaseUrl;

const { db, closeDbConnection, pgClient } = await import("../../../server/db.ts");
const { createFastifyApp } = await import("../../../server/fastify-app.ts");
const { ENV } = await import("../../../server/lib/env.ts");
const { clinics, reports } = await import("../../../drizzle/schema.ts");

// GLOBAL-SEARCH-3A · the by-id reads behind a search hit's deep link, against
// real PostgreSQL: clinic A reads its own report (including one far outside
// the first list page), never clinic B's; a foreign, missing and deleted id are
// indistinguishable; admin reads one workflow item of any clinic. Synthetic data.

const REPORTS_PER_CLINIC = 120;

test("REPORT-BY-ID-DB: lectura por id aislada por tenant, 404 uniforme y paridad con el listado", async (t) => {
  const suffix = `${process.pid}-${Date.now()}`;
  const clinicIds: number[] = [];

  t.after(async () => {
    try {
      if (clinicIds.length > 0) {
        await db.delete(clinics).where(inArray(clinics.id, clinicIds));
      }
    } finally {
      await closeDbConnection();
    }
  });

  for (const label of ["A", "B"]) {
    const [clinic] = await pgClient<{ id: number }[]>`
      insert into clinics (clinic_id, name)
      values (${`byid-${label}-${suffix}`}, ${`BYID Clinica ${label} ${suffix}`})
      returning id
    `;
    assert.ok(clinic);
    clinicIds.push(clinic.id);
  }
  const [clinicA, clinicB] = clinicIds as [number, number];
  const base = Date.UTC(2026, 0, 1);

  const insertReports = (clinicId: number, label: string) =>
    db
      .insert(reports)
      .values(
        Array.from({ length: REPORTS_PER_CLINIC }, (_, index) => ({
          clinicId,
          patientName: `Paciente ${label}-${index} ${suffix}`,
          fileName: `byid-${label}-${index}.pdf`,
          studyType: index % 2 === 0 ? "citologia" : "histopatologia",
          storagePath: `synthetic/byid/${suffix}/${label}/${index}.pdf`,
          createdAt: new Date(base + index * 60_000),
          uploadDate: new Date(base + index * 60_000),
        })),
      )
      .returning({ id: reports.id });

  const idsA = (await insertReports(clinicA, "A")).map((row) => row.id);
  const idsB = (await insertReports(clinicB, "B")).map((row) => row.id);
  // Oldest report of A: never in the first page of the module list (created_at desc).
  const oldestA = idsA[0]!;
  const foreignB = idsB[0]!;
  const [deletedRow] = await db
    .insert(reports)
    .values({ clinicId: clinicA, patientName: `Borrado ${suffix}`, storagePath: `synthetic/byid/${suffix}/deleted.pdf` })
    .returning({ id: reports.id });
  assert.ok(deletedRow);
  await db.delete(reports).where(eq(reports.id, deletedRow.id));
  const [{ max }] = await pgClient<{ max: number }[]>`select coalesce(max(id), 0)::int as max from reports`;
  const neverExisted = max + 1_000;

  const future = new Date("2099-01-01T00:00:00.000Z");
  const clinicAuth = {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async (hash: string) =>
      hash === "hash:a" || hash === "hash:b"
        ? { clinicUserId: hash === "hash:a" ? 1 : 2, expiresAt: future, lastAccess: new Date() }
        : null,
    getClinicUserById: async (id: number) => ({
      id,
      clinicId: id === 1 ? clinicA : clinicB,
      username: `u${id}`,
      authProId: null,
      role: "clinic_staff",
    }),
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
  };
  const app = await createFastifyApp({
    reportsRoutes: clinicAuth,
    adminReportWorkflowRoutes: {
      deleteAdminSession: async () => {},
      getAdminSessionWithUser: async (hash: string) =>
        hash === "hash:admin"
          ? { session: { adminUserId: 1, expiresAt: future, lastAccess: new Date() }, adminUser: { id: 1, username: "admin" } }
          : null,
      updateAdminSessionLastAccess: async () => {},
      hashSessionToken: (token: string) => `hash:${token}`,
    },
  });
  t.after(() => app.close());

  const get = (url: string, cookie?: string) =>
    app.inject({ method: "GET", url, headers: cookie ? { cookie } : {} });
  const clinicA_ = `${ENV.cookieName}=a`;
  const clinicB_ = `${ENV.cookieName}=b`;
  const admin = `${ENV.adminCookieName}=admin`;

  // 1 + 8: own report outside the first page, same item as the list returns.
  const own = await get(`/api/reports/${oldestA}`, clinicA_);
  assert.equal(own.statusCode, 200, own.body);
  assert.match(String(own.headers["cache-control"]), /no-store/, "private response is no-store");
  const ownBody = own.json<{ report: Record<string, unknown> }>();
  assert.equal(ownBody.report.id, oldestA);
  assert.equal(ownBody.report.clinicId, clinicA);
  assert.equal(ownBody.report.hasFile, true);
  const firstPage = await get("/api/reports?limit=50&offset=0", clinicA_);
  const firstIds = firstPage.json<{ reports: Array<{ id: number }> }>().reports.map((row) => row.id);
  assert.equal(firstIds.includes(oldestA), false, "the target is outside the first page");
  const lastPage = await get(`/api/reports?limit=50&offset=${REPORTS_PER_CLINIC - 1}`, clinicA_);
  const listed = lastPage.json<{ reports: Array<Record<string, unknown>> }>().reports.find((row) => row.id === oldestA);
  assert.deepEqual(ownBody.report, listed, "by-id body equals the list item");

  // 9: no storage path, no signed URL.
  assert.equal(own.body.includes("synthetic/byid"), false, "storage path never leaves the server");
  assert.equal(/storage_?path|previewUrl|downloadUrl|sign/i.test(own.body), false);

  // 2 + 3 + 10: foreign, deleted and never-existing ids are the same answer.
  const foreign = await get(`/api/reports/${foreignB}`, clinicA_);
  const deleted = await get(`/api/reports/${deletedRow.id}`, clinicA_);
  const missing = await get(`/api/reports/${neverExisted}`, clinicA_);
  // The per-request correlation id is the only field that differs.
  const withoutRequestId = (body: string) => {
    const { requestId: _requestId, ...rest } = JSON.parse(body) as Record<string, unknown>;
    return rest;
  };
  for (const response of [foreign, deleted, missing]) {
    assert.equal(response.statusCode, 404);
    assert.deepEqual(withoutRequestId(response.body), { success: false, error: "Informe no encontrado" });
    assert.equal(response.headers["cache-control"], foreign.headers["cache-control"]);
    assert.equal(response.headers["content-type"], foreign.headers["content-type"]);
  }
  // The symmetric case: B reads its own and not A's.
  assert.equal((await get(`/api/reports/${foreignB}`, clinicB_)).statusCode, 200);
  assert.equal((await get(`/api/reports/${oldestA}`, clinicB_)).statusCode, 404);
  // A clinicId in the query never moves the tenant.
  assert.equal((await get(`/api/reports/${foreignB}?clinicId=${clinicB}`, clinicA_)).statusCode, 404);

  // 4 + 5: anonymous and malformed.
  assert.equal((await get(`/api/reports/${oldestA}`)).statusCode, 401);
  assert.equal((await get("/api/reports/2147483648", clinicA_)).statusCode, 400);
  assert.equal((await get("/api/reports/1e3", clinicA_)).statusCode, 400);

  // 11: the sub-resources keep resolving and keep their own scoping.
  assert.equal((await get(`/api/reports/${oldestA}/history`, clinicA_)).statusCode, 200);
  assert.equal((await get(`/api/reports/${foreignB}/history`, clinicA_)).statusCode, 404);

  // 6 + 8: admin reads one workflow item of any clinic, list-item shape.
  const workflow = await get(`/api/admin/report-workflow/${foreignB}`, admin);
  assert.equal(workflow.statusCode, 200, workflow.body);
  assert.match(String(workflow.headers["cache-control"]), /no-store/);
  const item = workflow.json<{ report: Record<string, unknown> }>().report;
  assert.equal(item.id, foreignB);
  assert.equal(item.clinicId, clinicB);
  assert.equal(item.clinicName, `BYID Clinica B ${suffix}`);
  assert.equal(item.workflowStage, "sample_received");
  assert.equal(item.specialStainRequested, false);
  assert.deepEqual(
    Object.keys(item).sort(),
    [
      "clinicId",
      "clinicName",
      "createdAt",
      "fileName",
      "id",
      "patientName",
      "specialStainAt",
      "specialStainRequested",
      "studyType",
      "uploadDate",
      "workflowStage",
      "workflowUpdatedAt",
    ],
  );
  assert.equal(workflow.body.includes("synthetic/byid"), false);
  assert.equal((await get(`/api/admin/report-workflow/${deletedRow.id}`, admin)).statusCode, 404);

  // 7 + 12: a clinic session never reaches the admin read.
  assert.equal((await get(`/api/admin/report-workflow/${foreignB}`, clinicA_)).statusCode, 401);
  assert.equal((await get(`/api/admin/report-workflow/${foreignB}`)).statusCode, 401);
});
