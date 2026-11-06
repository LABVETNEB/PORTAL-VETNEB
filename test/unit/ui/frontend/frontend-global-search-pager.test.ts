import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  GlobalSearchHit,
  GlobalSearchKind,
  GlobalSearchResult,
} from "../../../../frontend/src/lib/global-search.ts";

const LIB_DIR = resolve(import.meta.dirname, "../../../../frontend/src/lib");
const PAGER_URL = pathToFileURL(resolve(LIB_DIR, "global-search-pager.ts")).href;
const SEARCH_URL = pathToFileURL(resolve(LIB_DIR, "global-search.ts")).href;
const SIBLINGS = new Set(["./routes", "./study-types", "./global-search"]);

// The frontend imports its siblings without an extension (the Next.js idiom the
// type-stripping loader cannot resolve). The fallback is limited to these two
// parents and their sibling specifiers, as in frontend-global-search-client.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (![PAGER_URL, SEARCH_URL].includes(context.parentURL ?? "") || !SIBLINGS.has(specifier)) throw error;
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});

const {
  applyGlobalSearchChunk,
  compareGlobalSearchHits,
  createGlobalSearchPager,
  globalSearchPagerCapped,
  globalSearchPagerHasMore,
  planGlobalSearchChunks,
  takeGlobalSearchPage,
} = (await import(PAGER_URL)) as typeof import("../../../../frontend/src/lib/global-search-pager.ts");
const { GLOBAL_SEARCH_MAX_OFFSET, globalSearchHitKey } = (await import(SEARCH_URL)) as typeof import(
  "../../../../frontend/src/lib/global-search.ts"
);

// GLOBAL-SEARCH-3A · the k-way merge pager against a model of the API:
// each kind ranked on its own (rank, recency, id), `offset` for one kind,
// `limit + 1` for hasMore, `offset` capped at GLOBAL_SEARCH_MAX_OFFSET.

function makeRow(kind: GlobalSearchKind, id: number, rank: number, minute: number): GlobalSearchHit {
  return {
    kind,
    id,
    title: `${kind}-${id}`,
    subtitle: null,
    status: null,
    date: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
    facts: [],
    clinic: null,
    rank,
    target: { reportId: null, particularTokenId: null, studyTrackingCaseId: null, clinicId: null, clinicUserId: null },
  };
}

/** Deterministic pseudo-random dataset (no Math.random: reproducible). */
function dataset(sizes: Readonly<Partial<Record<GlobalSearchKind, number>>>): Map<GlobalSearchKind, GlobalSearchHit[]> {
  let seed = 7;
  const nextInt = (max: number) => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed % max;
  };
  const byKind = new Map<GlobalSearchKind, GlobalSearchHit[]>();
  let id = 1;
  for (const [kind, size] of Object.entries(sizes) as [GlobalSearchKind, number][]) {
    const rows = Array.from({ length: size }, () => makeRow(kind, id++, nextInt(4), nextInt(50)));
    // The server's per-kind ORDER BY: rank, date desc, id desc.
    rows.sort(compareGlobalSearchHits);
    byKind.set(kind, rows);
  }
  return byKind;
}

function serve(data: Map<GlobalSearchKind, GlobalSearchHit[]>, kind: GlobalSearchKind, offset: number, limit: number): GlobalSearchResult {
  assert.ok(offset <= GLOBAL_SEARCH_MAX_OFFSET, `the pager never asks past the API offset limit (${offset})`);
  assert.ok(limit >= 1 && limit <= 25, `limit within the API window (${limit})`);
  const rows = data.get(kind) ?? [];
  const window = rows.slice(offset, offset + limit + 1);
  return {
    query: "q",
    hits: window.slice(0, limit),
    groups: [{ kind, returned: Math.min(limit, window.length), hasMore: window.length > limit }],
    limit,
    offset,
  };
}

function pageThrough(data: Map<GlobalSearchKind, GlobalSearchHit[]>, pageSize: number) {
  let state = createGlobalSearchPager([...data.keys()]);
  const pages: GlobalSearchHit[][] = [];
  let requests = 0;
  for (let guard = 0; guard < 10_000; guard += 1) {
    for (const chunk of planGlobalSearchChunks(state, pageSize)) {
      requests += 1;
      state = applyGlobalSearchChunk(state, chunk, serve(data, chunk.kind, chunk.offset, chunk.limit));
    }
    const taken = takeGlobalSearchPage(state, pageSize);
    state = taken.state;
    if (taken.page.length === 0) break;
    pages.push([...taken.page]);
    if (!globalSearchPagerHasMore(state)) break;
  }
  return { pages, state, requests };
}

