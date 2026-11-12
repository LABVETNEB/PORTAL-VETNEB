"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";

import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";
import { Button } from "@/components/ui/button";
import { SuperSearchField } from "@/features/dashboard/presentation/filters/SuperSearchField";
import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";
import {
  EMPTY_GLOBAL_SEARCH_FILTERS,
  GLOBAL_SEARCH_MAX_QUERY,
  GLOBAL_SEARCH_REPORT_STATUS_OPTIONS,
  GLOBAL_SEARCH_STUDY_TYPE_OPTIONS,
  buildGlobalSearchDestination,
  clearGlobalSearchFilter,
  describeGlobalSearchFilterChips,
  formatGlobalSearchDate,
  formatGlobalSearchFact,
  globalSearchDestinationOpensRecord,
  globalSearchHitKey,
  globalSearchKindLabel,
  globalSearchKindSingularLabel,
  globalSearchKindsFor,
  globalSearchStatusLabel,
  hasGlobalSearchReportFilters,
  isGlobalSearchRequestReady,
  readGlobalSearchSession,
  rememberGlobalSearchQuery,
  writeGlobalSearchSession,
  type GlobalSearchFilters,
  type GlobalSearchHit,
  type GlobalSearchKind,
  type GlobalSearchReportStatus,
  type GlobalSearchSurface,
} from "@/lib/global-search";
import { GLOBAL_SEARCH_MAX_CHUNK } from "@/lib/global-search-pager";
import {
  EMPTY_GLOBAL_SEARCH_ADVANCED_TEXT,
  composeAdvancedFreeText,
  foldTypedGlobalSearchFilters,
  readAdvancedFreeText,
  resolveGlobalSearchQuery,
  type GlobalSearchAdvancedText,
} from "@/lib/global-search-query";
import { cn } from "@/lib/utils";
import { useGlobalSearchPager } from "./useGlobalSearchPager";

/**
 * Row pitch of the results canvas. Rows are locked to it (`h-[var(--dash-row-pitch)]`)
 * and the capacity engine divides the measured canvas by it, so a page always
 * fits without vertical scroll. Two text lines plus a 44 px touch target.
 */
const RESULT_ROW_PITCH_PX = 52;
const RESULTS_FALLBACK_ROWS = 6;

const RESULTS_CANVAS_STYLE = {
  "--dash-row-pitch": `${RESULT_ROW_PITCH_PX}px`,
  "--dash-row-gap": "0px",
} as CSSProperties;

const DESTINATION_LABELS: Readonly<Record<GlobalSearchSurface, Readonly<Record<GlobalSearchKind, string>>>> = {
  clinic: {
    clinic: "Informes",
    report: "Informes",
    particular_token: "Tokens",
    tracking_case: "Informes",
    clinic_user: "Informes",
  },
  admin: {
    clinic: "Clínicas",
    report: "Informes",
    particular_token: "Tokens",
    tracking_case: "Informes",
    clinic_user: "Usuarios",
  },
};

/**
 * What opened the dialog: a query from the bar, a chosen hit, or a plain reopen.
 *
 * `filters` says what happens to the filters already applied: `keep` (default:
 * the words typed in the bar never reset them), `replace` (a recent or saved
 * search carries its own filters, read from its canonical text and `kinds`) or
 * `unavailable` (a saved search that expired or is not this session's: nothing
 * is searched). `restored` marks a search read back from `?sq=`: it is already
 * in the URL and is not confirmed again.
 */
export type DashboardGlobalSearchOpenRequest = {
  readonly id: number;
  readonly query: string;
  readonly hit: GlobalSearchHit | null;
  readonly filters?: "keep" | "replace" | "unavailable";
  readonly kinds?: readonly GlobalSearchKind[];
  readonly restored?: boolean;
};

/** The canonical search the dialog hands to the bar: composed text (filters included) and category. */
export type DashboardGlobalSearchConfirmation = {
  readonly query: string;
  readonly kinds: readonly GlobalSearchKind[];
};

