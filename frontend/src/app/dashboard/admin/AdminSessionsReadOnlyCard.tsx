"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { getAdminSessions } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type {
  AdminSessionStatus,
  AdminSessionSummary,
  AdminSessionType,
  AdminSessionsSnapshot,
} from "@/types";

const PAGE_SIZE = 25;

function formatOptionalDate(value: string | null) {
  return value ? formatDateTime(value) : "—";
}

function formatSessionType(value: AdminSessionType) {
  if (value === "admin") return "Admin";
  if (value === "clinic") return "Clínica";
  return "Particular";
}

function formatActorType(value: AdminSessionSummary["actorType"]) {
  if (value === "admin_user") return "Admin";
  if (value === "clinic_user") return "Clínica";
  return "Token particular";
}

function getSessionTypeVariant(
  value: AdminSessionType,
): "default" | "secondary" | "destructive" | "outline" {
  if (value === "admin") return "default";
  if (value === "clinic") return "secondary";
  return "outline";
}

function getStatusVariant(
  value: AdminSessionStatus,
): "default" | "secondary" | "destructive" | "outline" {
  return value === "active" ? "default" : "destructive";
}

function formatStatus(value: AdminSessionStatus) {
  return value === "active" ? "Activa" : "Expirada";
}

export function AdminSessionsReadOnlyCard() {
  const [snapshot, setSnapshot] = useState<AdminSessionsSnapshot | null>(null);
  const [sessionType, setSessionType] = useState<AdminSessionType | "all">(
    "all",
  );
  const [status, setStatus] = useState<AdminSessionStatus | "all">("all");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const query = useMemo(
    () => ({
      ...(sessionType !== "all" ? { sessionType } : {}),
      ...(status !== "all" ? { status } : {}),
      limit: PAGE_SIZE,
      offset,
    }),
    [offset, sessionType, status],
  );

  function loadSessions() {
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const result = await getAdminSessions(query);
          setSnapshot(result);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar las sesiones.",
          );
        }
      })();
    });
  }

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const hasPreviousPage = offset > 0;
  const hasNextPage = snapshot ? offset + snapshot.sessions.length < snapshot.total : false;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-base">Sesiones activas y expiradas</CardTitle>
          <CardDescription>
            Vista read-only de sesiones Admin, clínica y particulares. No expone
            tokens, hashes ni cookies.
          </CardDescription>
        </div>

        <Button type="button" onClick={loadSessions} disabled={isPending}>
          {isPending ? "Actualizando..." : "Actualizar"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs text-gray-400">Total filtrado</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {snapshot?.total ?? "—"}
            </p>
          </div>

          <label className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <span className="text-xs text-gray-400">Tipo de sesión</span>
            <select
              className="mt-2 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700"
              value={sessionType}
              onChange={(event) => {
                setOffset(0);
                setSessionType(event.target.value as AdminSessionType | "all");
              }}
            >
              <option value="all">Todas</option>
              <option value="admin">Admin</option>
              <option value="clinic">Clínica</option>
              <option value="particular">Particular</option>
            </select>
          </label>

          <label className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <span className="text-xs text-gray-400">Estado</span>
            <select
              className="mt-2 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700"
              value={status}
              onChange={(event) => {
                setOffset(0);
                setStatus(event.target.value as AdminSessionStatus | "all");
              }}
            >
              <option value="all">Todos</option>
              <option value="active">Activas</option>
              <option value="expired">Expiradas</option>
            </select>
          </label>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs text-gray-400">Página</p>
            <p className="mt-1 text-sm font-semibold text-gray-700">
              {Math.floor(offset / PAGE_SIZE) + 1}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {snapshot ? `${snapshot.sessions.length} visibles` : "—"}
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sesión</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creada</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Expira</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot?.sessions.length ? (
                snapshot.sessions.map((session) => (
                  <TableRow key={`${session.sessionType}-${session.sessionId}`}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={getSessionTypeVariant(session.sessionType)}>
                          {formatSessionType(session.sessionType)}
                        </Badge>
                        <span className="font-mono text-xs text-gray-400">
                          #{session.sessionId}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatActorType(session.actorType)} #{session.actorId}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(session.status)}>
                        {formatStatus(session.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">
                      {formatOptionalDate(session.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">
                      {formatOptionalDate(session.lastAccess)}
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">
                      {formatOptionalDate(session.expiresAt)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-gray-400"
                  >
                    {isPending
                      ? "Cargando sesiones..."
                      : "No hay sesiones para los filtros seleccionados."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-gray-400">
            Endpoint: <code>GET /api/admin/sessions</code>. Vista sin acciones
            destructivas.
          </p>

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