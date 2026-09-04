"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminAuditDenseTable, type AdminAuditRow } from "./AdminAuditDenseTable";
import {
  AdminAuditFilterBar,
  type AdminAuditFilterValues,
} from "./AdminAuditFilterBar";
import { AdminMobileAuditModule } from "./AdminMobileAuditModule";
import { getAdminAuditPage } from "./admin-audit.actions";
import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";
import { DASHBOARD_PAGER_RESERVATION } from "@/components/dashboard/DashboardPager";

// Server pagination is now sized by the measured rows container (Zero-Scroll
// adaptive contract). The legacy fixed page size survives only as the
// pre-measurement fallback and, on desktop, as the App Shell's pinned floor
// (`expectNinePopulatedRows`, SRV-2 pattern — see docs/implementation/
// admin-users-roles-server-adaptive-pagination.md and
// admin-reports-workflow-server-adaptive-pagination.md).
export const ADMIN_AUDIT_FALLBACK_ROWS = 9;
// Audit is the high-volume surface of PR-SRV-0 (no retention job on
// `audit_log`), so the strategy is RF debounced: a derived `limit` re-fetch,
// never an unbounded over-fetch superset. The effective `limit` never exceeds
// this cap, protecting the payload.
export const ADMIN_AUDIT_LIMIT_CAP = 32;

type AuditSummary = {
  total: number;
  latestDate: string;
};

type FilterOption = {
  value: string;
  label: string;
};

type AdminAuditCardProps = {
  filters: AdminAuditFilterValues;
  eventOptions: FilterOption[];
  actorTypeOptions: FilterOption[];
  globalTotal: number;
  roleChanges: AuditSummary;
  notifications: AuditSummary;
};