export const GLOBAL_SEARCH_STATE_UNAVAILABLE_NOTICE = "La búsqueda guardada venció o no está disponible";

export type DashboardGlobalSearchDialogProps = {
  readonly surface: GlobalSearchSurface;
  readonly open: boolean;
  readonly request: DashboardGlobalSearchOpenRequest | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onOpenDestination: (destination: string) => void;
  /** Enter, «Ver resultados» or a request from the bar: the single confirmation of a search. */
  readonly onSearchConfirmed?: (search: DashboardGlobalSearchConfirmation) => void;
  /** The dialog's words and applied filters (raw: the bar resolves them like the dialog), to mirror and preview with. */
  readonly onSearchStateChange?: (state: {
    readonly query: string;
    readonly filters: GlobalSearchFilters;
  }) => void;
  /** Where focus goes back on close (the top-bar input when it is painted). */
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
};

const fieldClass =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85";

function hitMeta(surface: GlobalSearchSurface, hit: GlobalSearchHit, withKind: boolean): string {
  return [
    withKind ? globalSearchKindSingularLabel(hit.kind) : null,
    hit.subtitle,
    globalSearchStatusLabel(hit.kind, hit.status),
    surface === "admin" && hit.kind !== "clinic" ? hit.clinic?.name : null,
    formatGlobalSearchDate(hit.date),
  ]
    .filter(Boolean)
    .join(" · ");
}

