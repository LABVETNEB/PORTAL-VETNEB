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
  assert.ok(parsed.ok, JSON.stringify(parsed));
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

function whereOf(query: { toSQL(): { sql: string; params: unknown[] } }) {
  const built = query.toSQL();
  return { where: built.sql.slice(built.sql.indexOf(" where ")), params: built.params, sql: built.sql };
}

function likeCount(where: string): number {
  return where.split("ILIKE immutable_unaccent(").length - 1;
}

const REPORT = (q: string, clinicId: number | null = 5) =>
  whereOf(infrastructure.buildReportSearchQuery(db, criteria({ q }), clinicId));

test("SQL lenguaje: una palabra genera el mismo predicado que antes (sin AND/OR extra)", () => {
  const { where } = REPORT("Pérez");
  assert.equal(likeCount(where) >= 3, true, "tres columnas de texto del informe");
  assert.equal(where.includes(") or ("), false);
  assert.match(where, /^ where \("reports"\."clinic_id" = \$\d+ and \(/);
});

test("SQL lenguaje: palabras sueltas se unen con AND y cada una viaja como parámetro", () => {
  const { where, params } = REPORT("luna perez");
  assert.equal(params.includes("%luna%"), true);
  assert.equal(params.includes("%perez%"), true);
  assert.equal(params.includes("%luna perez%"), false, "ya no se exige la frase contigua");
  assert.equal(likeCount(where) >= 6, true, "tres columnas por cada palabra");
  // (cols de luna) AND (cols de perez): dos grupos OR por columna unidos por AND.
  assert.equal(where.includes("ESCAPE '\\') and (immutable_unaccent("), true);
});

test("SQL lenguaje: una frase entre comillas es un único patrón contiguo", () => {
  const { params } = REPORT('"luna perez"');
  assert.equal(params.includes("%luna perez%"), true);
  assert.equal(params.includes("%luna%"), false);
});

test("SQL lenguaje: OR une alternativas dentro del predicado del tenant", () => {
  const { where, params } = REPORT("luna OR rex");
  assert.equal(params.includes("%luna%") && params.includes("%rex%"), true);
  assert.match(where, /^ where \("reports"\."clinic_id" = \$\d+ and \(/, "el tenant sigue siendo el primer predicado");
  assert.equal(where.includes(" or "), true);
});

test("SQL lenguaje: title: sólo toca las columnas de título de cada entidad", () => {
  const titleOnly = {
    report: ['"reports"."patient_name"'],
    particular_token: ['"particular_tokens"."pet_name"'],
    tracking_case: ['"reports"."patient_name"', '"particular_tokens"."pet_name"'],
    clinic: ['"clinics"."name"'],
    clinic_user: ['"clinic_users"."username"'],
  } as const;
  const notTitle = ['"reports"."file_name"', '"reports"."study_type"', '"particular_tokens"."tutor_last_name"', '"particular_tokens"."token_last4"', '"clinics"."contact_email"'];

  for (const [kind, build] of Object.entries(BUILDERS)) {
    const { where } = whereOf(build(db, criteria({ q: "title:luna" }), 9));
    const folded = where.slice(0, where.indexOf("order by") === -1 ? undefined : where.indexOf("order by"));
    for (const column of titleOnly[kind as keyof typeof titleOnly]) {
      assert.equal(folded.includes(`immutable_unaccent(coalesce(${column}::text, ''))`), true, `${kind} ${column}`);
    }
    // Ranking reads the title column too, so only the match predicate is inspected.
    const predicate = folded.slice(0, folded.indexOf(" order by ") === -1 ? undefined : folded.indexOf(" order by "));
    const matchPart = predicate.slice(predicate.indexOf(" and (") === -1 ? 0 : predicate.indexOf(" and ("));
    for (const column of notTitle) {
      assert.equal(matchPart.includes(column), false, `${kind} no debe mirar ${column} con title:`);
    }
  }
});

test("SQL lenguaje: title: con número no agrega la igualdad por id", () => {
  const { params } = REPORT("title:812");
  assert.equal(params.includes(812), false);
  assert.equal(params.includes("%812%"), true);
});

test("SQL lenguaje: un número desnudo dentro de un AND suma la igualdad por id de ese término", () => {
  const { sql, params } = REPORT("luna #812");
  assert.equal(params.includes(812), true);
  assert.equal(params.includes("%luna%"), true);
  assert.equal(sql.includes('WHEN "reports"."id" = $'), false, "el rank por id exige que sea el único término");
});

test("SQL lenguaje: el rank de una consulta simple multi-palabra usa el texto completo", () => {
  const { params } = REPORT("Luna Pérez");
  assert.equal(params.includes("Luna Pérez"), true, "patrón exacto");
  assert.equal(params.includes("Luna Pérez%"), true, "patrón de prefijo");
});

test("SQL lenguaje: con operadores el rank sigue al primer término", () => {
  const { params } = REPORT('"Luna Pérez" OR rex');
  assert.equal(params.includes("Luna Pérez"), true);
  assert.equal(params.includes("Luna Pérez%"), true);
  assert.equal(params.includes("%rex%"), true);
});

test("SQL lenguaje: en toda entidad el tenant es el primer predicado, con cualquier operador", () => {
  for (const q of ["luna perez", 'type:informe "luna perez"', "luna OR rex", "title:luna rex"]) {
    for (const [kind, build] of Object.entries(BUILDERS)) {
      const { where } = whereOf(build(db, criteria({ q }), 41));
      const column = TENANT_COLUMN[kind as keyof typeof TENANT_COLUMN];
      assert.equal(where.startsWith(` where (${column} = $`), true, `${kind} ${q}: ${where.slice(0, 80)}`);
    }
  }
});

test("SQL lenguaje: texto hostil en frases, title: y OR nunca llega al SQL, sólo a parámetros", () => {
  const hostile = `"x'); DROP TABLE reports; --" OR title:"y' OR '1'='1" 100%_`;
  for (const [kind, build] of Object.entries(BUILDERS)) {
    const { sql, params } = whereOf(build(db, criteria({ q: hostile }), 3));
    assert.equal(sql.includes("DROP TABLE"), false, kind);
    assert.equal(sql.includes("1'='1"), false, kind);
    assert.equal(params.includes("%x'); DROP TABLE reports; --%"), true, kind);
    assert.equal(params.includes("%y' OR '1'='1%"), true, kind);
    assert.equal(params.includes("%100\\%\\_%"), true, kind);
  }
});

test("SQL lenguaje: tildes, eñes y mayúsculas se pliegan en ambos lados con operadores", () => {
  const { where, params } = REPORT('"ÑANDÚ" OR title:Pérez');
  assert.equal(where.includes("ILIKE immutable_unaccent($"), true);
  assert.equal(params.includes("%ÑANDÚ%") && params.includes("%Pérez%"), true);
});

test("SQL lenguaje: el cursor y el offset conviven con el predicado de operadores", () => {
  const paged = whereOf(
    infrastructure.buildReportSearchQuery(db, criteria({ q: "luna OR rex", kinds: "report", offset: "20" }), 5),
  );
  assert.equal(paged.sql.includes("offset"), true);

  const parsed = parseGlobalSearchQuery({ q: "luna perez", kinds: "report" }, ADMIN_GLOBAL_SEARCH_KINDS);
  assert.ok(parsed.ok);
  const keyset = whereOf(
    infrastructure.buildReportSearchQuery(
      db,
      { ...parsed.criteria, after: { rank: 3, sortKey: "2026-01-02 03:04:05.123456", id: 9 } },
      5,
    ),
  );
  assert.equal(keyset.params.includes("2026-01-02 03:04:05.123456"), true);
  assert.equal(keyset.params.includes("%luna%") && keyset.params.includes("%perez%"), true);
  assert.match(keyset.sql, /order by .* desc, "reports"\."id" desc/);
});

test("SQL lenguaje: la proyección sigue sin hashes ni rutas con cualquier operador", () => {
  for (const [kind, build] of Object.entries(BUILDERS)) {
    const { sql } = whereOf(build(db, criteria({ q: 'a OR "b c" title:d' }), null));
    const projection = sql.slice(0, sql.indexOf(" from "));
    for (const forbidden of ["password_hash", "token_hash", "storage_path", "download_url"]) {
      assert.equal(sql.includes(forbidden), false, `${kind} ${forbidden}`);
    }
    assert.equal(projection.includes("*"), false, kind);
  }
});
