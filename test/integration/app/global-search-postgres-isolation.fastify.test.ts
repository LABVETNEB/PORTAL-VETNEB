import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";
import { inArray } from "drizzle-orm";

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
    "GLOBAL-SEARCH-DB requiere DATABASE_URL o SUPABASE_DB_URL para la DB aislada portal_vetneb_ci",
  );
}

process.env.DATABASE_URL = databaseUrl;
process.env.SUPABASE_DB_URL = databaseUrl;

const { db, closeDbConnection, pgClient } = await import("../../../server/db.ts");
const { createFastifyApp } = await import("../../../server/fastify-app.ts");
const { ENV } = await import("../../../server/lib/env.ts");
const { clinics, clinicUsers, particularTokens, reports, studyTrackingCases } = await import(
  "../../../drizzle/schema.ts"
);

type Body = {
  success: boolean;
  hits: Array<{ kind: string; id: number; title: string; clinic: { id: number } | null; target: Record<string, number | null> }>;
  groups: Array<{ kind: string; returned: number; hasMore: boolean }>;
};

const REPORTS_PER_CLINIC = 2_000;
const LATENCY_SAMPLES = 20;
/** Server-side p95 budget for one quick search over every clinic entity. */
const P95_BUDGET_MS = 750;

function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

test("GLOBAL-SEARCH-DB: SQL real aísla tenants, pliega tildes y encuentra fuera de la primera página", async (t) => {
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
      values (${`gsearch-${label}-${suffix}`}, ${`GSEARCH Clinica ${label} ${suffix}`})
      returning id
    `;
    assert.ok(clinic);
    clinicIds.push(clinic.id);
  }

  const [clinicA, clinicB] = clinicIds as [number, number];
  const base = Date.UTC(2026, 0, 1);

  const reportRows = (clinicId: number, label: string) =>
    Array.from({ length: REPORTS_PER_CLINIC }, (_, index) => ({
      clinicId,
      patientName: index === 0 ? `Ñandú Pérez ${suffix}` : `Paciente ${label}-${index} ${suffix}`,
      fileName: `gsearch-${label}-${index}.pdf`,
      studyType: index % 2 === 0 ? "citologia" : "histopatologia",
      storagePath: `synthetic/gsearch/${suffix}/${label}/${index}.pdf`,
      createdAt: new Date(base + index * 60_000),
      uploadDate: new Date(base + index * 60_000),
    }));

  // Index 0 is the OLDEST report of clinic A: never on the first page of the
  // module list (50 rows ordered by created_at desc).
  await db.insert(reports).values(reportRows(clinicA, "A"));
  await db.insert(reports).values(reportRows(clinicB, "B"));
  await db.insert(reports).values({
    clinicId: clinicB,
    patientName: `Exclusivo B 100% real ${suffix}`,
    fileName: "gsearch-b-exclusive.pdf",
    studyType: "citologia",
    storagePath: `synthetic/gsearch/${suffix}/B/exclusive.pdf`,
  });

  const [tokenA] = await db
    .insert(particularTokens)
    .values({
      clinicId: clinicA,
      tokenHash: `gsearch-a-${suffix}`.padEnd(64, "0").slice(0, 64),
      tokenLast4: "A1B2",
      tutorLastName: `Gómez ${suffix}`,
      petName: `Firulais ${suffix}`,
      petAge: "3",
      petBreed: "Mestizo",
      petSex: "M",
      petSpecies: "Canino",
      sampleLocation: "Sintética",
      sampleEvolution: "Sintética",
      extractionDate: new Date(base),
      shippingDate: new Date(base),
    })
    .returning({ id: particularTokens.id });
  assert.ok(tokenA);

  const [caseA] = await db
    .insert(studyTrackingCases)
    .values({
      clinicId: clinicA,
      particularTokenId: tokenA.id,
      receptionAt: new Date(base),
      estimatedDeliveryAt: new Date(base + 86_400_000),
      estimatedDeliveryAutoCalculatedAt: new Date(base),
    })
    .returning({ id: studyTrackingCases.id });
  assert.ok(caseA);

  const [userB] = await db
    .insert(clinicUsers)
    .values({ clinicId: clinicB, username: `gsearch-recepcion-${suffix}`, passwordHash: "synthetic-not-a-hash" })
    .returning({ id: clinicUsers.id });
  assert.ok(userB);

  const future = new Date("2099-01-01T00:00:00.000Z");
  const app = await createFastifyApp({
    clinicGlobalSearchRoutes: {
      deleteActiveSession: async () => {},
      getActiveSessionByToken: async (hash) =>
        hash === "hash:a" || hash === "hash:b"
          ? { clinicUserId: hash === "hash:a" ? 1 : 2, expiresAt: future, lastAccess: new Date() }
          : null,
      getClinicUserById: async (id) => ({
        id,
        clinicId: id === 1 ? clinicA : clinicB,
        username: `u${id}`,
        role: "clinic_staff",
      }),
      updateSessionLastAccess: async () => {},
      hashSessionToken: (token) => `hash:${token}`,
    },
    adminGlobalSearchRoutes: {
      deleteAdminSession: async () => {},
      getAdminSessionByToken: async (hash) =>
        hash === "hash:admin" ? { id: 1, adminUserId: 1, expiresAt: future, lastAccess: new Date() } : null,
      getAdminUserById: async () => ({ id: 1, username: "admin" }),
      updateAdminSessionLastAccess: async () => {},
      hashSessionToken: (token) => `hash:${token}`,
    },
  });
  t.after(() => app.close());

  const search = async (url: string, cookie: string) => {
    const response = await app.inject({ method: "GET", url, headers: { cookie } });
    assert.equal(response.statusCode, 200, `${url}: ${response.body}`);
    return response.json<Body>();
  };
  const clinicACookie = `${ENV.cookieName}=a`;
  const clinicBCookie = `${ENV.cookieName}=b`;
  const adminCookie = `${ENV.adminCookieName}=admin`;

  const accentless = await search(`/api/search?q=${encodeURIComponent(`nandu perez ${suffix}`)}`, clinicACookie);
  assert.deepEqual(
    accentless.hits.map((hit) => hit.kind),
    ["report"],
    "sólo el informe propio, nunca el homónimo de B",
  );
  assert.equal(accentless.hits[0]?.target.clinicId, clinicA);

  const upper = await search(`/api/search?q=${encodeURIComponent(`ÑANDÚ PÉREZ ${suffix}`)}`, clinicACookie);
  assert.deepEqual(upper.hits.map((hit) => hit.id), accentless.hits.map((hit) => hit.id));

  const foreign = await search(`/api/search?q=${encodeURIComponent(`Exclusivo B 100% real ${suffix}`)}`, clinicACookie);
  assert.deepEqual(foreign.hits, [], "la clínica A no ve títulos de B");

  const literalPercent = await search(`/api/search?q=${encodeURIComponent(`Exclusivo B 100%`)}`, clinicBCookie);
  assert.ok(literalPercent.hits.some((hit) => hit.title.startsWith("Exclusivo B 100% real")));
  const wildcard = await search(`/api/search?q=${encodeURIComponent("%%%%")}`, clinicBCookie);
  assert.deepEqual(wildcard.hits, [], "% del usuario es literal, no comodín");

  const tokenAndCase = await search(`/api/search?q=${encodeURIComponent(`firulais ${suffix}`)}`, clinicACookie);
  assert.deepEqual(
    tokenAndCase.hits.map((hit) => hit.kind).sort(),
    ["particular_token", "tracking_case"],
  );
  const tokenFromB = await search(`/api/search?q=${encodeURIComponent(`firulais ${suffix}`)}`, clinicBCookie);
  assert.deepEqual(tokenFromB.hits, []);

  const pageOne = await search(`/api/search?q=${encodeURIComponent(`paciente a-`)}&kinds=report&limit=25`, clinicACookie);
  const pageTwo = await search(`/api/search?q=${encodeURIComponent(`paciente a-`)}&kinds=report&limit=25&offset=25`, clinicACookie);
  assert.deepEqual(pageOne.groups[0], { kind: "report", returned: 25, hasMore: true });
  assert.equal(new Set([...pageOne.hits, ...pageTwo.hits].map((hit) => hit.id)).size, 50);

  const admin = await search(`/api/admin/search?q=${encodeURIComponent(suffix)}&limit=3`, adminCookie);
  assert.deepEqual(
    admin.groups.map((group) => group.kind),
    ["clinic", "report", "particular_token", "tracking_case", "clinic_user"],
  );
  assert.ok(admin.groups.find((group) => group.kind === "report")?.hasMore);
  assert.ok(admin.hits.some((hit) => hit.kind === "clinic_user" && hit.id === userB.id));

  const narrowed = await search(`/api/admin/search?q=${encodeURIComponent(`firulais ${suffix}`)}&clinicId=${clinicB}`, adminCookie);
  assert.deepEqual(narrowed.hits, [], "el filtro de clínica admin acota");

  const samples: number[] = [];
  for (let index = 0; index < LATENCY_SAMPLES; index += 1) {
    const started = performance.now();
    await search(`/api/search?q=${encodeURIComponent(`paciente a-${index * 7}`)}`, clinicACookie);
    samples.push(performance.now() - started);
  }
  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);
  t.diagnostic(`clinic quick search over ${REPORTS_PER_CLINIC * 2} reports: p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms`);
  assert.ok(p95 < P95_BUDGET_MS, `p95 ${p95.toFixed(1)}ms excede ${P95_BUDGET_MS}ms`);
});
