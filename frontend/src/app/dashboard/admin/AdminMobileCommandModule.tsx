"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminFailedLoginAlerts } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type {
  AdminFailedLoginAlertReason,
  AdminFailedLoginAlertSurface,
  AdminFailedLoginAlertsSnapshot,
} from "@/types";
import { AdminMobileStatusModule } from "./AdminMobileStatusModule";
import { AdminMobileOpsPager } from "./AdminMobileOpsPager";
import { AdminOverviewQuickLinks } from "./AdminOverviewQuickLinks";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

type RecentAdminActivity = {
  event: string;
  actor: string;
  date: string;
};

type AdminMobileCommandModuleProps = {
  auditEntriesCount: number;
  eventTypesCount: number;
  systemStatusLabel: string;
  systemStatusVariant: BadgeVariant;
  systemStatusIndicatorClass: string;
  systemStatusDetail: string;
  hasSystemHealthFetchError: boolean;
  recentActivity: RecentAdminActivity | null;
};

const FAILED_LOGIN_PAGE_SIZE = 3;

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

function getSurfaceVariant(value: AdminFailedLoginAlertSurface): BadgeVariant {
  if (value === "admin") return "default";
  if (value === "clinic") return "secondary";
  return "outline";
}

function getReasonVariant(value: AdminFailedLoginAlertReason): BadgeVariant {
  if (value === "rate_limited" || value === "invalid_credentials") {
    return "secondary";
  }
  return "outline";
}

