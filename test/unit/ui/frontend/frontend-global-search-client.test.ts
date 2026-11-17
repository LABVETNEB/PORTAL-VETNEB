import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  GlobalSearchHit,
  GlobalSearchResult,
} from "../../../../frontend/src/lib/global-search.ts";

const LIB_URL = pathToFileURL(resolve(import.meta.dirname, "../../../../frontend/src/lib/global-search.ts")).href;
const SIBLINGS = new Set(["./routes", "./study-types", "./global-search-query"]);

// The frontend imports its siblings without an extension (the Next.js idiom the
// type-stripping loader cannot resolve). The fallback is limited to that exact
// parent and those three specifiers, as in clinic-mobile-admin-parity-census.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (context.parentURL !== LIB_URL || !SIBLINGS.has(specifier)) throw error;
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});

const {
  EMPTY_GLOBAL_SEARCH_FILTERS,
  buildGlobalSearchDestination,
  buildGlobalSearchQueryString,
  clearGlobalSearchFilter,
  describeGlobalSearchFilterChips,
  describeGlobalSearchSyntaxError,
  foldGlobalSearchText,
  formatGlobalSearchFact,
  globalSearchDestinationOpensRecord,
  globalSearchKindsFor,
  globalSearchPathFor,
  globalSearchStatesPathFor,
  globalSearchStatusLabel,
  groupGlobalSearchHits,
  isGlobalSearchContinuation,
  isGlobalSearchFocusShortcut,
  isGlobalSearchQueryReady,
  isGlobalSearchRequestReady,
  normalizeGlobalSearchInput,
  readGlobalSearchRecent,
  readGlobalSearchSavedState,
  rememberGlobalSearchQuery,
  resolveGlobalSearchRequestKinds,
} = (await import(LIB_URL)) as typeof import("../../../../frontend/src/lib/global-search.ts");

// GLOBAL-SEARCH-2 · pure client contract of the GLOBAL-SEARCH-1 API.

function hit(partial: Partial<GlobalSearchHit> & Pick<GlobalSearchHit, "kind" | "id">): GlobalSearchHit {
  return {
    title: `Registro ${partial.id}`,
    subtitle: null,
    status: null,
    date: null,
    facts: [],
    clinic: null,
    rank: 3,
    ...partial,
    target: {
      reportId: null,
      particularTokenId: null,
      studyTrackingCaseId: null,
      clinicId: null,
      clinicUserId: null,
      ...partial.target,
    },
  };
}

function params(query: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(query));
}

test("each surface reaches its own endpoint and only its authorized kinds", () => {
  assert.equal(globalSearchPathFor("clinic"), "/api/search");
  assert.equal(globalSearchPathFor("admin"), "/api/admin/search");
  assert.deepEqual([...globalSearchKindsFor("clinic")], ["report", "particular_token", "tracking_case"]);
  assert.deepEqual(
    [...globalSearchKindsFor("admin")],
    ["clinic", "report", "particular_token", "tracking_case", "clinic_user"],
  );
});

test("the clinic request never carries a tenant, the admin clinicId only narrows", () => {
  const filters = { ...EMPTY_GLOBAL_SEARCH_FILTERS, clinicId: "22", kinds: ["clinic", "report"] as const };
  const clinic = params(buildGlobalSearchQueryString("clinic", { query: "ana", filters: { ...filters, kinds: [...filters.kinds] }, limit: 5, offset: 0 }));
  assert.deepEqual(clinic, { q: "ana", kinds: "report", limit: "5" }, "admin-only kinds and clinicId are dropped");

  const admin = params(buildGlobalSearchQueryString("admin", { query: "ana", filters: { ...filters, kinds: [...filters.kinds] }, limit: 5, offset: 0 }));
  assert.deepEqual(admin, { q: "ana clinic:22", kinds: "clinic,report", limit: "5" });

  const hostile = params(
    buildGlobalSearchQueryString("admin", {
      query: "ana",
      filters: { ...EMPTY_GLOBAL_SEARCH_FILTERS, clinicId: "1 or 1=1" },
      limit: 5,
      offset: 0,
    }),
  );
  assert.deepEqual(hostile, { q: "ana", limit: "5" }, "a non-numeric clinic id is never sent");
  assert.equal("clinicId" in admin, false, "the filters travel inside q, never as their own parameters");
});

