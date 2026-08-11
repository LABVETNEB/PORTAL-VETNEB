"use client";

import {
  useEffect,
  useLayoutEffect,
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
import { useAdaptiveItemsPerPage } from "@/hooks/useAdaptiveItemsPerPage";

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
// `[&_th]:h-8` on the desktop table.
const ADMIN_AUDIT_TABLE_HEADER_PX = 32;
// `[&_td]:h-9` on the desktop table / mobile item min-height fallback.
const ADMIN_AUDIT_ROW_HEIGHT_FALLBACK_PX = 36;
// The hook's own default tail separation, restated here because the desktop
// value below is derived from it.
const ADMIN_AUDIT_ADAPTIVE_SAFETY_GAP_PX = 6;
// `py-2` on the measured desktop rows region. The node is `border-box`, so its
// measured height includes both paddings, but only the TOP one displaces the
// table: the fit must discount the 8px the table starts below the container
// edge. The bottom padding is NOT discounted as well — the safety gap already
// reserves the tail, and double-counting it costs a full canonical row at
// 1366x768 / 1024x768 for sub-pixel gain.
const ADMIN_AUDIT_DESKTOP_TOP_PADDING_PX = 8;

type Measurement = {
  containerNode: HTMLElement | null;
  rowHeightPx: number;
  headerHeightPx: number;
};

function measurementsEqual(a: Measurement, b: Measurement) {
  return (
    a.containerNode === b.containerNode &&
    a.rowHeightPx === b.rowHeightPx &&
    a.headerHeightPx === b.headerHeightPx
  );
}

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
  const [desktopRowNode, setDesktopRowNode] = useState<HTMLElement | null>(null);
  const [mobileRowNode, setMobileRowNode] = useState<HTMLElement | null>(null);
  const [measurement, setMeasurement] = useState<Measurement>({
    containerNode: null,
    rowHeightPx: ADMIN_AUDIT_ROW_HEIGHT_FALLBACK_PX,
    headerHeightPx: 0,
  });

  const latestRequestRef = useRef(0);
  const totalRef = useRef(0);

  useEffect(() => {
    totalRef.current = totalCount;
  }, [totalCount]);

  useLayoutEffect(() => {
    const nodes = [
      desktopBodyNode,
      mobileBodyNode,
      desktopRowNode,
      mobileRowNode,
    ].filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) {
      return;
    }

    let frame: number | null = null;

    const recompute = () => {
      frame = null;

      const mobileHeight = mobileBodyNode?.getBoundingClientRect().height ?? 0;
      if (mobileHeight > 0 && mobileBodyNode) {
        const rowHeight = mobileRowNode?.getBoundingClientRect().height ?? 0;
        setMeasurement((previous) => {
          const next: Measurement = {
            containerNode: mobileBodyNode,
            rowHeightPx:
              rowHeight > 0 ? rowHeight : ADMIN_AUDIT_ROW_HEIGHT_FALLBACK_PX,
            headerHeightPx: 0,
          };
          return measurementsEqual(previous, next) ? previous : next;
        });
        return;
      }

      const desktopHeight = desktopBodyNode?.getBoundingClientRect().height ?? 0;
      if (desktopHeight > 0 && desktopBodyNode) {
        const rowHeight = desktopRowNode?.getBoundingClientRect().height ?? 0;
        setMeasurement((previous) => {
          const next: Measurement = {
            containerNode: desktopBodyNode,
            rowHeightPx:
              rowHeight > 0 ? rowHeight : ADMIN_AUDIT_ROW_HEIGHT_FALLBACK_PX,
            headerHeightPx: ADMIN_AUDIT_TABLE_HEADER_PX,
          };
          return measurementsEqual(previous, next) ? previous : next;
        });
      }
    };

    const scheduleRecompute = () => {
      if (frame === null) {
        frame = requestAnimationFrame(recompute);
      }
    };

    const observer = new ResizeObserver(scheduleRecompute);
    nodes.forEach((node) => observer.observe(node));
    scheduleRecompute();

    return () => {
      observer.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [desktopBodyNode, mobileBodyNode, desktopRowNode, mobileRowNode]);

  // Desktop keeps the nine-row page of the App Shell contract
  // (`expectNinePopulatedRows`, `dashboard-real-app-shell-no-scroll-contract.spec.ts`,
  // 1440x900 / 1366x768) as a CEILING, not a floor: the measured region is the
  // space the flex chain really allocates, so nine rows are served wherever
  // nine rows fit and the page shrinks where they do not (at 1280x720 nine
  // rows spilled over the pager and intercepted its hit-test). The mobile list
  // keeps the RF cap and floor 1 to shrink on short phones (same trade-off as
  // Reports/Users-Roles, SRV-2).
  //
  // Desktop fit, with H the measured container height:
  //   N = floor((H - 32 - 14) / 37)   =>   H >= 32 + 14 + 37N
  // The table starts 8px below the container edge, so it ends at 8 + 32 + 37N,
  // which is at most H - 6: the pager keeps at least the 6px safety gap of
  // clearance at every boundary, without spending a row on the bottom padding.
  const isDesktopMeasurement = measurement.headerHeightPx > 0;
  const { itemsPerPage: rowsPerPage } = useAdaptiveItemsPerPage({
    containerNode: measurement.containerNode,
    fallbackItems: ADMIN_AUDIT_FALLBACK_ROWS,
    itemHeightPx: measurement.rowHeightPx,
    headerHeightPx: measurement.headerHeightPx,
    safetyGapPx: isDesktopMeasurement
      ? ADMIN_AUDIT_ADAPTIVE_SAFETY_GAP_PX + ADMIN_AUDIT_DESKTOP_TOP_PADDING_PX
      : ADMIN_AUDIT_ADAPTIVE_SAFETY_GAP_PX,
    minItems: 1,
    maxItems: isDesktopMeasurement
      ? ADMIN_AUDIT_FALLBACK_ROWS
      : ADMIN_AUDIT_LIMIT_CAP,
  });

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
  const previousLimitRef = useRef(effectiveLimit);
  useEffect(() => {
    if (previousLimitRef.current === effectiveLimit) {
      return;
    }
    previousLimitRef.current = effectiveLimit;

    setOffset((currentOffset) => {
      let nextOffset = Math.floor(currentOffset / effectiveLimit) * effectiveLimit;
      const total = totalRef.current;
      if (total > 0) {
        const lastValidOffset = Math.max(
          0,
          (Math.ceil(total / effectiveLimit) - 1) * effectiveLimit,
        );
        nextOffset = Math.min(nextOffset, lastValidOffset);
      }
      nextOffset = Math.max(0, nextOffset);
      return nextOffset === currentOffset ? currentOffset : nextOffset;
    });
  }, [effectiveLimit]);

  useEffect(() => {
    loadAuditPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

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
        rowRef={setMobileRowNode}
      />

      <section
        aria-labelledby="admin-audit-register-title"
        className="dashboard-surface hidden min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-vetneb-line/80 bg-card md:flex"
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

      {/* Measured rows region. It is the flex-allocated space between the
          filter bar and the pager (`min-h-0 flex-1` keeps it shrinkable), so
          its height is the space that really exists. The table wrapper inside
          it is content-sized, which made the previous measurement
          self-referential: nine rows measured nine rows' worth of height and
          the fit never fell below nine, whatever the viewport. */}
      <div
        ref={setDesktopBodyNode}
        data-dashboard-adaptive-rows-canvas="true"
        className="min-h-0 flex-1 py-2"
      >
        <AdminAuditDenseTable
          rows={rows}
          loadError={loadError}
          hasActiveFilters={hasActiveFilters}
          desktopRowRef={setDesktopRowNode}
        />
      </div>

      <footer
        data-dashboard-adaptive-reserved-region="pager"
        className="flex min-h-10 shrink-0 items-center justify-between gap-2 border-t border-vetneb-line/70 px-3 py-1.5 text-xs text-muted-foreground sm:px-4"
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