// Compact, paginated mobile view of the failed-login alerts (the desktop
// "Alertas" tab table). Fetches lazily — only mounted when the chip is active —
// and only on mobile so the hidden desktop copy never triggers a network call.
function AdminMobileFailedLoginSection() {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [snapshot, setSnapshot] = useState<AdminFailedLoginAlertsSnapshot | null>(
    null,
  );
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const query = useMemo(
    () => ({ limit: FAILED_LOGIN_PAGE_SIZE, offset }),
    [offset],
  );

  function loadAlerts() {
    if (!isMobileViewport) return;
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          setSnapshot(await getAdminFailedLoginAlerts(query));
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
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) return;
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobileViewport, query]);

  const alerts = snapshot?.failedLoginAlerts ?? [];
  const total = snapshot?.total ?? 0;
  const page = Math.floor(offset / FAILED_LOGIN_PAGE_SIZE) + 1;
  const pageCount = snapshot
    ? Math.max(1, Math.ceil(total / FAILED_LOGIN_PAGE_SIZE))
    : 1;
  const rangeStart = alerts.length ? offset + 1 : 0;
  const rangeEnd = offset + alerts.length;
  const hasNextPage = snapshot ? rangeEnd < total : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold text-vetneb-ink">
          {snapshot ? `${total} intentos fallidos` : "Intentos fallidos"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={loadAlerts}
          disabled={isPending || !isMobileViewport}
          aria-busy={isPending ? true : undefined}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          Actualizar
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-3 gap-1.5 overflow-hidden">
        {alerts.length ? (
          alerts.map((alert) => (
            <article
              key={alert.id}
              data-admin-mobile-status-item="true"
              className="flex min-h-0 flex-col justify-center gap-1 overflow-hidden rounded-md border border-vetneb-line/70 bg-card/92 px-2.5 py-1.5"
            >
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
                <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                  #{alert.id}
                </span>
              </div>
              <p className="truncate text-xs font-medium text-vetneb-ink">
                {alert.username && alert.username.trim()
                  ? alert.username
                  : "Sin usuario"}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {alert.ipAddress ?? "IP —"} · {formatDateTime(alert.createdAt)}
              </p>
            </article>
          ))
        ) : (
          <div className="row-span-3 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">
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
          alerts.length ? `${rangeStart}–${rangeEnd} de ${total}` : "Sin intentos"
        }
        previousDisabled={offset === 0}
        nextDisabled={!hasNextPage}
        disabled={isPending}
        onPrevious={() =>
          setOffset(Math.max(0, offset - FAILED_LOGIN_PAGE_SIZE))
        }
        onNext={() => setOffset(offset + FAILED_LOGIN_PAGE_SIZE)}
      />
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div
      data-admin-mobile-status-item="true"
      className="rounded-md border border-vetneb-line/70 bg-card/95 px-2.5 py-1.5"
    >
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold leading-tight tracking-tight text-vetneb-ink">
        {value}
      </p>
      <p className="truncate text-[0.62rem] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function AdminMobileCommandModule({
  auditEntriesCount,
  eventTypesCount,
  systemStatusLabel,
  systemStatusVariant,
  systemStatusIndicatorClass,
  systemStatusDetail,
  hasSystemHealthFetchError,
  recentActivity,
}: AdminMobileCommandModuleProps) {
  const resumenSection = (
    // Fill the band: KPIs stay compact on top, the two info cards grow to share
    // the remaining height so the last card lands ~one gutter above the bottom
    // nav (balanced bottom gutter, no empty box).
    <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr_1fr] gap-2 overflow-hidden">
      <div className="grid grid-cols-2 gap-1.5">
        <MetricTile
          label="Auditoría"
          value={auditEntriesCount}
          hint="Registros totales"
        />
        <MetricTile
          label="Tipos de evento"
          value={eventTypesCount}
          hint="Categorías"
        />
      </div>
      <div
        data-admin-mobile-status-item="true"
        className="flex min-h-0 flex-col justify-center overflow-hidden rounded-md border border-vetneb-line/70 bg-card/95 px-2.5 py-2"
      >
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Estado del sistema
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={cn("h-2 w-2 rounded-full", systemStatusIndicatorClass)}
            aria-hidden="true"
          />
          <Badge variant={systemStatusVariant}>{systemStatusLabel}</Badge>
        </div>
        <p className="mt-1 line-clamp-3 text-[0.68rem] text-muted-foreground">
          {hasSystemHealthFetchError
            ? "No se pudo consultar el estado del sistema."
            : systemStatusDetail}
        </p>
      </div>
      <div
        data-admin-mobile-status-item="true"
        className="surface-soft flex min-h-0 flex-col justify-center overflow-hidden"
      >
        <p className="text-[0.78rem] font-semibold text-vetneb-ink">
          Alertas y estados
        </p>
        <p className="mt-1 line-clamp-3 text-[0.7rem] text-muted-foreground">
          {hasSystemHealthFetchError
            ? "Estado no disponible; revisar conectividad del servicio."
            : `${systemStatusLabel}: ${systemStatusDetail}`}
        </p>
      </div>
    </div>
  );

  const actividadSection = (
    // Three blocks share the height evenly so the last (accesos) lands ~one
    // gutter above the bottom nav.
    <div className="grid min-h-0 flex-1 grid-rows-3 gap-2 overflow-hidden">
      <div
        data-admin-mobile-status-item="true"
        className="surface-soft flex min-h-0 flex-col justify-center overflow-hidden"
      >
        <p className="text-[0.78rem] font-semibold text-vetneb-ink">
          Atención requerida
        </p>
        <p className="mt-1 line-clamp-3 text-[0.7rem] text-muted-foreground">
          Revisar intentos fallidos de login y salud del sistema antes de
          cambios administrativos.
        </p>
      </div>
      <div
        data-admin-mobile-status-item="true"
        className="surface-soft flex min-h-0 flex-col justify-center overflow-hidden"
      >
        <p className="text-[0.78rem] font-semibold text-vetneb-ink">
          Actividad reciente
        </p>
        {recentActivity ? (
          <p className="mt-1 line-clamp-3 text-[0.7rem] text-muted-foreground">
            <span className="font-semibold text-foreground/85">
              {recentActivity.event}
            </span>{" "}
            · {recentActivity.actor} · {recentActivity.date}
          </p>
        ) : (
          <p className="mt-1 text-[0.7rem] text-muted-foreground">
            Sin actividad de auditoría disponible.
          </p>
        )}
      </div>
      <div
        data-admin-mobile-status-item="true"
        className="flex min-h-0 flex-col justify-center overflow-hidden"
      >
        <AdminOverviewQuickLinks />
      </div>
    </div>
  );

  return (
    <AdminMobileStatusModule
      moduleKey="admin"
      ariaLabel="Resumen de administración"
      sections={[
        { id: "resumen", label: "Resumen", content: resumenSection },
        { id: "actividad", label: "Actividad", content: actividadSection },
        {
          id: "alertas",
          label: "Alertas",
          content: <AdminMobileFailedLoginSection />,
        },
      ]}
    />
  );
}