test("report filters narrow the request to reports, like the API, and bad dates are dropped", () => {
  const query = params(
    buildGlobalSearchQueryString("clinic", {
      query: "  Ñandú   Pérez ",
      filters: {
        ...EMPTY_GLOBAL_SEARCH_FILTERS,
        kinds: ["particular_token"],
        status: "ready",
        studyType: "citologia",
        from: "2026-01-01",
        to: "01/02/2026",
      },
      limit: 20,
      offset: 40,
    }),
  );
  assert.deepEqual(query, {
    q: "Ñandú Pérez status:ready study:citologia after:2026-01-01",
    kinds: "report",
    limit: "20",
    offset: "40",
  });
});

test("offset is capped at the API maximum and the query fits the 200-character limit", () => {
  const query = params(
    buildGlobalSearchQueryString("admin", {
      query: "x".repeat(200),
      filters: { ...EMPTY_GLOBAL_SEARCH_FILTERS, kinds: ["report"] },
      limit: 20,
      offset: 9000,
    }),
  );
  assert.equal(query.offset, "500");
  assert.equal(query.q, "x".repeat(200));
});

test("filters travel in q in a fixed order; over 200 characters the trailing WORDS are dropped, never a filter", () => {
  const filters = {
    ...EMPTY_GLOBAL_SEARCH_FILTERS,
    clinicId: "12",
    to: "2026-12-31",
    from: "2026-01-01",
    studyType: "histopatologia",
    status: "delivered" as const,
  };
  const request = { query: "luna", filters, limit: 5, offset: 0 };
  assert.equal(
    params(buildGlobalSearchQueryString("admin", request)).q,
    "luna status:delivered study:histopatologia after:2026-01-01 before:2026-12-31 clinic:12",
  );
  const long = Array.from({ length: 30 }, (_, index) => `palabra${index}`).join(" ");
  const q = params(buildGlobalSearchQueryString("admin", { ...request, query: long })).q;
  assert.ok(q.length <= 200, "never composes more than the server accepts");
  assert.ok(q.endsWith(" status:delivered study:histopatologia after:2026-01-01 before:2026-12-31 clinic:12"));
  assert.ok(q.startsWith("palabra0 palabra1 "), "words are dropped from the end, whole");
  // The clinic surface never composes a clinic operator.
  assert.equal(params(buildGlobalSearchQueryString("clinic", request)).q.includes("clinic:"), false);
});

test("a filter-only search is ready and sends no words", () => {
  const status = { ...EMPTY_GLOBAL_SEARCH_FILTERS, status: "ready" as const };
  assert.equal(isGlobalSearchRequestReady("clinic", "", status), true);
  assert.equal(isGlobalSearchRequestReady("clinic", "", EMPTY_GLOBAL_SEARCH_FILTERS), false);
  assert.equal(isGlobalSearchRequestReady("clinic", "a", EMPTY_GLOBAL_SEARCH_FILTERS), false);
  assert.equal(isGlobalSearchRequestReady("clinic", "status:ready", EMPTY_GLOBAL_SEARCH_FILTERS), true);
  assert.deepEqual(params(buildGlobalSearchQueryString("clinic", { query: "", filters: status, limit: 20, offset: 0 })), {
    q: "status:ready",
    kinds: "report",
    limit: "20",
  });
});

test("saved searches have their own endpoint per surface and parse only what the surface allows", () => {
  assert.equal(globalSearchStatesPathFor("clinic"), "/api/search/states");
  assert.equal(globalSearchStatesPathFor("admin"), "/api/admin/search/states");
  assert.deepEqual(readGlobalSearchSavedState("admin", { q: "luna status:ready", kinds: "clinic,report" }), {
    q: "luna status:ready",
    kinds: ["clinic", "report"],
  });
  assert.deepEqual(
    readGlobalSearchSavedState("clinic", { q: "luna", kinds: "clinic,report,report,<img>" }),
    { q: "luna", kinds: ["report"] },
    "an admin-only, repeated or unknown kind never reaches the clinic surface",
  );
  assert.deepEqual(readGlobalSearchSavedState("clinic", { q: "luna", kinds: null }), { q: "luna", kinds: [] });
  assert.equal(readGlobalSearchSavedState("clinic", { q: "", kinds: null }), null);
  assert.equal(readGlobalSearchSavedState("clinic", { q: 7, kinds: null }), null);
  assert.equal(readGlobalSearchSavedState("clinic", { q: "x".repeat(201), kinds: null }), null);
});

