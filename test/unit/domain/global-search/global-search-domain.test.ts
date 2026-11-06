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
  decodeGlobalSearchCursor,
  deriveGlobalSearchCursorKey,
  encodeGlobalSearchCursor,
  GLOBAL_SEARCH_CURSOR_TTL_SECONDS,
  type GlobalSearchCursorContext,
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
    // The domain merge never mints cursors: the use case fills `nextCursor`.
    { kind: "report", returned: 2, hasMore: true, nextCursor: null },
    { kind: "clinic", returned: 1, hasMore: false, nextCursor: null },
  ]);
});

// ── GLOBAL-SEARCH-3A · keyset cursor ─────────────────────────────────────────

const cursorKey = deriveGlobalSearchCursorKey("synthetic-test-secret");
const cursorNow = 1_800_000_000;

function cursorContext(overrides: Partial<GlobalSearchCursorContext> = {}, query: Record<string, unknown> = { q: "luna", kinds: "report" }): GlobalSearchCursorContext {
  const parsed = parseGlobalSearchQuery(query, ADMIN_GLOBAL_SEARCH_KINDS);
  assert.ok(parsed.ok);
  return { surface: "clinic", tenant: 11, kind: "report", criteria: parsed.criteria, ...overrides };
}

const position = { rank: 3, sortKey: "2026-01-02 03:04:05.123456", id: 4242 };

test("cursor: round trip exacto de la posición, con microsegundos", () => {
  const token = encodeGlobalSearchCursor(position, cursorContext(), cursorKey, cursorNow);
  assert.deepEqual(decodeGlobalSearchCursor(token, cursorContext(), cursorKey, cursorNow), position);
});

test("cursor: lleva sólo posición y vencimiento, nunca la consulta ni nombres", () => {
  const token = encodeGlobalSearchCursor(position, cursorContext({}, { q: "Ñandú Pérez", kinds: "report" }), cursorKey, cursorNow);
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  assert.deepEqual(Object.keys(payload).sort(), ["e", "i", "k", "r", "t"]);
  assert.equal(/ñandú|pérez|nandu|perez/i.test(Buffer.from(token.split(".")[1], "base64url").toString("utf8")), false);
});

test("cursor: se rechaza en cualquier otro contexto (clínica, superficie, entidad, consulta, filtros)", () => {
  const token = encodeGlobalSearchCursor(position, cursorContext(), cursorKey, cursorNow);
  const others: GlobalSearchCursorContext[] = [
    cursorContext({ tenant: 22 }),
    cursorContext({ surface: "admin" }),
    cursorContext({ surface: "admin", tenant: null }),
    cursorContext({ kind: "particular_token" }),
    cursorContext({}, { q: "lunas", kinds: "report" }),
    cursorContext({}, { q: "luna", kinds: "report", status: "ready" }),
    cursorContext({}, { q: "luna", kinds: "report", from: "2026-01-01" }),
  ];
  assert.deepEqual(
    others.map((context) => decodeGlobalSearchCursor(token, context, cursorKey, cursorNow)),
    others.map(() => null),
  );
  assert.equal(decodeGlobalSearchCursor(token, cursorContext(), deriveGlobalSearchCursorKey("another-secret"), cursorNow), null);
});

test("cursor: cualquier edición de la posición o de la firma rompe la verificación", () => {
  const token = encodeGlobalSearchCursor(position, cursorContext(), cursorKey, cursorNow);
  const [version, payload, mac] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ k: "report", r: 0, t: position.sortKey, i: 1, e: cursorNow + 60 })).toString("base64url");
  const flipped = mac.slice(0, -1) + (mac.endsWith("A") ? "B" : "A");
  for (const candidate of [
    `${version}.${forged}.${mac}`,
    `${version}.${payload}.${flipped}`,
    `v2.${payload}.${mac}`,
    `${version}.${payload}`,
    "",
    "v1..",
    "x".repeat(600),
    `${version}.${payload}.${mac}.extra`,
  ]) {
    assert.equal(decodeGlobalSearchCursor(candidate, cursorContext(), cursorKey, cursorNow), null, candidate.slice(0, 40));
  }
  assert.equal(decodeGlobalSearchCursor(42, cursorContext(), cursorKey, cursorNow), null);
});

test("cursor: vence y no acepta vencimientos futuros fuera de la ventana", () => {
  const token = encodeGlobalSearchCursor(position, cursorContext(), cursorKey, cursorNow);
  assert.deepEqual(decodeGlobalSearchCursor(token, cursorContext(), cursorKey, cursorNow + GLOBAL_SEARCH_CURSOR_TTL_SECONDS), position);
  assert.equal(decodeGlobalSearchCursor(token, cursorContext(), cursorKey, cursorNow + GLOBAL_SEARCH_CURSOR_TTL_SECONDS + 1), null);
  assert.equal(decodeGlobalSearchCursor(token, cursorContext(), cursorKey, cursorNow - 3_600), null, "minted in the future");
});

test("cursor: sólo se emiten posiciones válidas", () => {
  for (const invalid of [
    { ...position, rank: 4 },
    { ...position, id: 0 },
    { ...position, id: 2_147_483_648 },
    { ...position, sortKey: "2026-01-02T03:04:05Z" },
    { ...position, sortKey: "2026-01-02 03:04:05.1234567" },
  ]) {
    assert.throws(() => encodeGlobalSearchCursor(invalid, cursorContext(), cursorKey, cursorNow));
  }
  assert.throws(() => deriveGlobalSearchCursorKey(""));
});

test("parser: el cursor exige una sola entidad y no se combina con offset", () => {
  const parse = (query: Record<string, unknown>) => {
    const parsed = parseGlobalSearchQuery(query, ADMIN_GLOBAL_SEARCH_KINDS);
    return parsed.ok ? { ok: true, cursor: parsed.criteria.cursor, after: parsed.criteria.after } : { ok: false, error: parsed.error };
  };
  assert.deepEqual(parse({ q: "luna", kinds: "report", cursor: "v1.a.b" }), { ok: true, cursor: "v1.a.b", after: null });
  assert.deepEqual(parse({ q: "luna", cursor: "v1.a.b" }), { ok: false, error: "El cursor requiere un único tipo de entidad" });
  assert.deepEqual(parse({ q: "luna", kinds: "report,clinic", cursor: "v1.a.b" }), { ok: false, error: "El cursor requiere un único tipo de entidad" });
  assert.deepEqual(parse({ q: "luna", kinds: "report", offset: "25", cursor: "v1.a.b" }), { ok: false, error: "El cursor no se combina con offset" });
  assert.deepEqual(parse({ q: "luna", kinds: "report", cursor: "x".repeat(513) }), { ok: false, error: "Cursor de búsqueda inválido" });
  assert.deepEqual(parse({ q: "luna", kinds: "report", cursor: ["a", "b"] }), { ok: false, error: "Cursor de búsqueda inválido" });
  // A report filter narrows «Todo» to one kind, so a cursor is admissible there.
  assert.deepEqual(parse({ q: "luna", status: "ready", cursor: "v1.a.b" }), { ok: true, cursor: "v1.a.b", after: null });
});
