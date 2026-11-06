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
import type { GlobalSearchChunkRequest } from "../../../../frontend/src/lib/global-search-pager.ts";

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
  GLOBAL_SEARCH_MAX_CHUNK,
  applyGlobalSearchChunk,
  compareGlobalSearchHits,
  createGlobalSearchPager,
  globalSearchPagerHasMore,
  globalSearchPagerStalled,
  planGlobalSearchChunks,
  takeGlobalSearchPage,
} = (await import(PAGER_URL)) as typeof import("../../../../frontend/src/lib/global-search-pager.ts");
const { globalSearchHitKey } = (await import(SEARCH_URL)) as typeof import(
  "../../../../frontend/src/lib/global-search.ts"
);

// GLOBAL-SEARCH-3A-CURSOR · the k-way merge pager against a keyset model of
// the API: each kind in its SQL order (rank ASC, sort key DESC, id DESC) where
// the sort key is NOT the visible date, `limit + 1` for hasMore, and an opaque
// cursor naming the last row of the window. Frontend-only evidence: the real
// PostgreSQL traversal is covered by the backend suites of #1971.

type Row = { readonly hit: GlobalSearchHit; readonly sortKey: number };

function makeRow(kind: GlobalSearchKind, id: number, rank: number, sortKey: number, visibleMinute: number): Row {
  return {
    sortKey,
    hit: {
      kind,
      id,
      title: `${kind}-${id}`,
      subtitle: null,
      status: null,
      // The visible date deliberately disagrees with the SQL sort key.
      date: new Date(Date.UTC(2026, 0, 1, 0, visibleMinute)).toISOString(),
      facts: [],
      clinic: null,
      rank,
      target: { reportId: null, particularTokenId: null, studyTrackingCaseId: null, clinicId: null, clinicUserId: null },
    },
  };
}

function sqlOrder(a: Row, b: Row): number {
  return a.hit.rank - b.hit.rank || b.sortKey - a.sortKey || b.hit.id - a.hit.id;
}

/** Deterministic pseudo-random dataset (no Math.random: reproducible). */
function dataset(sizes: Readonly<Partial<Record<GlobalSearchKind, number>>>): Map<GlobalSearchKind, Row[]> {
  let seed = 7;
  const nextInt = (max: number) => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed % max;
  };
  const byKind = new Map<GlobalSearchKind, Row[]>();
  let id = 1;
  for (const [kind, size] of Object.entries(sizes) as [GlobalSearchKind, number][]) {
    // Few distinct sort keys: ties are broken by id, as in SQL.
    const rows = Array.from({ length: size }, () => makeRow(kind, id++, nextInt(4), nextInt(97), nextInt(50)));
    rows.sort(sqlOrder);
    byKind.set(kind, rows);
  }
  return byKind;
}

type Served = { readonly kind: GlobalSearchKind; readonly cursor: string | null; readonly limit: number };

function encodeCursor(kind: GlobalSearchKind, row: Row): string {
  return `v1.${Buffer.from(JSON.stringify([kind, row.hit.rank, row.sortKey, row.hit.id])).toString("base64url")}.sig`;
}

function serve(data: Map<GlobalSearchKind, Row[]>, chunk: GlobalSearchChunkRequest, log?: Served[]): GlobalSearchResult {
  log?.push({ kind: chunk.kind, cursor: chunk.cursor, limit: chunk.limit });
  assert.ok(chunk.limit >= 1 && chunk.limit <= 25, `limit within the API window (${chunk.limit})`);
  const rows = data.get(chunk.kind) ?? [];
  let start = 0;
  if (chunk.cursor !== null) {
    const [kind, rank, sortKey, id] = JSON.parse(Buffer.from(chunk.cursor.split(".")[1], "base64url").toString()) as [
      GlobalSearchKind,
      number,
      number,
      number,
    ];
    assert.equal(kind, chunk.kind, "a cursor is only sent for its own kind");
    const after = rows.findIndex(
      (row) =>
        row.hit.rank > rank || (row.hit.rank === rank && (row.sortKey < sortKey || (row.sortKey === sortKey && row.hit.id < id))),
    );
    start = after === -1 ? rows.length : after;
  }
  const window = rows.slice(start, start + chunk.limit + 1);
  const visible = window.slice(0, chunk.limit);
  const hasMore = window.length > chunk.limit;
  return {
    query: "q",
    hits: visible.map((row) => row.hit),
    groups: [
      {
        kind: chunk.kind,
        returned: visible.length,
        hasMore,
        nextCursor: hasMore ? encodeCursor(chunk.kind, visible[visible.length - 1]) : null,
      },
    ],
    limit: chunk.limit,
    offset: 0,
  };
}

