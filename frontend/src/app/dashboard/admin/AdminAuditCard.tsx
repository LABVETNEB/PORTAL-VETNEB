import { ChevronLeft, ChevronRight } from "lucide-react";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { AdminAuditDenseTable, type AdminAuditRow } from "./AdminAuditDenseTable";
import {
  AdminAuditFilterBar,
  type AdminAuditFilterValues,
} from "./AdminAuditFilterBar";

export const ADMIN_AUDIT_PAGE_SIZE = 9;

type AuditSummary = {
  total: number;
  latestDate: string;
};

type FilterOption = {
  value: string;
  label: string;
};

type AdminAuditCardProps = {
  rows: AdminAuditRow[];
  totalCount: number;
  page: number;
  loadError: boolean;
  filters: AdminAuditFilterValues;
  eventOptions: FilterOption[];
  actorTypeOptions: FilterOption[];
  globalTotal: number;
  roleChanges: AuditSummary;
  notifications: AuditSummary;
};

function buildAuditPageHref(filters: AdminAuditFilterValues, page: number) {
  const query = new URLSearchParams({ module: "audit-log" });

  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }

  if (page > 1) query.set("auditPage", String(page));
  return `/dashboard/admin?${query.toString()}`;
}

export function AdminAuditCard({
  rows,
  totalCount,
  page,
  loadError,
  filters,
  eventOptions,
  actorTypeOptions,
  globalTotal,
  roleChanges,
  notifications,
}: AdminAuditCardProps) {
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const pageCount = Math.max(1, Math.ceil(totalCount / ADMIN_AUDIT_PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * ADMIN_AUDIT_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * ADMIN_AUDIT_PAGE_SIZE, totalCount);

  return (
    <section
      id="audit-log"
      aria-labelledby="admin-audit-register-title"
      className="dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-vetneb-line/80 bg-card"
    >
      <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-vetneb-line/70 px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <h2 id="admin-audit-register-title" className="text-base font-semibold text-vetneb-ink">
            Registro operativo
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            Acción, actor, entidad y fecha con detalle controlado.
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {totalCount} coincidencias
        </span>
      </header>

      <div className="grid shrink-0 grid-cols-3 border-b border-vetneb-line/70">
        <div id="admin-event-summary" className="flex min-h-11 items-center justify-between gap-2 px-2 py-1.5 sm:px-4">
          <span className="text-[11px] text-muted-foreground sm:text-xs">Eventos</span>
          <strong className="text-xl font-semibold tabular-nums text-vetneb-ink">{globalTotal}</strong>
        </div>
        <div id="audit-role-changes" aria-label="Cambios de rol" className="flex min-h-11 items-center justify-between gap-2 border-x border-vetneb-line/70 px-2 py-1.5 sm:px-4">
          <div className="min-w-0">
            <p className="truncate text-[11px] text-muted-foreground sm:text-xs">Roles</p>
            <p className="hidden truncate text-[11px] text-muted-foreground sm:block">Último: {roleChanges.latestDate}</p>
          </div>
          <strong className="text-xl font-semibold tabular-nums text-vetneb-ink">{roleChanges.total}</strong>
        </div>
        <div id="admin-notifications" aria-label="Notificaciones" className="flex min-h-11 items-center justify-between gap-2 px-2 py-1.5 sm:px-4">
          <div className="min-w-0">
            <p className="truncate text-[11px] text-muted-foreground sm:text-xs">Avisos</p>
            <p className="hidden truncate text-[11px] text-muted-foreground sm:block">Última: {notifications.latestDate}</p>
          </div>
          <strong className="text-xl font-semibold tabular-nums text-vetneb-ink">{notifications.total}</strong>
        </div>
      </div>

      <AdminAuditFilterBar
        values={filters}
        eventOptions={eventOptions}
        actorTypeOptions={actorTypeOptions}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="min-h-0 flex-1 py-2">
        <AdminAuditDenseTable
          rows={rows}
          loadError={loadError}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      <footer className="flex min-h-10 shrink-0 items-center justify-between gap-2 border-t border-vetneb-line/70 px-3 py-1.5 text-xs text-muted-foreground sm:px-4">
        <span aria-live="polite">
          {totalCount === 0 ? "Sin eventos" : `${rangeStart}–${rangeEnd} de ${totalCount}`}
        </span>
        <div className="flex items-center gap-2">
          <span>Pág. {Math.min(page, pageCount)} / {pageCount}</span>
          <PublicRouteControl
            href={buildAuditPageHref(filters, Math.max(1, page - 1))}
            replace
            variant="bare"
            disabled={loadError || page <= 1}
            aria-label="Página anterior"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-card hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </PublicRouteControl>
          <PublicRouteControl
            href={buildAuditPageHref(filters, page + 1)}
            replace
            variant="bare"
            disabled={loadError || page >= pageCount}
            aria-label="Página siguiente"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-card hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </PublicRouteControl>
        </div>
      </footer>
    </section>
  );
}
