"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { ArrowRight, History, LoaderCircle, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { loadGlobalSearchState, saveGlobalSearchState } from "@/lib/api";
import {
  getDisplayedSearch,
  requestSearchSelection,
  subscribeDisplayedSearch,
} from "@/lib/dashboard/navigation/searchNavigation";
import {
  DASHBOARD_GLOBAL_SEARCH_OPEN_EVENT,
  EMPTY_GLOBAL_SEARCH_FILTERS,
  GLOBAL_SEARCH_MAX_QUERY,
  GLOBAL_SEARCH_SUGGESTION_LIMIT,
  describeGlobalSearchFilterChips,
  formatGlobalSearchDate,
  globalSearchHitKey,
  globalSearchKindLabel,
  globalSearchStatusLabel,
  groupGlobalSearchHits,
  isGlobalSearchFocusShortcut,
  isGlobalSearchRequestReady,
  normalizeGlobalSearchInput,
  readGlobalSearchRecent,
  readGlobalSearchSession,
  rememberGlobalSearchQuery,
  type GlobalSearchFilters,
  type GlobalSearchHit,
  type GlobalSearchKind,
  type GlobalSearchSurface,
} from "@/lib/global-search";
import { resolveGlobalSearchQuery } from "@/lib/global-search-query";
import { cn } from "@/lib/utils";
import {
  DashboardGlobalSearchDialog,
  type DashboardGlobalSearchConfirmation,
  type DashboardGlobalSearchOpenRequest,
} from "./DashboardGlobalSearchDialog";
import { useDashboardGlobalSearch } from "./useDashboardGlobalSearch";

type SearchOption =
  | { readonly type: "hit"; readonly key: string; readonly hit: GlobalSearchHit }
  | { readonly type: "recent"; readonly key: string; readonly query: string }
  | { readonly type: "all"; readonly key: string };

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}