export function AdminAuditCard({
  filters,
  eventOptions,
  actorTypeOptions,
  globalTotal,
  roleChanges,
  notifications,
}: AdminAuditCardProps) {
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const [rows, setRows] = useState<AdminAuditRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [isPending, startTransition] = useTransition();

  // One collapsed runtime feeds both presentations (desktop table + mobile
  // list), so the visible container drives a single cardinality and a single
  // fetch — no second pipeline (`AdminMobileAuditModule` no longer fetches).
  const [desktopBodyNode, setDesktopBodyNode] = useState<HTMLElement | null>(null);
  const [mobileBodyNode, setMobileBodyNode] = useState<HTMLElement | null>(null);

  const latestRequestRef = useRef(0);

  // Desktop keeps the nine-row page of the App Shell contract
  // (`expectNinePopulatedRows`, `dashboard-real-app-shell-no-scroll-contract.spec.ts`,
  // 1440x900 / 1366x768) as a CEILING, not a floor: the measured region is the
  // space the flex chain really allocates, so nine rows are served wherever
  // nine rows fit and the page shrinks where they do not (at 1280x720 nine
  // rows spilled over the pager and intercepted its hit-test). The mobile list
  // keeps the RF cap and floor 1 to shrink on short phones (same trade-off as
  // Reports/Users-Roles, SRV-2).
  //
  // This is the leaf that failed CI: `A -> B -> A` returned 8 where the same
  // viewport had just measured 9, because `N = floor((H - 32 - 14) / pitch)`
  // sits exactly on its discontinuity at pitch 37, and the pitch was probed
  // from a row keyed by `row.id` that unmounted on every refetch — so the loop
  // closed through the network. Both magic subtrahends are gone: the head is
  // reserved by the token CSS locks it to, and the `py-2` that used to be
  // discounted by hand no longer sits on the measured canvas.
  //
  // One owner per canvas. The two presentations are mutually exclusive by media
  // query, so exactly one reports `measured` — a pure function of the viewport,
  // with no content, page or history in it.
  const mobileCapacity = useDashboardCanvasCapacity({
    canvasNode: mobileBodyNode,
    fallbackItems: ADMIN_AUDIT_FALLBACK_ROWS,
    minItems: 1,
    maxItems: ADMIN_AUDIT_LIMIT_CAP,
  });
  const desktopCapacity = useDashboardCanvasCapacity({
    canvasNode: desktopBodyNode,
    fallbackItems: ADMIN_AUDIT_FALLBACK_ROWS,
    minItems: 1,
    // Desktop keeps the nine-row App Shell page as a CEILING, not a floor.
    maxItems: ADMIN_AUDIT_FALLBACK_ROWS,
  });
  const rowsPerPage = mobileCapacity.measured
    ? mobileCapacity.capacity
    : desktopCapacity.measured
      ? desktopCapacity.capacity
      : ADMIN_AUDIT_FALLBACK_ROWS;

  // Effective server page size: the measured rows, bounded by the RF cap.
  const effectiveLimit = rowsPerPage;

  const query = useMemo(
    () => ({
      ...(filters.event ? { event: filters.event } : {}),
      ...(filters.actorType ? { actorType: filters.actorType } : {}),
      ...(filters.from ? { from: `${filters.from}T00:00:00.000Z` } : {}),
      ...(filters.to ? { to: `${filters.to}T23:59:59.999Z` } : {}),
      ...(filters.clinicId ? { clinicId: Number(filters.clinicId) } : {}),
      ...(filters.reportId ? { reportId: Number(filters.reportId) } : {}),
      limit: effectiveLimit,
      offset,
    }),
    [effectiveLimit, offset, filters],
  );

  function loadAuditPage() {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    startTransition(() => {
      void (async () => {
        const result = await getAdminAuditPage(query);
        if (requestId !== latestRequestRef.current) return;
        setRows(result.rows);
        setTotalCount(result.total);
        setLoadError(result.loadError);
      })();
    });
  }

  // Recompute offset when the effective limit changes so the same first
  // record stays visible; clamp against the known total (PR-SRV-0 §6, rule 1
  // — audit-log exposes `total`, unlike Reports).
  const [reconciledLimit, setReconciledLimit] = useState(effectiveLimit);
  const limitChanged = reconciledLimit !== effectiveLimit;

  let reconciledOffset = offset;
  if (limitChanged) {
    reconciledOffset = Math.floor(offset / effectiveLimit) * effectiveLimit;
    const total = totalCount;
    if (total > 0) {
      const lastValidOffset = Math.max(
        0,
        (Math.ceil(total / effectiveLimit) - 1) * effectiveLimit,
      );
      reconciledOffset = Math.min(reconciledOffset, lastValidOffset);
    }
    reconciledOffset = Math.max(0, reconciledOffset);
  }

  const deferLoadForOffsetReconciliation =
    limitChanged && reconciledOffset !== offset;

  useEffect(() => {
    if (!limitChanged) {
      return;
    }

    if (reconciledOffset !== offset) {
      setOffset(reconciledOffset);
    }
    setReconciledLimit(effectiveLimit);
  }, [effectiveLimit, limitChanged, offset, reconciledOffset]);

  useEffect(() => {
    if (deferLoadForOffsetReconciliation) {
      return;
    }

    loadAuditPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, deferLoadForOffsetReconciliation]);

  const pageCount = Math.max(1, Math.ceil(totalCount / effectiveLimit));
  const page = Math.min(Math.floor(offset / effectiveLimit) + 1, pageCount);
  const rangeStart = totalCount === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + rows.length, totalCount);
  const hasPreviousPage = offset > 0;
  const hasNextPage = offset + rows.length < totalCount;

  function goToPreviousPage() {
    setOffset(Math.max(0, offset - effectiveLimit));
  }

  function goToNextPage() {
    setOffset(offset + effectiveLimit);
  }

  return (
    <div id="audit-log" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminMobileAuditModule
        filters={filters}
        eventOptions={eventOptions}
        actorTypeOptions={actorTypeOptions}
        globalTotal={globalTotal}
        roleChangesTotal={roleChanges.total}
        notificationsTotal={notifications.total}
        rows={rows}
        totalCount={totalCount}
        loadError={loadError}
        isPending={isPending}
        offset={offset}
        effectiveLimit={effectiveLimit}
        onPrevious={goToPreviousPage}
        onNext={goToNextPage}
        bodyRef={setMobileBodyNode}
      />

      <section
        aria-labelledby="admin-audit-register-title"
        data-dashboard-b12-module-card="true"
        className="dashboard-surface hidden min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-vetneb-line/80 bg-card md:flex"
      >
      <header className="flex min-h-12 shrink-0 items-center gap-3 border-b border-vetneb-line/70 px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <h2 id="admin-audit-register-title" className="text-base font-semibold text-vetneb-ink">
            Registro operativo
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            Acción, actor, entidad y fecha con detalle controlado.
          </p>
        </div>
        <div
          data-dashboard-b14-metrics="admin-audit"
          className="grid min-w-0 flex-1 grid-cols-3 divide-x divide-vetneb-line/70"
          aria-label="Resumen de auditoría"
        >
          <div id="admin-event-summary" className="min-w-0 px-2 text-center">
            <p className="truncate text-[10px] text-muted-foreground">Eventos</p>
            <strong className="text-sm font-semibold tabular-nums text-vetneb-ink">{globalTotal}</strong>
          </div>
          <div id="audit-role-changes" aria-label="Cambios de rol" className="min-w-0 px-2 text-center">
            <p className="truncate text-[10px] leading-3 text-muted-foreground">
              Roles · <span data-admin-audit-latest="roles">Últ. {roleChanges.latestDate}</span>
            </p>
            <strong className="text-sm font-semibold tabular-nums text-vetneb-ink">{roleChanges.total}</strong>
          </div>
          <div id="admin-notifications" aria-label="Notificaciones" className="min-w-0 px-2 text-center">
            <p className="truncate text-[10px] leading-3 text-muted-foreground">
              Avisos · <span data-admin-audit-latest="avisos">Últ. {notifications.latestDate}</span>
            </p>
            <strong className="text-sm font-semibold tabular-nums text-vetneb-ink">{notifications.total}</strong>
          </div>
        </div>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {totalCount} coincidencias
        </span>
      </header>

      <AdminAuditFilterBar
        values={filters}
        eventOptions={eventOptions}
        actorTypeOptions={actorTypeOptions}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Measured rows region. It is the flex-allocated space between the
          filter bar and the pager (`min-h-0 flex-1` keeps it shrinkable), so
          its height is the space that really exists. The table wrapper inside
          it is content-sized, which made the previous measurement
          self-referential: nine rows measured nine rows' worth of height and
          the fit never fell below nine, whatever the viewport. */}
      <div
        ref={setDesktopBodyNode}
        data-dashboard-adaptive-rows-canvas="true"
        data-dashboard-row-pitch="compact"
        data-dashboard-canvas-reserve="table-head-dense"
        className="min-h-0 flex-1"
      >
        <AdminAuditDenseTable
          rows={rows}
          loadError={loadError}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      <footer
        data-dashboard-adaptive-reserved-region="pager"
        className="flex shrink-0 items-center justify-between gap-2 overflow-hidden border-t border-vetneb-line/70 px-3 text-xs text-muted-foreground sm:px-4"
        style={DASHBOARD_PAGER_RESERVATION}
      >
        <span aria-live="polite">
          {totalCount === 0 ? "Sin eventos" : `${rangeStart}–${rangeEnd} de ${totalCount}`}
        </span>
        <div className="flex items-center gap-2">
          <span>Pág. {page} / {pageCount}</span>
          <button
            type="button"
            onClick={goToPreviousPage}
            disabled={loadError || !hasPreviousPage || isPending}
            aria-label="Página anterior"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-card hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={goToNextPage}
            disabled={loadError || !hasNextPage || isPending}
            aria-label="Página siguiente"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-card hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </footer>
      </section>
    </div>
  );
}
