"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  ADMIN_MODULE_NAV_LABELS,
  CLINIC_MODULE_NAV_LABELS,
} from "@/features/dashboard/config";
import { buildDashboardModuleHref } from "@/features/dashboard/application";
import { requestAdminModuleActivate } from "@/lib/admin-hub-reset";
import { requestClinicModuleActivate } from "@/lib/clinic-hub-reset";
import {
  DASHBOARD_GLOBAL_SEARCH_OPEN_EVENT,
  EMPTY_GLOBAL_SEARCH_FILTERS,
  GLOBAL_SEARCH_SUGGESTION_LIMIT,
  foldGlobalSearchText,
  formatGlobalSearchDate,
  globalSearchHitKey,
  globalSearchKindLabel,
  globalSearchStatusLabel,
  groupGlobalSearchHits,
  isGlobalSearchQueryReady,
  normalizeGlobalSearchInput,
  readGlobalSearchSession,
  type GlobalSearchHit,
  type GlobalSearchSurface,
} from "@/lib/global-search";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  DashboardGlobalSearchDialog,
  type DashboardGlobalSearchOpenRequest,
} from "./DashboardGlobalSearchDialog";
import { useDashboardGlobalSearch } from "./useDashboardGlobalSearch";

type ModuleEntry = { readonly moduleId: string; readonly label: string };

type SearchOption =
  | { readonly type: "module"; readonly key: string; readonly entry: ModuleEntry }
  | { readonly type: "hit"; readonly key: string; readonly hit: GlobalSearchHit }
  | { readonly type: "all"; readonly key: string };


function matchModules(entries: readonly ModuleEntry[], query: string): readonly ModuleEntry[] {
  const needle = foldGlobalSearchText(query);
  if (!needle) return entries;
  return entries.filter(
    (entry) =>
      foldGlobalSearchText(entry.label).includes(needle) ||
      foldGlobalSearchText(entry.moduleId).includes(needle),
  );
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
 * cancellable, grouped by entity. Module shortcuts stay as a secondary "Ir a"
 * group so the bar keeps its module navigation, but they are no longer the
 * search corpus. Choosing a record opens it in the record view of the full
 * search dialog, which resolves it by id - it never depends on the row being
 * loaded in the current module page.
 *
 * Navigation uses the router control pattern (button + router.push); link
 * elements are forbidden for in-app routing (AGENTS.md 10).
 */
export function DashboardGlobalSearch({ surface }: { readonly surface: GlobalSearchSurface }) {
  const router = useRouter();
  const isAdmin = surface === "admin";
  const basePath = isAdmin ? ROUTES.dashboardAdmin : ROUTES.dashboard;
  const modules = useMemo<readonly ModuleEntry[]>(
    () =>
      (isAdmin ? ADMIN_MODULE_NAV_LABELS : CLINIC_MODULE_NAV_LABELS).map((item) => ({
        moduleId: item.moduleId,
        label: item.label,
      })),
    [isAdmin],
  );

  const listboxId = useId();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(() => readGlobalSearchSession(surface)?.query ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [openRequest, setOpenRequest] = useState<DashboardGlobalSearchOpenRequest | null>(null);

  const normalized = normalizeGlobalSearchInput(query);
  const ready = isGlobalSearchQueryReady(query);
  const request = useMemo(
    () =>
      ready && open
        ? { query: normalized, filters: EMPTY_GLOBAL_SEARCH_FILTERS, limit: GLOBAL_SEARCH_SUGGESTION_LIMIT, offset: 0 }
        : null,
    [normalized, open, ready],
  );
  const search = useDashboardGlobalSearch(surface, request);

  const moduleMatches = useMemo(() => matchModules(modules, query), [modules, query]);
  const hitGroups = useMemo(
    () => (search.status === "ready" && search.result ? groupGlobalSearchHits(surface, search.result) : []),
    [search.result, search.status, surface],
  );

  const options = useMemo<readonly SearchOption[]>(() => {
    const list: SearchOption[] = moduleMatches.map((entry) => ({
      type: "module",
      key: `module:${entry.moduleId}`,
      entry,
    }));
    for (const group of hitGroups) {
      for (const hit of group.hits) list.push({ type: "hit", key: globalSearchHitKey(hit), hit });
    }
    if (ready) list.push({ type: "all", key: "all" });
    return list;
  }, [hitGroups, moduleMatches, ready]);

  const active = options.length > 0 ? options[Math.min(activeIndex, options.length - 1)] : undefined;
  const expanded = open && options.length > 0;

  // An empty query reopens the last search session (query, filters, page,
  // open record); a query or a chosen hit starts or updates it.
  const openDialog = useCallback((nextQuery: string, hit: GlobalSearchHit | null) => {
    setOpen(false);
    setOpenRequest((previous) => ({ id: (previous?.id ?? 0) + 1, query: nextQuery, hit }));
    setDialogOpen(true);
  }, []);

  const select = useCallback(
    (option: SearchOption | undefined) => {
      if (!option) return;
      if (option.type === "module") {
        setOpen(false);
        setQuery("");
        setActiveIndex(0);
        inputRef.current?.blur();
        // Same optimistic activation as every module destination. A claimed
        // request is navigated by the controller (single flight).
        const claimed = isAdmin
          ? requestAdminModuleActivate(option.entry.moduleId)
          : requestClinicModuleActivate(option.entry.moduleId);
        if (!claimed) router.push(buildDashboardModuleHref(basePath, option.entry.moduleId));
        return;
      }
      openDialog(normalized, option.type === "hit" ? option.hit : null);
    },
    [basePath, isAdmin, normalized, openDialog, router],
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
  }, [openDialog]);

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

  const moduleOptions = options.filter((option) => option.type === "module");
  const allOption = options.find((option) => option.type === "all");

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
          maxLength={80}
          data-workspace-app-bar-search-input="true"
          className="h-[var(--dash-drv-search-h)] w-full min-w-0 rounded-[var(--dash-drv-search-radius)] border border-transparent bg-[var(--dash-drv-search-fill)] pl-12 pr-4 text-[length:var(--dash-drv-search-font)] text-foreground transition-[background-color,border-color] duration-100 motion-reduce:transition-none placeholder:text-muted-foreground hover:bg-accent/60 focus-visible:border-input focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
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
            {moduleOptions.length > 0 ? (
              <li role="presentation">
                <ul role="group" aria-label="Ir a módulo">
                  <li role="presentation" aria-hidden="true" className="px-4 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ir a módulo
                  </li>
                  {moduleOptions.map((option) =>
                    option.type === "module"
                      ? renderOption(option, <span className="truncate">{option.entry.label}</span>, {
                          "data-workspace-app-bar-search-option": option.entry.moduleId,
                        })
                      : null,
                  )}
                </ul>
              </li>
            ) : null}
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
          <p
            id={statusId}
            role="status"
            aria-live="polite"
            data-global-search-status={open && ready ? search.status : "idle"}
            className={cn("flex items-center gap-2 px-4 text-xs text-muted-foreground", statusMessage ? "py-1.5" : "sr-only")}
          >
            {open && ready && search.status === "loading" ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : null}
            <span>{statusMessage}</span>
            {open && ready && search.status === "error" ? (
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
        onOpenChange={setDialogOpen}
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
