"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type {
  AdminSessionStatus,
  AdminSessionSummary,
  AdminSessionType,
  AdminSessionsSnapshot,
} from "@/types";

// Nine rows match the viewport-safe contract used across admin enterprise modules.
// The admin-sessions workspace also renders a compact credential-change control above
// this card; if no-scroll regressions appear at 1366×768, reduce to 8 and document.
const PAGE_SIZE = 9;

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

function getSessionKey(session: AdminSessionSummary) {
  return `${session.sessionType}-${session.sessionId}`;
}

type SessionTypeBadgeProps = {
  sessionType: AdminSessionType;
};

function SessionTypeBadge({ sessionType }: SessionTypeBadgeProps) {
  return (
    <Badge
      variant={getSessionTypeVariant(sessionType)}
      className="h-5 px-1.5 text-[11px] font-medium"
    >
      {formatSessionType(sessionType)}
    </Badge>
  );
}

type SessionStatusBadgeProps = {
  status: AdminSessionStatus;
};

function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  return (
    <Badge
      variant={getStatusVariant(status)}
      className="h-5 px-1.5 text-[11px] font-medium"
    >
      {formatStatus(status)}
    </Badge>
  );
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
    const sessionKey = getSessionKey(session);
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

  const sessions = snapshot?.sessions ?? [];
  const hasPreviousPage = offset > 0;
  const hasNextPage = snapshot
    ? offset + snapshot.sessions.length < snapshot.total
    : false;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = snapshot
    ? Math.max(1, Math.ceil(snapshot.total / PAGE_SIZE))
    : 1;
  const rangeStart = sessions.length ? offset + 1 : 0;
  const rangeEnd = offset + sessions.length;
  const activeOnPage = sessions.filter((session) => session.status === "active")
    .length;
  const expiredOnPage = sessions.filter(
    (session) => session.status === "expired",
  ).length;
  const disableActions = isPending || revokingSessionKey !== null;

  return (
    <Card className="dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden shadow-none hover:shadow-none">
      <CardHeader className="flex min-h-12 shrink-0 flex-row items-center justify-between gap-3 space-y-0 border-b border-vetneb-line/70 px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <CardTitle className="text-base">Sesiones activas y expiradas</CardTitle>
          <p
            className={`line-clamp-2 text-xs sm:truncate ${
              error ? "text-destructive" : "text-muted-foreground"
            }`}
            role={error ? "alert" : undefined}
            title={error ?? undefined}
          >
            {error ??
              "Admin, clínica y particulares. Sin tokens ni hashes. Revocación auditada."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 px-2.5 text-xs"
          onClick={loadSessions}
          disabled={disableActions}
          aria-busy={isPending ? true : undefined}
        >
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {isPending ? "Actualizando..." : "Actualizar"}
        </Button>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="dashboard-filter-stats-grid min-h-11 shrink-0 border-b border-vetneb-line/70">
          <div className="flex items-center justify-between gap-2 px-1 py-1">
            <span className="truncate text-[11px] text-muted-foreground sm:text-xs">
              Total filtrado
            </span>
            <strong className="text-xl font-semibold tabular-nums text-vetneb-ink">
              {snapshot?.total ?? "—"}
            </strong>
          </div>
          <div className="flex items-center justify-between gap-2 px-1 py-1">
            <span
              className="truncate text-[11px] text-muted-foreground sm:text-xs"
              title="Activas visibles en la página actual"
            >
              Activas
            </span>
            <strong className="text-xl font-semibold tabular-nums text-vetneb-ink">
              {snapshot ? activeOnPage : "—"}
            </strong>
          </div>
          <div className="flex items-center justify-between gap-2 px-1 py-1">
            <span
              className="truncate text-[11px] text-muted-foreground sm:text-xs"
              title="Expiradas visibles en la página actual"
            >
              Expiradas
            </span>
            <strong className="text-xl font-semibold tabular-nums text-vetneb-ink">
              {snapshot ? expiredOnPage : "—"}
            </strong>
          </div>
          <div className="flex items-center justify-between gap-2 px-1 py-1">
            <span className="truncate text-[11px] text-muted-foreground sm:text-xs">
              Página
            </span>
            <strong className="text-xl font-semibold tabular-nums text-vetneb-ink">
              {snapshot ? page : "—"}
            </strong>
          </div>
        </div>

        <div
          className="flex min-h-12 shrink-0 items-end gap-2 border-b border-vetneb-line/70 bg-muted/15 px-3 py-2 sm:px-4"
          aria-label="Filtros de sesiones"
        >
          <label className="grid min-w-0 flex-1 gap-1 text-[11px] font-medium text-muted-foreground sm:max-w-48">
            Tipo de sesión
            <select
              className="field-select h-8 text-xs"
              value={sessionType}
              disabled={disableActions}
              onChange={(event) => {
                setError(null);
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

          <label className="grid min-w-0 flex-1 gap-1 text-[11px] font-medium text-muted-foreground sm:max-w-48">
            Estado
            <select
              className="field-select h-8 text-xs"
              value={status}
              disabled={disableActions}
              onChange={(event) => {
                setError(null);
                setOffset(0);
                setStatus(event.target.value as AdminSessionStatus | "all");
              }}
            >
              <option value="all">Todos</option>
              <option value="active">Activas</option>
              <option value="expired">Expiradas</option>
            </select>
          </label>

          <span className="ml-auto hidden pb-2 text-[11px] text-muted-foreground md:inline">
            {PAGE_SIZE} por página
          </span>
        </div>

        <div className="min-h-0 flex-1 py-2">
          {sessions.length ? (
            <>
              <div className="dashboard-table-responsive dashboard-fitted-table hidden px-3 md:block sm:px-4">
                <Table
                  className="table-fixed text-[13px] [&_td]:h-9 [&_td]:px-2 [&_td]:py-1 [&_th]:h-8 [&_th]:px-2 [&_th]:text-xs [&_th]:font-semibold"
                  aria-label="Tabla de sesiones administrativas"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[14%]">Sesión</TableHead>
                      <TableHead className="w-[14%]">Actor</TableHead>
                      <TableHead className="w-[10%]">Estado</TableHead>
                      <TableHead className="hidden w-[9.5rem] lg:table-cell">
                        Creada
                      </TableHead>
                      <TableHead className="w-[9.5rem]">Último acceso</TableHead>
                      <TableHead className="hidden w-[9.5rem] xl:table-cell">
                        Expira
                      </TableHead>
                      <TableHead className="w-[8.5rem] text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => {
                      const sessionKey = getSessionKey(session);
                      const isRevoking = revokingSessionKey === sessionKey;
                      const isCurrentAdminSession =
                        session.sessionType === "admin" &&
                        typeof snapshot?.currentAdminSessionId === "number" &&
                        session.sessionId === snapshot.currentAdminSessionId;

                      return (
                        <TableRow key={sessionKey}>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <SessionTypeBadge sessionType={session.sessionType} />
                              <span className="truncate font-mono text-[11px] text-muted-foreground">
                                #{session.sessionId}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="truncate text-xs text-vetneb-ink/88">
                              {formatActorType(session.actorType)}
                            </p>
                            <p className="truncate font-mono text-[11px] text-muted-foreground">
                              ID {session.actorId}
                            </p>
                          </TableCell>
                          <TableCell>
                            <SessionStatusBadge status={session.status} />
                          </TableCell>
                          <TableCell className="hidden truncate text-xs text-muted-foreground lg:table-cell">
                            {formatOptionalDate(session.createdAt)}
                          </TableCell>
                          <TableCell className="truncate text-xs text-muted-foreground">
                            {formatOptionalDate(session.lastAccess)}
                          </TableCell>
                          <TableCell className="hidden truncate text-xs text-muted-foreground xl:table-cell">
                            {formatOptionalDate(session.expiresAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={isRevoking || isCurrentAdminSession}
                              aria-busy={isRevoking ? true : undefined}
                              aria-label={
                                isCurrentAdminSession
                                  ? `Sesión ${formatSessionType(session.sessionType)} #${session.sessionId} actual, no se puede revocar`
                                  : `Revocar sesión ${formatSessionType(session.sessionType)} #${session.sessionId}`
                              }
                              onClick={() => void handleRevokeSession(session)}
                            >
                              {isRevoking ? (
                                <Loader2 className="animate-spin" aria-hidden="true" />
                              ) : null}
                              {isCurrentAdminSession
                                ? "Sesión actual"
                                : isRevoking
                                  ? "Revocando..."
                                  : "Revocar"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div
                className="divide-y divide-vetneb-line/70 border-y border-vetneb-line/70 md:hidden"
                aria-label="Lista de sesiones"
              >
                {sessions.map((session) => {
                  const sessionKey = getSessionKey(session);
                  const isRevoking = revokingSessionKey === sessionKey;
                  const isCurrentAdminSession =
                    session.sessionType === "admin" &&
                    typeof snapshot?.currentAdminSessionId === "number" &&
                    session.sessionId === snapshot.currentAdminSessionId;

                  return (
                    <div
                      key={sessionKey}
                      className="flex min-h-10 items-center gap-2 px-3 py-1"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <SessionTypeBadge sessionType={session.sessionType} />
                          <SessionStatusBadge status={session.status} />
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {formatActorType(session.actorType)} · ID {session.actorId} ·
                          Sesión #{session.sessionId}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          Acceso {formatOptionalDate(session.lastAccess)} · Expira{" "}
                          {formatOptionalDate(session.expiresAt)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-xs"
                        disabled={isRevoking || isCurrentAdminSession}
                        aria-busy={isRevoking ? true : undefined}
                        aria-label={
                          isCurrentAdminSession
                            ? `Sesión ${formatSessionType(session.sessionType)} #${session.sessionId} actual, no se puede revocar`
                            : `Revocar sesión ${formatSessionType(session.sessionType)} #${session.sessionId}`
                        }
                        onClick={() => void handleRevokeSession(session)}
                      >
                        {isCurrentAdminSession
                          ? "Actual"
                          : isRevoking
                            ? "Revocando..."
                            : "Revocar"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : error ? (
            <div
              className="clinical-alert-error mx-3 sm:mx-4"
              role="alert"
            >
              {error}
            </div>
          ) : (
            <div className="mx-3 flex min-h-20 items-center justify-center rounded-md border border-vetneb-line/70 bg-muted/20 px-4 text-center text-xs text-muted-foreground sm:mx-4">
              {isPending
                ? "Cargando sesiones..."
                : "No hay sesiones para los filtros seleccionados."}
            </div>
          )}
        </div>

        <footer
          className="dashboard-table-pagination min-h-10 shrink-0 border-t border-vetneb-line/70 px-3 py-1.5 text-xs text-muted-foreground sm:px-4"
          aria-label="Paginación de sesiones"
        >
          <span aria-live="polite">
            {sessions.length
              ? `${rangeStart}–${rangeEnd} de ${snapshot?.total ?? 0}`
              : error
                ? "Error al cargar sesiones"
                : "Sin sesiones"}
          </span>
          <div className="dashboard-table-pagination-controls">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasPreviousPage || disableActions}
              onClick={() => {
                setError(null);
                setOffset(Math.max(offset - PAGE_SIZE, 0));
              }}
              className="h-7 px-2 text-xs flex-1 sm:flex-none"
            >
              Anterior
            </Button>
            <span
              className="dashboard-pagination-context"
              aria-live="polite"
              aria-atomic="true"
            >
              Pág. {page} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasNextPage || disableActions}
              onClick={() => {
                setError(null);
                setOffset(offset + PAGE_SIZE);
              }}
              className="h-7 px-2 text-xs flex-1 sm:flex-none"
            >
              Siguiente
            </Button>
          </div>
        </footer>
      </CardContent>
    </Card>
  );
}
