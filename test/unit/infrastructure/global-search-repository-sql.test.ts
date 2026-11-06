import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { db } = await import("../../../server/db.ts");
const infrastructure = await import(
  "../../../server/features/global-search/infrastructure/index.ts"
);
const { parseGlobalSearchQuery, ADMIN_GLOBAL_SEARCH_KINDS } = await import(
  "../../../server/features/global-search/domain/index.ts"
);

function criteria(query: Record<string, unknown>) {
  const parsed = parseGlobalSearchQuery(query, ADMIN_GLOBAL_SEARCH_KINDS);
  assert.ok(parsed.ok);
  return parsed.criteria;
}

const BUILDERS = {
  report: infrastructure.buildReportSearchQuery,
  particular_token: infrastructure.buildParticularTokenSearchQuery,
  tracking_case: infrastructure.buildTrackingCaseSearchQuery,
  clinic: infrastructure.buildClinicSearchQuery,
  clinic_user: infrastructure.buildClinicUserSearchQuery,
} as const;

const TENANT_COLUMN = {
  report: '"reports"."clinic_id"',
  particular_token: '"particular_tokens"."clinic_id"',
  tracking_case: '"study_tracking_cases"."clinic_id"',
  clinic: '"clinics"."id"',
  clinic_user: '"clinic_users"."clinic_id"',
} as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const forbiddenColumns = [
  "password_hash",
  "token_hash",
  "storage_path",
  "preview_url",
  "download_url",
  "payment_url",
  "auth_pro_id",
  '"notes"',
  "admin_contact_email",
  "detail_lesion",
  "details_lesion",
];

test("global search SQL: el tenant es el primer predicado parametrizado de cada entidad", () => {
  for (const [kind, build] of Object.entries(BUILDERS)) {
    const query = build(db, criteria({ q: "Pérez" }), 41).toSQL();
    const where = query.sql.slice(query.sql.indexOf(" where "));
    const column = TENANT_COLUMN[kind as keyof typeof TENANT_COLUMN];
    const tenant = new RegExp(`^ where \\(${escapeRegExp(column)} = \\$(\\d+) and `).exec(where);

    assert.ok(tenant, `${kind}: ${where}`);
    assert.equal(
      query.params[Number(tenant[1]) - 1],
      41,
      `${kind} liga el clinicId de la sesión como parámetro`,
    );
  }
});

test("global search SQL: sin scope no se agrega predicado de tenant (sólo superficie admin)", () => {
  const query = infrastructure.buildReportSearchQuery(db, criteria({ q: "rex" }), null).toSQL();
  assert.equal(query.sql.includes('"reports"."clinic_id" = $'), false);
});

test("global search SQL: el texto del usuario viaja sólo como parámetro escapado", () => {
  const hostile = "x'); DROP TABLE reports; -- 50%_";

  for (const [kind, build] of Object.entries(BUILDERS)) {
    const query = build(db, criteria({ q: hostile }), 7).toSQL();

    assert.equal(query.sql.includes("DROP TABLE"), false, kind);
    assert.ok(query.sql.includes("ILIKE immutable_unaccent($"), kind);
    assert.ok(query.sql.includes("ESCAPE '\\'"), kind);
    assert.ok(
      query.params.includes("%x'); DROP TABLE reports; -- 50\\%\\_%"),
      `${kind} liga el patrón contains escapado`,
    );
  }
});

test("global search SQL: la búsqueda pliega tildes y mayúsculas en ambos lados", () => {
  const query = infrastructure.buildReportSearchQuery(db, criteria({ q: "ÑANDÚ" }), 3).toSQL();
  assert.ok(query.sql.includes(`immutable_unaccent(coalesce("reports"."patient_name"::text, '')) ILIKE immutable_unaccent($`));
  assert.ok(query.params.includes("%ÑANDÚ%"));
});

test("global search SQL: proyección explícita sin hashes, rutas de storage, URLs ni notas", () => {
  for (const [kind, build] of Object.entries(BUILDERS)) {
    const sqlText = build(db, criteria({ q: "rex" }), null).toSQL().sql;
    const projection = sqlText.slice(0, sqlText.indexOf(" from "));

    for (const column of forbiddenColumns) {
      assert.equal(sqlText.includes(column), false, `${kind} no debe leer ${column}`);
    }
    assert.equal(projection.includes("*"), false, `${kind} no usa select *`);
  }
});

test("global search SQL: los joins de seguimiento exigen la misma clínica del caso", () => {
  const sqlText = infrastructure
    .buildTrackingCaseSearchQuery(db, criteria({ q: "rex" }), 5)
    .toSQL().sql;

  assert.ok(
    sqlText.includes(
      'left join "reports" on ("reports"."id" = "study_tracking_cases"."report_id" and "reports"."clinic_id" = "study_tracking_cases"."clinic_id")',
    ),
  );
  assert.ok(
    sqlText.includes(
      'left join "particular_tokens" on ("particular_tokens"."id" = "study_tracking_cases"."particular_token_id" and "particular_tokens"."clinic_id" = "study_tracking_cases"."clinic_id")',
    ),
  );
});

test("global search SQL: id numérico suma coincidencia exacta y rango 0", () => {
  const query = infrastructure.buildReportSearchQuery(db, criteria({ q: "#812" }), 2).toSQL();
  assert.ok(query.sql.includes('WHEN "reports"."id" = $'));
  assert.ok(query.params.includes(812));
});

