"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";

import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";
import { Button } from "@/components/ui/button";
import { SuperSearchField } from "@/features/dashboard/presentation/filters/SuperSearchField";
import {
  EMPTY_GLOBAL_SEARCH_FILTERS,
  GLOBAL_SEARCH_MAX_OFFSET,
  GLOBAL_SEARCH_PAGE_SIZE,
  GLOBAL_SEARCH_REPORT_STATUS_OPTIONS,
  GLOBAL_SEARCH_STUDY_TYPE_OPTIONS,
  buildGlobalSearchDestination,
  formatGlobalSearchDate,
  formatGlobalSearchFact,
  globalSearchHitKey,
  globalSearchKindLabel,
  globalSearchKindSingularLabel,
  globalSearchKindsFor,
  globalSearchStatusLabel,
  groupGlobalSearchHits,
  hasGlobalSearchReportFilters,
  isGlobalSearchQueryReady,
  normalizeGlobalSearchInput,
  type GlobalSearchFilters,
  type GlobalSearchHit,
  type GlobalSearchKind,
  type GlobalSearchReportStatus,
  type GlobalSearchSurface,
} from "@/lib/global-search";
import { cn } from "@/lib/utils";
import { useDashboardGlobalSearch } from "./useDashboardGlobalSearch";

/** Per-kind window when every kind is searched at once. */
const OVERVIEW_LIMIT = 10;

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

export type DashboardGlobalSearchDialogProps = {
  readonly surface: GlobalSearchSurface;
  readonly open: boolean;
  readonly initialQuery: string;
  readonly initialHit: GlobalSearchHit | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onOpenDestination: (destination: string) => void;
  /** Where focus goes back on close (the top-bar input when it is painted). */
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
};

const fieldClass =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85";

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

  return (
    <section
      aria-labelledby={headingId}
      data-global-search-record={globalSearchHitKey(hit)}
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4"
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
      <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
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
      <div className="flex flex-col gap-3 border-t border-vetneb-line/70 pt-4">
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
          onClick={() => onOpenDestination(destination)}
        >
          <span>{`Abrir en ${DESTINATION_LABELS[surface][hit.kind]}`}</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}

/**
 * Full results for "Buscar en VETNEB": every authorized entity, report filters
 * the API already supports, per-entity pagination and a record view that is
 * built from the search hit itself (resolved by id on the server), so a record
 * opens even when its module page never loaded it.
 *
 * Full screen below 768 px (the mobile entry point is the overflow menu), a
 * bounded panel above it. Its list and record columns are the dialog's own
 * contracted scroll regions; the dashboard document never scrolls.
 */
