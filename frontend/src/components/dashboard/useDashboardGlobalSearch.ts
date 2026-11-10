"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RateLimitError, searchDashboardGlobal } from "@/lib/api";
import { ApiResponseError } from "@/lib/api-error";
import {
  GLOBAL_SEARCH_DEBOUNCE_MS,
  describeGlobalSearchSyntaxError,
  isGlobalSearchQueryReady,
  type GlobalSearchRequest,
  type GlobalSearchResult,
  type GlobalSearchSurface,
} from "@/lib/global-search";

export type DashboardGlobalSearchState =
  | { readonly status: "idle"; readonly result: null; readonly error: null }
  | { readonly status: "loading"; readonly result: GlobalSearchResult | null; readonly error: null }
  | { readonly status: "ready"; readonly result: GlobalSearchResult; readonly error: null }
  | { readonly status: "error"; readonly result: null; readonly error: string; readonly errorKind: "syntax" | "other" };

const IDLE: DashboardGlobalSearchState = { status: "idle", result: null, error: null };

const GENERIC_ERROR = "No se pudo completar la búsqueda. Reintentá en unos segundos.";

function describeError(
  error: unknown,
  surface: GlobalSearchSurface,
): { readonly message: string; readonly errorKind: "syntax" | "other" } {
  if (error instanceof RateLimitError) return { message: error.message, errorKind: "other" };
  if (error instanceof ApiResponseError && error.status === 400) {
    // A rejected query is the user's to fix: repeating it can never succeed.
    const syntax = describeGlobalSearchSyntaxError(surface, error.message);
    if (syntax) return { message: syntax, errorKind: "syntax" };
  }
  return { message: GENERIC_ERROR, errorKind: "other" };
}

/**
 * Debounced, cancellable server search. Every new request aborts the one in
 * flight, and a response is only committed when it belongs to the latest
 * request, so a slow answer for "ana" can never overwrite the one for "anal".
 */
export function useDashboardGlobalSearch(
  surface: GlobalSearchSurface,
  request: GlobalSearchRequest | null,
  debounceMs: number = GLOBAL_SEARCH_DEBOUNCE_MS,
): DashboardGlobalSearchState & { readonly retry: () => void } {
  const [state, setState] = useState<DashboardGlobalSearchState>(IDLE);
  const [attempt, setAttempt] = useState(0);
  const sequence = useRef(0);
  const key = request && isGlobalSearchQueryReady(request.query) ? JSON.stringify(request) : null;

  useEffect(() => {
    const current = ++sequence.current;
    if (!key) {
      setState(IDLE);
      return;
    }

    const parsed = JSON.parse(key) as GlobalSearchRequest;
    const controller = new AbortController();
    setState((previous) => ({
      status: "loading",
      result: previous.status === "ready" ? previous.result : previous.result ?? null,
      error: null,
    }) as DashboardGlobalSearchState);

    const timer = window.setTimeout(() => {
      searchDashboardGlobal(surface, parsed, { signal: controller.signal }).then(
        (result) => {
          if (current !== sequence.current || controller.signal.aborted) return;
          setState({ status: "ready", result, error: null });
        },
        (error: unknown) => {
          if (current !== sequence.current || controller.signal.aborted) return;
          const { message, errorKind } = describeError(error, surface);
          setState({ status: "error", result: null, error: message, errorKind });
        },
      );
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [surface, key, debounceMs, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, retry };
}
