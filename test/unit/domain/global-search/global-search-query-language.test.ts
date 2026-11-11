import test from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_GLOBAL_SEARCH_KINDS,
  CLINIC_GLOBAL_SEARCH_KINDS,
  GLOBAL_SEARCH_MAX_CLAUSES,
  GLOBAL_SEARCH_MAX_TERMS,
  buildGlobalSearchNeedle,
  globalSearchQueryUnits,
  parseGlobalSearchLanguage,
  parseGlobalSearchQuery,
} from "../../../../server/features/global-search/domain/index.ts";

function shape(text: string) {
  const language = parseGlobalSearchLanguage(text);
  assert.ok(language.ok, `${text}: ${language.ok ? "" : language.error}`);
  return {
    clauses: language.clauses.map((clause) =>
      clause.map((term) => (term.titleOnly ? `title:${term.text}` : term.text)),
    ),
    typeKinds: language.typeKinds,
    plain: language.plain,
  };
}

function rejected(text: string): string {
  const language = parseGlobalSearchLanguage(text);
  assert.equal(language.ok, false, text);
  return language.ok ? "" : language.error;
}

test("lenguaje: una consulta simple conserva su forma histórica", () => {
  assert.deepEqual(shape("luna"), { clauses: [["luna"]], typeKinds: null, plain: true });
  assert.deepEqual(shape("Ñandú"), { clauses: [["Ñandú"]], typeKinds: null, plain: true });
  assert.deepEqual(shape("#812"), { clauses: [["#812"]], typeKinds: null, plain: true });
});

test("lenguaje: las palabras sueltas son un AND implícito", () => {
  assert.deepEqual(shape("luna perez"), { clauses: [["luna", "perez"]], typeKinds: null, plain: true });
});

test("lenguaje: las comillas fijan una frase exacta y dejan de ser consulta simple", () => {
  assert.deepEqual(shape('"luna perez"'), { clauses: [["luna perez"]], typeKinds: null, plain: false });
  assert.deepEqual(shape('"luna perez" rex').clauses, [["luna perez", "rex"]]);
  assert.deepEqual(shape('""  luna').clauses, [["luna"]], "una frase vacía se ignora");
  assert.deepEqual(shape('"luna perez').clauses, [["luna perez"]], "una comilla sin cerrar llega al final");
});

test("lenguaje: OR explícito, AND liga más fuerte y sólo cuenta en mayúsculas", () => {
  assert.deepEqual(shape("luna OR rex").clauses, [["luna"], ["rex"]]);
  assert.deepEqual(shape("a1 b2 OR c3").clauses, [["a1", "b2"], ["c3"]]);
  assert.deepEqual(shape("luna or rex").clauses, [["luna", "or", "rex"]], "or en minúscula es una palabra");
  assert.deepEqual(shape('luna "OR" rex').clauses, [["luna", "OR", "rex"]], "OR entre comillas es literal");
  assert.deepEqual(shape("luna OR").clauses, [["luna"]], "un OR colgante se ignora");
  assert.deepEqual(shape("OR luna OR OR rex").clauses, [["luna"], ["rex"]], "los OR vacíos se ignoran");
});

test("lenguaje: type: elige entidades, acepta alias sin tildes y se une", () => {
  assert.deepEqual(shape("type:informe luna").typeKinds, ["report"]);
  assert.deepEqual(shape("luna TYPE:Clínica").typeKinds, ["clinic"]);
  assert.deepEqual(shape("type:token type:seguimiento rex").typeKinds, ["particular_token", "tracking_case"]);
  assert.deepEqual(shape("type:usuarios rex").typeKinds, ["clinic_user"]);
  assert.deepEqual(shape("type:informe luna").clauses, [["luna"]], "el operador no es un término");
  assert.equal(shape("type:informe luna").plain, false);
  assert.equal(rejected("type:pdf luna"), "Tipo de búsqueda inválido");
  assert.deepEqual(shape("type: luna").typeKinds, null, "type: vacío aún no tiene efecto");
});

