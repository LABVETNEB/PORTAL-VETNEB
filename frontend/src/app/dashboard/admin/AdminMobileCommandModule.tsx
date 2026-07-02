"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AdminFailedLoginAlertsReadOnlyCard } from "./AdminFailedLoginAlertsReadOnlyCard";
import { AdminMobileStatusModule } from "./AdminMobileStatusModule";
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
          // Collapsed duality: the failed-login alerts runtime (fetch, adaptive
          // cardinality, offset, anti-race) lives in the read-only card, which
          // renders its mobile presentation here. Mounted lazily — only when
          // the chip is active — so the hidden desktop copy in ModuleTabs
          // (active-panel-only) never double-fetches. `presentation` is a
          // static per-mount signal, not a media-query/cardinality source.
          content: <AdminFailedLoginAlertsReadOnlyCard presentation="mobile" />,
        },
      ]}
    />
  );
}
