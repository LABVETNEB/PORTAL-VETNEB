"use client";

import { useState } from "react";
import type { Report } from "@/types";
import { ClipboardList, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { DashboardRefreshButton } from "@/components/dashboard/DashboardRefreshButton";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { ModuleSurface } from "@/components/dashboard/ModuleSurface";
import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";
import { usePagedRows } from "@/components/dashboard/usePagedRows";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ROUTES } from "@/lib/routes";
import { formatDate } from "@/lib/utils";

type Props = {
  recentReports: Report[];
  reportsLoadError: boolean;
};

const REPORTS_PAGE_SIZE = 3;

function formatReportFile(report: Report): string {
  if (report.fileName) {
    return report.fileName;
  }

  return report.hasFile ? "Con archivo" : "Sin archivo";
}

export function ClinicInformesWorkspaceSummary({
  recentReports,
  reportsLoadError,
}: Props) {
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const pagedReports = usePagedRows(recentReports, REPORTS_PAGE_SIZE);
  const selectedReport =
    selectedReportId === null
      ? null
      : (recentReports.find((report) => report.id === selectedReportId) ?? null);

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
        <div
          role="alert"
          className="clinical-alert-warning flex flex-wrap items-center justify-between gap-2"
        >
          <span>No se pudieron cargar los informes recientes. Intente nuevamente.</span>
          <DashboardRefreshButton />
        </div>
      ) : recentReports.length ? (
        <div
          data-clinic-reports-list-panel="true"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-vetneb-line/75 bg-card/82"
        >
          <div
            data-clinic-reports-table="true"
            className="hidden min-h-0 flex-1 overflow-hidden md:block"
          >
            <table className="w-full table-fixed text-[0.8125rem]">
              <thead className="border-b border-vetneb-line/65 bg-vetneb-surface-muted/65 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="w-[26%] px-3 py-2 text-left">Caso / Paciente</th>
                  <th className="w-[17%] px-3 py-2 text-left">Estudio</th>
                  <th className="w-[15%] px-3 py-2 text-left">Estado</th>
                  <th className="w-[14%] px-3 py-2 text-left">Fecha</th>
                  <th className="w-[18%] px-3 py-2 text-left">Archivo / Informe</th>
                  <th className="w-[10%] px-3 py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vetneb-line/60">
                {pagedReports.pageItems.map((report) => (
                  <tr
                    key={report.id}
                    data-clinic-reports-table-row="true"
                    className="hover:bg-vetneb-cyan/8"
                  >
                    <td className="px-3 py-1.5">
                      <p className="truncate font-semibold text-vetneb-ink">
                        {report.patientName ?? "Sin nombre"}
                      </p>
                      <p className="font-mono text-[0.6875rem] text-muted-foreground">
                        Informe #{report.id}
                      </p>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="block truncate">
                        {report.studyType ?? "Tipo sin registrar"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusBadge status={report.status} size="sm" />
                    </td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      {formatDate(report.uploadDate)}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      <span className="block truncate">{formatReportFile(report)}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setSelectedReportId(report.id)}
                      >
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            data-clinic-reports-mobile-list="true"
            className="flex min-h-0 flex-1 flex-col divide-y divide-vetneb-line/60 overflow-hidden md:hidden"
          >
            {pagedReports.pageItems.map((report) => (
              <div
                key={report.id}
                data-clinic-reports-mobile-row="true"
                className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-vetneb-ink">
                    #{report.id} · {report.patientName ?? "Sin nombre"}
                  </p>
                  <p className="truncate text-[0.6875rem] text-muted-foreground">
                    {report.studyType ?? "Tipo sin registrar"} ·{" "}
                    {formatDate(report.uploadDate)}
                  </p>
                  <p className="truncate text-[0.6875rem] text-muted-foreground">
                    {formatReportFile(report)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusBadge status={report.status} size="sm" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setSelectedReportId(report.id)}
                  >
                    Ver
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div
            data-clinic-reports-pagination-footer="true"
            className="flex min-h-10 shrink-0 items-center justify-end border-t border-vetneb-line/65 px-3 py-2 text-xs text-muted-foreground"
          >
            <div
              data-clinic-reports-pagination-controls="true"
              className="flex items-center justify-end gap-1.5"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={!pagedReports.hasPrev}
                onClick={() => {
                  setSelectedReportId(null);
                  pagedReports.goPrev();
                }}
                aria-label="Página anterior"
              >
                Anterior
              </Button>

              <span
                data-clinic-reports-pagination-status="true"
                className="min-w-16 text-center"
              >
                Página {pagedReports.page + 1} / {pagedReports.pageCount}
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={!pagedReports.hasNext}
                onClick={() => {
                  setSelectedReportId(null);
                  pagedReports.goNext();
                }}
                aria-label="Página siguiente"
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title="Sin informes recientes"
          description="No hay informes recientes disponibles."
          icon={ClipboardList}
        />
      )}

      {selectedReport ? (
        <ModuleDialog
          open={selectedReport !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedReportId(null);
            }
          }}
          title={`Informe #${selectedReport.id}`}
          description={selectedReport.patientName ?? "Sin nombre"}
        >
          <div
            data-clinic-reports-detail-dialog="true"
            className="flex min-h-0 flex-col gap-3 text-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.6875rem] text-muted-foreground">
                  Caso / Paciente
                </p>
                <p className="truncate text-sm font-semibold text-vetneb-ink">
                  {selectedReport.patientName ?? "Sin nombre"}
                </p>
              </div>
              <StatusBadge
                status={selectedReport.status}
                size="sm"
                className="shrink-0"
              />
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-vetneb-line/70 px-3 py-2">
              <div>
                <dt className="text-[0.6875rem] text-muted-foreground">Estudio</dt>
                <dd className="truncate font-medium">
                  {selectedReport.studyType ?? "Tipo sin registrar"}
                </dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] text-muted-foreground">Fecha</dt>
                <dd>{formatDate(selectedReport.uploadDate)}</dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-[0.6875rem] text-muted-foreground">
                  Archivo / Informe
                </dt>
                <dd className="truncate">{formatReportFile(selectedReport)}</dd>
              </div>
            </dl>

            <div className="border-t border-vetneb-line/65 pt-2">
              <p className="mb-1 text-xs font-medium">Documento seguro</p>
              <ReportFileActions
                reportId={selectedReport.id}
                hasFile={selectedReport.hasFile}
                scope="clinic"
                align="start"
              />
            </div>

            <PublicRouteControl
              href={`${ROUTES.dashboardInformes}?reportId=${selectedReport.id}`}
              variant="textLink"
              className="text-xs"
              aria-label={`Abrir informe ${selectedReport.id} en el módulo completo`}
            >
              Abrir en módulo completo
            </PublicRouteControl>
          </div>
        </ModuleDialog>
      ) : null}
    </ModuleSurface>
  );
}
