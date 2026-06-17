"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
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
import { getAdminSessions, revokeAdminSession } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { LoadingState } from "@/components/dashboard/LoadingState";
import type {
  AdminSessionStatus,
  AdminSessionSummary,
  AdminSessionType,
  AdminSessionsSnapshot,
} from "@/types";

// Single-viewport App Shell: a full page must fit the desktop viewport without
// scroll, so the server page size is bounded to what the compact table shows.
const PAGE_SIZE = 8;

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
  return value === "active" ? "default" : "outline";
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
  const [revokingSessionKey, setRevokingSessionKey] = useState<string | null>(
    null,
  );
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

  async function handleRevokeSession(session: AdminSessionSummary) {
    const sessionKey = `${session.sessionType}-${session.sessionId}`;
    const confirmed = window.confirm(
      `¿Revocar la sesión ${formatSessionType(session.sessionType)} #${
        session.sessionId
      }? Esta acción cerrará esa sesión y quedará auditada.`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setRevokingSessionKey(sessionKey);

    try {
      await revokeAdminSession(session.sessionType, session.sessionId);
      const refreshed = await getAdminSessions(query);
      setSnapshot(refreshed);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo revocar la sesión seleccionada.",
      );
    } finally {
      setRevokingSessionKey(null);
    }
  }

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const hasPreviousPage = offset > 0;
  const hasNextPage = snapshot
    ? offset + snapshot.sessions.length < snapshot.total
    : false;

  return (
    <Card className="dashboard-surface">
      <CardHeader className="flex flex-col gap-3 border-b border-vetneb-line/70 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-base">Sesiones activas y expiradas</CardTitle>
          <CardDescription>
            Vista de sesiones Admin, clínica y particulares. No expone tokens,
            hashes ni cookies. La revocación requiere confirmación explícita.
          </CardDescription>
        </div>

        <Button type="button" onClick={loadSessions} disabled={isPending} aria-busy={isPending ? true : undefined}>
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {isPending ? "Actualizando..." : "Actualizar"}
        </Button>
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
            <span className="text-xs text-muted-foreground">Tipo de sesión</span>
            <select
              className="field-select mt-1"
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

          <label className="surface-soft">
            <span className="text-xs text-muted-foreground">Estado</span>
            <select
              className="field-select mt-1"
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

          <div className="surface-soft">
            <p className="text-xs text-muted-foreground">Página</p>
            <p className="mt-1 text-sm font-semibold text-vetneb-ink">
              {Math.floor(offset / PAGE_SIZE) + 1}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {snapshot ? `${snapshot.sessions.length} visibles` : "—"}
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
                <TableHead>Sesión</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creada</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot?.sessions.length ? (
                snapshot.sessions.map((session) => {
                  const sessionKey = `${session.sessionType}-${session.sessionId}`;
                  const isRevoking = revokingSessionKey === sessionKey;
                  const isCurrentAdminSession =
                    session.sessionType === "admin" &&
                    typeof snapshot.currentAdminSessionId === "number" &&
                    session.sessionId === snapshot.currentAdminSessionId;

                  return (
                    <TableRow key={sessionKey}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={getSessionTypeVariant(session.sessionType)}
                          >
                            {formatSessionType(session.sessionType)}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground">
                            #{session.sessionId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-vetneb-ink/88">
                        {formatActorType(session.actorType)} #{session.actorId}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(session.status)}>
                          {formatStatus(session.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatOptionalDate(session.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatOptionalDate(session.lastAccess)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatOptionalDate(session.expiresAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isRevoking || isCurrentAdminSession}
                          aria-busy={isRevoking ? true : undefined}
                          aria-label={
                            isCurrentAdminSession
                              ? `Sesión ${formatSessionType(session.sessionType)} #${session.sessionId} actual, no se puede revocar`
                              : `Revocar sesión ${formatSessionType(session.sessionType)} #${session.sessionId}`
                          }
                          onClick={() => void handleRevokeSession(session)}
                        >
                          {isRevoking ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                          {isCurrentAdminSession
                            ? "Sesión actual"
                            : isRevoking
                              ? "Revocando..."
                              : "Revocar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
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
                      "No se pudieron cargar las sesiones."
                    ) : (
                      <EmptyState
                        title="Sin sesiones"
                        description="No hay sesiones para los filtros seleccionados."
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
