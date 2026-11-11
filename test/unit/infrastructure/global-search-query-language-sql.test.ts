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

function matchPredicate(kind: keyof typeof BUILDERS, q: string): { predicate: string; params: unknown[] } {
  const { where, params } = whereOf(BUILDERS[kind](db, criteria({ q }), 9));
  // The rank expression (ORDER BY) also reads the title column: only the WHERE is inspected.
  return { predicate: where.slice(0, where.indexOf(" order by ")), params };
}

const trimmed = (column: string) => `nullif(btrim(${column}::text, $`;

test("SQL lenguaje: title: sólo toca las columnas de título de cada entidad", () => {
  const titleOnly = {
    particular_token: ['"particular_tokens"."pet_name"'],
    clinic: ['"clinics"."name"'],
    clinic_user: ['"clinic_users"."username"'],
  } as const;
  const notTitle = [
    '"reports"."file_name"',
    '"reports"."study_type"',
    '"particular_tokens"."tutor_last_name"',
    '"particular_tokens"."token_last4"',
    '"clinics"."contact_email"',
  ];

  for (const [kind, columns] of Object.entries(titleOnly)) {
    const { predicate } = matchPredicate(kind as keyof typeof BUILDERS, "title:luna");
    const matchPart = predicate.slice(predicate.indexOf(" and (") + 5);
    for (const column of columns) {
      assert.equal(matchPart.includes(`immutable_unaccent(coalesce(${column}::text, ''))`), true, `${kind} ${column}`);
    }
    for (const column of notTitle) {
      assert.equal(matchPart.includes(column), false, `${kind} no debe mirar ${column} con title:`);
    }
  }
});

test("SQL lenguaje: title: de un informe coincide con el título visible (nombre del paciente, o el archivo si está vacío)", () => {
  const { predicate, params } = matchPredicate("report", "title:Luna");

  assert.equal(predicate.includes(trimmed('"reports"."patient_name"')), true);
  assert.equal(predicate.includes(trimmed('"reports"."file_name"')), true);
  assert.equal(predicate.includes("coalesce(nullif(btrim("), true, "primer valor no vacío, como mapReport");
  // patient_name goes first: a named patient keeps being the title even if the file name also matches.
  assert.equal(
    predicate.indexOf('"reports"."patient_name"') < predicate.indexOf('"reports"."file_name"'),
    true,
  );
  assert.equal(predicate.includes('"reports"."study_type"'), false, "el tipo de estudio no es título");
  assert.equal(params.includes("%Luna%"), true);
  const blanks = params.find((value) => typeof value === "string" && value.includes("\t") && value.includes("\u00a0"));
  assert.equal(typeof blanks, "string", "los caracteres en blanco de trim() (incluido NBSP) viajan como parámetro");
  assert.equal((blanks as string).includes("\ufeff") && (blanks as string).includes("\u3000"), true);
});

test("SQL lenguaje: title: de un seguimiento coincide con el título visible (paciente, o mascota si está vacío)", () => {
  const { predicate } = matchPredicate("tracking_case", "title:Rex");

  assert.equal(predicate.includes(trimmed('"reports"."patient_name"')), true);
  assert.equal(predicate.includes(trimmed('"particular_tokens"."pet_name"')), true);
  assert.equal(predicate.includes("coalesce(nullif(btrim("), true);
  assert.equal(predicate.includes('"particular_tokens"."tutor_last_name"'), false);
});

test("SQL lenguaje: una palabra sin title: sigue mirando todas las columnas de texto del informe", () => {
  const { predicate } = matchPredicate("report", "Luna");

  for (const column of ['"reports"."patient_name"', '"reports"."file_name"', '"reports"."study_type"']) {
    assert.equal(predicate.includes(`immutable_unaccent(coalesce(${column}::text, ''))`), true, column);
  }
  assert.equal(predicate.includes("nullif(btrim("), false, "el título visible sólo interviene con title:");
});

test("SQL lenguaje: title: con tildes, frase y OR pliega el título visible en ambos lados", () => {
  const { predicate, params } = matchPredicate("report", 'title:"Ñandú Pérez" OR title:luna');

  assert.equal(predicate.includes("immutable_unaccent(coalesce((coalesce(nullif(btrim("), true);
  assert.equal(predicate.includes("ILIKE immutable_unaccent($"), true);
  assert.equal(params.includes("%Ñandú Pérez%") && params.includes("%luna%"), true);
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

test("A3 SQL: una consulta sólo de filtros conserva el tenant primero, no agrega ILIKE y ordena por expresión", () => {
  const built = whereOf(infrastructure.buildReportSearchQuery(db, criteria({ q: "type:informe after:2026-01-01" }), 5));
  assert.match(built.where, /^ where \("reports"\."clinic_id" = \$\d+ and true and "reports"\."created_at" >= \$\d+\)/);
  assert.equal(likeCount(built.sql), 0, "ningún término de texto en el SQL");
  assert.match(built.sql, /order by \(3\)::int, "reports"\."created_at" desc, "reports"\."id" desc/);
});

test("A3 SQL: sólo filtros funciona en todas las entidades sin romper el tenant", () => {
  for (const kind of Object.keys(BUILDERS) as (keyof typeof BUILDERS)[]) {
    const built = whereOf(BUILDERS[kind](db, criteria({ q: "type:informe" }), 9));
    assert.ok(built.where.startsWith(` where (${TENANT_COLUMN[kind]} = $`), `${kind}: tenant primero`);
    assert.equal(likeCount(built.sql), 0, kind);
  }
});

test("A5 SQL: status, study y fechas del texto llegan como parámetros del informe", () => {
  const built = whereOf(
    infrastructure.buildReportSearchQuery(
      db,
      criteria({ q: "luna status:ready study:histopatologia after:2026-01-01 before:2026-02-01" }),
      5,
    ),
  );
  assert.match(built.where, /"reports"\."current_status" = \$\d+/);
  assert.match(built.where, /"reports"\."study_type" = \$\d+/);
  assert.match(built.where, /"reports"\."created_at" >= \$\d+/);
  assert.match(built.where, /"reports"\."created_at" <= \$\d+/);
  assert.equal(built.params.includes("ready"), true);
  assert.equal(built.params.includes("histopatologia"), true);
  assert.equal(built.sql.includes("ready"), false, "el valor nunca se interpola en el SQL");
});
