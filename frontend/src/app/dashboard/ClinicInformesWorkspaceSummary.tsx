"use client";

import { useState } from "react";
import type { Report } from "@/types";
import { ClipboardList, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ModuleSurface } from "@/components/dashboard/ModuleSurface";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ROUTES } from "@/lib/routes";
import { cn, formatDate } from "@/lib/utils";

type Props = {
  recentReports: Report[];
  reportsLoadError: boolean;
};

export function ClinicInformesWorkspaceSummary({
  recentReports,
  reportsLoadError,
}: Props) {
  const [selectedReportId, setSelectedReportId] = useState<number | null>(
    recentReports[0]?.id ?? null,
  );
  const selectedReport =
    recentReports.find((report) => report.id === selectedReportId) ??
    recentReports[0] ??
    null;

  const fullModuleLink = (
    <PublicRouteControl
      href={ROUTES.dashboardInformes}
      variant="bare"
      className="inline-flex h-9 items-center gap-2 rounded-md border border-vetneb-teal/45 bg-vetneb-teal/10 px-3 text-sm font-semibold text-vetneb-teal transition-colors hover:bg-vetneb-teal/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
      aria-label="Abrir módulo completo de informes"
    >
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
      Abrir módulo completo
    </PublicRouteControl>
  );

  return (
    <ModuleSurface
      ariaLabel="Informes recientes de la clínica"
      toolbar={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-vetneb-ink">
              Informes recientes
            </h3>
            <p className="text-xs text-muted-foreground">
              Últimos estudios cargados. Para acceso completo use el módulo de informes.
            </p>
          </div>
          {fullModuleLink}
        </div>
      }
    >
      {reportsLoadError ? (
        <p role="alert" className="clinical-alert-warning">
          No se pudieron cargar los informes recientes. Intente nuevamente.
        </p>
      ) : recentReports.length ? (
        <div className="dashboard-inline-list min-h-0 flex-1 rounded-lg border border-vetneb-line/75 bg-card/82">
            <div className="dashboard-inline-scroll divide-y divide-vetneb-line/60">
              {recentReports.map((report) => {
                const isSelected = selectedReport?.id === report.id;

                return (
                  <div key={report.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedReportId(report.id)}
                      aria-pressed={isSelected}
                      aria-expanded={isSelected}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-vetneb-cyan/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-inset",
                        isSelected && "bg-vetneb-cyan/12",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-vetneb-ink">
                          {report.patientName ?? "Sin nombre"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {report.studyType} · {formatDate(report.uploadDate)}
                        </p>
                      </div>
                      <StatusBadge status={report.status} size="sm" className="ml-2 shrink-0" />
                    </button>

                    {isSelected && selectedReport ? (
                      <div
                        data-detail-state="selected"
                        className="dashboard-inline-detail border-t border-vetneb-line/60 bg-vetneb-surface-muted/40 p-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                                Detalle del informe
                              </p>
                              <h4 className="mt-1 break-words text-lg font-semibold text-vetneb-ink">
                                {selectedReport.patientName ?? "Sin nombre"}
                              </h4>
                            </div>
                            <StatusBadge status={selectedReport.status} size="sm" className="shrink-0" />
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="clinical-muted-band rounded-lg px-3 py-2">
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-vetneb-navy">
                                Estudio
                              </p>
                              <p className="mt-1 text-xs text-vetneb-ink">
                                {selectedReport.studyType ?? "—"}
                              </p>
                            </div>
                            <div className="clinical-muted-band rounded-lg px-3 py-2">
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-vetneb-navy">
                                Carga
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatDate(selectedReport.uploadDate)}
                              </p>
                            </div>
                            <div className="clinical-muted-band rounded-lg px-3 py-2">
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-vetneb-navy">
                                Informe
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                #{selectedReport.id} · {selectedReport.hasFile ? "Con archivo" : "Sin archivo"}
                              </p>
                            </div>
                            <div className="clinical-muted-band rounded-lg px-3 py-2">
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-vetneb-navy">
                                Acción
                              </p>
                              <PublicRouteControl
                                href={`${ROUTES.dashboardInformes}?reportId=${selectedReport.id}`}
                                variant="textLink"
                                className="mt-1 inline-flex text-xs font-semibold text-vetneb-navy hover:text-vetneb-teal"
                                aria-label={`Abrir informe ${selectedReport.id} en el módulo completo`}
                              >
                                Abrir en módulo completo
                              </PublicRouteControl>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
        </div>
      ) : (
        <EmptyState
          title="Sin informes recientes"
          description="No hay informes recientes disponibles."
          icon={ClipboardList}
        />
      )}
    </ModuleSurface>
  );
}
