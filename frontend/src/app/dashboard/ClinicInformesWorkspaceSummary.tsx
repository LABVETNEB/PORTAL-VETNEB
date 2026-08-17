"use client";

import { useState, type FormEvent } from "react";
import type { Report } from "@/types";
import { ClipboardList, ExternalLink, Filter } from "lucide-react";
import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";
import {
  dashboardFilterActionClassName,
  dashboardFilterControlClassName,
  FilterBar,
  FilterField,
  type FilterBarDensity,
} from "@/components/dashboard/FilterBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

type ClinicReportsFilterState = {
  report: string;
  patient: string;
  status: "" | Report["status"];
  study: string;
  file: string;
  from: string;
  to: string;
};

const INITIAL_REPORTS_FILTER_STATE: ClinicReportsFilterState = {
  report: "",
  patient: "",
  status: "",
  study: "",
  file: "",
  from: "",
  to: "",
};

const REPORT_STATUS_FILTER_OPTIONS: Array<{
  value: ClinicReportsFilterState["status"];
  label: string;
}> = [
  { value: "", label: "Todos" },
  { value: "uploaded", label: "Subido" },
  { value: "processing", label: "Procesando" },
  { value: "ready", label: "Listo" },
  { value: "delivered", label: "Entregado" },
];

function formatReportFile(report: Report): string {
  if (report.fileName) {
    return report.fileName;
  }

  return report.hasFile ? "Con archivo" : "Sin archivo";
}

function normalizeSearchText(value: string | number | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesFilterText(
  source: string | number | null | undefined,
  query: string,
) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const searchable = normalizeSearchText(source);
  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => searchable.includes(token));
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function matchesUploadDateRange(report: Report, from: string, to: string) {
  const uploadDate = toDateInputValue(report.uploadDate);
  if (!uploadDate) return !from && !to;
  if (from && uploadDate < from) return false;
  if (to && uploadDate > to) return false;
  return true;
}

function isReportsFilterStateEmpty(filters: ClinicReportsFilterState) {
  return Object.values(filters).every((value) => !value.trim());
}

function matchesClinicReportFilters(
  report: Report,
  filters: ClinicReportsFilterState,
) {
  const reportDisplay = `Informe #${report.id}`;
  const patientDisplay = report.patientName ?? "Sin nombre";
  const studyDisplay = report.studyType ?? "Tipo sin registrar";
  const fileDisplay = formatReportFile(report);

  return (
    matchesFilterText(reportDisplay, filters.report) &&
    matchesFilterText(patientDisplay, filters.patient) &&
    (!filters.status || report.status === filters.status) &&
    matchesFilterText(studyDisplay, filters.study) &&
    matchesFilterText(fileDisplay, filters.file) &&
    matchesUploadDateRange(report, filters.from, filters.to)
  );
}

