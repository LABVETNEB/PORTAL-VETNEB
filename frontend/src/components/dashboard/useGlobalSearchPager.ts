"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GlobalSearchCursorRejectedError, RateLimitError, searchDashboardGlobal } from "@/lib/api";
import { ApiResponseError } from "@/lib/api-error";
import {
  GLOBAL_SEARCH_DEBOUNCE_MS,
  describeGlobalSearchSyntaxError,
  hasGlobalSearchReportFilters,
  isGlobalSearchRequestReady,
  type GlobalSearchFilters,
  type GlobalSearchHit,
  type GlobalSearchKind,
  type GlobalSearchSurface,
} from "@/lib/global-search";
import { resolveGlobalSearchQuery } from "@/lib/global-search-query";
import {
  applyGlobalSearchChunk,
  createGlobalSearchPager,
  globalSearchPagerHasMore,
  globalSearchPagerStalled,
  planGlobalSearchChunks,
  takeGlobalSearchPage,
  type GlobalSearchPagerState,
} from "@/lib/global-search-pager";

/**
 * Why a page could not be read. `expired` is only the server rejecting a
 * continuation cursor; it is never inferred from another status.
 */
export type GlobalSearchPagerErrorKind = "expired" | "auth" | "forbidden" | "invalid" | "throttled" | "generic";

export type GlobalSearchPagerView = {
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly page: readonly GlobalSearchHit[];
  /** Zero-based index of the page on screen. */
  readonly pageIndex: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  /** The last page was reached and some entity announced more rows it could not continue. */
  readonly stalled: boolean;
  readonly error: string | null;
  readonly errorKind: GlobalSearchPagerErrorKind | null;
  readonly next: () => void;
  readonly previous: () => void;
  /** Re-reads the failed page of the same traversal (not for `expired`). */
  readonly retry: () => void;
  /** Drops the traversal and starts again at page 1, same query and filters. */
  readonly restart: () => void;
};

const GENERIC_ERROR = "No se pudo completar la búsqueda. Reintentá en unos segundos.";
export const GLOBAL_SEARCH_EXPIRED_MESSAGE =
  "La búsqueda quedó desactualizada. Actualizala para seguir desde la primera página; se conservan el texto y los filtros.";
const AUTH_ERROR = "Tu sesión expiró. Volvé a iniciar sesión para seguir buscando.";
const FORBIDDEN_ERROR = "No tenés permiso para realizar esta búsqueda.";
const INVALID_ERROR = "La búsqueda no es válida. Revisá el texto y los filtros.";

/**
 * A traversal stays reusable in memory (never in browser storage) at most
 * this long: the server signs cursors for 2 h, so a remembered continuation
 * is never older than that.
 */
const REUSE_TTL_MS = 2 * 60 * 60 * 1000 - 5 * 60 * 1000;

function classify(
  error: unknown,
  surface: GlobalSearchSurface,
): { readonly kind: GlobalSearchPagerErrorKind; readonly message: string } {
  if (error instanceof GlobalSearchCursorRejectedError) return { kind: "expired", message: GLOBAL_SEARCH_EXPIRED_MESSAGE };
  if (error instanceof RateLimitError) return { kind: "throttled", message: error.message };
  if (error instanceof ApiResponseError) {
    if (error.status === 401) return { kind: "auth", message: AUTH_ERROR };
    if (error.status === 403) return { kind: "forbidden", message: FORBIDDEN_ERROR };
    if (error.status === 400) {
      return { kind: "invalid", message: describeGlobalSearchSyntaxError(surface, error.message) ?? INVALID_ERROR };
    }
  }
  return { kind: "generic", message: GENERIC_ERROR };
}

/** Mutable work of one traversal; never read during render. */
type Session = {
  readonly key: string;
  readonly createdAt: number;
  readonly pages: GlobalSearchHit[][];
  state: GlobalSearchPagerState;
};

/**
 * The last traversal of each surface, for the tab's SPA lifetime only. Opening
 * a record remounts the top bar; coming back reuses the pages already read
 * instead of replaying every window up to a deep page. Logout hard-reloads
 * the document, which drops it.
 */
const TRAVERSALS = new Map<GlobalSearchSurface, Session>();

/** What render reads: an immutable copy published after each load. */
type Snapshot = {
  readonly key: string;
  readonly pages: readonly (readonly GlobalSearchHit[])[];
  readonly hasMore: boolean;
  readonly stalled: boolean;
  readonly pageIndex: number;
  readonly status: GlobalSearchPagerView["status"];
  readonly error: string | null;
  readonly errorKind: GlobalSearchPagerErrorKind | null;
};

