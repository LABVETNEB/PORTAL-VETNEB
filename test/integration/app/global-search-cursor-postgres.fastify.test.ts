import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";
import { eq, inArray, sql } from "drizzle-orm";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

// Both URLs must already name the isolated local database: this spec never
// rewrites the environment, it refuses to run anywhere else.
for (const name of ["DATABASE_URL", "SUPABASE_DB_URL"] as const) {
  const value = process.env[name]?.trim();
  const target = value ? new URL(value) : undefined;
  if (
    !target ||
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    target.pathname !== "/portal_vetneb_ci"
  ) {
    throw new Error(
      `GLOBAL-SEARCH-CURSOR-DB requiere ${name} apuntando a la DB aislada portal_vetneb_ci`,
    );
  }
}

const { db, closeDbConnection, pgClient } = await import("../../../server/db.ts");
const { createFastifyApp } = await import("../../../server/fastify-app.ts");
const { ENV } = await import("../../../server/lib/env.ts");
const { clinics, reports } = await import("../../../drizzle/schema.ts");
const infrastructure = await import("../../../server/features/global-search/infrastructure/index.ts");
const { parseGlobalSearchQuery, ADMIN_GLOBAL_SEARCH_KINDS } = await import(
  "../../../server/features/global-search/domain/index.ts"
);

// GLOBAL-SEARCH-3A · keyset cursor against real PostgreSQL: result sets of
// 2,000, 10,000 and 25,000 reports walked to the end through the API, ties
// down to the microsecond, accents, exact id, combined filters, cross-clinic
// and cross-surface reuse, the legacy offset window, concurrent writes during
// a walk, latency and the planner. Synthetic data, removed at the end.

type Body = {
  success: boolean;
  error?: string;
  hits: Array<{ kind: string; id: number; title: string; rank: number; target: { clinicId: number | null } }>;
  groups: Array<{ kind: string; hasMore: boolean; nextCursor: string | null }>;
};

const P95_BUDGET_MS = 750;
const PAGE = 25;
const datasets = [
  { label: "lote2k", size: 2_000 },
  { label: "lote10k", size: 10_000 },
  { label: "lote25k", size: 25_000 },
] as const;

function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