test("lenguaje: title: limita el término al título, también como frase", () => {
  assert.deepEqual(shape("title:luna").clauses, [["title:luna"]]);
  assert.deepEqual(shape('title:"luna perez" rex').clauses, [["title:luna perez", "rex"]]);
  assert.deepEqual(shape("title:luna OR rex").clauses, [["title:luna"], ["rex"]]);
});

test("lenguaje: operadores desconocidos se rechazan; entre comillas o con forma de hora son literales", () => {
  assert.equal(rejected("foo:bar luna"), "Operador de búsqueda desconocido: foo:");
  assert.equal(rejected("owner:me luna"), "Operador de búsqueda desconocido: owner:");
  assert.equal(rejected("is:starred"), "Operador de búsqueda desconocido: is:");
  assert.deepEqual(shape('"foo:bar"').clauses, [["foo:bar"]]);
  assert.deepEqual(shape("10:30 turno").clauses, [["10:30", "turno"]]);
  assert.deepEqual(shape("TOK-A:1").clauses, [["TOK-A:1"]], "un guion no abre un operador");
  assert.deepEqual(shape("-luna").clauses, [["-luna"]], "no hay exclusión: el guion es literal");
});

test("lenguaje: sin términos ni operadores no hay consulta", () => {
  assert.equal(rejected("type:"), "La búsqueda requiere al menos un término");
  assert.equal(rejected("after:"), "La búsqueda requiere al menos un término");
  assert.equal(rejected("OR OR"), "La búsqueda requiere al menos un término");
  assert.equal(rejected('""'), "La búsqueda requiere al menos un término");
});

test("lenguaje: los límites de términos y de alternativas acotan el SQL", () => {
  const nine = Array.from({ length: GLOBAL_SEARCH_MAX_TERMS + 1 }, (_, index) => `w${index}`).join(" ");
  assert.equal(rejected(nine), "Demasiados términos de búsqueda");
  const eight = Array.from({ length: GLOBAL_SEARCH_MAX_TERMS }, (_, index) => `w${index}`).join(" ");
  assert.equal(parseGlobalSearchLanguage(eight).ok, true);

  const alternatives = Array.from({ length: GLOBAL_SEARCH_MAX_CLAUSES + 1 }, (_, index) => `w${index}`).join(" OR ");
  assert.equal(rejected(alternatives), "Demasiadas alternativas OR en la búsqueda");
});

test("lenguaje: es determinista", () => {
  const text = 'type:informe "luna perez" OR title:rex  50%';
  assert.deepEqual(parseGlobalSearchLanguage(text), parseGlobalSearchLanguage(text));
});

test("lenguaje: comodines LIKE y SQL hostil sólo producen patrones escapados", () => {
  const language = parseGlobalSearchLanguage(`50%_ "a'); DROP TABLE x; --" title:\\b`);
  assert.ok(language.ok);
  const patterns = language.clauses.flat().map((term) => term.containsPattern);
  assert.deepEqual(patterns, ["%50\\%\\_%", "%a'); DROP TABLE x; --%", "%\\\\b%"]);
});

test("lenguaje: sólo un número desnudo es un id; frases y title: nunca", () => {
  const ids = (text: string) => {
    const language = parseGlobalSearchLanguage(text);
    assert.ok(language.ok);
    return language.clauses.flat().map((term) => term.numericId);
  };
  assert.deepEqual(ids("812 luna #9"), [812, null, 9]);
  assert.deepEqual(ids('"812"'), [null]);
  assert.deepEqual(ids("title:812"), [null]);
  assert.deepEqual(ids("0 12ab"), [null, null]);
});

test("needle: la consulta simple es idéntica a la histórica (rank sobre el texto completo)", () => {
  const needle = buildGlobalSearchNeedle("Luna Pérez");
  assert.equal(needle.text, "Luna Pérez");
  assert.equal(needle.exactPattern, "Luna Pérez");
  assert.equal(needle.prefixPattern, "Luna Pérez%");
  assert.equal(needle.containsPattern, "%Luna Pérez%");
  assert.equal(needle.numericId, null);
  assert.deepEqual(needle.clauses.map((clause) => clause.map((term) => term.text)), [["Luna", "Pérez"]]);
});

