import type { FieldVisit, RoutePlan } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Truck, Route } from "lucide-react";
import {
  getRoutePlanStatusLabel,
  getRoutePlanStatusVariant,
  formatDate,
} from "@/lib/utils";
import { LogisticsRecentListCanvas } from "./LogisticsRecentListCanvas";

export type LogisticsCommandCenterProps = {
  fieldVisits: FieldVisit[];
  routePlans: RoutePlan[];
  fieldVisitsLoadError: boolean;
  routePlansLoadError: boolean;
};

export function LogisticsCommandCenter({
  fieldVisits,
  routePlans,
  fieldVisitsLoadError,
  routePlansLoadError,
}: LogisticsCommandCenterProps) {
  const activeVisits = fieldVisits.filter(
    (v) => v.status === "in_progress" || v.status === "scheduled",
  );
  const activePlans = routePlans.filter(
    (p) => p.status === "in_progress" || p.status === "released",
  );
  const recentVisits = fieldVisits.slice(0, 5);
  const recentPlans = routePlans.slice(0, 5);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-5"
      aria-labelledby="logistics-command-center-heading"
    >
      <section
        className="surface-note-info shrink-0"
        aria-labelledby="logistics-operational-priority"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-vetneb-navy/80">
              Estado operativo logística
            </p>
            <p
              id="logistics-operational-priority"
              className="mt-1 text-sm font-medium text-vetneb-navy"
            >
              Priorice visitas activas y planes en curso para sostener continuidad operativa.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[24rem]">
            <div className="dashboard-kpi-pill" data-tone="focus">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide">
                Visitas activas
              </p>
              <p className="mt-1 text-lg font-bold leading-none">
                {activeVisits.length}
              </p>
            </div>
            <div className="dashboard-kpi-pill" data-tone="critical">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide">
                Planes activos
              </p>
              <p className="mt-1 text-lg font-bold leading-none">
                {activePlans.length}
              </p>
            </div>
            <div className="dashboard-kpi-pill">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide">
                Total visitas
              </p>
              <p className="mt-1 text-lg font-bold leading-none">
                {fieldVisits.length}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="shrink-0">
        <h2
          id="logistics-command-center-heading"
          className="dashboard-section-heading"
        >
          Centro de logística
        </h2>
        <p className="dashboard-section-description">
          Visitas de campo activas y planes de ruta en tiempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 min-h-0 flex-1 auto-rows-fr">
        <Card className="dashboard-surface flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="flex shrink-0 flex-row items-start justify-between pb-3">
            <div>
              <CardTitle className="text-base">Visitas de campo</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Programadas y en curso.
              </p>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {fieldVisitsLoadError ? (
              <p role="alert" className="clinical-alert-warning">
                No se pudieron cargar las visitas de campo. Intente nuevamente.
              </p>
            ) : recentVisits.length ? (
              <LogisticsRecentListCanvas pagerAriaLabel="Paginación de visitas recientes">
                {recentVisits.map((visit) => (
                  <div key={visit.id} className="dashboard-list-row">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-vetneb-ink">
                        {visit.clinicName ?? `Clínica #${visit.clinicId}`}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {visit.address ?? "Sin dirección"} ·{" "}
                        {formatDate(visit.scheduledAt)}
                      </p>
                    </div>
                    <StatusBadge
                      status={visit.status}
                      size="sm"
                      className="ml-2 shrink-0"
                    />
                  </div>
                ))}
              </LogisticsRecentListCanvas>
            ) : (
              <EmptyState
                title="Sin visitas activas"
                description="No hay visitas de campo disponibles."
                icon={Truck}
              />
            )}
          </CardContent>
        </Card>

        <Card className="dashboard-surface flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="flex shrink-0 flex-row items-start justify-between pb-3">
            <div>
              <CardTitle className="text-base">Planes de ruta</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Liberados y en ejecución.
              </p>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {routePlansLoadError ? (
              <p role="alert" className="clinical-alert-warning">
                No se pudieron cargar los planes de ruta. Intente nuevamente.
              </p>
            ) : recentPlans.length ? (
              <LogisticsRecentListCanvas pagerAriaLabel="Paginación de planes recientes">
                {recentPlans.map((plan) => {
                  const progress =
                    plan.totalStops > 0
                      ? Math.round(
                          (plan.completedStops / plan.totalStops) * 100,
                        )
                      : 0;
                  return (
                    <div key={plan.id} className="dashboard-list-row">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-vetneb-ink">
                          {plan.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {plan.completedStops}/{plan.totalStops} paradas ·{" "}
                          {progress}% · {formatDate(plan.plannedDate)}
                        </p>
                      </div>
                      <Badge
                        variant={getRoutePlanStatusVariant(plan.status)}
                        className="ml-2 shrink-0"
                      >
                        {getRoutePlanStatusLabel(plan.status)}
                      </Badge>
                    </div>
                  );
                })}
              </LogisticsRecentListCanvas>
            ) : (
              <EmptyState
                title="Sin planes de ruta"
                description="No hay planes de ruta disponibles."
                icon={Route}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