function optionDomId(listboxId: string, option: SearchOption): string {
  return `${listboxId}-${option.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function hitMeta(surface: GlobalSearchSurface, hit: GlobalSearchHit): string {
  return [
    hit.subtitle,
    globalSearchStatusLabel(hit.kind, hit.status),
    surface === "admin" && hit.kind !== "clinic" ? hit.clinic?.name : null,
    formatGlobalSearchDate(hit.date),
  ]
    .filter(Boolean)
    .join(" · ");
}

function SearchOptionRow({
  id,
  option,
  selected,
  extra,
  onChoose,
  children,
}: {
  readonly id: string;
  readonly option: SearchOption;
  readonly selected: boolean;
  readonly extra?: Record<string, string>;
  readonly onChoose: (option: SearchOption) => void;
  readonly children: ReactNode;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      // Focusable but not tabbable: the click focuses the option, which keeps
      // the listbox open through the selection (see `onWrapperBlur`). Keyboard
      // users drive the list from the combobox with aria-activedescendant.
      tabIndex={-1}
      {...extra}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 px-4 py-1.5 text-foreground",
        selected && "bg-accent/70",
      )}
      onClick={() => onChoose(option)}
    >
      {children}
    </li>
  );
}

/**
 * GLOBAL-SEARCH-2 · "Buscar en VETNEB".
 *
 * The top-bar combobox searches REAL records through the authorized API
 * (`/api/search` for Clínica, `/api/admin/search` for Admin), debounced and
 * cancellable, grouped by entity. Module names are never suggested. Choosing a record opens it
 * in the record view of the full search dialog, which resolves it by id - it
 * never depends on the row being loaded in the current module page.
 *
 * Every way of confirming a search (Enter here or in the dialog, «Ver todos»,
 * a recent search, a suggested hit with its query, operators and filters)
 * goes through the dialog, which hands the CANONICAL search to `confirmSearch`.
 * That is the only place that saves it (`/api/search/states`) and asks the
 * navigation machine for `?sq=<uuid>` (`searchNavigation.ts`): this component
 * never writes the URL itself. A display that carries an `sq` (reload, Back,
 * Forward, return from a record) is read back and reopens the dialog.
 *
 * Navigation to a record uses the router control pattern (button + router.push);
 * link elements are forbidden for in-app routing (AGENTS.md 10).
 */
export function DashboardGlobalSearch({ surface }: { readonly surface: GlobalSearchSurface }) {
  const router = useRouter();

  const listboxId = useId();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(() => readGlobalSearchSession(surface)?.query ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [openRequest, setOpenRequest] = useState<DashboardGlobalSearchOpenRequest | null>(null);
  const [recent, setRecent] = useState<readonly string[]>(() => readGlobalSearchRecent(surface));
  // The dialog's effective filters: the preview searches with the same ones.
  const [dialogFilters, setDialogFilters] = useState<GlobalSearchFilters>(
    () => readGlobalSearchSession(surface)?.filters ?? EMPTY_GLOBAL_SEARCH_FILTERS,
  );

  const normalized = normalizeGlobalSearchInput(query);
  const ready = isGlobalSearchRequestReady(surface, query, dialogFilters);
  const filterChips = useMemo(
    () => describeGlobalSearchFilterChips(surface, resolveGlobalSearchQuery(surface, query, dialogFilters).filters),
    [dialogFilters, query, surface],
  );
  const request = useMemo(
    () =>
      ready && open
        ? { query: normalized, filters: dialogFilters, limit: GLOBAL_SEARCH_SUGGESTION_LIMIT, offset: 0 }
        : null,
    [dialogFilters, normalized, open, ready],
  );
  const search = useDashboardGlobalSearch(surface, request);

  const hitGroups = useMemo(
    () => (search.status === "ready" && search.result ? groupGlobalSearchHits(surface, search.result) : []),
    [search.result, search.status, surface],
  );

  const options = useMemo<readonly SearchOption[]>(() => {
    const list: SearchOption[] = [];
    if (!ready) {
      for (const entry of recent) list.push({ type: "recent", key: `recent:${entry}`, query: entry });
      return list;
    }
    for (const group of hitGroups) {
      for (const hit of group.hits) list.push({ type: "hit", key: globalSearchHitKey(hit), hit });
    }
    if (ready) list.push({ type: "all", key: "all" });
    return list;
  }, [hitGroups, ready, recent]);

  const active = options.length > 0 ? options[Math.min(activeIndex, options.length - 1)] : undefined;
  const expanded = open && options.length > 0;

  // An empty query reopens the last search session (query, filters, page,
  // open record); a query or a chosen hit starts or updates it.
  const openDialog = useCallback(
    (
      nextQuery: string,
      hit: GlobalSearchHit | null,
      extra?: Pick<DashboardGlobalSearchOpenRequest, "filters" | "kinds" | "restored">,
    ) => {
      setOpen(false);
      if (nextQuery && !extra?.restored && extra?.filters !== "unavailable") {
        setRecent(rememberGlobalSearchQuery(surface, nextQuery));
      }
      setOpenRequest((previous) => ({ id: (previous?.id ?? 0) + 1, query: nextQuery, hit, ...extra }));
      setDialogOpen(true);
    },
    [surface],
  );

  // ── Saved searches (?sq=) ──────────────────────────────────────────────────
  const displayedSearch = useSyncExternalStore(subscribeDisplayedSearch, getDisplayedSearch, () => null);
  const dialogOpenRef = useRef(false);
  useEffect(() => {
    dialogOpenRef.current = dialogOpen;
  }, [dialogOpen]);
  /** The id of the search this bar has already applied or saved: its own selection is not read back. */
  const appliedSearch = useRef<string | null>(null);
  const saveSequence = useRef(0);
  const saveController = useRef<AbortController | null>(null);
  const lastSave = useRef<{ readonly key: string; readonly pending: boolean; readonly id: string | null } | null>(null);

  const cancelPendingSave = useCallback(() => {
    saveSequence.current += 1;
    saveController.current?.abort();
    saveController.current = null;
  }, []);

  /**
   * The single confirmation. Repeating the search that is already saved (or in
   * flight) does nothing; a late answer never navigates when another
   * confirmation overtook it or the dialog closed (opening a record, for
   * example); a failed save leaves the search working without `?sq=`.
   */
  const confirmSearch = useCallback(
    (search: DashboardGlobalSearchConfirmation) => {
      setRecent(readGlobalSearchRecent(surface));
      const key = JSON.stringify([search.query, search.kinds]);
      const last = lastSave.current;
      if (last && last.key === key && (last.pending || (last.id !== null && getDisplayedSearch() === last.id))) return;

      cancelPendingSave();
      const sequence = saveSequence.current;
      const controller = new AbortController();
      saveController.current = controller;
      lastSave.current = { key, pending: true, id: null };
      saveGlobalSearchState(surface, { q: search.query, kinds: search.kinds as readonly GlobalSearchKind[] }, { signal: controller.signal }).then(
        ({ id }) => {
          if (sequence !== saveSequence.current) return;
          if (!dialogOpenRef.current) {
            lastSave.current = null;
            return;
          }
          lastSave.current = { key, pending: false, id };
          appliedSearch.current = id;
          if (!requestSearchSelection(id)) appliedSearch.current = null;
        },
        () => {
          if (sequence === saveSequence.current) lastSave.current = null;
        },
      );
    },
    [cancelPendingSave, surface],
  );

  // A display with `sq` (reload, Back, Forward, return from a record) is read
  // back and reopens the dialog; one without it closes what that search opened.
  useEffect(() => {
    if (displayedSearch === null) {
      if (appliedSearch.current !== null) {
        appliedSearch.current = null;
        cancelPendingSave();
        setDialogOpen(false);
      }
      return undefined;
    }
    if (appliedSearch.current === displayedSearch) return undefined;

    const controller = new AbortController();
    const unavailable = () => {
      if (controller.signal.aborted) return;
      appliedSearch.current = displayedSearch;
      openDialog("", null, { filters: "unavailable", restored: true });
    };
    loadGlobalSearchState(surface, displayedSearch, { signal: controller.signal }).then((state) => {
      if (controller.signal.aborted) return;
      appliedSearch.current = displayedSearch;
      openDialog(state.q, null, { filters: "replace", kinds: state.kinds, restored: true });
    }, unavailable);
    return () => controller.abort();
  }, [cancelPendingSave, displayedSearch, openDialog, surface]);

  useEffect(() => cancelPendingSave, [cancelPendingSave]);

  const onDialogOpenChange = useCallback(
    (next: boolean) => {
      setDialogOpen(next);
      if (next) return;
      // Closing selects the same location without its `sq`; opening a record
      // does not come through here (it navigates and closes on its own).
      cancelPendingSave();
      if (getDisplayedSearch() !== null) {
        appliedSearch.current = null;
        requestSearchSelection(null);
      }
    },
    [cancelPendingSave],
  );

  const select = useCallback(
    (option: SearchOption | undefined) => {
      if (!option) return;
      if (option.type === "recent") {
        setQuery(option.query);
        // A recent search brings its own filters (typed operators in its text).
        openDialog(option.query, null, { filters: "replace" });
        return;
      }
      openDialog(normalized, option.type === "hit" ? option.hit : null);
    },
    [normalized, openDialog],
  );

  const onChoose = useCallback(
    (option: SearchOption) => {
      setActiveIndex(Math.max(0, options.findIndex((candidate) => candidate.key === option.key)));
      select(option);
    },
    [options, select],
  );

  useEffect(() => {
    function onOpenRequest() {
      openDialog("", null);
    }
    function onShortcut(event: KeyboardEvent) {
      if (
        isGlobalSearchFocusShortcut({
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          targetEditable: isEditableTarget(event.target),
        })
      ) {
        const input = inputRef.current;
        if (dialogOpen || !input || input.offsetParent === null) return;
        event.preventDefault();
        input.focus();
        input.select();
        setOpen(true);
        return;
      }
      if (event.key.toLowerCase() !== "k" || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const input = inputRef.current;
      if (input && input.offsetParent !== null) {
        input.focus();
        setOpen(true);
      } else {
        openDialog("", null);
      }
    }
    window.addEventListener(DASHBOARD_GLOBAL_SEARCH_OPEN_EVENT, onOpenRequest);
    window.addEventListener("keydown", onShortcut);
    return () => {
      window.removeEventListener(DASHBOARD_GLOBAL_SEARCH_OPEN_EVENT, onOpenRequest);
      window.removeEventListener("keydown", onShortcut);
    };
  }, [dialogOpen, openDialog]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
        setActiveIndex((index) => Math.min(index + 1, Math.max(0, options.length - 1)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setOpen(true);
        setActiveIndex((index) => Math.max(0, index - 1));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (active) select(active);
        else if (ready) openDialog(normalized, null);
        return;
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    },
    [active, normalized, openDialog, options.length, ready, select],
  );

  /**
   * Closes only when focus really leaves the search. Pointer-press handlers
   * are forbidden on frontend sources (text-selection/copy guard), so options
   * carry `tabIndex={-1}`: a click moves focus INTO this wrapper and
   * `relatedTarget` proves it.
   */
  const onWrapperBlur = useCallback((event: ReactFocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setOpen(false);
  }, []);

  const statusMessage = !open || !ready
    ? ""
    : search.status === "loading"
      ? "Buscando registros…"
      : search.status === "error"
        ? search.error
        : search.status === "ready" && hitGroups.length === 0
          ? `Sin registros para «${normalized}».`
          : search.status === "ready"
            ? `${search.result.hits.length} registros encontrados.`
            : "";

  const renderOption = (option: SearchOption, content: ReactNode, extra?: Record<string, string>) => (
    <SearchOptionRow
      key={option.key}
      id={optionDomId(listboxId, option)}
      option={option}
      selected={active?.key === option.key}
      extra={extra}
      onChoose={onChoose}
    >
      {content}
    </SearchOptionRow>
  );

  const allOption = options.find((option) => option.type === "all");
  const recentOptions = options.filter(
    (option): option is Extract<SearchOption, { type: "recent" }> => option.type === "recent",
  );

  return (
    <>
      <div
        className="relative hidden min-w-0 shrink md:block md:w-48 lg:w-72 xl:w-[26rem] 2xl:w-[32rem]"
        data-workspace-app-bar-search="true"
        data-dashboard-global-search={surface}
        onBlur={onWrapperBlur}
      >
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-describedby={statusId}
          aria-activedescendant={expanded && active ? optionDomId(listboxId, active) : undefined}
          aria-label="Buscar en VETNEB"
          placeholder="Buscar en VETNEB"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={GLOBAL_SEARCH_MAX_QUERY}
          data-workspace-app-bar-search-input="true"
          className="h-[var(--dash-drv-search-h)] w-full min-w-0 rounded-[var(--dash-drv-search-radius)] border border-transparent bg-[var(--dash-drv-search-fill)] pl-12 pr-4 text-[length:var(--dash-drv-search-font)] text-foreground transition-[background-color,border-color] duration-100 motion-reduce:transition-none placeholder:text-muted-foreground hover:bg-accent/60 focus-visible:border-input focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            // Recent searches wait for an arrow key: Enter on an empty field does nothing.
            setActiveIndex(isGlobalSearchRequestReady(surface, event.target.value, dialogFilters) ? 0 : -1);
            setOpen(true);
          }}
          onFocus={() => {
            if (!ready) setActiveIndex(-1);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <div
          data-workspace-app-bar-search-results="true"
          hidden={!open || (options.length === 0 && !statusMessage)}
          className="absolute left-0 top-[calc(100%+0.25rem)] z-50 w-[max(100%,min(28rem,calc(100vw-2rem)))] overflow-hidden rounded-2xl border border-input bg-card py-2 text-sm"
        >
          {/*
            The listbox always exists so `aria-controls` resolves; `hidden`
            (not conditional rendering) keeps the reference valid.
          */}
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Resultados de búsqueda"
            hidden={!expanded}
            className="max-h-[min(26rem,60dvh)] overflow-y-auto overscroll-contain"
          >
            {hitGroups.map((group) => (
              <li role="presentation" key={group.kind}>
                <ul role="group" aria-label={globalSearchKindLabel(group.kind)} data-global-search-group={group.kind}>
                  <li role="presentation" aria-hidden="true" className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {globalSearchKindLabel(group.kind)}
                  </li>
                  {group.hits.map((hit) =>
                    renderOption(
                      { type: "hit", key: globalSearchHitKey(hit), hit },
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{hit.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{hitMeta(surface, hit)}</span>
                      </span>,
                      { "data-global-search-hit": globalSearchHitKey(hit) },
                    ),
                  )}
                </ul>
              </li>
            ))}
            {recentOptions.length > 0 ? (
              <li role="presentation">
                <ul role="group" aria-label="Búsquedas recientes" data-global-search-group="recent">
                  <li role="presentation" aria-hidden="true" className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Búsquedas recientes
                  </li>
                  {recentOptions.map((option) =>
                    renderOption(
                      option,
                      <span className="flex min-w-0 items-center gap-3">
                        <History className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="truncate">{option.query}</span>
                      </span>,
                      { "data-global-search-recent": "true" },
                    ),
                  )}
                </ul>
              </li>
            ) : null}
            {allOption
              ? renderOption(
                  allOption,
                  <span className="flex min-w-0 items-center gap-2 font-medium text-primary">
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{`Ver todos los resultados de «${normalized}»`}</span>
                  </span>,
                  { "data-global-search-see-all": "true" },
                )
              : null}
          </ul>
          {filterChips.length > 0 ? (
            <p className="px-4 pb-1 text-xs text-muted-foreground" data-global-search-active-filters="true">
              {`Filtros activos: ${filterChips.map((chip) => chip.label).join(", ")}`}
            </p>
          ) : null}
          <p
            id={statusId}
            role="status"
            aria-live="polite"
            data-global-search-status={open && ready ? search.status : "idle"}
            data-global-search-error-kind={open && ready && search.status === "error" ? search.errorKind : undefined}
            className={cn("flex items-center gap-2 px-4 text-xs text-muted-foreground", statusMessage ? "py-1.5" : "sr-only")}
          >
            {open && ready && search.status === "loading" ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : null}
            <span>{statusMessage}</span>
            {open && ready && search.status === "error" && search.errorKind !== "syntax" ? (
              <button
                type="button"
                className="ml-auto rounded-md px-2 py-1 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85"
                onClick={() => search.retry()}
              >
                Reintentar
              </button>
            ) : null}
          </p>
        </div>
      </div>

      <DashboardGlobalSearchDialog
        surface={surface}
        open={dialogOpen}
        request={openRequest}
        onOpenChange={onDialogOpenChange}
        onSearchConfirmed={confirmSearch}
        onSearchStateChange={(state) => {
          setQuery(state.query);
          setDialogFilters(state.filters);
        }}
        returnFocusRef={inputRef}
        onOpenDestination={(destination) => {
          // The bar keeps the query: reopening the search restores the session.
          setDialogOpen(false);
          router.push(destination);
        }}
      />
    </>
  );
}
