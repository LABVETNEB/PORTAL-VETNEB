"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Loader2 } from "lucide-react";
import { PublicExternalControl } from "@/components/public/PublicRouteControl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildAdminFailedLoginAlertsCsvUrl,
  getAdminFailedLoginAlerts,
} from "@/lib/api";
import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";
import { DASHBOARD_TOUCH_PAGER_RESERVATION } from "@/components/dashboard/DashboardPager";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { LoadingState } from "@/components/dashboard/LoadingState";
import type {
  AdminFailedLoginAlertReason,
  AdminFailedLoginAlertsSnapshot,
  AdminFailedLoginAlertSurface,
} from "@/types";
import { AdminFailedLoginDetailDialog } from "./AdminFailedLoginDetailDialog";
import { AdminMobileOpsPager } from "./AdminMobileOpsPager";

// Server pagination is now sized by the measured rows container (Zero-Scroll
// adaptive contract). The legacy PAGE_SIZE survives only as the
// pre-measurement fallback.
const FAILED_LOGIN_FALLBACK_ROWS = 5;
// Re-fetch payload bound: `login_failed_attempts` only grows (no retention
// job), so the strategy is debounced re-fetch with a derived limit, never an
// unbounded superset. The effective `limit` never exceeds this cap.
const FAILED_LOGIN_LIMIT_CAP = 25;
// Default `TableHead` height (`h-11`), discounted from the measured desktop
// region so the row math never counts the header as a data row.
const FAILED_LOGIN_TABLE_HEADER_PX = 44;
// Fallback item height used until a real row is measured.
const FAILED_LOGIN_ROW_HEIGHT_FALLBACK_PX = 48;

function formatSurface(value: AdminFailedLoginAlertSurface) {
  if (value === "admin") return "Admin";
  if (value === "clinic") return "Clínica";
  return "Particular";
}

function formatReason(value: AdminFailedLoginAlertReason) {
  if (value === "missing_credentials") return "Credenciales faltantes";
  if (value === "invalid_credentials") return "Credenciales inválidas";
  return "Bloqueo temporal";
}

function getSurfaceVariant(
  value: AdminFailedLoginAlertSurface,
): "default" | "secondary" | "destructive" | "outline" {
  if (value === "admin") return "default";
  if (value === "clinic") return "secondary";
  return "outline";
}

function getReasonVariant(
  value: AdminFailedLoginAlertReason,
): "default" | "secondary" | "destructive" | "outline" {
  if (value === "rate_limited") return "secondary";
  if (value === "invalid_credentials") return "secondary";
  return "outline";
}

function formatNullable(value: string | null) {
  return value && value.trim() ? value : "—";
}

type AdminFailedLoginAlertsReadOnlyCardProps = {
  /**
   * Static presentation signal per mount point (never a media query, never a
   * cardinality source). The default renders the responsive pair (desktop
   * Card + mobile section, CSS-switched). The Admin mobile command module
   * mounts `"mobile"` so its no-scroll contract never sees the hidden desktop
   * table wrapper (`dashboard-table-responsive`, overflow-x auto).
   */
  presentation?: "responsive" | "mobile";
};