function RecordView({
  surface,
  hit,
  onOpenDestination,
  onBack,
}: {
  readonly surface: GlobalSearchSurface;
  readonly hit: GlobalSearchHit;
  readonly onOpenDestination: (destination: string) => void;
  readonly onBack: () => void;
}) {
  const headingId = useId();
  const status = globalSearchStatusLabel(hit.kind, hit.status);
  const date = formatGlobalSearchDate(hit.date);
  const facts = hit.facts.map(formatGlobalSearchFact);
  const reportId = hit.target.reportId;
  const destination = buildGlobalSearchDestination(surface, hit);
  const opensRecord = globalSearchDestinationOpensRecord(destination);

  return (
    <section
      aria-labelledby={headingId}
      data-global-search-record={globalSearchHitKey(hit)}
      data-global-search-record-scroll-owner="true"
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3 md:p-4"
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-md px-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 md:hidden"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver a resultados
      </button>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {`${globalSearchKindSingularLabel(hit.kind)} #${hit.id}`}
        </p>
        <h3 id={headingId} className="mt-1 break-words text-lg font-semibold text-foreground">
          {hit.title}
        </h3>
        {hit.subtitle ? <p className="mt-0.5 break-words text-sm text-muted-foreground">{hit.subtitle}</p> : null}
      </div>
      <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        {status ? (
          <>
            <dt className="text-muted-foreground">Estado</dt>
            <dd className="min-w-0 break-words font-medium text-foreground">{status}</dd>
          </>
        ) : null}
        {date ? (
          <>
            <dt className="text-muted-foreground">Fecha</dt>
            <dd className="min-w-0 text-foreground">{date}</dd>
          </>
        ) : null}
        {surface === "admin" && hit.clinic && hit.kind !== "clinic" ? (
          <>
            <dt className="text-muted-foreground">Clínica</dt>
            <dd className="min-w-0 break-words text-foreground">{hit.clinic.name}</dd>
          </>
        ) : null}
        {facts.map((fact) => (
          <div key={fact.label} className="contents">
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="min-w-0 break-words text-foreground">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-3 border-t border-vetneb-line/70 pt-3">
        {reportId ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              {hit.kind === "report" ? "Documento del informe" : `Informe vinculado #${reportId}`}
            </p>
            <ReportFileActions reportId={reportId} scope={surface} align="start" />
          </div>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 justify-between"
          data-global-search-open-module="true"
          data-global-search-opens-record={opensRecord ? "true" : "false"}
          onClick={() => onOpenDestination(destination)}
        >
          <span>
            {opensRecord
              ? `Abrir informe #${reportId} en ${DESTINATION_LABELS[surface][hit.kind]}`
              : `Ir a ${DESTINATION_LABELS[surface][hit.kind]}`}
          </span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}

/**
 * Full results for «Buscar en VETNEB»: every authorized entity, server pages
 * sized to the space on screen, report filters the API supports and a record
 * view built from the hit (resolved by id on the server).
 *
 * Zero scroll: the results canvas is measured and pages hold exactly the rows
 * it fits; the pager is a fixed footer of that canvas. «Todo» and every
 * category page through the same k-way merge (`useGlobalSearchPager`).
 *
 * Its state lives in this always-mounted component, so closing the dialog to
 * open a record and coming back restores query, filters, category, page and
 * the record that was open.
 */
export function DashboardGlobalSearchDialog({
  surface,
  open,
  request,
  onOpenChange,
  onOpenDestination,
  onSearchConfirmed,
  onSearchStateChange,
  returnFocusRef,
}: DashboardGlobalSearchDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const filtersId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  // B05: portal under the shell's portal root so the dashboard tokens (theme
  // included) resolve inside the dialog, exactly like the scoped ModuleDialogs.
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setPortalContainer(document.querySelector<HTMLElement>('[data-dashboard-portal-root="true"]'));
  }, []);

  const [remembered] = useState(() => readGlobalSearchSession(surface));
  const [query, setQuery] = useState(remembered?.query ?? "");
  const [filters, setFilters] = useState<GlobalSearchFilters>(remembered?.filters ?? EMPTY_GLOBAL_SEARCH_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<GlobalSearchHit | null>(remembered?.selected ?? null);
  const [advancedEdit, setAdvancedEdit] = useState<GlobalSearchAdvancedText | null>(null);
  const [stateUnavailable, setStateUnavailable] = useState(false);
  const handledRequest = useRef<number | null>(null);
  const confirmRef = useRef(onSearchConfirmed);
  const stateChangeRef = useRef(onSearchStateChange);
  // Latest callbacks, written before any passive effect of the commit reads them.
  useLayoutEffect(() => {
    confirmRef.current = onSearchConfirmed;
    stateChangeRef.current = onSearchStateChange;
  });

  // One model: the words and the filters (typed operators on top of the applied
  // ones, field by field) are what the chips, the form, the pager and the API see.
  const resolved = useMemo(() => resolveGlobalSearchQuery(surface, query, filters), [filters, query, surface]);
  const effectiveFilters = resolved.filters;

  /** Typed filter operators become chips (they replace only their own field); the words stay. */
  const foldTyped = useCallback(
    (text: string, base: GlobalSearchFilters) => foldTypedGlobalSearchFilters(surface, text, base),
    [surface],
  );

  /**
   * The only confirmation of a search: the canonical text (filters included)
   * and the category go to the bar, which saves them and asks the machine for
   * `?sq=`. The preview per keystroke never gets here.
   */
  const confirm = useCallback(
    (words: string, applied: GlobalSearchFilters) => {
      const next = resolveGlobalSearchQuery(surface, words, applied);
      if (!isGlobalSearchRequestReady(surface, next.words, next.filters)) return;
      rememberGlobalSearchQuery(surface, next.text);
      const allowed = new Set<GlobalSearchKind>(globalSearchKindsFor(surface));
      confirmRef.current?.({ query: next.text, kinds: applied.kinds.filter((kind) => allowed.has(kind)) });
    },
    [surface],
  );

  // A new query or a chosen hit starts a new search; a plain reopen restores it.
  // The words typed in the bar never reset the filters (they replace only the
  // field they name); a recent or saved search brings its own.
  useEffect(() => {
    if (!open || !request || handledRequest.current === request.id) return;
    handledRequest.current = request.id;
    setAdvancedEdit(null);

    if (request.filters === "unavailable") {
      setQuery("");
      setFilters(EMPTY_GLOBAL_SEARCH_FILTERS);
      setShowFilters(false);
      setSelected(null);
      setStateUnavailable(true);
      return;
    }
    setStateUnavailable(false);

    if (request.hit) setSelected(request.hit);
    const text = request.query.replace(/\s+/g, " ").trim();
    if (request.filters === "replace") {
      const folded = foldTyped(text, { ...EMPTY_GLOBAL_SEARCH_FILTERS, kinds: request.kinds ?? [] });
      setQuery(folded.query);
      setFilters(folded.filters);
      setShowFilters(false);
      if (!request.hit) setSelected(null);
      if (!request.restored) confirm(folded.query, folded.filters);
      return;
    }
    if (text) {
      const folded = foldTyped(text, filters);
      // Reopening with the search already on screen restores it, open record included.
      const unchanged = folded.query === query && JSON.stringify(folded.filters) === JSON.stringify(filters);
      setQuery(folded.query);
      setFilters(folded.filters);
      if (!request.hit && !unchanged) setSelected(null);
      confirm(folded.query, folded.filters);
    }
  }, [confirm, filters, foldTyped, open, query, request]);

  useEffect(() => {
    stateChangeRef.current?.({ query, filters });
  }, [filters, query]);

  const kinds = globalSearchKindsFor(surface);
  const reportFilters = hasGlobalSearchReportFilters(effectiveFilters);
  const typeKinds = resolved.typeKinds;
  const activeKinds = useMemo<readonly GlobalSearchKind[]>(() => {
    if (reportFilters) return ["report"];
    const base = effectiveFilters.kinds.length > 0 ? effectiveFilters.kinds : kinds;
    // A typed `type:` restricts the entities searched (never widens them). An empty
    // intersection is left to the server, whose closed 400 explains the conflict.
    const restricted = typeKinds.length > 0 ? base.filter((kind) => typeKinds.includes(kind)) : base;
    return restricted.length > 0 ? restricted : base;
  }, [effectiveFilters.kinds, kinds, reportFilters, typeKinds]);
  const singleKind = activeKinds.length === 1 ? activeKinds[0] : null;
  const ready = isGlobalSearchRequestReady(surface, resolved.words, effectiveFilters);
  const advancedBase = useMemo(() => readAdvancedFreeText(resolved.words), [resolved.words]);
  // Words the form cannot express (OR, several phrases, type:, literal terms) are never overwritten.
  const advancedLocked = advancedBase === null;
  const advanced = advancedEdit ?? advancedBase ?? EMPTY_GLOBAL_SEARCH_ADVANCED_TEXT;

  const [canvasNode, setCanvasNode] = useState<HTMLElement | null>(null);
  const capacity = useDashboardCanvasCapacity({
    canvasNode,
    fallbackItems: RESULTS_FALLBACK_ROWS,
    minItems: 1,
    maxItems: GLOBAL_SEARCH_MAX_CHUNK,
  });
  // The page size only follows a real measurement: while the canvas is
  // unmounted (dialog closed, filters open) the session keeps its pages.
  const [pageSize, setPageSize] = useState(remembered?.pageSize ?? RESULTS_FALLBACK_ROWS);
  // Nothing is fetched until the dialog has been opened in this mount: a
  // route change remounts the bar and must not replay the search unseen.
  const [activated, setActivated] = useState(false);
  useEffect(() => {
    if (open) setActivated(true);
  }, [open]);
  useLayoutEffect(() => {
    if (capacity.measured && capacity.capacity !== pageSize) setPageSize(capacity.capacity);
  }, [capacity.capacity, capacity.measured, pageSize]);

  const pager = useGlobalSearchPager({
    surface,
    // Raw state: the pager resolves it once, exactly as the dialog did (resolving the
    // already-resolved words again would let a contradictory typed operator win silently).
    query,
    filters,
    kinds: activeKinds,
    pageSize,
    enabled: activated && !stateUnavailable,
    restorePageIndex: remembered && remembered.pageSize === pageSize ? remembered.pageIndex : 0,
  });

  useEffect(() => {
    if (!activated) return;
    writeGlobalSearchSession(surface, { query, filters, pageIndex: pager.pageIndex, pageSize, selected });
  }, [activated, filters, pageSize, pager.pageIndex, query, selected, surface]);

  const updateFilters = (patch: Partial<GlobalSearchFilters>) => {
    // Editing any filter folds the typed operators into chips first.
    const folded = foldTyped(query, filters);
    setQuery(folded.query);
    setFilters({ ...folded.filters, ...patch });
    setSelected(null);
    setStateUnavailable(false);
  };

  /** «Ver resultados»: the form's text fields replace the words only if the person edited them. */
  const applyFilters = () => {
    const folded = foldTyped(query, filters);
    const words = advancedEdit !== null && !advancedLocked ? composeAdvancedFreeText(advancedEdit) : folded.query;
    setQuery(words);
    setFilters(folded.filters);
    setAdvancedEdit(null);
    setShowFilters(false);
    setSelected(null);
    setStateUnavailable(false);
    confirm(words, folded.filters);
  };

  const pageNumber = pager.pageIndex + 1;
  const scopeLabel = singleKind ? globalSearchKindLabel(singleKind) : "Todo";
  const announcement = !ready
    ? "Escribí al menos 2 caracteres para buscar."
    : pager.status === "loading"
      ? "Buscando registros…"
      : pager.status === "error"
        ? pager.error ?? ""
        : pager.status === "ready" && pager.page.length === 0
          ? `Sin resultados para «${resolved.text}».`
          : pager.status === "ready"
            ? `${scopeLabel}, página ${pageNumber}: ${pager.page.length} resultados${pager.hasNext ? "; hay más páginas" : ""}.`
            : "";

  const filtersActive = reportFilters || Boolean(effectiveFilters.clinicId);
  const filterChips = describeGlobalSearchFilterChips(surface, effectiveFilters);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={portalContainer}>
        {/* z-80: above the mobile app bar (60), bottom nav (65/70), the overflow
            menu (75) and the ModuleCard chip proxies (64); no ancestor of the
            portal root creates a stacking context. */}
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-vetneb-ink/30" />
        <Dialog.Content
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          data-dashboard-global-search-dialog={surface}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            const target = returnFocusRef?.current;
            if (target && target.isConnected && target.offsetParent !== null) {
              event.preventDefault();
              target.focus();
            }
          }}
          className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-card text-foreground focus:outline-none md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(46rem,calc(100dvh-2rem))] md:w-[min(68rem,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:border-input"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-vetneb-line/70 pl-4 pr-1">
            <Dialog.Title id={titleId} className="text-base font-semibold">
              Buscar en VETNEB
            </Dialog.Title>
            <Dialog.Description id={descriptionId} className="sr-only">
              {surface === "admin"
                ? "Busca clínicas, informes, tokens particulares, seguimientos y usuarios de clínica."
                : "Busca informes, tokens particulares y seguimientos de tu clínica."}
            </Dialog.Description>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="Cerrar búsqueda">
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-b border-vetneb-line/70 px-3 py-2 md:px-4">
            <SuperSearchField
              label="Buscar en VETNEB"
              placeholder="Paciente, tutor, informe, #id…"
              value={query}
              ref={inputRef}
              maxLength={GLOBAL_SEARCH_MAX_QUERY}
              autoComplete="off"
              spellCheck={false}
              data-global-search-dialog-input="true"
              className="md:w-full md:max-w-none"
              onKeyDown={(event) => {
                // Enter confirms the search: typed operators fold into chips and the
                // canonical search goes to the bar. It also dismisses the virtual
                // keyboard so the pager is reachable.
                if (event.key === "Enter") {
                  const folded = foldTyped(event.currentTarget.value, filters);
                  setQuery(folded.query);
                  setFilters(folded.filters);
                  setStateUnavailable(false);
                  confirm(folded.query, folded.filters);
                  event.currentTarget.blur();
                }
              }}
              onValueChange={(value) => {
                setQuery(value);
                setSelected(null);
                setAdvancedEdit(null);
                setStateUnavailable(false);
              }}
            />
            <div
              role="group"
              aria-label="Tipo de registro"
              data-global-search-category-row="true"
              className="flex min-w-0 flex-wrap items-center gap-1.5"
            >
              {[null, ...kinds].map((kind) => {
                const pressed =
                  kind === null
                    ? effectiveFilters.kinds.length === 0 && !reportFilters
                    : reportFilters
                      ? kind === "report"
                      : effectiveFilters.kinds.length === 1 && effectiveFilters.kinds[0] === kind;
                return (
                  <button
                    key={kind ?? "all"}
                    type="button"
                    aria-pressed={pressed}
                    disabled={reportFilters && kind !== "report"}
                    data-global-search-kind-filter={kind ?? "all"}
                    onClick={() => updateFilters({ kinds: kind ? [kind] : [] })}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 disabled:opacity-50",
                      pressed ? "border-primary bg-primary text-primary-foreground [:root[data-theme=dark-gray]_&]:border-vetneb-navy [:root[data-theme=dark-gray]_&]:bg-vetneb-navy [:root[data-theme=dark-gray]_&]:text-vetneb-surface" : "border-input bg-card text-foreground hover:bg-accent/60",
                    )}
                  >
                    {kind ? globalSearchKindLabel(kind) : "Todo"}
                  </button>
                );
              })}
              <button
                type="button"
                aria-expanded={showFilters}
                aria-controls={filtersId}
                data-global-search-filters-toggle="true"
                onClick={() => setShowFilters((value) => !value)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85",
                  filtersActive ? "border-primary text-primary [:root[data-theme=dark-gray]_&]:border-vetneb-navy [:root[data-theme=dark-gray]_&]:text-vetneb-navy" : "border-input text-foreground hover:bg-accent/60",
                )}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                {filtersActive ? "Filtros activos" : "Filtros"}
              </button>
            </div>
            {filterChips.length > 0 && !showFilters ? (
              <div
                role="group"
                aria-label="Filtros aplicados"
                data-global-search-applied-filters="true"
                // Short viewports (landscape phones) have no room for a second chip row
                // without starving the results: the same filters stay readable and
                // removable in the Filtros panel, whose toggle already says "activos".
                className="flex min-w-0 flex-wrap items-center gap-1.5 [@media(max-height:480px)]:hidden"
              >
                {filterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    aria-label={`Quitar filtro ${chip.label}`}
                    data-global-search-applied-filter={chip.key}
                    onClick={() => updateFilters(clearGlobalSearchFilter(effectiveFilters, chip.key))}
                    className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-primary bg-accent/60 px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85"
                  >
                    <span className="truncate">{chip.label}</span>
                    <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </button>
                ))}
                <button
                  type="button"
                  data-global-search-clear-filters="true"
                  onClick={() => updateFilters({ ...EMPTY_GLOBAL_SEARCH_FILTERS, kinds: effectiveFilters.kinds })}
                  className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85"
                >
                  Borrar filtros
                </button>
              </div>
            ) : null}
            <p
              role="status"
              aria-live="polite"
              data-global-search-dialog-status={ready ? pager.status : "idle"}
              className="sr-only"
            >
              {announcement}
            </p>
            {resolved.truncated ? (
              <p role="alert" data-global-search-truncated="true" className="text-xs text-muted-foreground">
                La búsqueda es demasiado larga: se omitieron las últimas palabras para conservar los filtros.
              </p>
            ) : null}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
            <div className={cn("min-h-0 flex-col md:flex md:border-r md:border-vetneb-line/70", selected && !showFilters ? "hidden" : "flex")}>
              {showFilters ? (
                <fieldset
                  id={filtersId}
                  data-global-search-filters-panel="true"
                  data-global-search-filters-scroll-owner="true"
                  className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3 md:p-4"
                >
                  <legend className="sr-only">Filtros avanzados</legend>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Estado del informe
                      <select
                        className={fieldClass}
                        value={effectiveFilters.status}
                        data-global-search-filter="status"
                        onChange={(event) => updateFilters({ status: event.target.value as GlobalSearchReportStatus | "" })}
                      >
                        <option value="">Todos</option>
                        {GLOBAL_SEARCH_REPORT_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Tipo de estudio
                      <select
                        className={fieldClass}
                        value={effectiveFilters.studyType}
                        data-global-search-filter="studyType"
                        onChange={(event) => updateFilters({ studyType: event.target.value })}
                      >
                        <option value="">Todos</option>
                        {GLOBAL_SEARCH_STUDY_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Desde
                      <input
                        type="date"
                        className={fieldClass}
                        value={effectiveFilters.from}
                        max={effectiveFilters.to || undefined}
                        data-global-search-filter="from"
                        onChange={(event) => updateFilters({ from: event.target.value })}
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Hasta
                      <input
                        type="date"
                        className={fieldClass}
                        value={effectiveFilters.to}
                        min={effectiveFilters.from || undefined}
                        data-global-search-filter="to"
                        onChange={(event) => updateFilters({ to: event.target.value })}
                      />
                    </label>
                    {surface === "admin" ? (
                      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                        ID de clínica
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className={fieldClass}
                          value={effectiveFilters.clinicId}
                          data-global-search-filter="clinicId"
                          onChange={(event) => updateFilters({ clinicId: event.target.value.replace(/\D/g, "").slice(0, 9) })}
                        />
                      </label>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Contiene las palabras
                      <input
                        type="text"
                        className={fieldClass}
                        value={advanced.contains}
                        disabled={advancedLocked}
                        autoComplete="off"
                        spellCheck={false}
                        data-global-search-advanced="contains"
                        onChange={(event) => setAdvancedEdit({ ...advanced, contains: event.target.value })}
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Frase exacta
                      <input
                        type="text"
                        className={fieldClass}
                        value={advanced.exact}
                        disabled={advancedLocked}
                        autoComplete="off"
                        spellCheck={false}
                        data-global-search-advanced="exact"
                        onChange={(event) => setAdvancedEdit({ ...advanced, exact: event.target.value })}
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Sólo en el título o nombre
                      <input
                        type="text"
                        className={fieldClass}
                        value={advanced.title}
                        disabled={advancedLocked}
                        autoComplete="off"
                        spellCheck={false}
                        data-global-search-advanced="title"
                        onChange={(event) => setAdvancedEdit({ ...advanced, title: event.target.value })}
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Tipo de registro
                      <select
                        className={fieldClass}
                        value={reportFilters ? "report" : effectiveFilters.kinds.length === 1 ? effectiveFilters.kinds[0] : ""}
                        disabled={reportFilters}
                        data-global-search-advanced="kind"
                        onChange={(event) =>
                          updateFilters({ kinds: event.target.value ? [event.target.value as GlobalSearchKind] : [] })
                        }
                      >
                        <option value="">Todos</option>
                        {kinds.map((kind) => (
                          <option key={kind} value={kind}>{globalSearchKindLabel(kind)}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {advancedLocked ? (
                    <p className="text-xs text-muted-foreground" data-global-search-advanced-locked="true">
                      La consulta tiene alternativas, varias frases u operadores que este formulario no expresa: editala en el campo de búsqueda.
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Los filtros de estado, tipo de estudio y fechas aplican a informes.
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="min-h-11 flex-1"
                      data-global-search-filters-apply="true"
                      onClick={applyFilters}
                    >
                      Ver resultados
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 flex-1"
                      onClick={() => updateFilters({ ...EMPTY_GLOBAL_SEARCH_FILTERS, kinds: effectiveFilters.kinds })}
                    >
                      Limpiar filtros
                    </Button>
                  </div>
                </fieldset>
              ) : (
                <>
                  <div
                    ref={setCanvasNode}
                    role="region"
                    aria-label={`Resultados: ${scopeLabel}`}
                    data-global-search-results-region="true"
                    data-global-search-page-size={pageSize}
                    style={RESULTS_CANVAS_STYLE}
                    className="min-h-0 flex-1 overflow-hidden px-1 md:px-2"
                  >
                    {ready && pager.status === "error" ? (
                      <div
                        className="flex flex-col items-start gap-2 p-3"
                        data-global-search-error={pager.errorKind ?? "generic"}
                      >
                        <p className="text-sm text-foreground">{pager.error}</p>
                        {pager.errorKind === "expired" ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            data-global-search-restart="true"
                            onClick={() => {
                              setSelected(null);
                              pager.restart();
                            }}
                          >
                            Actualizar búsqueda
                          </Button>
                        ) : pager.errorKind === "generic" || pager.errorKind === "throttled" ? (
                          <Button type="button" variant="outline" className="min-h-11" onClick={() => pager.retry()}>
                            Reintentar
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    {ready && pager.status === "ready" && pager.page.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground" data-global-search-empty="true">
                        <p>{`Sin resultados para «${resolved.text}».`}</p>
                        <p className="mt-1">
                          {filtersActive || effectiveFilters.kinds.length > 0
                            ? "Probá quitar los filtros o buscar por número de registro (#id)."
                            : "Probá con otro nombre, apellido o número de registro (#id)."}
                        </p>
                      </div>
                    ) : null}
                    {stateUnavailable ? (
                      <p role="alert" className="p-3 text-sm text-foreground" data-global-search-state-unavailable="true">
                        {GLOBAL_SEARCH_STATE_UNAVAILABLE_NOTICE}
                      </p>
                    ) : null}
                    {!ready && !stateUnavailable ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        Buscá por paciente, mascota, tutor, archivo o #número. No distingue tildes ni mayúsculas.
                      </p>
                    ) : null}
                    {pager.status !== "error" && pager.page.length > 0 ? (
                      <ul className="flex flex-col" aria-busy={pager.status === "loading" || undefined}>
                        {pager.page.map((hit) => {
                          const key = globalSearchHitKey(hit);
                          const isSelected = selected ? globalSearchHitKey(selected) === key : false;
                          const meta = hitMeta(surface, hit, !singleKind);
                          return (
                            <li key={key}>
                              <button
                                type="button"
                                aria-current={isSelected ? "true" : undefined}
                                data-global-search-result={key}
                                onClick={() => setSelected(hit)}
                                className={cn(
                                  "flex h-[var(--dash-row-pitch)] w-full min-w-0 flex-col items-start justify-center rounded-lg px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/85",
                                  isSelected ? "bg-accent/80" : "hover:bg-accent/50",
                                )}
                              >
                                <span className="w-full truncate text-sm font-medium leading-5 text-foreground">{hit.title}</span>
                                {meta ? <span className="w-full truncate text-xs leading-4 text-muted-foreground">{meta}</span> : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                  {ready ? (
                    <nav
                      aria-label={`Paginación de resultados: ${scopeLabel}`}
                      data-global-search-pager="true"
                      className="flex shrink-0 items-center justify-between gap-2 border-t border-vetneb-line/70 px-2 py-1"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11"
                        disabled={!pager.hasPrevious || pager.status === "loading"}
                        data-global-search-page="previous"
                        onClick={() => {
                          setSelected(null);
                          pager.previous();
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        Anterior
                      </Button>
                      <span
                        className="min-w-0 truncate text-center text-xs text-muted-foreground"
                        data-global-search-page-number={pageNumber}
                        aria-current="page"
                        title={pager.stalled ? "El servidor no permitió continuar una categoría. Actualizá la búsqueda para ver el resto." : undefined}
                      >
                        {pager.stalled ? `Página ${pageNumber} · actualizá la búsqueda` : `Página ${pageNumber}`}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11"
                        disabled={!pager.hasNext}
                        data-global-search-page="next"
                        onClick={() => {
                          setSelected(null);
                          pager.next();
                        }}
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </nav>
                  ) : null}
                </>
              )}
            </div>
            <div className={cn("min-h-0 flex-col", selected && !showFilters ? "flex" : "hidden md:flex")}>
              {selected ? (
                <RecordView
                  surface={surface}
                  hit={selected}
                  onOpenDestination={onOpenDestination}
                  onBack={() => setSelected(null)}
                />
              ) : (
                <p className="hidden p-4 text-sm text-muted-foreground md:block">
                  Elegí un resultado para ver el registro.
                </p>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
