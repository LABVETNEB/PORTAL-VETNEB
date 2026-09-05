import type { Report, FieldVisit, DashboardStats } from "@/types";
import { ModuleMetricRun } from "@/components/dashboard/ModuleMetricRun";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ModuleCardSections } from "@/components/dashboard/ModuleCard";
import { DashboardRefreshButton } from "@/components/dashboard/DashboardRefreshButton";
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

type RecentActivityEntry = {
  label: string;
  detail: string;
  date: string | null;
};

function pickMostRecentActivity(
  recentReports: Report[],
  recentVisits: FieldVisit[],
): RecentActivityEntry | null {
  const candidates: RecentActivityEntry[] = [];

  const latestReport = recentReports[0];
  if (latestReport) {
    candidates.push({
      label: latestReport.patientName ?? "Informe sin nombre",
      detail: `${latestReport.studyType ?? "Estudio"} · ${formatDate(latestReport.uploadDate)}`,
      date: latestReport.updatedAt ?? latestReport.uploadDate,
    });
  }

  const latestVisit = recentVisits[0];
  if (latestVisit) {
    candidates.push({
      label: latestVisit.clinicName ?? `Clínica #${latestVisit.clinicId}`,
      detail: `Visita de campo · ${formatDate(latestVisit.scheduledAt)}`,
      date: latestVisit.scheduledAt,
    });
  }

  if (!candidates.length) return null;

  return candidates.reduce((latest, current) => {
    const latestTime = latest.date ? new Date(latest.date).getTime() : 0;
    const currentTime = current.date ? new Date(current.date).getTime() : 0;
    return currentTime > latestTime ? current : latest;
  });
}

