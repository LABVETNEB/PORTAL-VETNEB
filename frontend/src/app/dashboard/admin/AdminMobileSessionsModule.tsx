"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminSessions, revokeAdminSession } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type {
  AdminSessionStatus,
  AdminSessionSummary,
  AdminSessionType,
  AdminSessionsSnapshot,
} from "@/types";
import { AdminMobileOpsPager } from "./AdminMobileOpsPager";

const MOBILE_PAGE_SIZE = 3;

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

function getSessionKey(session: AdminSessionSummary) {
  return `${session.sessionType}-${session.sessionId}`;
}

export function AdminMobileSessionsModule() {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [snapshot, setSnapshot] = useState<AdminSessionsSnapshot | null>(null);
  const [sessionType, setSessionType] = useState<AdminSessionType | "all">("all");
  const [status, setStatus] = useState<AdminSessionStatus | "all">("all");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [revokingSessionKey, setRevokingSessionKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const query = useMemo(
    () => ({
      ...(sessionType !== "all" ? { sessionType } : {}),
      ...(status !== "all" ? { status } : {}),
      limit: MOBILE_PAGE_SIZE,
      offset,
    }),
    [offset, sessionType, status],
  );

  function loadSessions() {
    if (!isMobileViewport) return;
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          setSnapshot(await getAdminSessions(query));
        } catch (err) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar las sesiones.");
        }
      })();
    });
  }

  async function handleRevokeSession(session: AdminSessionSummary) {
    const sessionKey = getSessionKey(session);
    const confirmed = window.confirm(
      `¿Revocar la sesión ${formatSessionType(session.sessionType)} #${session.sessionId}? Esta acción cerrará esa sesión y quedará auditada.`,
    );
    if (!confirmed) return;

    setError(null);
    setRevokingSessionKey(sessionKey);
    try {
      await revokeAdminSession(session.sessionType, session.sessionId);
      setSnapshot(await getAdminSessions(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revocar la sesión seleccionada.");
    } finally {
      setRevokingSessionKey(null);
    }
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) return;
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobileViewport, query]);

  const sessions = snapshot?.sessions ?? [];
  const page = Math.floor(offset / MOBILE_PAGE_SIZE) + 1;
  const pageCount = snapshot
    ? Math.max(1, Math.ceil(snapshot.total / MOBILE_PAGE_SIZE))
    : 1;
  const rangeStart = sessions.length ? offset + 1 : 0;
  const rangeEnd = offset + sessions.length;
  const hasNextPage = snapshot ? rangeEnd < snapshot.total : false;
  const disabled = isPending || revokingSessionKey !== null;

  return (
    <section
      data-admin-mobile-ops-module="sessions"
      aria-label="Sesiones administrativas"
      className="dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-vetneb-line/80 bg-card md:hidden"
    >
      <header className="flex min-h-10 shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-vetneb-line/70 px-2 py-1">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-vetneb-ink">
            {snapshot ? `${snapshot.total} sesiones` : "Sesiones"}
          </p>
          <p className={`truncate text-[11px] ${error ? "text-destructive" : "text-muted-foreground"}`} role={error ? "alert" : undefined}>
            {error ?? "Activas y expiradas"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={loadSessions}
          disabled={disabled || !isMobileViewport}
          aria-busy={isPending ? true : undefined}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          Actualizar
        </Button>
      </header>

      <div className="grid min-h-12 shrink-0 grid-cols-2 gap-2 overflow-hidden border-b border-vetneb-line/70 bg-muted/15 px-2 py-1">
        <label className="grid min-w-0 gap-0.5 text-[10px] font-medium text-muted-foreground">
          Tipo
          <select
            className="field-select h-7 text-xs"
            value={sessionType}
            disabled={disabled}
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
        <label className="grid min-w-0 gap-0.5 text-[10px] font-medium text-muted-foreground">
          Estado
          <select
            className="field-select h-7 text-xs"
            value={status}
            disabled={disabled}
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
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-3 overflow-hidden">
        {sessions.length ? (
          sessions.map((session) => {
            const sessionKey = getSessionKey(session);
            const isRevoking = revokingSessionKey === sessionKey;
            const isCurrentAdminSession =
              session.sessionType === "admin" &&
              session.sessionId === snapshot?.currentAdminSessionId;

            return (
              <article
                key={sessionKey}
                data-admin-mobile-ops-item="true"
                className="flex min-h-0 items-center gap-2 overflow-hidden border-b border-vetneb-line/70 px-2 py-1 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={session.sessionType === "admin" ? "default" : "secondary"} className="h-5 px-1.5 text-[10px]">
                      {formatSessionType(session.sessionType)}
                    </Badge>
                    <Badge variant={session.status === "active" ? "default" : "outline"} className="h-5 px-1.5 text-[10px]">
                      {session.status === "active" ? "Activa" : "Expirada"}
                    </Badge>
                  </div>
                  <p className="truncate text-xs font-medium text-vetneb-ink">
                    {formatActorType(session.actorType)} · #{session.sessionId}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    Acceso {session.lastAccess ? formatDateTime(session.lastAccess) : "—"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs"
                  disabled={disabled || isCurrentAdminSession}
                  aria-busy={isRevoking ? true : undefined}
                  aria-label={isCurrentAdminSession ? `Sesión ${formatSessionType(session.sessionType)} #${session.sessionId} actual, no se puede revocar` : `Revocar sesión ${formatSessionType(session.sessionType)} #${session.sessionId}`}
                  onClick={() => void handleRevokeSession(session)}
                >
                  {isCurrentAdminSession ? "Actual" : isRevoking ? "Revocando..." : "Revocar"}
                </Button>
              </article>
            );
          })
        ) : (
          <div className="col-span-full row-span-3 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">
            {error ? "Error al cargar sesiones" : isPending ? "Cargando sesiones..." : "Sin sesiones"}
          </div>
        )}
      </div>

      <AdminMobileOpsPager
        ariaLabel="Paginación de sesiones"
        page={page}
        pageCount={pageCount}
        rangeLabel={sessions.length ? `${rangeStart}–${rangeEnd} de ${snapshot?.total ?? 0}` : "Sin sesiones"}
        previousDisabled={offset === 0}
        nextDisabled={!hasNextPage}
        disabled={disabled}
        onPrevious={() => setOffset(Math.max(0, offset - MOBILE_PAGE_SIZE))}
        onNext={() => setOffset(offset + MOBILE_PAGE_SIZE)}
      />
    </section>
  );
}
