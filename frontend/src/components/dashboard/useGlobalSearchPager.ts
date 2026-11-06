"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RateLimitError, searchDashboardGlobal } from "@/lib/api";
import {
  GLOBAL_SEARCH_DEBOUNCE_MS,
  hasGlobalSearchReportFilters,
  isGlobalSearchQueryReady,
  normalizeGlobalSearchInput,
  type GlobalSearchFilters,
  type GlobalSearchHit,
  type GlobalSearchKind,
  type GlobalSearchSurface,
} from "@/lib/global-search";
import {
  applyGlobalSearchChunk,
  createGlobalSearchPager,
  globalSearchPagerCapped,
  globalSearchPagerHasMore,
  planGlobalSearchChunks,
  takeGlobalSearchPage,
  type GlobalSearchPagerState,
} from "@/lib/global-search-pager";

export type GlobalSearchPagerView = {
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly page: readonly GlobalSearchHit[];
  /** Zero-based index of the page on screen. */
  readonly pageIndex: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  /** The last reachable page was reached and some entity still has rows past the API offset limit. */
  readonly capped: boolean;
  readonly error: string | null;
  readonly next: () => void;
  readonly previous: () => void;
  readonly retry: () => void;
};

const GENERIC_ERROR = "No se pudo completar la búsqueda. Reintentá en unos segundos.";

/** Mutable work of one session; never read during render. */
type Session = {
  readonly key: string;
  readonly pages: GlobalSearchHit[][];
  state: GlobalSearchPagerState;
};

/** What render reads: an immutable copy published after each load. */
type Snapshot = {
  readonly key: string;
  readonly pages: readonly (readonly GlobalSearchHit[])[];
  readonly hasMore: boolean;
  readonly capped: boolean;
  readonly pageIndex: number;
  readonly status: GlobalSearchPagerView["status"];
  readonly error: string | null;
};

/**
 * Server pagination for the full search, shared by Clínica and Admin, by
 * «Todo» and by every category (see `lib/global-search-pager.ts`).
 *
 * The page size is the capacity measured by the caller, so a page always fits
 * its canvas. Any change of query, filters, categories or page size starts a
 * new session at page 1; a session in flight is aborted and its answers are
 * dropped. Pages already read are kept, so «Anterior» never asks again.
 */
export function useGlobalSearchPager(input: {
  readonly surface: GlobalSearchSurface;
  readonly query: string;
  readonly filters: GlobalSearchFilters;
  readonly kinds: readonly GlobalSearchKind[];
  readonly pageSize: number;
  readonly enabled: boolean;
  readonly debounceMs?: number;
  /** Page to reopen on the first session after mount (search session memory). */
  readonly restorePageIndex?: number;
}): GlobalSearchPagerView {
  const { surface, filters, pageSize, enabled } = input;
  const debounceMs = input.debounceMs ?? GLOBAL_SEARCH_DEBOUNCE_MS;
  const query = normalizeGlobalSearchInput(input.query);
  const kinds = useMemo(
    () => (hasGlobalSearchReportFilters(filters) ? (["report"] as GlobalSearchKind[]) : [...input.kinds]),
    [filters, input.kinds],
  );
  const ready = enabled && pageSize > 0 && isGlobalSearchQueryReady(query);
  const key = ready ? JSON.stringify({ surface, query, filters, kinds, pageSize }) : null;

  const session = useRef<Session | null>(null);
  const controller = useRef<AbortController | null>(null);
  const failedIndex = useRef(0);
  const restoreIndex = useRef(Math.max(0, input.restorePageIndex ?? 0));
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const publish = useCallback((target: Session, patch: Partial<Snapshot>) => {
    setSnapshot((previous) => {
      const base: Snapshot =
        previous && previous.key === target.key
          ? previous
          : { key: target.key, pages: [], hasMore: true, capped: false, pageIndex: 0, status: "loading", error: null };
      return {
        ...base,
        pages: target.pages.map((page) => [...page]),
        hasMore: globalSearchPagerHasMore(target.state),
        capped: globalSearchPagerCapped(target.state),
        ...patch,
      };
    });
  }, []);

  const load = useCallback(
    async (target: Session, index: number) => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      publish(target, { status: "loading", error: null });
      try {
        while (target.pages.length <= index) {
          const plan = planGlobalSearchChunks(target.state, pageSize);
          const answers = await Promise.all(
            plan.map((chunk) =>
              searchDashboardGlobal(
                surface,
                { query, filters: { ...filters, kinds: [chunk.kind] }, limit: chunk.limit, offset: chunk.offset },
                { signal: abort.signal },
              ).then((result) => ({ chunk, result })),
            ),
          );
          if (abort.signal.aborted || session.current !== target) return;
          let state = target.state;
          for (const { chunk, result } of answers) state = applyGlobalSearchChunk(state, chunk, result);
          const taken = takeGlobalSearchPage(state, pageSize);
          target.state = taken.state;
          if (taken.page.length === 0 && target.pages.length > 0) break;
          target.pages.push([...taken.page]);
        }
        if (abort.signal.aborted || session.current !== target) return;
        publish(target, {
          status: "ready",
          error: null,
          pageIndex: Math.min(index, Math.max(0, target.pages.length - 1)),
        });
      } catch (caught) {
        if (abort.signal.aborted || session.current !== target) return;
        failedIndex.current = index;
        publish(target, {
          status: "error",
          error: caught instanceof RateLimitError ? caught.message : GENERIC_ERROR,
        });
      }
    },
    [filters, pageSize, publish, query, surface],
  );

  useEffect(() => {
    controller.current?.abort();
    if (!key) {
      session.current = null;
      return;
    }
    const next: Session = { key, pages: [], state: createGlobalSearchPager(kinds) };
    session.current = next;
    const target = restoreIndex.current;
    restoreIndex.current = 0;
    const timer = window.setTimeout(() => void load(next, target), debounceMs);
    return () => {
      window.clearTimeout(timer);
      controller.current?.abort();
    };
    // `kinds`, `load` inputs and `pageSize` are all part of `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, debounceMs]);

  const view = snapshot && key && snapshot.key === key ? snapshot : null;
  const pageIndex = view?.pageIndex ?? 0;
  const pages = view?.pages ?? [];
  const status: GlobalSearchPagerView["status"] = !key ? "idle" : (view?.status ?? "loading");
  const hasNext = status === "ready" && (pageIndex < pages.length - 1 || Boolean(view?.hasMore));
  const lastReachable = status === "ready" && pageIndex >= pages.length - 1 && !view?.hasMore;

  const next = useCallback(() => {
    const target = session.current;
    if (!target) return;
    const index = pageIndex + 1;
    if (index < target.pages.length) {
      publish(target, { pageIndex: index });
      return;
    }
    void load(target, index);
  }, [load, pageIndex, publish]);

  const previous = useCallback(() => {
    const target = session.current;
    if (target) publish(target, { pageIndex: Math.max(0, pageIndex - 1) });
  }, [pageIndex, publish]);

  const retry = useCallback(() => {
    const target = session.current;
    if (target) void load(target, failedIndex.current);
  }, [load]);

  return {
    status,
    page: pages[pageIndex] ?? [],
    pageIndex,
    hasPrevious: pageIndex > 0,
    hasNext,
    capped: lastReachable && Boolean(view?.capped),
    error: view?.error ?? null,
    next,
    previous,
    retry,
  };
}
