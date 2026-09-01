import type { ReactNode } from "react";
import type { FieldVisit, RoutePlan } from "@/types";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ModuleMetricRun } from "@/components/dashboard/ModuleMetricRun";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { CanonicalOperationalRow } from "@/components/dashboard/CanonicalOperationalRow";
import { FieldVisitDetailDialog } from "./FieldVisitDetailDialog";
import { RoutePlanDetailDialog } from "./RoutePlanDetailDialog";

export type LogisticsCommandCenterProps = {
  fieldVisits: FieldVisit[];
  routePlans: RoutePlan[];
  fieldVisitsLoadError: boolean;
  routePlansLoadError: boolean;
  headerActions?: ReactNode;
};

export function LogisticsCommandCenter({
  fieldVisits,
  routePlans,
  fieldVisitsLoadError,
  routePlansLoadError,
  headerActions,
}: LogisticsCommandCenterProps) {
  const activeVisits = fieldVisits.filter(
    (v) => v.status === "in_progress" || v.status === "scheduled",
  );
  const activePlans = routePlans.filter(
    (p) => p.status === "in_progress" || p.status === "released",
  );
  // The bounded canvas is the single owner of cardinality: it measures its own
  // height and pages the rows adaptively (audit §20, A03 contract). Truncating
  // here first capped both lists below the measured page size, which made a
  // complete second page unreachable on tall viewports. The ordered
  // collections are handed over whole, in the order the server produced them.
  const recentVisits = fieldVisits;
  const recentPlans = routePlans;

  return (
    <ModuleCard
      ariaLabel="Centro de logística"
    >
      <div
        className="flex min-h-0 flex-1 flex-col gap-5"
        aria-labelledby="logistics-command-center-heading"
        data-logistics-command-center="true"
      >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-vetneb-line/70 px-3 py-1.5">
        <div className="min-w-0">
          <h2 id="logistics-command-center-heading" className="truncate text-xs font-semibold text-vetneb-ink">
            Centro de logística
          </h2>
          <p className="truncate text-[0.6875rem] text-muted-foreground">Visitas, rutas y métricas operativas.</p>
        </div>
        {headerActions ? <div className="flex shrink-0 gap-1">{headerActions}</div> : null}
      </div>
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
          <ModuleMetricRun
            surfaceId="clinic-logistica-full"
            className="text-xs text-vetneb-navy"
            metrics={[
              { key: "visitas-activas", label: "Visitas activas", value: activeVisits.length },
              { key: "planes-activos", label: "Planes activos", value: activePlans.length },
              { key: "total-visitas", label: "Total visitas", value: fieldVisits.length },
            ]}
          />
        </div>
      </section>

      {/* `minmax(0,1fr)` instead of `auto-rows-fr` (`minmax(auto,1fr)`): inside a
          bounded no-scroll canvas the rows must be allowed to shrink below their
          min-content, or the stacked mobile cards overflow their tracks and paint
          over each other — which puts the lower card's pager behind the upper
          card and blocks its pointer events. Same grammar the other no-scroll
          grids already use (styles/dashboard/shell.css, surfaces.css). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 min-h-0 flex-1 auto-rows-[minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="flex shrink-0 flex-row items-start justify-between pb-3">
            <div>
              <CardTitle className="text-base">Visitas de campo</CardTitle>
              <p
                className="mt-1 text-xs text-muted-foreground"
                data-dashboard-chrome-secondary="true"
              >
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
                  <CanonicalOperationalRow
                    key={visit.id}
                    dataAttributes={{ "data-logistics-recent-row": "visita" }}
                    identity={visit.clinicName ?? `Clínica #${visit.clinicId}`}
                    secondary={`${visit.address ?? "Sin dirección"} · ${formatDate(visit.scheduledAt)}`}
                    trailing={
                      <>
                        <StatusBadge status={visit.status} size="sm" />
                        <FieldVisitDetailDialog visit={visit} />
                      </>
                    }
                  />
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
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="flex shrink-0 flex-row items-start justify-between pb-3">
            <div>
              <CardTitle className="text-base">Planes de ruta</CardTitle>
              <p
                className="mt-1 text-xs text-muted-foreground"
                data-dashboard-chrome-secondary="true"
              >
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
                    <CanonicalOperationalRow
                      key={plan.id}
                      dataAttributes={{ "data-logistics-recent-row": "ruta" }}
                      identity={plan.name}
                      secondary={`${plan.completedStops}/${plan.totalStops} paradas · ${progress}% · ${formatDate(plan.plannedDate)}`}
                      trailing={
                        <>
                          <Badge variant={getRoutePlanStatusVariant(plan.status)}>
                            {getRoutePlanStatusLabel(plan.status)}
                          </Badge>
                          <RoutePlanDetailDialog plan={plan} />
                        </>
                      }
                    />
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
        </section>
      </div>
      </div>
    </ModuleCard>
  );
}
