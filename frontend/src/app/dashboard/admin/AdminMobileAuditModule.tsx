"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AdminAuditDetailDialog } from "./AdminAuditDetailDialog";
import {
  AdminAuditFilterBar,
  type AdminAuditFilterValues,
} from "./AdminAuditFilterBar";
import type { AdminAuditRow } from "./AdminAuditDenseTable";
import { AdminMobileOpsPager } from "./AdminMobileOpsPager";

const MOBILE_PAGE_SIZE = 3;

type FilterOption = {
  value: string;
  label: string;
};

type AdminMobileAuditModuleProps = {
  rows: AdminAuditRow[];
  totalCount: number;
  serverPage: number;
  serverPageSize: number;
  loadError: boolean;
  filters: AdminAuditFilterValues;
  eventOptions: FilterOption[];
  actorTypeOptions: FilterOption[];
  globalTotal: number;
  roleChangesTotal: number;
  notificationsTotal: number;
};

function buildServerPageHref(filters: AdminAuditFilterValues, page: number) {
  const query = new URLSearchParams({ module: "audit-log" });
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  if (page > 1) query.set("auditPage", String(page));
  return `/dashboard/admin?${query.toString()}`;
}

export function AdminMobileAuditModule({
  rows,
  totalCount,
  serverPage,
  serverPageSize,
  loadError,
  filters,
  eventOptions,
  actorTypeOptions,
  globalTotal,
  roleChangesTotal,
  notificationsTotal,
}: AdminMobileAuditModuleProps) {
  const router = useRouter();
  const [localPage, setLocalPage] = useState(0);
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const localPageCount = Math.max(1, Math.ceil(rows.length / MOBILE_PAGE_SIZE));
  const globalPageCount = Math.max(1, Math.ceil(totalCount / MOBILE_PAGE_SIZE));
  const globalPage = Math.min(
    globalPageCount,
    (serverPage - 1) * Math.ceil(serverPageSize / MOBILE_PAGE_SIZE) + localPage + 1,
  );
  const visibleRows = rows.slice(
    localPage * MOBILE_PAGE_SIZE,
    localPage * MOBILE_PAGE_SIZE + MOBILE_PAGE_SIZE,
  );
  const rangeStart = visibleRows.length
    ? (serverPage - 1) * serverPageSize + localPage * MOBILE_PAGE_SIZE + 1
    : 0;
  const rangeEnd = Math.min(rangeStart + visibleRows.length - 1, totalCount);
  const hasPrevious = localPage > 0 || serverPage > 1;
  const hasNext = localPage + 1 < localPageCount || rangeEnd < totalCount;

  useEffect(() => {
    setLocalPage(0);
  }, [rows, serverPage]);

  function goPrevious() {
    if (localPage > 0) {
      setLocalPage((current) => current - 1);
      return;
    }
    if (serverPage > 1) {
      router.push(buildServerPageHref(filters, serverPage - 1), { scroll: false });
    }
  }

  function goNext() {
    if (localPage + 1 < localPageCount) {
      setLocalPage((current) => current + 1);
      return;
    }
    if (rangeEnd < totalCount) {
      router.push(buildServerPageHref(filters, serverPage + 1), { scroll: false });
    }
  }

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

      <div className="grid min-h-0 flex-1 grid-rows-3 overflow-hidden">
        {loadError ? (
          <div className="col-span-full row-span-3 flex items-center justify-center px-4 text-center text-xs text-destructive" role="alert">
            No se pudieron cargar los eventos.
          </div>
        ) : visibleRows.length ? (
          visibleRows.map((row) => (
            <article
              key={row.id}
              data-admin-mobile-ops-item="true"
              className="flex min-h-0 items-center gap-2 overflow-hidden border-b border-vetneb-line/70 px-2 py-1 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Badge
                    variant={row.eventVariant}
                    className="h-5 max-w-[72%] truncate px-1.5 text-[11px] font-medium"
                  >
                    {row.eventLabel}
                  </Badge>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    #{row.id}
                  </span>
                </div>
                <p className="truncate text-xs font-medium text-vetneb-ink">{row.actor}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {row.entity} · {row.date}
                </p>
              </div>
              <AdminAuditDetailDialog row={row} />
            </article>
          ))
        ) : (
          <div className="col-span-full row-span-3 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">
            {hasActiveFilters
              ? "No hay eventos para los filtros seleccionados."
              : "No hay eventos de auditoría disponibles."}
          </div>
        )}
      </div>

      <AdminMobileOpsPager
        ariaLabel="Paginación de auditoría"
        page={globalPage}
        pageCount={globalPageCount}
        rangeLabel={visibleRows.length ? `${rangeStart}–${rangeEnd} de ${totalCount}` : "Sin eventos"}
        previousDisabled={!hasPrevious}
        nextDisabled={!hasNext}
        disabled={loadError}
        onPrevious={goPrevious}
        onNext={goNext}
      />
    </section>
  );
}
