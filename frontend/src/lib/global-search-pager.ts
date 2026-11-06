import {
  globalSearchHitKey,
  type GlobalSearchHit,
  type GlobalSearchKind,
  type GlobalSearchResult,
} from "./global-search";

/**
 * GLOBAL-SEARCH-3A-CURSOR · one pagination contract for every search view.
 *
 * The API ranks each entity on its own SQL order (rank, the entity's sort
 * timestamp with microseconds, id) and continues one entity at a time with an
 * opaque keyset cursor (`groups[].nextCursor`). A page of «Todo» is a k-way
 * merge of those per-entity streams: each stream is consumed strictly in the
 * order the server sent it and the comparator only chooses between the heads
 * of different streams. Rows are never re-sorted inside a stream, so a stream
 * whose visible date differs from its SQL key (reports show `upload_date`,
 * sort by `created_at`) keeps the server order. A k-way merge emits every row
 * of every stream exactly once; one category is simply the k = 1 case.
 *
 * There is no page or record cap: a stream ends only when the server says
 * `hasMore = false`, or when its answer cannot be continued safely (no
 * cursor, a repeated cursor, a window with no new row), which ends that
 * stream as `stalled` instead of looping.
 *
 * Pure: no fetch, no timers, no DOM. The hook drives it with real responses.
 */

/** Same order as `compareGlobalSearchHits` on the server (head selection only). */
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

/**
 * Chooses between the heads of two different streams, as the server's
 * `mergeGlobalSearchHits` does. Never used to sort rows of one stream.
 */
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
  /** Continuation of the next window; `null` before the first window. */
  readonly cursor: string | null;
  /** The first window was read. */
  readonly started: boolean;
  /** No further window will be requested for this kind. */
  readonly exhausted: boolean;
  /**
   * The server said there is more but gave nothing that can be continued
   * safely. Ended to avoid a loop and reported to the user, never hidden.
   */
  readonly stalled: boolean;
};

export type GlobalSearchPagerState = {
  readonly streams: readonly GlobalSearchStream[];
  /** Keys already paged: a second copy of a row is never emitted. */
  readonly emitted: ReadonlySet<string>;
};

export function createGlobalSearchPager(kinds: readonly GlobalSearchKind[]): GlobalSearchPagerState {
  return {
    streams: kinds.map((kind) => ({
      kind,
      buffer: [],
      cursor: null,
      started: false,
      exhausted: false,
      stalled: false,
    })),
    emitted: new Set(),
  };
}

/** One single-kind window: the first one without cursor, the rest with the stream's cursor. */
export type GlobalSearchChunkRequest = {
  readonly kind: GlobalSearchKind;
  readonly cursor: string | null;
  readonly limit: number;
};

/**
 * The single-kind windows needed before a page of `pageSize` rows can be
 * taken: every open stream must hold at least `pageSize` rows, because the
 * whole page may come from one entity. Each window asks for the API maximum,
 * so one request usually feeds several pages.
 */
export function planGlobalSearchChunks(
  state: GlobalSearchPagerState,
  pageSize: number,
): readonly GlobalSearchChunkRequest[] {
  const size = Math.max(1, Math.min(pageSize, GLOBAL_SEARCH_MAX_CHUNK));
  return state.streams
    .filter((stream) => !stream.exhausted && stream.buffer.length < size)
    .filter((stream) => !stream.started || stream.cursor !== null)
    .map((stream) => ({ kind: stream.kind, cursor: stream.cursor, limit: GLOBAL_SEARCH_MAX_CHUNK }));
}

/** Folds one single-kind response into its stream. Stale answers are ignored. */
export function applyGlobalSearchChunk(
  state: GlobalSearchPagerState,
  request: GlobalSearchChunkRequest,
  result: GlobalSearchResult,
): GlobalSearchPagerState {
  const group = result.groups.find((entry) => entry.kind === request.kind);
  const hasMore = group?.hasMore === true;
  const nextCursor = hasMore && typeof group?.nextCursor === "string" ? group.nextCursor : null;

  return {
    ...state,
    streams: state.streams.map((stream) => {
      if (stream.kind !== request.kind || stream.exhausted || stream.cursor !== request.cursor) return stream;
      if (stream.started && request.cursor === null) return stream;

      const known = new Set(stream.buffer.map(globalSearchHitKey));
      const fresh: GlobalSearchHit[] = [];
      for (const hit of result.hits) {
        if (hit.kind !== request.kind) continue;
        const key = globalSearchHitKey(hit);
        if (known.has(key) || state.emitted.has(key)) continue;
        known.add(key);
        fresh.push(hit);
      }

      // More is announced but cannot be reached safely: no cursor, the same
      // cursor again, or a window that brought nothing new.
      const stalled =
        hasMore && (nextCursor === null || nextCursor === request.cursor || fresh.length === 0);
      return {
        ...stream,
        buffer: [...stream.buffer, ...fresh],
        cursor: hasMore && !stalled ? nextCursor : null,
        started: true,
        exhausted: !hasMore || stalled,
        stalled,
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

/** Some entity announced more rows but its continuation could not be followed. */
export function globalSearchPagerStalled(state: GlobalSearchPagerState): boolean {
  return state.streams.some((stream) => stream.stalled);
}
