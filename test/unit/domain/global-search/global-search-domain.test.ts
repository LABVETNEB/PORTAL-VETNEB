import test from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_GLOBAL_SEARCH_KINDS,
  CLINIC_GLOBAL_SEARCH_KINDS,
  GLOBAL_SEARCH_MAX_QUERY_LENGTH,
  buildGlobalSearchNeedle,
  compareGlobalSearchHits,
  escapeLikePattern,
  mergeGlobalSearchHits,
  normalizeGlobalSearchText,
  parseGlobalSearchQuery,
  type GlobalSearchHit,
} from "../../../../server/features/global-search/domain/index.ts";

function hit(overrides: Partial<GlobalSearchHit> & Pick<GlobalSearchHit, "kind" | "id">): GlobalSearchHit {
  return {
    title: "Titulo",
    subtitle: null,
    status: null,
    date: null,
    facts: [],
    clinic: null,
    target: {
      reportId: null,
      particularTokenId: null,
      studyTrackingCaseId: null,
      clinicId: null,
      clinicUserId: null,
    },
    rank: 3,
    ...overrides,
  };
}

test("global search normaliza espacios, controles y longitud", () => {
  assert.equal(normalizeGlobalSearchText("  Ñandú \t\n Pérez  "), "Ñandú Pérez");
  assert.equal(normalizeGlobalSearchText("a\u0000b"), "a b");
  assert.equal(normalizeGlobalSearchText(" a "), null);
  assert.equal(normalizeGlobalSearchText(42), null);
  assert.equal(normalizeGlobalSearchText("x".repeat(300))?.length, GLOBAL_SEARCH_MAX_QUERY_LENGTH);
});

test("global search escapa comodines LIKE del texto del usuario", () => {
  assert.equal(escapeLikePattern("100%_a\\b"), "100\\%\\_a\\\\b");

  const needle = buildGlobalSearchNeedle("50%");
  assert.equal(needle.containsPattern, "%50\\%%");
  assert.equal(needle.prefixPattern, "50\\%%");
  assert.equal(needle.exactPattern, "50\\%");
  assert.equal(needle.numericId, null);
});

test("global search reconoce identificadores numéricos con y sin #", () => {
  assert.equal(buildGlobalSearchNeedle("#1234").numericId, 1234);
  assert.equal(buildGlobalSearchNeedle("1234").numericId, 1234);
  assert.equal(buildGlobalSearchNeedle("0").numericId, null);
  assert.equal(buildGlobalSearchNeedle("12ab").numericId, null);
});

test("global search rechaza consultas vacías, tipos desconocidos y paginación ambigua", () => {
  assert.equal(parseGlobalSearchQuery({}, CLINIC_GLOBAL_SEARCH_KINDS).ok, false);
  assert.equal(parseGlobalSearchQuery({ q: "x" }, CLINIC_GLOBAL_SEARCH_KINDS).ok, false);

  const unknownKind = parseGlobalSearchQuery(
    { q: "rex", kinds: "clinic_user" },
    CLINIC_GLOBAL_SEARCH_KINDS,
  );
  assert.equal(unknownKind.ok, false, "la clínica no puede pedir entidades exclusivas de admin");

  assert.equal(
    parseGlobalSearchQuery({ q: "rex", offset: "10" }, CLINIC_GLOBAL_SEARCH_KINDS).ok,
    false,
  );
  assert.equal(
    parseGlobalSearchQuery({ q: "rex", limit: "999" }, CLINIC_GLOBAL_SEARCH_KINDS).ok,
    false,
  );
  assert.equal(
    parseGlobalSearchQuery({ q: "rex", limit: "5; drop" }, CLINIC_GLOBAL_SEARCH_KINDS).ok,
    false,
  );
});

