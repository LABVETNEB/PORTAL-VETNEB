"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { LoadingState } from "@/components/dashboard/LoadingState";
import type {
  AdminFailedLoginAlertReason,
  AdminFailedLoginAlertsSnapshot,
  AdminFailedLoginAlertSurface,
} from "@/types";

const PAGE_SIZE = 25;

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

export function AdminFailedLoginAlertsReadOnlyCard() {
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

  const query = useMemo(
    () => ({
      ...(surface !== "all" ? { surface } : {}),
      ...(reason !== "all" ? { reason } : {}),
      limit: PAGE_SIZE,
      offset,
    }),
    [offset, reason, surface],
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

    startTransition(() => {
      void (async () => {
        try {
          const result = await getAdminFailedLoginAlerts(query);
          setSnapshot(result);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar los intentos fallidos.",
          );
        }
      })();
    });
  }

  useEffect(() => {
    loadFailedLoginAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const hasPreviousPage = offset > 0;
  const hasNextPage = snapshot
    ? offset + snapshot.failedLoginAlerts.length < snapshot.total
    : false;

  return (
    <Card id="failed-login-alerts" className="dashboard-surface">
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

      <CardContent className="space-y-4 pt-6">
        <div className="dashboard-filter-stats-grid">
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
              {Math.floor(offset / PAGE_SIZE) + 1}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot?.failedLoginAlerts.length ? (
                snapshot.failedLoginAlerts.map((alert) => (
                  <TableRow key={alert.id}>
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
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {formatNullable(alert.userAgent)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(alert.createdAt)}
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

        <div className="dashboard-table-pagination">
          <div className="dashboard-table-pagination-controls">
            <Button
              type="button"
              variant="outline"
              disabled={!hasPreviousPage || isPending}
              onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
              className="flex-1 sm:flex-none"
            >
              Anterior
            </Button>
            <span
              className="dashboard-pagination-context"
              aria-live="polite"
              aria-atomic="true"
            >
              Pág.&nbsp;{Math.floor(offset / PAGE_SIZE) + 1}
              {snapshot ? ` / ${Math.max(1, Math.ceil(snapshot.total / PAGE_SIZE))}` : null}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={!hasNextPage || isPending}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="flex-1 sm:flex-none"
            >
              Siguiente
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
