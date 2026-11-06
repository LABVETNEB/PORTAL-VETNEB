import {
  GLOBAL_SEARCH_MAX_OFFSET,
  globalSearchHitKey,
  type GlobalSearchHit,
  type GlobalSearchKind,
  type GlobalSearchResult,
} from "./global-search";

/**
 * GLOBAL-SEARCH-3A · one pagination contract for every search view.
 *
 * The API ranks each entity on its own (`rank`, recency, `id`, a total order)
 * and pages one entity at a time (`offset` needs a single kind). A page of
 * «Todo» is therefore an exact k-way merge of those per-entity streams: each
 * stream is consumed strictly in server order and the next row of the page is
 * the smallest head under the same comparator the server uses to merge. A
 * k-way merge emits every row of every stream exactly once, so pages never
 * repeat or skip a record, and one category is simply the k = 1 case.
 *
 * Pure: no fetch, no timers, no DOM. The hook drives it with real responses.
 */

/** Same order as `compareGlobalSearchHits` on the server. */
const KIND_ORDER: Readonly<Record<GlobalSearchKind, number>> = {
  clinic: 0,
  report: 1,
  tracking_case: 2,
  particular_token: 3,
  clinic_user: 4,
};

/** Largest window one request may ask for (`limit` ≤ 25 in the API). */
export const GLOBAL_SEARCH_MAX_CHUNK = 25;

function hitTime(hit: GlobalSearchHit): number {
  if (!hit.date) return 0;
  const time = Date.parse(hit.date);
  return Number.isNaN(time) ? 0 : time;
}

export function compareGlobalSearchHits(a: GlobalSearchHit, b: GlobalSearchHit): number {
  return (
    a.rank - b.rank ||
    hitTime(b) - hitTime(a) ||
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
    b.id - a.id
  );
}

export type GlobalSearchStream = {
  readonly kind: GlobalSearchKind;
  /** Rows already read from the server, in server order, not yet paged. */
  readonly buffer: readonly GlobalSearchHit[];
  /** Server rows consumed so far: the `offset` of the next request. */
  readonly offset: number;
  /** The server has no further row for this kind. */
  readonly exhausted: boolean;
  /**
   * The server may hold more rows but the API cannot reach them (`offset`
   * above `GLOBAL_SEARCH_MAX_OFFSET`). Reported to the user, never hidden.
   */
  readonly capped: boolean;
};

export type GlobalSearchPagerState = {
  readonly streams: readonly GlobalSearchStream[];
  /** Keys already paged: a second copy of a row is never emitted. */
  readonly emitted: ReadonlySet<string>;
};

export function createGlobalSearchPager(kinds: readonly GlobalSearchKind[]): GlobalSearchPagerState {
  return {
    streams: kinds.map((kind) => ({ kind, buffer: [], offset: 0, exhausted: false, capped: false })),
    emitted: new Set(),
  };
}

export type GlobalSearchChunkRequest = {
  readonly kind: GlobalSearchKind;
  readonly offset: number;
  readonly limit: number;
};

/**
 * The single-kind requests needed before a page of `pageSize` rows can be
 * taken: every open stream must hold at least `pageSize` rows, because the
 * whole page may come from one entity.
 */
export function planGlobalSearchChunks(
  state: GlobalSearchPagerState,
  pageSize: number,
): readonly GlobalSearchChunkRequest[] {
  const size = Math.max(1, Math.min(pageSize, GLOBAL_SEARCH_MAX_CHUNK));
  return state.streams
    .filter((stream) => !stream.exhausted && stream.buffer.length < size)
    .map((stream) => ({
      kind: stream.kind,
      offset: stream.offset,
      limit: Math.min(GLOBAL_SEARCH_MAX_CHUNK, Math.max(size - stream.buffer.length, size)),
    }));
}

/** Folds one single-kind response into its stream. */
export function applyGlobalSearchChunk(
  state: GlobalSearchPagerState,
  request: GlobalSearchChunkRequest,
  result: GlobalSearchResult,
): GlobalSearchPagerState {
  const rows = result.hits.filter((hit) => hit.kind === request.kind);
  const hasMore = result.groups.some((group) => group.kind === request.kind && group.hasMore);
  return {
    ...state,
    streams: state.streams.map((stream) => {
      if (stream.kind !== request.kind || stream.offset !== request.offset) return stream;
      const offset = stream.offset + rows.length;
      const reachable = offset <= GLOBAL_SEARCH_MAX_OFFSET;
      return {
        ...stream,
        buffer: [...stream.buffer, ...rows],
        offset,
        exhausted: !hasMore || !reachable || rows.length === 0,
        capped: hasMore && !reachable,
      };
    }),
  };
}

/** Takes the next page by k-way merge. Call after the planned chunks landed. */
export function takeGlobalSearchPage(
  state: GlobalSearchPagerState,
  pageSize: number,
): { readonly page: readonly GlobalSearchHit[]; readonly state: GlobalSearchPagerState } {
  const buffers = state.streams.map((stream) => [...stream.buffer]);
  const emitted = new Set(state.emitted);
  const page: GlobalSearchHit[] = [];

  while (page.length < pageSize) {
    let best = -1;
    for (let index = 0; index < buffers.length; index += 1) {
      const head = buffers[index][0];
      if (!head) continue;
      if (best === -1 || compareGlobalSearchHits(head, buffers[best][0]) < 0) best = index;
    }
    if (best === -1) break;
    const next = buffers[best].shift() as GlobalSearchHit;
    const key = globalSearchHitKey(next);
    if (emitted.has(key)) continue;
    emitted.add(key);
    page.push(next);
  }

  return {
    page,
    state: {
      emitted,
      streams: state.streams.map((stream, index) => ({ ...stream, buffer: buffers[index] })),
    },
  };
}

/** A next page exists while any stream still holds or can fetch a row. */
export function globalSearchPagerHasMore(state: GlobalSearchPagerState): boolean {
  return state.streams.some((stream) => stream.buffer.length > 0 || !stream.exhausted);
}

/** Some entity has rows the API cannot page to (`offset` cap). */
export function globalSearchPagerCapped(state: GlobalSearchPagerState): boolean {
  return state.streams.some((stream) => stream.capped);
}
