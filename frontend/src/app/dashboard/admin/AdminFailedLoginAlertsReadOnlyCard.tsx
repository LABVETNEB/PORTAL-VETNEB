"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  return "Rate limit";
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
  if (value === "rate_limited") return "destructive";
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
    <Card id="failed-login-alerts">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-base">
            Intentos fallidos de login
          </CardTitle>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={clearFailedLoginAlertFilters}
            disabled={surface === "all" && reason === "all" && offset === 0}
          >
            Limpiar filtros
          </Button>
          <Button
            type="button"
            variant="outline"
            asChild
          >
            <a href={csvUrl}>Exportar CSV</a>
          </Button>
          <Button
            type="button"
            onClick={loadFailedLoginAlerts}
            disabled={isPending}
          >
            {isPending ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="surface-soft">
            <p className="text-xs text-gray-400">Total filtrado</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {snapshot?.total ?? "—"}
            </p>
          </div>

          <label className="surface-soft">
            <span className="text-xs text-gray-400">Superficie</span>
            <select
              className="field-select mt-2"
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
            <span className="text-xs text-gray-400">Motivo</span>
            <select
              className="field-select mt-2"
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
              <option value="rate_limited">Rate limit</option>
            </select>
          </label>

          <div className="surface-soft">
            <p className="text-xs text-gray-400">Página</p>
            <p className="mt-1 text-sm font-semibold text-gray-700">
              {Math.floor(offset / PAGE_SIZE) + 1}
            </p>
            <p className="mt-1 text-xs text-gray-400">
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

        <div className="overflow-hidden">
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
                    <TableCell className="whitespace-nowrap font-mono text-xs text-gray-400">
                      #{alert.id}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSurfaceVariant(alert.surface)}>
                        {formatSurface(alert.surface)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatNullable(alert.username)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getReasonVariant(alert.reason)}>
                        {formatReason(alert.reason)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {formatNullable(alert.ipAddress)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-gray-500">
                      {formatNullable(alert.userAgent)}
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">
                      {formatDateTime(alert.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="clinical-table-state"
                  >
                    {isPending
                      ? "Cargando intentos fallidos..."
                      : error
                        ? "No se pudieron cargar los intentos fallidos."
                        : "No hay intentos fallidos para los filtros seleccionados."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!hasPreviousPage || isPending}
              onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!hasNextPage || isPending}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