function pageThrough(data: Map<GlobalSearchKind, Row[]>, pageSize: number, log?: Served[]) {
  let state = createGlobalSearchPager([...data.keys()]);
  const pages: GlobalSearchHit[][] = [];
  let requests = 0;
  for (let guard = 0; guard < 20_000; guard += 1) {
    for (const chunk of planGlobalSearchChunks(state, pageSize)) {
      requests += 1;
      state = applyGlobalSearchChunk(state, chunk, serve(data, chunk, log));
    }
    const taken = takeGlobalSearchPage(state, pageSize);
    state = taken.state;
    if (taken.page.length === 0) break;
    pages.push([...taken.page]);
    if (!globalSearchPagerHasMore(state)) break;
  }
  return { pages, state, requests };
}

function keysOf(rows: readonly Row[]): string[] {
  return rows.map((row) => globalSearchHitKey(row.hit));
}

function assertCompleteTraversal(data: Map<GlobalSearchKind, Row[]>, pages: readonly (readonly GlobalSearchHit[])[], label: string) {
  const flat = pages.flat();
  const keys = flat.map(globalSearchHitKey);
  assert.equal(new Set(keys).size, keys.length, `${label}: no duplicates`);
  assert.deepEqual([...keys].sort(), [...data.values()].flatMap(keysOf).sort(), `${label}: no omissions`);
  for (const [kind, rows] of data) {
    assert.deepEqual(
      flat.filter((hit) => hit.kind === kind).map(globalSearchHitKey),
      keysOf(rows),
      `${label}: ${kind} keeps the exact SQL order of its stream`,
    );
  }
}

test("la primera ventana va sin cursor y cada continuación lleva el nextCursor de su entidad", () => {
  const data = dataset({ report: 80 });
  const log: Served[] = [];
  pageThrough(data, 10, log);
  assert.equal(log[0].cursor, null, "first window without cursor");
  for (let index = 1; index < log.length; index += 1) {
    assert.ok(log[index].cursor?.startsWith("v1."), `request ${index} continues by cursor`);
  }
  assert.equal(new Set(log.map((entry) => entry.cursor)).size, log.length, "a cursor is never reused");
  assert.ok(log.every((entry) => entry.limit === GLOBAL_SEARCH_MAX_CHUNK), "each window asks the API maximum");
});

test("una categoría recorre más allá de 525 registros: 2.000 y 10.000 completos, en orden y sin repetir", () => {
  for (const size of [526, 2_000, 10_000]) {
    const data = dataset({ report: size });
    const { pages, requests, state } = pageThrough(data, 9);
    assertCompleteTraversal(data, pages, `report ${size}`);
    assert.equal(pages.flat().length, size);
    assert.ok(pages.slice(0, -1).every((page) => page.length === 9), `${size}: every page but the last is full`);
    assert.equal(globalSearchPagerHasMore(state), false);
    assert.equal(globalSearchPagerStalled(state), false);
    assert.equal(requests, Math.ceil(size / GLOBAL_SEARCH_MAX_CHUNK), `${size}: one request per 25 rows`);
  }
});

test("«Todo» con tres categorías (Clínica) y distintos ritmos de agotamiento", () => {
  const data = dataset({ report: 2_000, particular_token: 41, tracking_case: 0 });
  for (const pageSize of [1, 7, 12, 25]) {
    const { pages } = pageThrough(data, pageSize);
    assertCompleteTraversal(data, pages, `clinic Todo pageSize ${pageSize}`);
    assert.ok(pages.slice(0, -1).every((page) => page.length === pageSize));
  }
});

test("«Todo» con cinco categorías (Admin) y 10.000 registros en total", () => {
  const data = dataset({ clinic: 6, report: 6_000, tracking_case: 2_500, particular_token: 1_480, clinic_user: 14 });
  const { pages, requests } = pageThrough(data, 13);
  assertCompleteTraversal(data, pages, "admin Todo");
  // At most one window per open stream per refill: about rows / 25 plus the first windows.
  assert.ok(requests <= Math.ceil(10_000 / GLOBAL_SEARCH_MAX_CHUNK) + 5 + 5, `requests ${requests}`);
});

test("el comparador sólo elige entre cabezas: nunca reordena una entidad por la fecha visible", () => {
  const data = dataset({ report: 120, tracking_case: 60 });
  const flat = pageThrough(data, 8).pages.flat();
  const reports = flat.filter((hit) => hit.kind === "report");
  // The visible date of the stream is not monotonic, yet the order is the SQL one.
  const visibleSorted = [...reports].sort(compareGlobalSearchHits).map(globalSearchHitKey);
  assert.notDeepEqual(reports.map(globalSearchHitKey), visibleSorted, "the dataset exercises the disagreement");
  assert.deepEqual(reports.map(globalSearchHitKey), keysOf(data.get("report") ?? []));
  assert.deepEqual(
    pageThrough(data, 8).pages.flat().map(globalSearchHitKey),
    flat.map(globalSearchHitKey),
    "same input, same pages",
  );
});

test("cada página pide sólo lo necesario: una ventana por entidad abierta y nada más", () => {
  const data = dataset({ report: 200, particular_token: 200, tracking_case: 200 });
  let state = createGlobalSearchPager([...data.keys()]);
  const first = planGlobalSearchChunks(state, 8);
  assert.deepEqual(first.map((chunk) => [chunk.kind, chunk.cursor]), [
    ["report", null],
    ["particular_token", null],
    ["tracking_case", null],
  ]);
  for (const chunk of first) state = applyGlobalSearchChunk(state, chunk, serve(data, chunk));
  state = takeGlobalSearchPage(state, 8).state;
  assert.deepEqual(planGlobalSearchChunks(state, 8), [], "25-row windows feed the next page without a request");
});

