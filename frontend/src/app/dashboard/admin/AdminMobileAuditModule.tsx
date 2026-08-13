"use client";

import { Badge } from "@/components/ui/badge";
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
  globalTotal: number;
  roleChangesTotal: number;
  notificationsTotal: number;
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
};

export function AdminMobileAuditModule({
  filters,
  eventOptions,
  actorTypeOptions,
  globalTotal,
  roleChangesTotal,
  notificationsTotal,
  rows,
  totalCount,
  loadError,
  isPending,
  offset,
  effectiveLimit,
  onPrevious,
  onNext,
  bodyRef,
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
      <div className="grid min-h-9 shrink-0 grid-cols-3 border-b border-vetneb-line/70 text-[11px]">
        <div className="flex items-center justify-between gap-1 px-2">
          <span className="truncate text-muted-foreground">Eventos</span>
          <strong className="tabular-nums text-vetneb-ink">{globalTotal}</strong>
        </div>
        <div className="flex items-center justify-between gap-1 border-x border-vetneb-line/70 px-2">
          <span className="truncate text-muted-foreground">Roles</span>
          <strong className="tabular-nums text-vetneb-ink">{roleChangesTotal}</strong>
        </div>
        <div className="flex items-center justify-between gap-1 px-2">
          <span className="truncate text-muted-foreground">Avisos</span>
          <strong className="tabular-nums text-vetneb-ink">{notificationsTotal}</strong>
        </div>
      </div>

      <AdminAuditFilterBar
        values={filters}
        eventOptions={eventOptions}
        actorTypeOptions={actorTypeOptions}
        hasActiveFilters={hasActiveFilters}
      />

      <div
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
          rows.map((row, index) => (
            <article
              key={row.id}
              data-admin-mobile-ops-item="true"
              data-dashboard-adaptive-row="true"
              className="flex min-h-9 items-center gap-2 overflow-hidden px-2 py-0.5"
            >
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
            </article>
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
      </div>

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