export function ClinicCommandCenter({
  stats,
  statsLoadError,
  recentReports,
  recentVisits,
  reportsLoadError,
  visitsLoadError,
}: ClinicCommandCenterProps) {
  const attentionItems: string[] = [];
  if (statsLoadError) {
    attentionItems.push("No se pudieron cargar las métricas operativas.");
  } else {
    if ((stats?.pendingReports ?? 0) > 0) {
      attentionItems.push(
        `${stats!.pendingReports} informe(s) pendiente(s) de entrega.`,
      );
    }
    if ((stats?.activeVisits ?? 0) > 0) {
      attentionItems.push(
        `${stats!.activeVisits} visita(s) de campo activa(s) en curso.`,
      );
    }
  }

  const recentActivity = pickMostRecentActivity(recentReports, recentVisits);
  const hasAnyError = statsLoadError || reportsLoadError || visitsLoadError;

  return (
    <ModuleCardSections
      ariaLabel="Centro de operaciones clínica"
      cardDataAttributes={{ "data-clinic-mobile-module": "operaciones" }}
      cardAttribute="data-clinic-command-center"
      cardAttributeValue="true"
      chipAttribute="data-clinic-command-center-chip"
      panelAttribute="data-clinic-command-center-panel"
      header={
        /* The run is this band's ONLY child, so retiring it alone below `md`
           would leave the host painting its own `py-1.5` + `border-b` — a 13px
           empty strip, measured on all six phone viewports. Both halves are
           retired: the host leaves the flow so the chip band becomes the card's
           first painted child, and the run keeps the same `hidden md:flex`
           grammar the mapped Admin references use, so its OWN computed display
           is `none` below `md` instead of merely inheriting an unpainted
           ancestor. Desktop is untouched. */
        <div className="flex shrink-0 items-center border-b border-vetneb-line/70 px-2 py-1.5 text-xs text-muted-foreground max-md:hidden">
          <ModuleMetricRun
            className="hidden md:flex"
            surfaceId="clinic-operaciones"
            metrics={[
              { key: "informes", label: "Informes", value: stats?.totalReports ?? "—" },
              { key: "pendientes", label: "Pendientes", value: stats?.pendingReports ?? "—" },
              { key: "visitas-activas", label: "Visitas activas", value: stats?.activeVisits ?? "—" },
            ]}
          />
        </div>
      }
        sections={[
          {
            id: "metricas",
            label: "Métricas",
            content: (
              <section
                className="flex min-h-0 flex-1 flex-col gap-3"
                aria-labelledby="clinic-command-center-heading"
              >
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
                </div>
                {statsLoadError ? (
                  <div
                    role="alert"
                    className="clinical-alert-warning flex shrink-0 flex-wrap items-center justify-between gap-2"
                  >
                    <span>No se pudieron cargar las métricas operativas. Intente nuevamente.</span>
                    <DashboardRefreshButton />
                  </div>
                ) : null}
                <div className="hidden min-h-0 flex-1 md:block">
                  <StatsCards stats={stats} />
                </div>
              </section>
            ),
          },
          {
            id: "recientes",
            label: "Recientes",
            content: (
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
                <Card className="dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden">
                  <CardHeader className="shrink-0 pb-3">
                    <div>
                      <CardTitle className="text-base">Informes recientes</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Últimos estudios cargados y su estado actual.
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 space-y-1.5">
                    {reportsLoadError ? (
                      <div
                        role="alert"
                        className="clinical-alert-warning flex flex-wrap items-center justify-between gap-2"
                      >
                        <span>
                          No se pudieron cargar los informes recientes. Intente nuevamente.
                        </span>
                        <DashboardRefreshButton />
                      </div>
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
                        size="sm"
                      />
                    )}
                  </CardContent>
                </Card>

                <Card className="dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden">
                  <CardHeader className="shrink-0 pb-3">
                    <div>
                      <CardTitle className="text-base">Visitas de campo</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Programación logística con seguimiento en curso.
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 space-y-1.5">
                    {visitsLoadError ? (
                      <div
                        role="alert"
                        className="clinical-alert-warning flex flex-wrap items-center justify-between gap-2"
                      >
                        <span>
                          No se pudieron cargar las visitas de campo recientes. Intente nuevamente.
                        </span>
                        <DashboardRefreshButton />
                      </div>
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
                        size="sm"
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: "estado",
            label: "Estado",
            content: (
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                <div
                  className="surface-soft min-h-0"
                  data-clinic-command-attention="true"
                >
                  <p className="text-[0.8rem] font-semibold text-vetneb-ink">
                    Atención requerida
                  </p>
                  {attentionItems.length ? (
                    <ul className="mt-1 space-y-1 text-[0.72rem] text-muted-foreground">
                      {attentionItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[0.72rem] text-muted-foreground">
                      Sin pendientes operativos detectados.
                    </p>
                  )}
                </div>

                <div
                  className="surface-soft min-h-0"
                  data-clinic-command-activity="true"
                >
                  <p className="text-[0.8rem] font-semibold text-vetneb-ink">
                    Actividad reciente
                  </p>
                  {recentActivity ? (
                    <p className="mt-1 line-clamp-2 text-[0.72rem] text-muted-foreground">
                      <span className="font-semibold text-foreground/85">
                        {recentActivity.label}
                      </span>{" "}
                      · {recentActivity.detail}
                    </p>
                  ) : (
                    <p className="mt-1 text-[0.72rem] text-muted-foreground">
                      Sin actividad reciente disponible.
                    </p>
                  )}
                </div>

                <div
                  className="surface-soft min-h-0"
                  data-clinic-command-continuity="true"
                >
                  <p className="text-[0.8rem] font-semibold text-vetneb-ink">
                    Continuidad operativa
                  </p>
                  <p className="mt-1 text-[0.72rem] text-muted-foreground">
                    {hasAnyError
                      ? "Estado degradado: revisar conectividad de informes, visitas o métricas."
                      : "Operativo: informes y logística sincronizados sin incidentes detectados."}
                  </p>
                </div>
              </div>
            ),
          },
        ]}
    />
  );
}
