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
const SIBLINGS = new Set(["./routes", "./study-types"]);

// The frontend imports its siblings without an extension (the Next.js idiom the
// type-stripping loader cannot resolve). The fallback is limited to that exact
// parent and those two specifiers, as in clinic-mobile-admin-parity-census.
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
  foldGlobalSearchText,
  formatGlobalSearchFact,
  globalSearchDestinationOpensRecord,
  globalSearchKindsFor,
  globalSearchPathFor,
  globalSearchStatusLabel,
  groupGlobalSearchHits,
  isGlobalSearchQueryReady,
  normalizeGlobalSearchInput,
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
  assert.deepEqual(admin, { q: "ana", kinds: "clinic,report", clinicId: "22", limit: "5" });

  const hostile = params(
    buildGlobalSearchQueryString("admin", {
      query: "ana",
      filters: { ...EMPTY_GLOBAL_SEARCH_FILTERS, clinicId: "1 or 1=1" },
      limit: 5,
      offset: 0,
    }),
  );
  assert.equal(hostile.clinicId, undefined, "a non-numeric clinic id is never sent");
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
    q: "Ñandú Pérez",
    kinds: "report",
    status: "ready",
    studyType: "citologia",
    from: "2026-01-01",
    limit: "20",
    offset: "40",
  });
});

test("offset is capped at the API maximum and the query at 80 characters", () => {
  const query = params(
    buildGlobalSearchQueryString("admin", {
      query: "x".repeat(200),
      filters: { ...EMPTY_GLOBAL_SEARCH_FILTERS, kinds: ["report"] },
      limit: 20,
      offset: 9000,
    }),
  );
  assert.equal(query.offset, "500");
  assert.equal(query.q, "x".repeat(80));
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
      { kind: "report", returned: 2, hasMore: true },
      { kind: "particular_token", returned: 0, hasMore: false },
      { kind: "tracking_case", returned: 1, hasMore: false },
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
