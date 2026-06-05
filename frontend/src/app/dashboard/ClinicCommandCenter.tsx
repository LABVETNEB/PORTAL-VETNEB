import type { Report, FieldVisit, DashboardStats } from "@/types";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Route } from "lucide-react";
import { formatDate } from "@/lib/utils";

export type ClinicCommandCenterProps = {
  stats: DashboardStats | null;
  statsLoadError: boolean;
  recentReports: Report[];
  recentVisits: FieldVisit[];
  reportsLoadError: boolean;
  visitsLoadError: boolean;
};

export function ClinicCommandCenter({
  stats,
  statsLoadError,
  recentReports,
  recentVisits,
  reportsLoadError,
  visitsLoadError,
}: ClinicCommandCenterProps) {
  return (
    <section
      className="space-y-5"
      aria-labelledby="clinic-command-center-heading"
    >
      <section className="surface-note-info" aria-labelledby="dashboard-operational-priority">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-vetneb-navy/80">
              Estado operativo clínica
            </p>
            <p
              id="dashboard-operational-priority"
              className="mt-1 text-sm font-medium text-vetneb-navy"
            >
              Priorice informes pendientes y visitas activas para sostener continuidad diagnóstica.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-[20rem]">
            <div className="dashboard-kpi-pill" data-tone="critical">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide">
                Informes pendientes
              </p>
              <p className="mt-1 text-lg font-bold leading-none">
                {stats?.pendingReports ?? "—"}
              </p>
            </div>
            <div className="dashboard-kpi-pill" data-tone="focus">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide">
                Visitas activas
              </p>
              <p className="mt-1 text-lg font-bold leading-none">
                {stats?.activeVisits ?? "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div>
        <h2
          id="clinic-command-center-heading"
          className="dashboard-section-heading"
        >
          Métricas operativas
        </h2>
        <p className="dashboard-section-description">
          Vista rápida de informes, pendientes y actividad logística del día.
        </p>
        {statsLoadError ? (
          <p role="alert" className="mt-3 clinical-alert-warning">
            No se pudieron cargar las métricas operativas. Intente nuevamente.
          </p>
        ) : null}
        <div className="mt-4">
          <StatsCards stats={stats} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="dashboard-surface">
          <CardHeader className="flex flex-row items-start justify-between pb-3">
            <div>
              <CardTitle className="text-base">Informes recientes</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Últimos estudios cargados y su estado actual.
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
                <div
                  key={report.id}
                  className="dashboard-list-row"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-vetneb-ink">
                      {report.patientName ?? "Sin nombre"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {report.studyType} · {formatDate(report.uploadDate)}
                    </p>
                  </div>
                  <StatusBadge
                    status={report.status}
                    size="sm"
                    className="ml-2 shrink-0"
                  />
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

        <Card className="dashboard-surface">
          <CardHeader className="flex flex-row items-start justify-between pb-3">
            <div>
              <CardTitle className="text-base">Visitas de campo</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Programación logística con seguimiento en curso.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {visitsLoadError ? (
              <p role="alert" className="clinical-alert-warning">
                No se pudieron cargar las visitas de campo recientes. Intente nuevamente.
              </p>
            ) : recentVisits.length ? (
              recentVisits.map((visit) => (
                <div
                  key={visit.id}
                  className="dashboard-list-row"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-vetneb-ink">
                      {visit.clinicName ?? `Clínica #${visit.clinicId}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(visit.scheduledAt)}
                    </p>
                  </div>
                  <StatusBadge
                    status={visit.status}
                    size="sm"
                    className="ml-2 shrink-0"
                  />
                </div>
              ))
            ) : (
              <EmptyState
                title="Sin visitas recientes"
                description="No hay visitas de campo recientes disponibles."
                icon={Route}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