test("a continuation sends the cursor of its single kind and never an offset", () => {
  const request = {
    query: "luna",
    filters: { ...EMPTY_GLOBAL_SEARCH_FILTERS, kinds: ["report" as const] },
    limit: 25,
    cursor: "v1.cGF5bG9hZA.c2ln",
  };
  assert.equal(isGlobalSearchContinuation(request), true);
  const query = params(buildGlobalSearchQueryString("clinic", request));
  assert.deepEqual(query, { q: "luna", kinds: "report", limit: "25", cursor: "v1.cGF5bG9hZA.c2ln" });
  assert.equal("offset" in query, false, "cursor and offset are never combined");

  // A report filter narrows to reports: still exactly one kind, so a cursor is valid.
  const filtered = params(
    buildGlobalSearchQueryString("admin", {
      query: "luna",
      filters: { ...EMPTY_GLOBAL_SEARCH_FILTERS, status: "ready", clinicId: "4" },
      limit: 25,
      cursor: "v1.x.y",
    }),
  );
  assert.deepEqual(filtered, { q: "luna status:ready clinic:4", kinds: "report", limit: "25", cursor: "v1.x.y" });
  assert.deepEqual([...resolveGlobalSearchRequestKinds("admin", { ...EMPTY_GLOBAL_SEARCH_FILTERS, status: "ready" })], ["report"]);
});

test("a cursor without exactly one kind, empty or over 512 characters never leaves the client", () => {
  const base = { query: "luna", limit: 25 };
  assert.throws(() =>
    buildGlobalSearchQueryString("clinic", { ...base, filters: EMPTY_GLOBAL_SEARCH_FILTERS, cursor: "v1.a.b" }),
  );
  assert.throws(() =>
    buildGlobalSearchQueryString("admin", {
      ...base,
      filters: { ...EMPTY_GLOBAL_SEARCH_FILTERS, kinds: ["report", "clinic"] },
      cursor: "v1.a.b",
    }),
  );
  // An admin-only kind on the clinic surface is dropped, leaving no kind for the cursor.
  assert.throws(() =>
    buildGlobalSearchQueryString("clinic", {
      ...base,
      filters: { ...EMPTY_GLOBAL_SEARCH_FILTERS, kinds: ["clinic"] },
      cursor: "v1.a.b",
    }),
  );
  const one = { ...EMPTY_GLOBAL_SEARCH_FILTERS, kinds: ["report" as const] };
  assert.throws(() => buildGlobalSearchQueryString("clinic", { ...base, filters: one, cursor: "" }));
  assert.throws(() => buildGlobalSearchQueryString("clinic", { ...base, filters: one, cursor: "x".repeat(513) }));
  assert.doesNotThrow(() => buildGlobalSearchQueryString("clinic", { ...base, filters: one, cursor: "x".repeat(512) }));
  assert.equal(isGlobalSearchContinuation({ ...base, filters: one, offset: 0 }), false);
});

test("the query is ready from two meaningful characters; folding ignores accents and case", () => {
  assert.equal(isGlobalSearchQueryReady(" a "), false);
  assert.equal(isGlobalSearchQueryReady("an"), true);
  assert.equal(normalizeGlobalSearchInput("  ana \n maria "), "ana maria");
  assert.equal(foldGlobalSearchText("CLÍNICAS"), foldGlobalSearchText("clinicas"));
});

test("hits are grouped in the canonical kind order and keep the per-kind hasMore", () => {
  const result: GlobalSearchResult = {
    query: "ana",
    limit: 5,
    offset: 0,
    hits: [
      hit({ kind: "tracking_case", id: 3 }),
      hit({ kind: "report", id: 1, rank: 0 }),
      hit({ kind: "report", id: 2 }),
    ],
    groups: [
      { kind: "report", returned: 2, hasMore: true, nextCursor: "v1.a.b" },
      { kind: "particular_token", returned: 0, hasMore: false, nextCursor: null },
      { kind: "tracking_case", returned: 1, hasMore: false, nextCursor: null },
    ],
  };
  const grouped = groupGlobalSearchHits("clinic", result).map((group) => ({
    kind: group.kind,
    ids: group.hits.map((entry) => entry.id),
    hasMore: group.hasMore,
  }));
  assert.deepEqual(grouped, [
    { kind: "report", ids: [1, 2], hasMore: true },
    { kind: "tracking_case", ids: [3], hasMore: false },
  ]);
});