export function ClinicInformesWorkspaceSummary({
  recentReports,
  reportsLoadError,
}: Props) {
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [filterDraft, setFilterDraft] =
    useState<ClinicReportsFilterState>(INITIAL_REPORTS_FILTER_STATE);
  const [appliedFilters, setAppliedFilters] =
    useState<ClinicReportsFilterState>(INITIAL_REPORTS_FILTER_STATE);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [reportsListBodyNode, setReportsListBodyNode] =
    useState<HTMLDivElement | null>(null);

  // The pitch and the table-head reserve are CSS tokens, so neither the rows nor
  // the header need to be observed: the two observers this surface used to run —
  // one probing the tallest rendered row, one measuring the head — published
  // into a single capacity without a common snapshot, which is how the same
  // geometry settled on different cardinalities depending on the active slice.
  const { capacity: rowsPerPage } = useDashboardCanvasCapacity({
    canvasNode: reportsListBodyNode,
    fallbackItems: REPORTS_PAGE_SIZE,
    minItems: 2,
  });

  const filteredReports = recentReports.filter((report) =>
    matchesClinicReportFilters(report, appliedFilters),
  );
  const pagedReports = usePagedRows(filteredReports, rowsPerPage);


  const selectedReport =
    selectedReportId === null
      ? null
      : (recentReports.find((report) => report.id === selectedReportId) ?? null);
  const hasActiveFilters = !isReportsFilterStateEmpty(appliedFilters);

  function updateFilterDraft<K extends keyof ClinicReportsFilterState>(
    field: K,
    value: ClinicReportsFilterState[K],
  ) {
    setFilterDraft((current) => ({ ...current, [field]: value }));
  }

  function applyAdvancedFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters({
      report: filterDraft.report.trim(),
      patient: filterDraft.patient.trim(),
      status: filterDraft.status,
      study: filterDraft.study.trim(),
      file: filterDraft.file.trim(),
      from: filterDraft.from,
      to: filterDraft.to,
    });
    pagedReports.setPage(0);
    setSelectedReportId(null);
    setIsFilterDialogOpen(false);
  }

  function clearAdvancedFilters() {
    setFilterDraft(INITIAL_REPORTS_FILTER_STATE);
    setAppliedFilters(INITIAL_REPORTS_FILTER_STATE);
    pagedReports.setPage(0);
    setSelectedReportId(null);
    setIsFilterDialogOpen(false);
  }

  const fullModuleLink = (
    <PublicRouteControl
      href={ROUTES.dashboardInformes}
      variant="bare"
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-vetneb-teal/45 bg-vetneb-teal/10 px-2.5 text-xs font-semibold text-vetneb-teal transition-colors hover:bg-vetneb-teal/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
      aria-label="Abrir módulo completo de informes"
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      Abrir módulo completo
    </PublicRouteControl>
  );

  function renderAdvancedFilterForm(mobile = false) {
    const density: FilterBarDensity = mobile ? "comfortable" : "compact";
    const controlClassName = dashboardFilterControlClassName(density);
    const buttonClassName = dashboardFilterActionClassName(density);

    return (
      <FilterBar
        data-clinic-report-filter-bar={mobile ? "advanced-mobile" : "advanced"}
        density={density}
        className={
          mobile
            ? "grid grid-cols-2 gap-2"
            : "hidden shrink-0 md:grid md:grid-cols-4 lg:grid-cols-[0.82fr_1.1fr_0.85fr_1fr_1fr_0.85fr_0.85fr_auto_auto]"
        }
        onSubmit={applyAdvancedFilters}
        aria-label={
          mobile
            ? "Filtros avanzados de informes clínica mobile"
            : "Filtros avanzados de informes clínica"
        }
      >
        <FilterField label="Informe" density={density}>
          <Input
            className={controlClassName}
            type="text"
            placeholder="#ID"
            value={filterDraft.report}
            onChange={(event) => updateFilterDraft("report", event.target.value)}
          />
        </FilterField>
        <FilterField label="Paciente" density={density}>
          <Input
            className={controlClassName}
            type="text"
            placeholder="Texto visible"
            value={filterDraft.patient}
            onChange={(event) => updateFilterDraft("patient", event.target.value)}
          />
        </FilterField>
        <FilterField label="Estado" density={density}>
          <Select
            className={controlClassName}
            value={filterDraft.status}
            onChange={(event) =>
              updateFilterDraft(
                "status",
                event.target.value as ClinicReportsFilterState["status"],
              )
            }
          >
            {REPORT_STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Estudio" density={density}>
          <Input
            className={controlClassName}
            type="text"
            placeholder="Tipo visible"
            value={filterDraft.study}
            onChange={(event) => updateFilterDraft("study", event.target.value)}
          />
        </FilterField>
        <FilterField label="Archivo" density={density}>
          <Input
            className={controlClassName}
            type="text"
            placeholder="Nombre"
            value={filterDraft.file}
            onChange={(event) => updateFilterDraft("file", event.target.value)}
          />
        </FilterField>
        <FilterField label="Desde" density={density}>
          <Input
            className={controlClassName}
            type="date"
            value={filterDraft.from}
            onChange={(event) => updateFilterDraft("from", event.target.value)}
          />
        </FilterField>
        <FilterField label="Hasta" density={density}>
          <Input
            className={controlClassName}
            type="date"
            value={filterDraft.to}
            onChange={(event) => updateFilterDraft("to", event.target.value)}
          />
        </FilterField>
        <Button type="submit" size="sm" className={buttonClassName}>
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          Aplicar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={buttonClassName}
          onClick={clearAdvancedFilters}
        >
          Limpiar
        </Button>
      </FilterBar>
    );
  }

  return (
    <ModuleSurface
      ariaLabel="Informes recientes de la clínica"
      toolbar={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <ModuleDialog
            open={isFilterDialogOpen}
            onOpenChange={setIsFilterDialogOpen}
            title="Filtrar informes"
            description="Los filtros se aplican sobre los informes recientes cargados en la workspace."
            trigger={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs md:hidden"
              >
                <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                {hasActiveFilters ? "Filtros activos" : "Filtros"}
              </Button>
            }
          >
            {renderAdvancedFilterForm(true)}
          </ModuleDialog>
          {fullModuleLink}
        </div>
      }
    >
      {!reportsLoadError ? renderAdvancedFilterForm() : null}

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
            ref={setReportsListBodyNode}
            data-clinic-reports-list-body="true"
            data-dashboard-adaptive-rows-canvas="true"
            data-dashboard-row-pitch="regular"
            data-dashboard-canvas-reserve="table-head"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {filteredReports.length ? (
              <>
                <div
                  data-clinic-reports-table="true"
                  className="hidden min-h-0 flex-1 overflow-hidden md:block"
                >
                  <table className="w-full table-fixed text-[0.8125rem]">
                    <thead
                      className="border-b border-vetneb-line/65 bg-vetneb-surface-muted/65 text-xs font-semibold uppercase text-muted-foreground"
                    >
                      <tr>
                        <th className="w-[26%] px-3 py-2 text-left">
                          Caso / Paciente
                        </th>
                        <th className="w-[17%] px-3 py-2 text-left">Estudio</th>
                        <th className="w-[15%] px-3 py-2 text-left">Estado</th>
                        <th className="w-[14%] px-3 py-2 text-left">Fecha</th>
                        <th className="w-[18%] px-3 py-2 text-left">
                          Archivo / Informe
                        </th>
                        <th className="w-[10%] px-3 py-2 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-vetneb-line/60">
                      {pagedReports.pageItems.map((report, index) => (
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
                            <span className="block truncate">
                              {formatReportFile(report)}
                            </span>
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
                  {pagedReports.pageItems.map((report, index) => (
                    <div
                      key={report.id}
                      data-clinic-reports-mobile-row="true"
                  data-dashboard-adaptive-row="true"
                      className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-vetneb-ink">
                          #{report.id} · {report.patientName ?? "Sin nombre"}
                        </p>
                        <p className="truncate text-[0.6875rem] text-muted-foreground">
                          {report.studyType ?? "Tipo sin registrar"}
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
              </>
            ) : (
              <div className="flex min-h-0 flex-1 p-3">
                <EmptyState
                  title="Sin informes para los filtros aplicados"
                  description="No hay informes recientes que coincidan con los campos visibles seleccionados."
                  icon={ClipboardList}
                  size="sm"
                  className="w-full"
                />
              </div>
            )}
          </div>

          <div
            data-clinic-reports-pagination-footer="true"
            data-dashboard-adaptive-reserved-region="pager"
            className="flex shrink-0 items-center justify-center border-t border-vetneb-line/65 px-3 text-xs text-muted-foreground"
          >
            <nav
              aria-label="Paginación de informes recientes"
              data-dashboard-pager="true"
              data-clinic-reports-pagination-controls="true"
              className="dashboard-pager"
            >
              <span data-dashboard-pager-prev="true" className="inline-flex">
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
              </span>

              <span
                data-dashboard-pager-state="true"
                data-clinic-reports-pagination-status="true"
                className="min-w-16 text-center"
              >
                Página {pagedReports.page + 1} de {pagedReports.pageCount}
              </span>

              <span data-dashboard-pager-next="true" className="inline-flex">
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
              </span>
            </nav>
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