/**
 * Server pagination for the full search, shared by Clínica and Admin, by
 * «Todo» and by every category (see `lib/global-search-pager.ts`).
 *
 * The page size is the capacity measured by the caller, so a page always fits
 * its canvas. Any change of query, filters, categories or page size starts a
 * new traversal at page 1; a load in flight is aborted and its answers are
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
  /** Page to reopen on the first traversal after mount (search session memory). */
  readonly restorePageIndex?: number;
}): GlobalSearchPagerView {
  const { surface, pageSize, enabled } = input;
  const debounceMs = input.debounceMs ?? GLOBAL_SEARCH_DEBOUNCE_MS;
  // One model: the words and the filters (typed operators already on top of the
  // applied ones) are exactly what the request composes into `q`, so the
  // traversal key changes only when the canonical search does.
  const resolved = useMemo(
    () => resolveGlobalSearchQuery(surface, input.query, input.filters),
    [surface, input.query, input.filters],
  );
  // The request is built from the RAW state (it resolves it once, like `resolved`);
  // resolving already-resolved words again would not be idempotent for a conflicting operator.
  const query = input.query;
  const filters = input.filters;
  const effectiveFilters = resolved.filters;
  const kinds = useMemo(
    () => (hasGlobalSearchReportFilters(effectiveFilters) ? (["report"] as GlobalSearchKind[]) : [...input.kinds]),
    [effectiveFilters, input.kinds],
  );
  const ready = enabled && pageSize > 0 && isGlobalSearchRequestReady(surface, resolved.words, effectiveFilters);
  const key = ready ? JSON.stringify({ surface, text: resolved.text, kinds, pageSize }) : null;

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
          : {
              key: target.key,
              pages: [],
              hasMore: true,
              stalled: false,
              pageIndex: 0,
              status: "loading",
              error: null,
              errorKind: null,
            };
      return {
        ...base,
        pages: target.pages.map((page) => [...page]),
        hasMore: globalSearchPagerHasMore(target.state),
        stalled: globalSearchPagerStalled(target.state),
        ...patch,
      };
    });
  }, []);

  const startSession = useCallback(
    (sessionKey: string): Session => {
      const next: Session = {
        key: sessionKey,
        createdAt: Date.now(),
        pages: [],
        state: createGlobalSearchPager(kinds),
      };
      session.current = next;
      TRAVERSALS.set(surface, next);
      return next;
    },
    [kinds, surface],
  );

  const load = useCallback(
    async (target: Session, index: number) => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      publish(target, { status: "loading", error: null, errorKind: null });
      try {
        while (target.pages.length <= index) {
          const plan = planGlobalSearchChunks(target.state, pageSize);
          const answers = await Promise.all(
            plan.map((chunk) =>
              searchDashboardGlobal(
                surface,
                chunk.cursor === null
                  ? { query, filters: { ...filters, kinds: [chunk.kind] }, limit: chunk.limit, offset: 0 }
                  : { query, filters: { ...filters, kinds: [chunk.kind] }, limit: chunk.limit, cursor: chunk.cursor },
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
          errorKind: null,
          pageIndex: Math.min(index, Math.max(0, target.pages.length - 1)),
        });
      } catch (caught) {
        if (abort.signal.aborted || session.current !== target) return;
        // One failed window cancels its siblings: their answers would be dropped.
        abort.abort();
        const { kind, message } = classify(caught, surface);
        failedIndex.current = index;
        if (kind === "expired") {
          // The traversal can no longer continue: none of its cursors is reused.
          target.pages.length = 0;
          target.state = createGlobalSearchPager([]);
          if (TRAVERSALS.get(surface) === target) TRAVERSALS.delete(surface);
          publish(target, { status: "error", error: message, errorKind: kind, pageIndex: 0, hasMore: false });
          return;
        }
        publish(target, { status: "error", error: message, errorKind: kind });
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
    const target = restoreIndex.current;
    restoreIndex.current = 0;

    const remembered = TRAVERSALS.get(surface);    if (
      target > 0 &&
      remembered &&
      remembered.key === key &&
      target < remembered.pages.length &&
      Date.now() - remembered.createdAt < REUSE_TTL_MS
    ) {
      session.current = remembered;
      publish(remembered, { status: "ready", error: null, errorKind: null, pageIndex: target });
      return () => {
        controller.current?.abort();
      };
    }

    const next = startSession(key);
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
  const lastPage = status === "ready" && pageIndex >= pages.length - 1 && !view?.hasMore;

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
    if (target && view?.errorKind !== "expired") void load(target, failedIndex.current);
  }, [load, view?.errorKind]);

  const restart = useCallback(() => {
    if (!key) return;
    void load(startSession(key), 0);
  }, [key, load, startSession]);

  return {
    status,
    page: status === "error" && view?.errorKind === "expired" ? [] : (pages[pageIndex] ?? []),
    pageIndex,
    hasPrevious: pageIndex > 0 && !(status === "error" && view?.errorKind === "expired"),
    hasNext,
    stalled: lastPage && Boolean(view?.stalled),
    error: view?.error ?? null,
    errorKind: view?.errorKind ?? null,
    next,
    previous,
    retry,
    restart,
  };
}