test("report destinations open the record by id; the rest land on their module", () => {
  const report = hit({ kind: "report", id: 9, target: { reportId: 9 } as GlobalSearchHit["target"] });
  const tracking = hit({ kind: "tracking_case", id: 4, target: { reportId: 9 } as GlobalSearchHit["target"] });
  const token = hit({ kind: "particular_token", id: 7 });

  assert.equal(buildGlobalSearchDestination("clinic", report), "/dashboard/informes?reportId=9");
  assert.equal(buildGlobalSearchDestination("clinic", tracking), "/dashboard/informes?reportId=9");
  assert.equal(buildGlobalSearchDestination("clinic", hit({ kind: "tracking_case", id: 5 })), "/dashboard/informes");
  assert.equal(buildGlobalSearchDestination("clinic", token), "/dashboard?module=tokens#clinic-particular-token-7");

  assert.equal(buildGlobalSearchDestination("admin", report), "/dashboard/admin?module=admin-report-upload&reportId=9");
  assert.equal(buildGlobalSearchDestination("admin", tracking), "/dashboard/admin?module=admin-report-upload&reportId=9");
  assert.equal(
    buildGlobalSearchDestination("admin", token),
    "/dashboard/admin?module=admin-particular-tokens#admin-particular-token-7",
  );
  assert.equal(buildGlobalSearchDestination("admin", hit({ kind: "clinic", id: 2 })), "/dashboard/admin?module=admin-clinics");
  assert.equal(
    buildGlobalSearchDestination("admin", hit({ kind: "clinic_user", id: 5 })),
    "/dashboard/admin?module=admin-users-roles",
  );
  assert.equal(globalSearchDestinationOpensRecord("/dashboard/informes?reportId=9"), true);
  assert.equal(globalSearchDestinationOpensRecord("/dashboard/admin?module=admin-report-upload&reportId=9"), true);
  assert.equal(globalSearchDestinationOpensRecord("/dashboard/admin?module=admin-clinics"), false);
  assert.equal(globalSearchDestinationOpensRecord("/dashboard?module=tokens#clinic-particular-token-7"), false);
});

test("status and fact labels are resolved per kind", () => {
  assert.equal(globalSearchStatusLabel("report", "processing"), "En proceso");
  assert.equal(globalSearchStatusLabel("tracking_case", "processing"), "Procesamiento");
  assert.equal(globalSearchStatusLabel("clinic", null), null);
  assert.deepEqual(formatGlobalSearchFact({ label: "studyType", value: "citologia" }), {
    label: "Tipo de estudio",
    value: "Citología",
  });
  assert.deepEqual(formatGlobalSearchFact({ label: "tokenLast4", value: "1234" }), {
    label: "Token",
    value: "•••• 1234",
  });
  assert.deepEqual(formatGlobalSearchFact({ label: "estimatedDeliveryAt", value: "2026-03-04T10:00:00.000Z" }), {
    label: "Entrega estimada",
    value: "04/03/2026",
  });
});

test("recent searches: per surface, newest first, folded dedupe, capped at five", () => {
  assert.deepEqual([...readGlobalSearchRecent("clinic")], []);
  rememberGlobalSearchQuery("clinic", "a");
  assert.deepEqual([...readGlobalSearchRecent("clinic")], [], "an unready query is not recorded");
  for (const query of ["uno", "dos", "tres", "cuatro", "cinco", "seis"]) rememberGlobalSearchQuery("clinic", query);
  assert.deepEqual([...readGlobalSearchRecent("clinic")], ["seis", "cinco", "cuatro", "tres", "dos"]);
  rememberGlobalSearchQuery("clinic", "  CUÁTRO ");
  assert.deepEqual([...readGlobalSearchRecent("clinic")], ["CUÁTRO", "seis", "cinco", "tres", "dos"]);
  assert.deepEqual([...readGlobalSearchRecent("admin")], [], "surfaces do not share history");
});