test("global search SQL: limit+1 para hasMore, offset y orden estable", () => {
  const query = infrastructure
    .buildReportSearchQuery(db, criteria({ q: "rex", kinds: "report", limit: "20", offset: "40" }), 2)
    .toSQL();

  assert.match(query.sql, /order by \(CASE .* END\), "reports"."created_at" desc, "reports"."id" desc limit \$\d+ offset \$\d+$/);
  assert.equal(query.params.at(-2), 21);
  assert.equal(query.params.at(-1), 40);
});

test("global search SQL: filtros de informe se aplican del lado del servidor", () => {
  const query = infrastructure
    .buildReportSearchQuery(
      db,
      criteria({ q: "rex", status: "ready", studyType: "citologia", from: "2026-01-01", to: "2026-01-31" }),
      2,
    )
    .toSQL();

  assert.ok(query.sql.includes('"reports"."current_status" = $'));
  assert.ok(query.sql.includes('"reports"."study_type" = $'));
  assert.ok(query.sql.includes('"reports"."created_at" >= $'));
  assert.ok(query.sql.includes('"reports"."created_at" <= $'));
  assert.ok(query.params.includes("ready"));
  assert.ok(query.params.includes("citologia"));
});

// ── GLOBAL-SEARCH-3A · keyset predicate ─────────────────────────────────────

const SORT_COLUMN = {
  report: '"reports"."created_at"',
  particular_token: '"particular_tokens"."created_at"',
  tracking_case: '"study_tracking_cases"."reception_at"',
  clinic: '"clinics"."updated_at"',
  clinic_user: '"clinic_users"."updated_at"',
} as const;

const ID_COLUMN = {
  report: '"reports"."id"',
  particular_token: '"particular_tokens"."id"',
  tracking_case: '"study_tracking_cases"."id"',
  clinic: '"clinics"."id"',
  clinic_user: '"clinic_users"."id"',
} as const;

test("global search SQL: el cursor agrega un predicado keyset parametrizado y anula el offset", () => {
  const after = { rank: 2, sortKey: "2026-01-02 03:04:05.123456", id: 77 };
  for (const [kind, build] of Object.entries(BUILDERS)) {
    const key = kind as keyof typeof SORT_COLUMN;
    const base = criteria({ q: "rex", kinds: kind, limit: "10" });
    const plain = build(db, base, 41).toSQL();
    const keyed = build(db, { ...base, after }, 41).toSQL();

    assert.equal(plain.sql.includes("::timestamp"), false, `${kind}: no keyset without a cursor`);
    const sortColumn = escapeRegExp(SORT_COLUMN[key]);
    const idColumn = escapeRegExp(ID_COLUMN[key]);
    const keyset = new RegExp(
      `\\(\\(CASE .*? END\\) > \\$(\\d+) OR \\(\\(CASE .*? END\\) = \\$(\\d+) AND \\(${sortColumn}, ${idColumn}\\) < \\(\\$(\\d+)::timestamp, \\$(\\d+)\\)\\)\\)`,
    ).exec(keyed.sql);
    assert.ok(keyset, `${kind}: ${keyed.sql}`);
    assert.deepEqual(
      [keyset[1], keyset[2], keyset[3], keyset[4]].map((index) => keyed.params[Number(index) - 1]),
      [2, 2, after.sortKey, 77],
      `${kind}: every cursor value is a bound parameter`,
    );
    assert.ok(
      new RegExp(`^ where \\(${escapeRegExp(TENANT_COLUMN[key])} = \\$\\d+ and `).test(keyed.sql.slice(keyed.sql.indexOf(" where "))),
      `${kind}: the tenant stays the first predicate`,
    );
    // Single-table selects are not table-qualified by Drizzle.
    const unqualified = SORT_COLUMN[key].slice(SORT_COLUMN[key].lastIndexOf(".") + 1);
    const format = ", 'YYYY-MM-DD HH24:MI:SS.US')";
    assert.ok(
      keyed.sql.includes(`to_char(${SORT_COLUMN[key]}${format}`) || keyed.sql.includes(`to_char(${unqualified}${format}`),
      `${kind}: the exact sort key is selected in a DateStyle-independent format`,
    );
    // Drizzle drops a zero offset: a keyset page has no offset clause, or offset 0.
    const offsetClause = / offset \$(\d+)$/.exec(keyed.sql);
    assert.ok(!offsetClause || keyed.params[Number(offsetClause[1]) - 1] === 0, `${kind}: a keyset page starts at offset 0`);
    const limitClause = / limit \$(\d+)/.exec(keyed.sql);
    assert.equal(keyed.params[Number(limitClause?.[1]) - 1], 11, `${kind}: still limit + 1`);
  }
});

test("global search SQL: un cursor con texto hostil sigue siendo un parámetro", () => {
  const hostile = { rank: 3, sortKey: "2026-01-01 00:00:00'); DROP TABLE reports; --", id: 1 };
  const query = infrastructure
    .buildReportSearchQuery(db, { ...criteria({ q: "rex", kinds: "report" }), after: hostile }, 2)
    .toSQL();
  assert.equal(query.sql.includes("DROP TABLE"), false);
  assert.ok(query.params.includes(hostile.sortKey));
});