test("una respuesta obsoleta (otro cursor o ventana ya leída) no altera el flujo", () => {
  const data = dataset({ report: 60 });
  let state = createGlobalSearchPager(["report"]);
  const [first] = planGlobalSearchChunks(state, 10);
  const answer = serve(data, first);
  state = applyGlobalSearchChunk(state, first, answer);
  const replay = applyGlobalSearchChunk(state, first, answer);
  assert.deepEqual(replay, state, "the first window applied twice is ignored");
  const foreign = applyGlobalSearchChunk(state, { kind: "report", cursor: "v1.otro.sig", limit: 25 }, answer);
  assert.deepEqual(foreign, state, "an answer for another cursor is ignored");
});

test("respuestas incoherentes terminan el flujo como incompleto, sin bucles", () => {
  const row = makeRow("report", 1, 0, 1, 1).hit;
  const row2 = makeRow("report", 2, 0, 0, 1).hit;
  const reply = (hits: GlobalSearchHit[], nextCursor: string | null): GlobalSearchResult => ({
    query: "q",
    hits,
    groups: [{ kind: "report", returned: hits.length, hasMore: true, nextCursor }],
    limit: 25,
    offset: 0,
  });

  const noCursor = applyGlobalSearchChunk(createGlobalSearchPager(["report"]), { kind: "report", cursor: null, limit: 25 }, reply([row], null));
  assert.equal(globalSearchPagerStalled(noCursor), true, "hasMore without cursor");
  assert.deepEqual(planGlobalSearchChunks(noCursor, 10), []);
  assert.deepEqual(takeGlobalSearchPage(noCursor, 10).page.map(globalSearchHitKey), ["report:1"], "rows read are kept");

  let repeated = applyGlobalSearchChunk(createGlobalSearchPager(["report"]), { kind: "report", cursor: null, limit: 25 }, reply([row], "c1"));
  repeated = applyGlobalSearchChunk(repeated, { kind: "report", cursor: "c1", limit: 25 }, reply([row2], "c1"));
  assert.equal(globalSearchPagerStalled(repeated), true, "the same cursor twice");

  let empty = applyGlobalSearchChunk(createGlobalSearchPager(["report"]), { kind: "report", cursor: null, limit: 25 }, reply([row], "c1"));
  empty = applyGlobalSearchChunk(empty, { kind: "report", cursor: "c1", limit: 25 }, reply([], "c2"));
  assert.equal(globalSearchPagerStalled(empty), true, "an empty window that announces more");

  let stale = applyGlobalSearchChunk(createGlobalSearchPager(["report"]), { kind: "report", cursor: null, limit: 25 }, reply([row], "c1"));
  stale = applyGlobalSearchChunk(stale, { kind: "report", cursor: "c1", limit: 25 }, reply([row], "c2"));
  assert.equal(globalSearchPagerStalled(stale), true, "a window with only rows already read");

  // The page loop of the hook terminates: nothing left to plan, then an empty page.
  assert.equal(globalSearchPagerHasMore(takeGlobalSearchPage(stale, 10).state), false);
});

test("una fila repetida por un cambio concurrente (cruza el cursor hacia adelante) aparece una sola vez", () => {
  const data = dataset({ report: 40 });
  let state = createGlobalSearchPager(["report"]);
  const [first] = planGlobalSearchChunks(state, 10);
  state = applyGlobalSearchChunk(state, first, serve(data, first));
  const taken = takeGlobalSearchPage(state, 10);
  state = taken.state;
  const already = taken.page[0];
  // The server sends an already paged row again in the next window.
  for (let round = 0; round < 3; round += 1) {
    const [chunk] = planGlobalSearchChunks(state, 10);
    if (!chunk) break;
    const answer = serve(data, chunk);
    state = applyGlobalSearchChunk(state, chunk, { ...answer, hits: [already, ...answer.hits] });
    state = takeGlobalSearchPage(state, 10).state;
  }
  const rest: GlobalSearchHit[] = [];
  for (;;) {
    for (const chunk of planGlobalSearchChunks(state, 10)) state = applyGlobalSearchChunk(state, chunk, serve(data, chunk));
    const page = takeGlobalSearchPage(state, 10);
    state = page.state;
    if (page.page.length === 0) break;
    rest.push(...page.page);
  }
  assert.ok(!rest.some((hit) => globalSearchHitKey(hit) === globalSearchHitKey(already)));
});

test("una categoría vacía queda agotada en la primera ventana y no frena a las demás", () => {
  const data = dataset({ report: 0, particular_token: 23 });
  const { pages } = pageThrough(data, 10);
  assert.deepEqual(pages.map((page) => page.length), [10, 10, 3]);
});
