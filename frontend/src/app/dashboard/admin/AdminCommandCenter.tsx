import { Badge } from "@/components/ui/badge";
import { ModuleSurface } from "@/components/dashboard/ModuleSurface";
import { AdminOverviewQuickLinks } from "./AdminOverviewQuickLinks";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

type RecentAdminActivity = {
  event: string;
  actor: string;
  date: string;
};

type AdminCommandCenterProps = {
  auditEntriesCount: number;
  eventTypesCount: number;
  systemStatusLabel: string;
  systemStatusVariant: BadgeVariant;
  systemStatusIndicatorClass: string;
  systemStatusDetail: string;
  hasSystemHealthFetchError: boolean;
  recentActivity: RecentAdminActivity | null;
};

export function AdminCommandCenter({
  auditEntriesCount,
  eventTypesCount,
  systemStatusLabel,
  systemStatusVariant,
  systemStatusIndicatorClass,
  systemStatusDetail,
  hasSystemHealthFetchError,
  recentActivity,
}: AdminCommandCenterProps) {
  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      aria-labelledby="admin-command-center-heading"
    >
      <ModuleSurface
        toolbar={
          <div className="min-w-0">
            <h2
              id="admin-command-center-heading"
              className="dashboard-section-heading"
            >
              Resumen operativo
            </h2>
            <p className="dashboard-section-description hidden sm:block">
              Lectura inmediata de auditoría, variedad de eventos y salud del sistema.
            </p>
          </div>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div
            className="grid grid-cols-2 gap-2 lg:grid-cols-3"
            role="group"
            aria-label="Métricas operativas"
          >
            <div className="rounded-md border border-vetneb-line/70 bg-card/95 px-3 py-1.5">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Eventos de auditoría
              </p>
              <p className="mt-0.5 text-xl font-semibold leading-tight tracking-tight text-vetneb-ink">
                {auditEntriesCount}
              </p>
              <p className="text-[0.7rem] text-muted-foreground">Registros totales</p>
            </div>

            <div className="rounded-md border border-vetneb-line/70 bg-card/95 px-3 py-1.5">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Tipos de evento
              </p>
              <p className="mt-0.5 text-xl font-semibold leading-tight tracking-tight text-vetneb-ink">
                {eventTypesCount}
              </p>
              <p className="text-[0.7rem] text-muted-foreground">Categorías distintas</p>
            </div>

            <div className="col-span-2 rounded-md border border-vetneb-line/70 bg-card/95 px-3 py-1.5 lg:col-span-1">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Estado del sistema
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <span
                  className={cn("h-2 w-2 rounded-full", systemStatusIndicatorClass)}
                  aria-hidden="true"
                />
                <Badge variant={systemStatusVariant}>{systemStatusLabel}</Badge>
              </div>
              <p className="mt-0.5 line-clamp-1 text-[0.7rem] text-muted-foreground">
                {hasSystemHealthFetchError
                  ? "No se pudo consultar el estado del sistema."
                  : systemStatusDetail}
              </p>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="surface-soft">
              <p className="text-[0.8rem] font-semibold text-vetneb-ink">
                Atención requerida
              </p>
              <p className="mt-1 text-[0.72rem] text-muted-foreground">
                Revisar intentos fallidos de login y salud del sistema antes de
                cambios administrativos.
              </p>
            </div>

            <div className="surface-soft min-h-0">
              <p className="text-[0.8rem] font-semibold text-vetneb-ink">
                Actividad reciente
              </p>
              {recentActivity ? (
                <p className="mt-1 line-clamp-2 text-[0.72rem] text-muted-foreground">
                  <span className="font-semibold text-foreground/85">
                    {recentActivity.event}
                  </span>{" "}
                  · {recentActivity.actor} · {recentActivity.date}
                </p>
              ) : (
                <p className="mt-1 text-[0.72rem] text-muted-foreground">
                  Sin actividad de auditoría disponible.
                </p>
              )}
            </div>

            <AdminOverviewQuickLinks />

            <div className="surface-soft min-h-0">
              <p className="text-[0.8rem] font-semibold text-vetneb-ink">
                Alertas y estados
              </p>
              <p className="mt-1 line-clamp-2 text-[0.72rem] text-muted-foreground">
                {hasSystemHealthFetchError
                  ? "Estado no disponible; revisar conectividad del servicio."
                  : `${systemStatusLabel}: ${systemStatusDetail}`}
              </p>
            </div>
          </div>
        </div>
      </ModuleSurface>
    </section>
  );
}