test("GLOBAL-SEARCH-CURSOR-DB: el cursor recorre 2k/10k/25k completos, aislado, estable y dentro del presupuesto", async (t) => {
  const suffix = `${process.pid}-${Date.now()}`;
  const clinicIds: number[] = [];

  t.after(async () => {
    try {
      if (clinicIds.length > 0) await db.delete(clinics).where(inArray(clinics.id, clinicIds));
    } finally {
      await closeDbConnection();
    }
  });

  for (const label of ["A", "B"]) {
    const [clinic] = await pgClient<{ id: number }[]>`
      insert into clinics (clinic_id, name)
      values (${`gcursor-${label}-${suffix}`}, ${`GCURSOR Clinica ${label} ${suffix}`})
      returning id
    `;
    assert.ok(clinic);
    clinicIds.push(clinic.id);
  }
  const [clinicA, clinicB] = clinicIds as [number, number];

  // Timestamps repeat every 13 rows (ties broken by id) and carry distinct
  // microseconds inside the same millisecond for the first 9 of each block.
  for (const { label, size } of datasets) {
    await pgClient`
      insert into reports (clinic_id, patient_name, file_name, study_type, current_status, storage_path, created_at, upload_date)
      select ${clinicA},
             case when g % 50 = 0 then 'Ñandú ' || ${label} || ' ' || g else 'Paciente ' || ${label} || ' ' || g end,
             ${label} || '-' || g || '.pdf',
             case when g % 2 = 0 then 'citologia' else 'histopatologia' end,
             (array['uploaded','processing','ready','delivered'])[1 + g % 4],
             'synthetic/gcursor/' || ${suffix} || '/' || ${label} || '/' || g,
             timestamp '2026-01-01 00:00:00' + ((g / 13) || ' seconds')::interval + ((g % 13) % 9 || ' microseconds')::interval,
             timestamp '2026-01-01 00:00:00' + ((g / 13) || ' seconds')::interval
      from generate_series(1, ${size}) g`;
  }
  // Clinic B homonyms of every set: never part of clinic A's walk.
  await pgClient`
    insert into reports (clinic_id, patient_name, storage_path, created_at)
    select ${clinicB}, 'Paciente lote2k ' || g, 'synthetic/gcursor/' || ${suffix} || '/B/' || g, now()
    from generate_series(1, 300) g`;
  await pgClient`analyze reports`;

  const future = new Date("2099-01-01T00:00:00.000Z");
  const app = await createFastifyApp({
    clinicGlobalSearchRoutes: {
      deleteActiveSession: async () => {},
      getActiveSessionByToken: async (hash) =>
        hash === "hash:a" || hash === "hash:b"
          ? { clinicUserId: hash === "hash:a" ? 1 : 2, expiresAt: future, lastAccess: new Date() }
          : null,
      getClinicUserById: async (id) => ({ id, clinicId: id === 1 ? clinicA : clinicB, username: `u${id}`, role: "clinic_staff" }),
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

  const clinicACookie = `${ENV.cookieName}=a`;
  const clinicBCookie = `${ENV.cookieName}=b`;
  const adminCookie = `${ENV.adminCookieName}=admin`;

  const get = async (url: string, cookie: string) => {
    const started = performance.now();
    const response = await app.inject({ method: "GET", url, headers: { cookie } });
    return { response, body: response.json<Body>(), ms: performance.now() - started };
  };

  const followCursor = async (base: string, cookie: string, onPage?: (page: number) => Promise<void>) => {
    const ids: number[] = [];
    const latencies: number[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 5_000; page += 1) {
      const { response, body, ms } = await get(cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base, cookie);
      assert.equal(response.statusCode, 200, body.error ?? "unexpected status");
      assert.match(String(response.headers["cache-control"]), /no-store/);
      latencies.push(ms);
      ids.push(...body.hits.map((hit) => hit.id));
      const group = body.groups.find((entry) => entry.kind === "report");
      assert.equal(Boolean(group?.nextCursor), Boolean(group?.hasMore));
      cursor = group?.nextCursor ?? null;
      if (!cursor) break;
      await onPage?.(page);
    }
    return { ids, latencies };
  };

  /** The server order of the contract, read straight from SQL. */
  const expectedIds = async (label: string) => {
    const rows = await pgClient<{ id: number }[]>`
      select id from reports
      where clinic_id = ${clinicA} and patient_name ilike ${`%${label} %`}
      order by created_at desc, id desc`;
    return rows.map((row) => row.id);
  };

  const timings: Record<string, { pages: number; p50: number; p95: number }> = {};

  // 1-4: every set walked to its end, beyond 525, same order as SQL, no
  // duplicate, no omission, never clinic B.
  for (const { label, size } of datasets) {
    const { ids, latencies } = await followCursor(`/api/search?q=${label}&kinds=report&limit=${PAGE}`, clinicACookie);
    const expected = await expectedIds(label);
    assert.equal(new Set(expected).size, size, `${label}: the seeded set`);
    assert.ok(ids.length > 525);
    assert.deepEqual(ids, expected, `${label}: identical to the SQL order, end to end`);
    assert.equal(new Set(ids).size, ids.length, `${label}: no duplicates`);
    timings[label] = {
      pages: latencies.length,
      p50: Number(percentile(latencies, 50).toFixed(1)),
      p95: Number(percentile(latencies, 95).toFixed(1)),
    };
    assert.ok(timings[label].p95 < P95_BUDGET_MS, `${label}: p95 ${timings[label].p95} ms`);
  }
  t.diagnostic(`cursor walk latency per page (ms): ${JSON.stringify(timings)}`);

  // 4 (compat): the first 525 by offset are exactly the first 525 by cursor.
  const byOffset: number[] = [];
  for (let offset = 0; offset <= 500; offset += PAGE) {
    const { body } = await get(`/api/search?q=lote2k&kinds=report&limit=${PAGE}&offset=${offset}`, clinicACookie);
    byOffset.push(...body.hits.map((hit) => hit.id));
  }
  assert.deepEqual(byOffset, (await expectedIds("lote2k")).slice(0, byOffset.length));
  assert.equal((await get(`/api/search?q=lote2k&kinds=report&limit=${PAGE}&offset=525`, clinicACookie)).response.statusCode, 400);

  // 5: microsecond ties inside one millisecond keep their exact order.
  const microTies = await pgClient<{ n: number }[]>`
    select count(*)::int as n from (
      select date_trunc('milliseconds', created_at) as ms, count(*) from reports
      where clinic_id = ${clinicA} and patient_name ilike '%lote2k %'
      group by 1 having count(distinct created_at) > 1) groups`;
  assert.ok((microTies[0]?.n ?? 0) > 0, "the dataset really holds distinct microseconds in one millisecond");

  // 6: accents and case are folded on both sides.
  const accented = await followCursor(`/api/search?q=${encodeURIComponent("NANDU LOTE2K")}&kinds=report&limit=${PAGE}`, clinicACookie);
  const accentedExpected = await pgClient<{ id: number }[]>`
    select id from reports where clinic_id = ${clinicA} and patient_name like 'Ñandú lote2k %'
    order by created_at desc, id desc`;
  assert.deepEqual(accented.ids, accentedExpected.map((row) => row.id), "the 40 «Ñandú» rows, found without the accent");

  // 7: an exact id ranks first.
  const target = (await expectedIds("lote10k"))[7_777]!;
  const exact = await get(`/api/search?q=%23${target}&kinds=report&limit=5`, clinicACookie);
  assert.equal(exact.body.hits[0]?.id, target);
  assert.equal(exact.body.hits[0]?.rank, 0);

  // 8: combined filters walked by cursor return exactly the SQL set.
  const filtered = await followCursor(
    `/api/search?q=lote10k&status=ready&studyType=citologia&from=2026-01-01&to=2026-01-02&limit=${PAGE}`,
    clinicACookie,
  );
  const filteredExpected = await pgClient<{ id: number }[]>`
    select id from reports
    where clinic_id = ${clinicA} and patient_name ilike '%lote10k %' and current_status = 'ready'
      and study_type = 'citologia' and created_at >= '2026-01-01' and created_at < '2026-01-03'
    order by created_at desc, id desc`;
  assert.deepEqual(filtered.ids, filteredExpected.map((row) => row.id));

  // 9-11: forged, cross-clinic, cross-surface and wrong-session cursors.
  const first = await get(`/api/search?q=lote2k&kinds=report&limit=${PAGE}`, clinicACookie);
  const cursor = encodeURIComponent(first.body.groups[0]?.nextCursor ?? "");
  const forged = cursor.slice(0, 20) + (cursor[20] === "A" ? "B" : "A") + cursor.slice(21);
  const rejections = await Promise.all([
    get(`/api/search?q=lote2k&kinds=report&limit=${PAGE}&cursor=${forged}`, clinicACookie),
    get(`/api/search?q=lote2k&kinds=report&limit=${PAGE}&cursor=${cursor}`, clinicBCookie),
    get(`/api/admin/search?q=lote2k&kinds=report&limit=${PAGE}&cursor=${cursor}`, adminCookie),
    get(`/api/admin/search?q=lote2k&kinds=report&limit=${PAGE}&cursor=${cursor}`, clinicACookie),
  ]);
  assert.deepEqual(rejections.map(({ response }) => response.statusCode), [400, 400, 400, 401]);
  assert.equal(JSON.stringify(rejections[1].body).includes("lote2k"), false, "a rejection discloses no row of clinic A");
  // Clinic B walking its own homonyms never meets clinic A rows.
  const clinicBWalk = await followCursor(`/api/search?q=lote2k&kinds=report&limit=${PAGE}`, clinicBCookie);
  const clinicBRows = await db.select({ id: reports.id }).from(reports).where(eq(reports.clinicId, clinicB));
  assert.deepEqual([...clinicBWalk.ids].sort((a, b) => a - b), clinicBRows.map((row) => row.id).sort((a, b) => a - b));

  // 13: concurrent writes during a walk. Keyset guarantees, without a snapshot:
  //  - a row inserted BEFORE the cursor position is not seen;
  //  - a row inserted AFTER it is seen once;
  //  - a row deleted ahead is simply absent and shifts nothing;
  //  - a row whose sort key moves across the cursor can be missed or repeated.
  const expectedBefore = await expectedIds("lote2k");
  const moveAhead = expectedBefore[1_500]!;
  const moveBack = expectedBefore[10]!;
  const deleteAhead = expectedBefore[1_200]!;
  let newest = 0;
  let oldest = 0;
  const concurrent = await followCursor(`/api/search?q=lote2k&kinds=report&limit=${PAGE}`, clinicACookie, async (page) => {
    if (page !== 3) return;
    const [inserted] = await pgClient<{ newest: number; oldest: number }[]>`
      with a as (
        insert into reports (clinic_id, patient_name, storage_path, created_at)
        values (${clinicA}, 'Paciente lote2k nuevo-reciente', 'synthetic/gcursor/new-1', timestamp '2027-01-01'),
               (${clinicA}, 'Paciente lote2k nuevo-antiguo', 'synthetic/gcursor/new-2', timestamp '2020-01-01')
        returning id, created_at)
      select max(id) filter (where created_at > '2026-06-01')::int as newest,
             max(id) filter (where created_at < '2026-06-01')::int as oldest from a`;
    newest = inserted!.newest;
    oldest = inserted!.oldest;
    await db.delete(reports).where(eq(reports.id, deleteAhead));
    await db.update(reports).set({ createdAt: sql`timestamp '2027-02-01'` }).where(eq(reports.id, moveAhead));
    await db.update(reports).set({ createdAt: sql`timestamp '2019-01-01'` }).where(eq(reports.id, moveBack));
  });
  const seenOnce = (id: number) => concurrent.ids.filter((value) => value === id).length;
  assert.equal(seenOnce(newest), 0, "inserted before the cursor: not seen");
  assert.equal(seenOnce(oldest), 1, "inserted after the cursor: seen once");
  assert.equal(seenOnce(deleteAhead), 0, "deleted ahead: absent");
  assert.equal(seenOnce(moveAhead), 0, "moved before the cursor: missed (no snapshot)");
  assert.equal(seenOnce(moveBack), 2, "moved after the cursor: repeated (no snapshot)");
  const untouched = expectedBefore.filter((id) => ![deleteAhead, moveAhead, moveBack].includes(id));
  assert.deepEqual(
    concurrent.ids.filter((id) => untouched.includes(id)),
    untouched,
    "every unchanged row is seen exactly once, in order",
  );

  // 14: planner and timing of a first page, a deep keyset page and the
  // deepest legacy offset page of the 25k set.
  const criteria = (query: Record<string, unknown>) => {
    const parsed = parseGlobalSearchQuery(query, ADMIN_GLOBAL_SEARCH_KINDS);
    assert.ok(parsed.ok);
    return parsed.criteria;
  };
  const deepRows = await pgClient<{ id: number; sort_key: string }[]>`
    select id, created_at::text as sort_key from reports
    where clinic_id = ${clinicA} and patient_name ilike '%lote25k %'
    order by created_at desc, id desc offset 20000 limit 1`;
  const deep = { rank: 3, sortKey: deepRows[0]!.sort_key, id: deepRows[0]!.id };
  const plans: Record<string, string[]> = {};
  for (const [label, built] of [
    ["first page", infrastructure.buildReportSearchQuery(db, criteria({ q: "lote25k", kinds: "report", limit: "25" }), clinicA)],
    ["keyset after 20000", infrastructure.buildReportSearchQuery(db, { ...criteria({ q: "lote25k", kinds: "report", limit: "25" }), after: deep }, clinicA)],
    ["offset 500", infrastructure.buildReportSearchQuery(db, criteria({ q: "lote25k", kinds: "report", limit: "25", offset: "500" }), clinicA)],
    ["admin unscoped keyset", infrastructure.buildReportSearchQuery(db, { ...criteria({ q: "lote25k", kinds: "report", limit: "25" }), after: deep }, null)],
  ] as const) {
    const query = built.toSQL();
    const plan = await pgClient.unsafe(`EXPLAIN (ANALYZE, BUFFERS) ${query.sql}`, query.params as never[]);
    plans[label] = plan
      .map((line) => String(line["QUERY PLAN"]))
      .filter((line) => /Scan|Sort|Limit|Execution Time|Buffers: shared/.test(line))
      .map((line) => line.trim());
  }
  t.diagnostic(`EXPLAIN ANALYZE: ${JSON.stringify(plans)}`);
});