export function DashboardGlobalSearchDialog({
  surface,
  open,
  initialQuery,
  initialHit,
  onOpenChange,
  onOpenDestination,
  returnFocusRef,
}: DashboardGlobalSearchDialogProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  // B05: portal under the shell's portal root so the dashboard tokens (theme
  // included) resolve inside the dialog, exactly like the scoped ModuleDialogs.
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setPortalContainer(document.querySelector<HTMLElement>('[data-dashboard-portal-root="true"]'));
  }, []);
  const descriptionId = useId();
  const filtersId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<GlobalSearchFilters>(EMPTY_GLOBAL_SEARCH_FILTERS);
  const [offset, setOffset] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<GlobalSearchHit | null>(initialHit);

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setFilters(EMPTY_GLOBAL_SEARCH_FILTERS);
    setOffset(0);
    setShowFilters(false);
    setSelected(initialHit);
  }, [initialHit, initialQuery, open]);

  const kinds = globalSearchKindsFor(surface);
  const reportFilters = hasGlobalSearchReportFilters(filters);
  const singleKind: GlobalSearchKind | null = reportFilters
    ? "report"
    : filters.kinds.length === 1
      ? filters.kinds[0]
      : null;
  const limit = singleKind ? GLOBAL_SEARCH_PAGE_SIZE : OVERVIEW_LIMIT;
  const normalized = normalizeGlobalSearchInput(query);
  const ready = isGlobalSearchQueryReady(query);

  const request = useMemo(
    () => (open && ready ? { query: normalized, filters, limit, offset: singleKind ? offset : 0 } : null),
    [filters, limit, normalized, offset, open, ready, singleKind],
  );
  const search = useDashboardGlobalSearch(surface, request);
  const groups = useMemo(
    () => (search.result ? groupGlobalSearchHits(surface, search.result) : []),
    [search.result, surface],
  );
  const singleGroup = singleKind ? search.result?.groups.find((group) => group.kind === singleKind) : undefined;
  const canPageForward = Boolean(singleGroup?.hasMore) && offset + limit <= GLOBAL_SEARCH_MAX_OFFSET;
  const total = search.result?.hits.length ?? 0;

  const updateFilters = (patch: Partial<GlobalSearchFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setOffset(0);
  };

  const announcement = !ready
    ? "Escribí al menos 2 caracteres para buscar."
    : search.status === "loading"
      ? "Buscando registros…"
      : search.status === "error"
        ? search.error
        : search.status === "ready" && total === 0
          ? `Sin resultados para «${normalized}».`
          : search.status === "ready"
            ? singleKind
              ? `${globalSearchKindLabel(singleKind)}: resultados ${offset + 1} a ${offset + total}.`
              : `${total} resultados en ${groups.length} categorías.`
            : "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={portalContainer}>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-vetneb-ink/30" />
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
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-card text-foreground focus:outline-none md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(46rem,calc(100dvh-2rem))] md:w-[min(68rem,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:border-input"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-vetneb-line/70 px-4 py-2">
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

          <div className="flex shrink-0 flex-col gap-2 border-b border-vetneb-line/70 px-4 py-3">
            <SuperSearchField
              label="Buscar en VETNEB"
              placeholder="Paciente, tutor, informe, #id…"
              value={query}
              ref={inputRef}
              maxLength={80}
              autoComplete="off"
              spellCheck={false}
              data-global-search-dialog-input="true"
              className="md:w-full md:max-w-none"
              onValueChange={(value) => {
                setQuery(value);
                setOffset(0);
                setSelected(null);
              }}
            />
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div role="group" aria-label="Tipo de registro" className="flex min-w-0 flex-wrap gap-1.5">
                {[null, ...kinds].map((kind) => {
                  const pressed = kind === null ? filters.kinds.length === 0 && !reportFilters : singleKind === kind;
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
                        pressed ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground hover:bg-accent/60",
                      )}
                    >
                      {kind ? globalSearchKindLabel(kind) : "Todo"}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                aria-expanded={showFilters}
                aria-controls={filtersId}
                data-global-search-filters-toggle="true"
                onClick={() => setShowFilters((value) => !value)}
                className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-input px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                {reportFilters || filters.clinicId ? "Filtros activos" : "Filtros"}
              </button>
            </div>
            <fieldset
              id={filtersId}
              hidden={!showFilters}
              className="grid grid-cols-2 gap-2 md:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]"
            >
              <legend className="sr-only">Filtros avanzados</legend>
              <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                Estado del informe
                <select
                  className={fieldClass}
                  value={filters.status}
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
                  value={filters.studyType}
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
                  value={filters.from}
                  max={filters.to || undefined}
                  data-global-search-filter="from"
                  onChange={(event) => updateFilters({ from: event.target.value })}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                Hasta
                <input
                  type="date"
                  className={fieldClass}
                  value={filters.to}
                  min={filters.from || undefined}
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
                    value={filters.clinicId}
                    data-global-search-filter="clinicId"
                    onChange={(event) => updateFilters({ clinicId: event.target.value.replace(/\D/g, "").slice(0, 9) })}
                  />
                </label>
              ) : null}
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 w-full"
                  onClick={() => updateFilters({ ...EMPTY_GLOBAL_SEARCH_FILTERS, kinds: filters.kinds })}
                >
                  Limpiar filtros
                </Button>
              </div>
            </fieldset>
            <p role="status" aria-live="polite" data-global-search-dialog-status={ready ? search.status : "idle"} className="text-xs text-muted-foreground">
              {announcement}
            </p>
          </div>

          <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
            <div
              className={cn("min-h-0 flex-col md:flex md:border-r md:border-vetneb-line/70", selected ? "hidden" : "flex")}
            >
              <div
                role="region"
                aria-label="Resultados"
                tabIndex={0}
                data-global-search-results-region="true"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/85"
              >
                {ready && search.status === "error" ? (
                  <div className="flex flex-col items-start gap-2 p-3">
                    <p className="text-sm text-foreground">{search.error}</p>
                    <Button type="button" variant="outline" className="min-h-11" onClick={() => search.retry()}>
                      Reintentar
                    </Button>
                  </div>
                ) : null}
                {ready && search.status === "ready" && total === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground" data-global-search-empty="true">
                    <p>{`Sin resultados para «${normalized}».`}</p>
                    {reportFilters || filters.kinds.length > 0 || filters.clinicId ? (
                      <p className="mt-1">Probá quitar los filtros o buscar por número de registro (#id).</p>
                    ) : (
                      <p className="mt-1">Probá con otro nombre, apellido o número de registro (#id).</p>
                    )}
                  </div>
                ) : null}
                {!ready ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    Buscá por paciente, mascota, tutor, archivo o #número. No distingue tildes ni mayúsculas.
                  </p>
                ) : null}
                {groups.map((group) => (
                  <section key={group.kind} aria-label={globalSearchKindLabel(group.kind)} className="mb-2">
                    <h3 className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {globalSearchKindLabel(group.kind)}
                    </h3>
                    <ul className="flex flex-col">
                      {group.hits.map((hit) => {
                        const key = globalSearchHitKey(hit);
                        const isSelected = selected ? globalSearchHitKey(selected) === key : false;
                        const meta = [
                          hit.subtitle,
                          globalSearchStatusLabel(hit.kind, hit.status),
                          surface === "admin" && hit.kind !== "clinic" ? hit.clinic?.name : null,
                          formatGlobalSearchDate(hit.date),
                        ].filter(Boolean).join(" · ");
                        return (
                          <li key={key}>
                            <button
                              type="button"
                              aria-current={isSelected ? "true" : undefined}
                              data-global-search-result={key}
                              onClick={() => setSelected(hit)}
                              className={cn(
                                "flex min-h-11 w-full min-w-0 flex-col items-start rounded-lg px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85",
                                isSelected ? "bg-accent/80" : "hover:bg-accent/50",
                              )}
                            >
                              <span className="w-full truncate text-sm font-medium text-foreground">{hit.title}</span>
                              {meta ? <span className="w-full truncate text-xs text-muted-foreground">{meta}</span> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {!singleKind && group.hasMore ? (
                      <button
                        type="button"
                        data-global-search-more={group.kind}
                        onClick={() => updateFilters({ kinds: [group.kind] })}
                        className="mx-2 mt-1 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85"
                      >
                        {`Ver más ${globalSearchKindLabel(group.kind).toLowerCase()}`}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
                  </section>
                ))}
              </div>
              {singleKind && ready && (offset > 0 || canPageForward) ? (
                <nav
                  aria-label={`Paginación de ${globalSearchKindLabel(singleKind).toLowerCase()}`}
                  className="flex shrink-0 items-center justify-between gap-2 border-t border-vetneb-line/70 px-3 py-2"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11"
                    disabled={offset === 0 || search.status === "loading"}
                    data-global-search-page="previous"
                    onClick={() => setOffset((value) => Math.max(0, value - limit))}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {total > 0 ? `${offset + 1}–${offset + total}` : ""}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11"
                    disabled={!canPageForward || search.status === "loading"}
                    data-global-search-page="next"
                    onClick={() => setOffset((value) => value + limit)}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </nav>
              ) : null}
            </div>
            <div className={cn("min-h-0 flex-col", selected ? "flex" : "hidden md:flex")}>
              {selected ? (
                <RecordView surface={surface} hit={selected} onOpenDestination={onOpenDestination} onBack={() => setSelected(null)} />
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
