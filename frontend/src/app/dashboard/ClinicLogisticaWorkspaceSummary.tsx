import type { FieldVisit } from "@/types";
import { Route as RouteIcon, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ROUTES } from "@/lib/routes";
import { formatDate } from "@/lib/utils";

type Props = {
  recentVisits: FieldVisit[];
  visitsLoadError: boolean;
};

export function ClinicLogisticaWorkspaceSummary({
  recentVisits,
  visitsLoadError,
}: Props) {
  return (
    <div className="space-y-4">
      <Card className="dashboard-surface">
        <CardHeader className="flex flex-row items-start justify-between pb-3">
          <div>
            <CardTitle className="text-base">Visitas de campo recientes</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Programación logística activa. Para gestión completa use el módulo de logística.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {visitsLoadError ? (
            <p role="alert" className="clinical-alert-warning">
              No se pudieron cargar las visitas de campo. Intente nuevamente.
            </p>
          ) : recentVisits.length ? (
            recentVisits.map((visit) => (
              <div key={visit.id} className="dashboard-list-row">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-vetneb-ink">
                    {visit.clinicName ?? `Clínica #${visit.clinicId}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(visit.scheduledAt)}
                  </p>
                </div>
                <StatusBadge status={visit.status} size="sm" className="ml-2 shrink-0" />
              </div>
            ))
          ) : (
            <EmptyState
              title="Sin visitas recientes"
              description="No hay visitas de campo recientes disponibles."
              icon={RouteIcon}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <PublicRouteControl
          href={ROUTES.dashboardLogistica}
          variant="bare"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-vetneb-teal/45 bg-vetneb-teal/10 px-4 text-sm font-semibold text-vetneb-teal transition-colors hover:bg-vetneb-teal/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
          aria-label="Abrir módulo completo de logística"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Ver módulo de logística completo
        </PublicRouteControl>
      </div>
    </div>
  );
}