test("needle: con operadores el rank sigue al primer término y el id sólo si es el único", () => {
  assert.equal(buildGlobalSearchNeedle('"Luna Pérez" OR rex').exactPattern, "Luna Pérez");
  assert.equal(buildGlobalSearchNeedle("title:rex OR luna").exactPattern, "rex");
  assert.equal(buildGlobalSearchNeedle("#812").numericId, 812);
  assert.equal(buildGlobalSearchNeedle("812 luna").numericId, null);
  assert.equal(buildGlobalSearchNeedle("title:812").numericId, null);
});

test("needle: texto que el lenguaje rechaza degrada a un único término literal", () => {
  const needle = buildGlobalSearchNeedle("foo:bar");
  assert.deepEqual(needle.clauses.map((clause) => clause.map((term) => term.text)), [["foo:bar"]]);
  assert.equal(needle.containsPattern, "%foo:bar%");
});

test("parser: type: reduce las entidades dentro de las permitidas de la superficie", () => {
  const admin = parseGlobalSearchQuery({ q: "type:usuario rex" }, ADMIN_GLOBAL_SEARCH_KINDS);
  assert.ok(admin.ok);
  assert.deepEqual(admin.kinds, ["clinic_user"]);

  const clinic = parseGlobalSearchQuery({ q: "type:token type:informe rex" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.ok(clinic.ok);
  assert.deepEqual(clinic.kinds, ["report", "particular_token"], "orden canónico, sin duplicados");

  const narrowed = parseGlobalSearchQuery({ q: "type:informe rex", kinds: "report,particular_token" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.ok(narrowed.ok);
  assert.deepEqual(narrowed.kinds, ["report"], "type: nunca amplía lo pedido en kinds");
});

test("parser: un type: fuera de la superficie o contradictorio es 400, nunca amplía el alcance", () => {
  const foreign = parseGlobalSearchQuery({ q: "type:clinica rex" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.deepEqual(foreign, { ok: false, status: 400, error: "El tipo de búsqueda no está disponible aquí" });

  const contradictory = parseGlobalSearchQuery({ q: "type:token rex", kinds: "report" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.equal(contradictory.ok, false);

  const unknown = parseGlobalSearchQuery({ q: "foo:bar" }, ADMIN_GLOBAL_SEARCH_KINDS);
  assert.deepEqual(unknown, { ok: false, status: 400, error: "Operador de búsqueda desconocido: foo:" });
});

test("parser: type: a una sola entidad habilita offset y cursor sin kinds explícito", () => {
  const paged = parseGlobalSearchQuery({ q: "type:informe rex", offset: "20" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.ok(paged.ok);
  assert.equal(paged.criteria.offset, 20);

  const several = parseGlobalSearchQuery({ q: "rex", offset: "20" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.equal(several.ok, false, "sin type: la paginación sigue exigiendo una entidad");
});

test("parser: type: y los filtros de informe se combinan sin ampliar", () => {
  const tokens = parseGlobalSearchQuery({ q: "type:token rex", status: "ready" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.deepEqual(tokens, { ok: false, status: 400, error: "Los filtros de informe requieren incluir informes" });

  const reports = parseGlobalSearchQuery({ q: "type:informe rex", status: "ready" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.ok(reports.ok);
  assert.deepEqual(reports.kinds, ["report"]);
});

test("parser: el texto completo (con operadores) es lo que ata el cursor y el eco de la consulta", () => {
  const a = parseGlobalSearchQuery({ q: "type:informe rex" }, CLINIC_GLOBAL_SEARCH_KINDS);
  const b = parseGlobalSearchQuery({ q: "type:informe luna" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.ok(a.ok && b.ok);
  assert.equal(a.criteria.needle.text, "type:informe rex");
  assert.notEqual(a.criteria.needle.text, b.criteria.needle.text);
});

function filtersOf(text: string) {
  const language = parseGlobalSearchLanguage(text);
  assert.ok(language.ok, `${text}: ${language.ok ? "" : language.error}`);
  return language;
}

test("A3 lenguaje: una consulta sólo de operadores es válida y no tiene términos", () => {
  const typeOnly = filtersOf("type:informe");
  assert.deepEqual(typeOnly.clauses, []);
  assert.deepEqual(typeOnly.typeKinds, ["report"]);
  assert.equal(typeOnly.plain, false);

  assert.equal(filtersOf("after:2026-01-01").filters.after, "2026-01-01");
  const range = filtersOf("type:informe before:2026-12-31 after:2026-01-01");
  assert.deepEqual(range.filters, { status: null, studyType: null, after: "2026-01-01", before: "2026-12-31", clinicId: null });
  assert.deepEqual(filtersOf("type:seguimiento").typeKinds, ["tracking_case"]);
});

test("A5 lenguaje: status, study, after, before y clinic con alias y normalización", () => {
  const all = filtersOf("luna ESTADO:Ready estudio:Histopatología after:2026-01-01 before:2026-02-03 clinica:12");
  assert.deepEqual(all.filters, {
    status: "ready",
    studyType: "histopatologia",
    after: "2026-01-01",
    before: "2026-02-03",
    clinicId: 12,
  });
  assert.deepEqual(all.clauses.map((clause) => clause.map((term) => term.text)), [["luna"]]);
  assert.deepEqual(
    filtersOf("luna OR rex status:delivered").clauses.map((clause) => clause.map((term) => term.text)),
    [["luna"], ["rex"]],
    "los operadores aplican a toda la consulta",
  );
  assert.equal(filtersOf("status: luna").filters.status, null, "operador sin valor todavía no tiene efecto");
});

test("A5 lenguaje: valores inválidos y fechas imposibles se rechazan con mensaje cerrado", () => {
  assert.equal(rejected("status:borrado"), "Estado de informe inválido");
  assert.equal(rejected("study:12"), "Tipo de estudio inválido");
  assert.equal(rejected("after:2026-02-30"), "Fecha de búsqueda inválida");
  assert.equal(rejected("before:ayer"), "Fecha de búsqueda inválida");
  assert.equal(rejected("clinic:abc"), "Clínica de búsqueda inválida");
  assert.equal(rejected("clinic:0"), "Clínica de búsqueda inválida");
});

test("A1 lenguaje: repetir un operador con otro valor es contradictorio; con el mismo valor se unifica", () => {
  assert.equal(rejected("status:ready status:delivered"), "Filtros contradictorios: status:");
  assert.equal(rejected("after:2026-01-01 after:2026-01-02"), "Filtros contradictorios: after:");
  assert.equal(rejected("clinic:1 clinica:2"), "Filtros contradictorios: clinica:");
  assert.equal(filtersOf("status:ready estado:READY").filters.status, "ready");
});

test("A5 lenguaje: caben los cinco filtros distintos a la vez", () => {
  assert.equal(
    filtersOf("status:ready study:abc after:2026-01-01 before:2026-02-01 clinic:3").filters.clinicId,
    3,
  );
});

test("A3 parser: sólo filtros es válido; sin filtros ni términos sigue siendo 400", () => {
  const typeOnly = parseGlobalSearchQuery({ q: "type:informe" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.ok(typeOnly.ok);
  assert.deepEqual(typeOnly.kinds, ["report"]);
  assert.deepEqual(typeOnly.criteria.needle.clauses, []);
  assert.equal(typeOnly.criteria.needle.numericId, null);

  const dated = parseGlobalSearchQuery({ q: "after:2026-01-01" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.ok(dated.ok);
  assert.deepEqual(dated.kinds, ["report"], "las fechas aplican a informes y no amplían el alcance");
  assert.equal(dated.criteria.createdFrom?.toISOString(), "2026-01-01T00:00:00.000Z");

  const empty = parseGlobalSearchQuery({ q: "OR" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.deepEqual(empty, { ok: false, status: 400, error: "La búsqueda requiere al menos un término" });
  assert.equal(parseGlobalSearchQuery({ q: "x" }, CLINIC_GLOBAL_SEARCH_KINDS).ok, false);
});

test("A5 parser: after es inclusivo desde el inicio del día UTC y before hasta su final", () => {
  const range = parseGlobalSearchQuery({ q: "luna after:2026-01-01 before:2026-12-31" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.ok(range.ok);
  assert.equal(range.criteria.createdFrom?.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(range.criteria.createdTo?.toISOString(), "2026-12-31T23:59:59.999Z");
  assert.deepEqual(range.kinds, ["report"]);
});

test("A5 parser: rangos contradictorios y filtros de informe sobre otra entidad son 400", () => {
  assert.deepEqual(parseGlobalSearchQuery({ q: "after:2026-12-31 before:2026-01-01" }, CLINIC_GLOBAL_SEARCH_KINDS), {
    ok: false,
    status: 400,
    error: "Rango de fechas inválido",
  });
  assert.deepEqual(parseGlobalSearchQuery({ q: "type:token after:2026-01-01" }, CLINIC_GLOBAL_SEARCH_KINDS), {
    ok: false,
    status: 400,
    error: "Los filtros de informe requieren incluir informes",
  });
});

test("A1 parser: texto y parámetros se combinan sólo si coinciden", () => {
  const same = parseGlobalSearchQuery({ q: "luna status:ready", status: "ready" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.ok(same.ok);
  assert.equal(same.criteria.reportStatus, "ready");

  const other = parseGlobalSearchQuery({ q: "luna status:ready", status: "delivered" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.deepEqual(other, { ok: false, status: 400, error: "Filtros de búsqueda contradictorios" });

  const dates = parseGlobalSearchQuery({ q: "luna after:2026-01-01", from: "2026-02-01" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.equal(dates.ok, false);

  const fromParam = parseGlobalSearchQuery({ q: "luna", from: "2026-02-01" }, CLINIC_GLOBAL_SEARCH_KINDS);
  assert.ok(fromParam.ok);
  assert.equal(fromParam.criteria.createdFrom?.toISOString(), "2026-02-01T00:00:00.000Z");
});

test("A5 parser: clinic: se expone como estrechamiento de Admin", () => {
  const admin = parseGlobalSearchQuery({ q: "luna clinic:7" }, ADMIN_GLOBAL_SEARCH_KINDS);
  assert.ok(admin.ok);
  assert.equal(admin.clinicId, 7);
  const plain = parseGlobalSearchQuery({ q: "luna" }, ADMIN_GLOBAL_SEARCH_KINDS);
  assert.ok(plain.ok);
  assert.equal(plain.clinicId, null);
});

test("unidades de tasa: una consulta de filtros cuenta sus entidades", () => {
  assert.equal(globalSearchQueryUnits({ q: "type:informe" }, ADMIN_GLOBAL_SEARCH_KINDS), 1);
  assert.equal(globalSearchQueryUnits({ q: "after:2026-01-01" }, ADMIN_GLOBAL_SEARCH_KINDS), 1);
});

test("unidades de tasa: type: cuenta sólo las entidades que realmente consulta", () => {
  assert.equal(globalSearchQueryUnits({ q: "rex" }, ADMIN_GLOBAL_SEARCH_KINDS), ADMIN_GLOBAL_SEARCH_KINDS.length);
  assert.equal(globalSearchQueryUnits({ q: "type:informe rex" }, ADMIN_GLOBAL_SEARCH_KINDS), 1);
  assert.equal(globalSearchQueryUnits({ q: "foo:bar" }, ADMIN_GLOBAL_SEARCH_KINDS), 1);
});
