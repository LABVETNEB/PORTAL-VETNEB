"use client";

import { Badge } from "@/components/ui/badge";
import {
  ContentList,
  ContentListItem,
  SelectionToolbar,
  type CollectionSelection,
} from "@/features/dashboard/presentation/surfaces";
import { AdminAuditDetailDialog } from "./AdminAuditDetailDialog";
import {
  AdminAuditFilterBar,
  type AdminAuditFilterValues,
} from "./AdminAuditFilterBar";
import { AdminMobileOpsPager } from "./AdminMobileOpsPager";
import type { AdminAuditRow } from "./AdminAuditDenseTable";

type FilterOption = {
  value: string;
  label: string;
};

type AdminMobileAuditModuleProps = {
  filters: AdminAuditFilterValues;
  eventOptions: FilterOption[];
  actorTypeOptions: FilterOption[];
  // Single source of truth (`AdminAuditCard`): this module only renders the
  // rows/pager state it receives, it never fetches on its own.
  rows: AdminAuditRow[];
  totalCount: number;
  loadError: boolean;
  isPending: boolean;
  offset: number;
  effectiveLimit: number;
  onPrevious: () => void;
  onNext: () => void;
  bodyRef: (node: HTMLElement | null) => void;
  selection: CollectionSelection<number>;
};

export function AdminMobileAuditModule({
  filters,
  eventOptions,
  actorTypeOptions,
  rows,
  totalCount,
  loadError,
  isPending,
  offset,
  effectiveLimit,
  onPrevious,
  onNext,
  bodyRef,
  selection,
}: AdminMobileAuditModuleProps) {
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const pageCount = Math.max(1, Math.ceil(totalCount / effectiveLimit));
  const currentPage = Math.min(Math.floor(offset / effectiveLimit) + 1, pageCount);
  const rangeStart = rows.length ? offset + 1 : 0;
  const rangeEnd = offset + rows.length;
  const hasPrevious = offset > 0;
  const hasNext = rangeEnd < totalCount;

  return (
    <section
      data-admin-mobile-ops-module="audit"
      aria-label="Registro operativo de auditoría"
      className="dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-vetneb-line/80 bg-card md:hidden"
    >
      <AdminAuditFilterBar
        values={filters}
        eventOptions={eventOptions}
        actorTypeOptions={actorTypeOptions}
        hasActiveFilters={hasActiveFilters}
        leadingSlot={
          <label className="-ml-1.5 flex size-9 shrink-0 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              aria-label="Seleccionar los eventos de esta página"
              data-collection-selection="page"
              className="size-[18px] cursor-pointer accent-vetneb-teal"
              disabled={loadError || rows.length === 0}
              checked={selection.allVisibleSelected}
              ref={(node) => {
                if (node) node.indeterminate = selection.someVisibleSelected;
              }}
              onChange={selection.toggleVisiblePage}
            />
          </label>
        }
        renderToolbar={(defaultToolbar) => (
          <SelectionToolbar selectedCount={selection.selectedCount} onClearSelection={selection.clearSelection}>
            {defaultToolbar}
          </SelectionToolbar>
        )}
      />

      <ContentList
        as="div"
        ref={bodyRef}
        data-dashboard-adaptive-rows-canvas="true"
          data-dashboard-row-pitch="regular"
        className="min-h-0 flex-1 divide-y divide-vetneb-line/70 overflow-hidden"
      >
        {loadError ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-destructive" role="alert">
            No se pudieron cargar los eventos.
          </div>
        ) : rows.length ? (
          rows.map((row) => (
            <ContentListItem
              as="article"
              key={row.id}
              data-admin-mobile-ops-item="true"
              data-dashboard-adaptive-row="true"
              data-state={selection.isSelected(row.id) ? "selected" : undefined}
              className="flex min-h-9 items-center gap-1 overflow-hidden py-0.5 pr-2 data-[state=selected]:bg-vetneb-teal/10"
            >
              <label className="flex size-9 shrink-0 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  aria-label={`Seleccionar evento ${row.id}`}
                  data-collection-selection="item"
                  className="size-[18px] cursor-pointer accent-vetneb-teal"
                  checked={selection.isSelected(row.id)}
                  onChange={() => selection.toggle(row.id)}
                />
              </label>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Badge
                    variant={row.eventVariant}
                    className="h-5 max-w-[60%] truncate px-1.5 text-[11px] font-medium"
                  >
                    {row.eventLabel}
                  </Badge>
                  <span className="min-w-0 truncate text-xs font-medium text-vetneb-ink">
                    {row.actor}
                  </span>
                </div>
                <p className="truncate text-[11px] text-muted-foreground">
                  {row.entity} · {row.date}
                </p>
              </div>
              <AdminAuditDetailDialog row={row} />
            </ContentListItem>
          ))
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
            {isPending
              ? "Cargando eventos..."
              : hasActiveFilters
                ? "No hay eventos para los filtros seleccionados."
                : "No hay eventos de auditoría disponibles."}
          </div>
        )}
      </ContentList>

      <AdminMobileOpsPager
        ariaLabel="Paginación de auditoría"
        page={currentPage}
        pageCount={pageCount}
        rangeLabel={rows.length ? `${rangeStart}–${rangeEnd} de ${totalCount}` : "Sin eventos"}
        previousDisabled={!hasPrevious || isPending}
        nextDisabled={!hasNext || isPending}
        disabled={loadError}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </section>
  );
}