test("slash focuses the search only outside editable targets and without modifiers", () => {
  const base = { key: "/", ctrlKey: false, metaKey: false, altKey: false, targetEditable: false };
  assert.equal(isGlobalSearchFocusShortcut(base), true);
  assert.equal(isGlobalSearchFocusShortcut({ ...base, targetEditable: true }), false);
  assert.equal(isGlobalSearchFocusShortcut({ ...base, ctrlKey: true }), false);
  assert.equal(isGlobalSearchFocusShortcut({ ...base, metaKey: true }), false);
  assert.equal(isGlobalSearchFocusShortcut({ ...base, altKey: true }), false);
  assert.equal(isGlobalSearchFocusShortcut({ ...base, key: "k" }), false);
});

test("applied filter chips describe each filter and clear exactly one", () => {
  const filters = {
    ...EMPTY_GLOBAL_SEARCH_FILTERS,
    kinds: ["report"] as const,
    status: "ready" as const,
    studyType: "citologia",
    from: "2026-01-02",
    to: "2026-02-03",
    clinicId: "22",
  };
  const admin = describeGlobalSearchFilterChips("admin", { ...filters, kinds: [...filters.kinds] });
  assert.deepEqual(admin, [
    { key: "status", label: "Listo" },
    { key: "studyType", label: "Citología" },
    { key: "from", label: "Desde 02/01/2026" },
    { key: "to", label: "Hasta 03/02/2026" },
    { key: "clinicId", label: "Clínica #22" },
  ]);
  const clinic = describeGlobalSearchFilterChips("clinic", { ...filters, kinds: [...filters.kinds] });
  assert.equal(clinic.some((chip) => chip.key === "clinicId"), false, "the clinic tenant is the session");

  const cleared = clearGlobalSearchFilter({ ...filters, kinds: [...filters.kinds] }, "from");
  assert.equal(cleared.from, "");
  assert.deepEqual({ ...cleared, from: filters.from, kinds: [...filters.kinds] }, { ...filters, kinds: [...filters.kinds] });
});

test("syntax rejections of the API become guidance; any other 400 text is never echoed", () => {
  assert.equal(
    describeGlobalSearchSyntaxError("clinic", "Operador de búsqueda desconocido: foo:"),
    "«foo:» no es un operador. Usá type:, title:, status:, study:, after:, before: o clinic:, o poné el texto entre comillas para buscarlo tal cual.",
  );
  assert.match(describeGlobalSearchSyntaxError("clinic", "Filtros contradictorios: status:") ?? "", /«status:» con dos valores/);
  for (const message of [
    "Estado de informe inválido",
    "Tipo de estudio inválido",
    "Clínica de búsqueda inválida",
    "Fecha de búsqueda inválida",
    "Rango de fechas inválido",
    "Filtros de búsqueda contradictorios",
    "Los filtros de informe requieren incluir informes",
  ]) {
    assert.ok(describeGlobalSearchSyntaxError("admin", message), message);
  }
  assert.match(describeGlobalSearchSyntaxError("clinic", "Tipo de búsqueda inválido") ?? "", /type:informe, type:token o type:seguimiento/);
  assert.match(describeGlobalSearchSyntaxError("admin", "Tipo de búsqueda inválido") ?? "", /type:clinica o type:usuario/);
  for (const message of [
    "El tipo de búsqueda no está disponible aquí",
    "La búsqueda requiere al menos un término",
    "Demasiados términos de búsqueda",
    "Demasiadas alternativas OR en la búsqueda",
  ]) {
    assert.ok(describeGlobalSearchSyntaxError("clinic", message), message);
  }
  // Unknown or hostile server text is not a syntax message: the caller keeps its generic text.
  assert.equal(describeGlobalSearchSyntaxError("clinic", "Paginación de búsqueda inválida"), null);
  assert.equal(describeGlobalSearchSyntaxError("clinic", "Operador de búsqueda desconocido: <img onerror=x>:"), null);
  assert.equal(describeGlobalSearchSyntaxError("clinic", "select * from reports"), null);
});
