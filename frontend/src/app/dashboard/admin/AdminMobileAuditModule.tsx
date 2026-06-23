"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { AdminAuditDetailDialog } from "./AdminAuditDetailDialog";
import {
  AdminAuditFilterBar,
  type AdminAuditFilterValues,
} from "./AdminAuditFilterBar";
import { AdminMobileOpsPager } from "./AdminMobileOpsPager";
import { getAdminMobileAuditPage, type AdminMobileAuditPage } from "./admin-audit-mobile.actions";

const MOBILE_PAGE_SIZE = 10;

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
};

const EMPTY_PAGE: AdminMobileAuditPage = { rows: [], total: 0, loadError: false };

export function AdminMobileAuditModule({
  filters,
  eventOptions,
  actorTypeOptions,
  globalTotal,
  roleChangesTotal,
  notificationsTotal,
}: AdminMobileAuditModuleProps) {
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<AdminMobileAuditPage>(EMPTY_PAGE);
  const [isPending, startTransition] = useTransition();
  const hasActiveFilters = Object.values(filters).some(Boolean);

  function loadPage(nextOffset: number) {
    startTransition(() => {
      void (async () => {
        const result = await getAdminMobileAuditPage({
          ...(filters.event ? { event: filters.event } : {}),
          ...(filters.actorType ? { actorType: filters.actorType } : {}),
          ...(filters.from ? { from: `${filters.from}T00:00:00.000Z` } : {}),
          ...(filters.to ? { to: `${filters.to}T23:59:59.999Z` } : {}),
          ...(filters.clinicId ? { clinicId: Number(filters.clinicId) } : {}),
          ...(filters.reportId ? { reportId: Number(filters.reportId) } : {}),
          limit: MOBILE_PAGE_SIZE,
          offset: nextOffset,
        });
        setPage(result);
        setOffset(nextOffset);
      })();
    });
  }

  useEffect(() => {
    loadPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const pageCount = Math.max(1, Math.ceil(page.total / MOBILE_PAGE_SIZE));
  const currentPage = Math.floor(offset / MOBILE_PAGE_SIZE) + 1;
  const rangeStart = page.rows.length ? offset + 1 : 0;
  const rangeEnd = offset + page.rows.length;
  const hasNext = rangeEnd < page.total;

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

      <div className="min-h-0 flex-1 divide-y divide-vetneb-line/70 overflow-hidden">
        {page.loadError ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-destructive" role="alert">
            No se pudieron cargar los eventos.
          </div>
        ) : page.rows.length ? (
          page.rows.map((row) => (
            <article
              key={row.id}
              data-admin-mobile-ops-item="true"
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
        rangeLabel={page.rows.length ? `${rangeStart}–${rangeEnd} de ${page.total}` : "Sin eventos"}
        previousDisabled={offset === 0 || isPending}
        nextDisabled={!hasNext || isPending}
        disabled={page.loadError}
        onPrevious={() => loadPage(Math.max(0, offset - MOBILE_PAGE_SIZE))}
        onNext={() => loadPage(offset + MOBILE_PAGE_SIZE)}
      />
    </section>
  );
}
