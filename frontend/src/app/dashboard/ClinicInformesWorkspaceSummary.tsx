import type { Report } from "@/types";
import { ClipboardList, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ROUTES } from "@/lib/routes";
import { formatDate } from "@/lib/utils";

type Props = {
  recentReports: Report[];
  reportsLoadError: boolean;
};

export function ClinicInformesWorkspaceSummary({
  recentReports,
  reportsLoadError,
}: Props) {
  return (
    <div className="space-y-4">
      <Card className="dashboard-surface">
        <CardHeader className="flex flex-row items-start justify-between pb-3">
          <div>
            <CardTitle className="text-base">Informes recientes</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Últimos estudios cargados. Para acceso completo use el módulo de informes.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {reportsLoadError ? (
            <p role="alert" className="clinical-alert-warning">
              No se pudieron cargar los informes recientes. Intente nuevamente.
            </p>
          ) : recentReports.length ? (
            recentReports.map((report) => (
              <div key={report.id} className="dashboard-list-row">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-vetneb-ink">
                    {report.patientName ?? "Sin nombre"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {report.studyType} · {formatDate(report.uploadDate)}
                  </p>
                </div>
                <StatusBadge status={report.status} size="sm" className="ml-2 shrink-0" />
              </div>
            ))
          ) : (
            <EmptyState
              title="Sin informes recientes"
              description="No hay informes recientes disponibles."
              icon={ClipboardList}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <PublicRouteControl
          href={ROUTES.dashboardInformes}
          variant="bare"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-vetneb-teal/45 bg-vetneb-teal/10 px-4 text-sm font-semibold text-vetneb-teal transition-colors hover:bg-vetneb-teal/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
          aria-label="Abrir módulo completo de informes"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Ver módulo de informes completo
        </PublicRouteControl>
      </div>
    </div>
  );
}