test("«Todo» recorre todos los resultados autorizados sin duplicar ni omitir, con cualquier tamaño de página", () => {
  const data = dataset({ report: 137, particular_token: 41, tracking_case: 9 });
  const expected = [...data.values()].flat().map(globalSearchHitKey).sort();
  for (const pageSize of [1, 3, 7, 12, 25]) {
    const { pages } = pageThrough(data, pageSize);
    const keys = pages.flat().map(globalSearchHitKey);
    assert.deepEqual([...keys].sort(), expected, `pageSize ${pageSize}: same set as the server holds`);
    assert.equal(new Set(keys).size, keys.length, `pageSize ${pageSize}: no duplicates`);
    assert.ok(pages.slice(0, -1).every((page) => page.length === pageSize), `pageSize ${pageSize}: every page but the last is full`);
  }
});

test("el orden de «Todo» es el orden global del servidor (rango, recencia, entidad, id) y es estable", () => {
  const data = dataset({ clinic: 6, report: 30, tracking_case: 12, particular_token: 18, clinic_user: 5 });
  const flat = pageThrough(data, 5).pages.flat();
  for (let index = 1; index < flat.length; index += 1) {
    assert.ok(compareGlobalSearchHits(flat[index - 1], flat[index]) <= 0, `row ${index} out of order`);
  }
  assert.deepEqual(
    pageThrough(data, 5).pages.flat().map(globalSearchHitKey),
    flat.map(globalSearchHitKey),
    "same input, same pages",
  );
});

test("una categoría es el caso k = 1: páginas exactas del orden del servidor", () => {
  const data = dataset({ report: 64 });
  const { pages, requests } = pageThrough(data, 10);
  assert.deepEqual(pages.flat().map(globalSearchHitKey), (data.get("report") ?? []).map(globalSearchHitKey));
  assert.deepEqual(pages.map((page) => page.length), [10, 10, 10, 10, 10, 10, 4]);
  assert.ok(requests <= 7, `one request per page at most (${requests})`);
});

test("cada página pide sólo lo necesario: nunca más de una ventana por entidad", () => {
  const data = dataset({ report: 200, particular_token: 200, tracking_case: 200 });
  let state = createGlobalSearchPager([...data.keys()]);
  const first = planGlobalSearchChunks(state, 8);
  assert.deepEqual(first.map((chunk) => [chunk.kind, chunk.offset, chunk.limit]), [
    ["report", 0, 8],
    ["particular_token", 0, 8],
    ["tracking_case", 0, 8],
  ]);
  for (const chunk of first) state = applyGlobalSearchChunk(state, chunk, serve(data, chunk.kind, chunk.offset, chunk.limit));
  state = takeGlobalSearchPage(state, 8).state;
  const second = planGlobalSearchChunks(state, 8);
  assert.ok(second.length <= 3);
  assert.ok(second.every((chunk) => chunk.offset === 8), "the next window starts where the stream stopped");
});

test("una entidad vacía queda agotada y no frena el recorrido de las demás", () => {
  const data = dataset({ report: 0, particular_token: 23 });
  const { pages } = pageThrough(data, 10);
  assert.deepEqual(pages.map((page) => page.length), [10, 10, 3]);
});

test("el tope de offset del API se declara: el usuario sabe que hay más y no se pide fuera de rango", () => {
  const data = dataset({ report: 700 });
  const { pages, state } = pageThrough(data, 25);
  const reached = pages.flat().length;
  assert.equal(reached, GLOBAL_SEARCH_MAX_OFFSET + 25, "500 + the last window of 25");
  assert.equal(globalSearchPagerHasMore(state), false);
  assert.equal(globalSearchPagerCapped(state), true, "the cap is reported, not hidden");
});

test("un registro repetido por el servidor (alta concurrente) nunca aparece dos veces", () => {
  const row = makeRow("report", 1, 0, 1);
  let state = createGlobalSearchPager(["report"]);
  state = applyGlobalSearchChunk(state, { kind: "report", offset: 0, limit: 2 }, {
    query: "q",
    hits: [row, row],
    groups: [{ kind: "report", returned: 2, hasMore: false }],
    limit: 2,
    offset: 0,
  });
  assert.deepEqual(takeGlobalSearchPage(state, 2).page.map(globalSearchHitKey), ["report:1"]);
});