test("global search acepta paginación con un único tipo y conserva el orden canónico de tipos", () => {
  const parsed = parseGlobalSearchQuery(
    { q: "rex", kinds: "report", limit: "20", offset: "40" },
    CLINIC_GLOBAL_SEARCH_KINDS,
  );
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.kinds, ["report"]);
  assert.equal(parsed.criteria.limit, 20);
  assert.equal(parsed.criteria.offset, 40);

  const many = parseGlobalSearchQuery(
    { q: "rex", kinds: "clinic_user,clinic" },
    ADMIN_GLOBAL_SEARCH_KINDS,
  );
  assert.ok(many.ok);
  assert.deepEqual(many.kinds, ["clinic", "clinic_user"]);
});

test("global search: filtros de informe restringen las entidades a informes", () => {
  const parsed = parseGlobalSearchQuery(
    { q: "rex", status: "ready", studyType: "citologia", from: "2026-01-01", to: "2026-02-01" },
    ADMIN_GLOBAL_SEARCH_KINDS,
  );
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.kinds, ["report"]);
  assert.equal(parsed.criteria.reportStatus, "ready");
  assert.equal(parsed.criteria.studyType, "citologia");
  assert.equal(parsed.criteria.createdFrom?.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(parsed.criteria.createdTo?.toISOString(), "2026-02-01T23:59:59.999Z");

  assert.equal(
    parseGlobalSearchQuery({ q: "rex", kinds: "clinic", status: "ready" }, ADMIN_GLOBAL_SEARCH_KINDS).ok,
    false,
    "un filtro de informe sobre otra entidad no se ignora en silencio",
  );
  assert.equal(parseGlobalSearchQuery({ q: "rex", status: "borrado" }, ADMIN_GLOBAL_SEARCH_KINDS).ok, false);
  assert.equal(parseGlobalSearchQuery({ q: "rex", studyType: "Cito'; --" }, ADMIN_GLOBAL_SEARCH_KINDS).ok, false);
  assert.equal(parseGlobalSearchQuery({ q: "rex", from: "2026-02-30" }, ADMIN_GLOBAL_SEARCH_KINDS).ok, false);
  assert.equal(
    parseGlobalSearchQuery({ q: "rex", from: "2026-03-01", to: "2026-02-01" }, ADMIN_GLOBAL_SEARCH_KINDS).ok,
    false,
  );
});

test("global search ordena por rango, recencia, entidad e id de forma determinista", () => {
  const hits = [
    hit({ kind: "report", id: 1, rank: 3, date: "2026-01-01T00:00:00.000Z" }),
    hit({ kind: "report", id: 2, rank: 3, date: "2026-03-01T00:00:00.000Z" }),
    hit({ kind: "clinic", id: 3, rank: 1 }),
    hit({ kind: "particular_token", id: 9, rank: 0 }),
    hit({ kind: "tracking_case", id: 4, rank: 3, date: "2026-03-01T00:00:00.000Z" }),
  ];

  const order = [...hits].sort(compareGlobalSearchHits).map((item) => `${item.kind}:${item.id}`);
  assert.deepEqual(order, [
    "particular_token:9",
    "clinic:3",
    "report:2",
    "tracking_case:4",
    "report:1",
  ]);
});

test("global search fusiona páginas sin duplicados y calcula hasMore sin COUNT", () => {
  const merged = mergeGlobalSearchHits(
    [
      {
        kind: "report",
        rows: [
          hit({ kind: "report", id: 1 }),
          hit({ kind: "report", id: 1 }),
          hit({ kind: "report", id: 2 }),
          hit({ kind: "report", id: 3 }),
        ],
      },
      { kind: "clinic", rows: [hit({ kind: "clinic", id: 1 })] },
    ],
    3,
  );

  assert.deepEqual(
    merged.hits.map((item) => `${item.kind}:${item.id}`).sort(),
    ["clinic:1", "report:1", "report:2"],
  );
  assert.deepEqual(merged.groups, [
    { kind: "report", returned: 2, hasMore: true },
    { kind: "clinic", returned: 1, hasMore: false },
  ]);
});