export function AdminFailedLoginAlertsReadOnlyCard({
  presentation = "responsive",
}: AdminFailedLoginAlertsReadOnlyCardProps = {}) {
  const [snapshot, setSnapshot] =
    useState<AdminFailedLoginAlertsSnapshot | null>(null);
  const [surface, setSurface] = useState<
    AdminFailedLoginAlertSurface | "all"
  >("all");
  const [reason, setReason] = useState<AdminFailedLoginAlertReason | "all">(
    "all",
  );
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // One collapsed runtime feeds both presentations, so the visible container
  // (desktop table region or mobile list region) drives a single cardinality.
  const [desktopBodyNode, setDesktopBodyNode] = useState<HTMLElement | null>(
    null,
  );
  const [mobileBodyNode, setMobileBodyNode] = useState<HTMLElement | null>(null);

  const latestRequestRef = useRef(0);
  const snapshotRef = useRef<AdminFailedLoginAlertsSnapshot | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);


  // One owner per canvas. The two presentations are mutually exclusive by
  // media query, so exactly one reports `measured` — a function of the
  // viewport alone, with no row content, page or history in it.
  const mobileCapacity = useDashboardCanvasCapacity({
    canvasNode: mobileBodyNode,
    fallbackItems: FAILED_LOGIN_FALLBACK_ROWS,
    minItems: 1,
    maxItems: FAILED_LOGIN_LIMIT_CAP,
  });
  const desktopCapacity = useDashboardCanvasCapacity({
    canvasNode: desktopBodyNode,
    fallbackItems: FAILED_LOGIN_FALLBACK_ROWS,
    minItems: 1,
    maxItems: FAILED_LOGIN_LIMIT_CAP,
  });
  const rowsPerPage = mobileCapacity.measured
    ? mobileCapacity.capacity
    : desktopCapacity.measured
      ? desktopCapacity.capacity
      : FAILED_LOGIN_FALLBACK_ROWS;

  // Effective server page size: the measured rows, bounded by the re-fetch
  // cap. The hook already clamps to [1, FAILED_LOGIN_LIMIT_CAP].
  const effectiveLimit = rowsPerPage;

  const query = useMemo(
    () => ({
      ...(surface !== "all" ? { surface } : {}),
      ...(reason !== "all" ? { reason } : {}),
      limit: effectiveLimit,
      offset,
    }),
    [effectiveLimit, offset, reason, surface],
  );

  const csvUrl = useMemo(
    () =>
      buildAdminFailedLoginAlertsCsvUrl({
        ...(surface !== "all" ? { surface } : {}),
        ...(reason !== "all" ? { reason } : {}),
      }),
    [reason, surface],
  );

  function clearFailedLoginAlertFilters() {
    setSurface("all");
    setReason("all");
    setOffset(0);
  }

  function loadFailedLoginAlerts() {
    setError(null);

    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    startTransition(() => {
      void (async () => {
        try {
          const result = await getAdminFailedLoginAlerts(query);
          if (requestId !== latestRequestRef.current) return;
          setSnapshot(result);
        } catch (err) {
          if (requestId !== latestRequestRef.current) return;
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar los intentos fallidos.",
          );
        }
      })();
    });
  }

  // Recompute offset when the effective limit changes so the same first record
  // stays visible; clamp against the known total.
  const previousLimitRef = useRef(effectiveLimit);
  useEffect(() => {
    if (previousLimitRef.current === effectiveLimit) {
      return;
    }
    previousLimitRef.current = effectiveLimit;

    setOffset((currentOffset) => {
      let nextOffset = Math.floor(currentOffset / effectiveLimit) * effectiveLimit;
      const total = snapshotRef.current?.total;
      if (typeof total === "number") {
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
    loadFailedLoginAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const alerts = snapshot?.failedLoginAlerts ?? [];
  const hasPreviousPage = offset > 0;
  const hasNextPage = snapshot
    ? offset + snapshot.failedLoginAlerts.length < snapshot.total
    : false;
  const page = Math.floor(offset / effectiveLimit) + 1;
  const pageCount = snapshot
    ? Math.max(1, Math.ceil(snapshot.total / effectiveLimit))
    : 1;
  const rangeStart = alerts.length ? offset + 1 : 0;
  const rangeEnd = offset + alerts.length;

  function goToPreviousPage() {
    setOffset(Math.max(offset - effectiveLimit, 0));
  }

  function goToNextPage() {
    setOffset(offset + effectiveLimit);
  }

  const showDesktopPresentation = presentation !== "mobile";

  return (
    <>
      {showDesktopPresentation ? (
      <Card
        id="failed-login-alerts"
        className="dashboard-surface hidden min-h-0 flex-1 flex-col overflow-hidden md:flex"
      >
      <CardHeader className="flex flex-col gap-3 border-b border-vetneb-line/70 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-base">
            Intentos fallidos de login
          </CardTitle>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            type="button"
            variant="outline"
            onClick={clearFailedLoginAlertFilters}
            disabled={surface === "all" && reason === "all" && offset === 0}
          >
            Limpiar filtros
          </Button>
          <PublicExternalControl
            href={csvUrl}
            target="_self"
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-card/95 px-4 text-sm font-semibold text-foreground shadow-[0_1px_2px_rgba(15,45,62,0.05)] transition-[background-color,border-color,box-shadow,color] duration-150 hover:border-vetneb-teal/45 hover:bg-accent/70 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55 sm:w-auto"
          >
            Exportar CSV
          </PublicExternalControl>
          <Button
            type="button"
            onClick={loadFailedLoginAlerts}
            disabled={isPending}
            aria-busy={isPending ? true : undefined}
          >
            {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {isPending ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-4">
        <div className="dashboard-filter-stats-grid shrink-0">
          <div className="surface-soft">
            <p className="text-xs text-muted-foreground">Total filtrado</p>
            <p className="mt-1 text-2xl font-bold text-vetneb-ink">
              {snapshot?.total ?? "—"}
            </p>
          </div>

          <label className="surface-soft">
            <span className="text-xs text-muted-foreground">Superficie</span>
            <select
              className="field-select mt-1"
              value={surface}
              onChange={(event) => {
                setOffset(0);
                setSurface(
                  event.target.value as AdminFailedLoginAlertSurface | "all",
                );
              }}
            >
              <option value="all">Todas</option>
              <option value="admin">Admin</option>
              <option value="clinic">Clínica</option>
              <option value="particular">Particular</option>
            </select>
          </label>

          <label className="surface-soft">
            <span className="text-xs text-muted-foreground">Motivo</span>
            <select
              className="field-select mt-1"
              value={reason}
              onChange={(event) => {
                setOffset(0);
                setReason(
                  event.target.value as AdminFailedLoginAlertReason | "all",
                );
              }}
            >
              <option value="all">Todos</option>
              <option value="missing_credentials">Credenciales faltantes</option>
              <option value="invalid_credentials">Credenciales inválidas</option>
              <option value="rate_limited">Bloqueo temporal</option>
            </select>
          </label>

          <div className="surface-soft">
            <p className="text-xs text-muted-foreground">Página</p>
            <p className="mt-1 text-sm font-semibold text-vetneb-ink">
              {page}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {snapshot
                ? `${snapshot.failedLoginAlerts.length} visibles`
                : "—"}
            </p>
          </div>
        </div>

        {error ? (
          <div className="clinical-alert-error">
            {error}
          </div>
        ) : null}

        <div
          ref={setDesktopBodyNode}
          data-dashboard-adaptive-rows-canvas="true"
              data-dashboard-row-pitch="compact"
              data-dashboard-canvas-reserve="table-head-dense"
          className="min-h-0 flex-1"
        >
          <div className="dashboard-table-responsive">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Superficie</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>User agent</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-[4.5rem] text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot?.failedLoginAlerts.length ? (
                  snapshot.failedLoginAlerts.map((alert, index) => (
                    <TableRow
                      key={alert.id}
                    >
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        #{alert.id}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSurfaceVariant(alert.surface)}>
                          {formatSurface(alert.surface)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-vetneb-ink/88">
                        {formatNullable(alert.username)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getReasonVariant(alert.reason)}>
                          {formatReason(alert.reason)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatNullable(alert.ipAddress)}
                      </TableCell>
                      {/* PR-TRUNC. The cell stays single-line: this table is a
                          pitch-locked adaptive canvas (`row-pitch="compact"`,
                          `td { block-size: var(--dash-row-pitch); overflow:
                          hidden }`), so letting a ~130-character user agent
                          wrap would trade a horizontal ellipsis for a VERTICAL
                          clip and move the adaptive row capacity (A03). The
                          truncation is legitimate ONLY because the "Ver" action
                          below opens AdminFailedLoginDetailDialog, which renders
                          the whole user agent — a real keyboard- and screen-
                          reader-reachable surface, not a hover-only tooltip. */}
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {formatNullable(alert.userAgent)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(alert.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <AdminFailedLoginDetailDialog
                          alert={alert}
                          surfaceLabel={formatSurface(alert.surface)}
                          reasonLabel={formatReason(alert.reason)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : isPending ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-3">
                      <LoadingState
                        variant="table"
                        compact
                        rows={3}
                        className="border-0 bg-transparent shadow-none rounded-none"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="clinical-table-state">
                      {error ? (
                        "No se pudieron cargar los intentos fallidos."
                      ) : (
                        <EmptyState
                          title="Sin intentos fallidos"
                          description="No hay intentos fallidos para los filtros seleccionados."
                          size="sm"
                          className="border-0 bg-transparent"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div
          data-dashboard-adaptive-reserved-region="pager"
          className="dashboard-table-pagination shrink-0 overflow-hidden"
          style={DASHBOARD_TOUCH_PAGER_RESERVATION}
        >
          <div className="dashboard-table-pagination-controls">
            <Button
              type="button"
              variant="outline"
              disabled={!hasPreviousPage || isPending}
              onClick={goToPreviousPage}
              className="flex-1 sm:flex-none"
            >
              Anterior
            </Button>
            <span
              className="dashboard-pagination-context"
              aria-live="polite"
              aria-atomic="true"
            >
              Pág.&nbsp;{page}
              {snapshot ? ` / ${pageCount}` : null}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={!hasNextPage || isPending}
              onClick={goToNextPage}
              className="flex-1 sm:flex-none"
            >
              Siguiente
            </Button>
          </div>
        </div>
      </CardContent>
      </Card>
      ) : null}

      <section
        aria-label="Intentos fallidos de login"
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden md:hidden"
      >
        <div className="flex shrink-0 items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-semibold text-vetneb-ink">
            {snapshot ? `${snapshot.total} intentos fallidos` : "Intentos fallidos"}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={loadFailedLoginAlerts}
            disabled={isPending}
            aria-busy={isPending ? true : undefined}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            Actualizar
          </Button>
        </div>

        <div
          ref={setMobileBodyNode}
          data-dashboard-adaptive-rows-canvas="true"
              data-dashboard-row-pitch="regular"
          className="min-h-0 flex-1 divide-y divide-vetneb-line/60 overflow-hidden rounded-lg border border-vetneb-line/75"
        >
          {alerts.length ? (
            alerts.map((alert, index) => (
              <article
                key={alert.id}
                data-admin-mobile-status-item="true"
                    data-dashboard-adaptive-row="true"
                className="flex min-h-9 items-center gap-2 overflow-hidden px-2.5 py-0.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Badge
                      variant={getSurfaceVariant(alert.surface)}
                      className="h-5 px-1.5 text-[10px]"
                    >
                      {formatSurface(alert.surface)}
                    </Badge>
                    <Badge
                      variant={getReasonVariant(alert.reason)}
                      className="h-5 px-1.5 text-[10px]"
                    >
                      {formatReason(alert.reason)}
                    </Badge>
                    <span className="min-w-0 truncate text-xs font-medium text-vetneb-ink">
                      {alert.username && alert.username.trim()
                        ? alert.username
                        : "Sin usuario"}
                    </span>
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {alert.ipAddress ?? "IP —"} · {formatDateTime(alert.createdAt)}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  #{alert.id}
                </span>
                <span className="shrink-0">
                  <AdminFailedLoginDetailDialog
                    alert={alert}
                    surfaceLabel={formatSurface(alert.surface)}
                    reasonLabel={formatReason(alert.reason)}
                  />
                </span>
              </article>
            ))
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
              {error
                ? "No se pudieron cargar los intentos fallidos."
                : isPending
                  ? "Cargando intentos fallidos..."
                  : "Sin intentos fallidos registrados."}
            </div>
          )}
        </div>

        <AdminMobileOpsPager
          ariaLabel="Paginación de intentos fallidos"
          page={page}
          pageCount={pageCount}
          rangeLabel={
            alerts.length
              ? `${rangeStart}–${rangeEnd} de ${snapshot?.total ?? 0}`
              : "Sin intentos"
          }
          previousDisabled={!hasPreviousPage}
          nextDisabled={!hasNextPage}
          disabled={isPending}
          onPrevious={goToPreviousPage}
          onNext={goToNextPage}
        />
      </section>
    </>
  );
}
