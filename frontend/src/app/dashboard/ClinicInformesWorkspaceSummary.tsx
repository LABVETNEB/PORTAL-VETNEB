"use client";

import { useState, type FormEvent } from "react";
import type { Report } from "@/types";
import { ClipboardList, Filter } from "lucide-react";
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
import { DashboardRefreshButton } from "@/components/dashboard/DashboardRefreshButton";
import { DASHBOARD_TOUCH_PAGER_RESERVATION } from "@/components/dashboard/DashboardPager";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";
import { usePagedRows } from "@/components/dashboard/usePagedRows";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { FullModuleRouteControl } from "@/components/dashboard/FullModuleRouteControl";
import { DetailsMetadata, DetailsPane } from "@/features/dashboard/presentation/details";
import {
  CollectionHeader,
  CollectionState,
  CollectionWorkspace,
  ContentList,
  ContentListItem,
} from "@/features/dashboard/presentation/surfaces";
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
  const hasReportsFooter = !reportsLoadError && recentReports.length > 0;

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
    <FullModuleRouteControl href={ROUTES.dashboardInformes} ariaLabel="Abrir módulo completo de informes" />
  );

  function renderAdvancedFilterForm(mobile = false) {
    const density: FilterBarDensity = mobile ? "module-card" : "compact";
    const controlClassName = dashboardFilterControlClassName(density);
    const buttonClassName = dashboardFilterActionClassName(density);

    return (
      <FilterBar
        data-clinic-report-filter-bar={mobile ? "advanced-mobile" : "advanced"}
        density={density}
        className={
          mobile
            ? "grid grid-cols-2 gap-2"
            : "hidden shrink-0 md:grid md:min-w-0 md:shrink md:grow md:basis-[36rem] md:grid-cols-4 lg:basis-[59rem] lg:grid-cols-[0.82fr_1.1fr_0.85fr_1fr_1fr_minmax(8.5rem,0.85fr)_minmax(8.5rem,0.85fr)_auto_auto]"
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
    <ModuleCard
      ariaLabel="Informes recientes de la clínica"
      dataAttributes={{ "data-clinic-mobile-module": "informes" }}
    >
      <div
        data-clinic-reports-toolbar="true"
        className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-vetneb-line/70 p-1.5 md:justify-end"
      >
        {/* Clinic desktop/tablet space pass: from 768px up the summary run is
            retired and the filters own this band, left of the actions. The
            bar's flex-basis is the width its grid needs, so when filters and
            actions do not fit side by side the actions wrap to a second line
            instead of squeezing the fields. Below 768px the bar is not painted,
            so the band keeps only Filtros and "Abrir módulo completo".
            C23b PR5: between 768px and 1536px, while the list owns its pager
            footer, the CTA moves to that footer, so it never wraps into a
            second band row above the data. From 1536px it fits beside them. */}
        {renderAdvancedFilterForm()}
        <div
          className={`flex shrink-0 flex-wrap items-center justify-end gap-2${hasReportsFooter ? " md:hidden 2xl:flex" : ""}`}
        >
          <ModuleDialog
            open={isFilterDialogOpen}
            onOpenChange={setIsFilterDialogOpen}
            title="Filtrar informes"
            description="Los filtros se aplican sobre los informes recientes cargados en la workspace."
            dashboardScopedPortal
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
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">

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
          <CollectionWorkspace
            ref={setReportsListBodyNode}
            data-clinic-reports-list-body="true"
            data-dashboard-adaptive-rows-canvas="true"
            data-dashboard-row-pitch="regular"
            data-dashboard-canvas-reserve="table-head-above-md"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {filteredReports.length ? (
              <>
                <div
                  data-clinic-reports-table="true"
                  className="hidden min-h-0 flex-1 overflow-hidden md:block"
                >
                  <table className="w-full table-fixed text-[0.8125rem]">
                    <CollectionHeader
                      className="border-b border-vetneb-line/65 bg-vetneb-surface-muted/65 text-xs font-semibold uppercase text-muted-foreground"
                    >
                      <ContentListItem as="tr">
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
                      </ContentListItem>
                    </CollectionHeader>
                    <ContentList as="tbody" className="divide-y divide-vetneb-line/60">
                      {pagedReports.pageItems.map((report, index) => (
                        <ContentListItem
                          as="tr"
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
                        </ContentListItem>
                      ))}
                    </ContentList>
                  </table>
                </div>

                <ContentList
                  as="div"
                  data-clinic-reports-mobile-list="true"
                  className="flex min-h-0 flex-1 flex-col divide-y divide-vetneb-line/60 overflow-hidden md:hidden"
                >
                  {pagedReports.pageItems.map((report, index) => (
                    <ContentListItem
                      as="div"
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
                    </ContentListItem>
                  ))}
                </ContentList>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 p-3">
                <CollectionState
                  variant="empty"
                  title="Sin informes para los filtros aplicados"
                  description="No hay informes recientes que coincidan con los campos visibles seleccionados."
                  icon={ClipboardList}
                  size="sm"
                  className="w-full"
                />
              </div>
            )}
          </CollectionWorkspace>

          <div
            data-clinic-reports-pagination-footer="true"
            className="relative flex shrink-0 items-center justify-center px-3 text-xs text-muted-foreground"
          >
            {/* CMP-12: the border and the height reservation live on the SAME
                element (matching Admin's AdminMobileOpsPager, and DashboardPager's
                own component) — border-box makes the reserved height inclusive of
                the border, so a border on a separate outer wrapper cannot add an
                extra pixel on top of the reservation. */}
            <nav
              aria-label="Paginación de informes recientes"
              data-dashboard-pager="true"
              data-dashboard-adaptive-reserved-region="pager"
              data-clinic-reports-pagination-controls="true"
              className="dashboard-pager min-h-10 w-full border-t border-vetneb-line/65"
              style={DASHBOARD_TOUCH_PAGER_RESERVATION}
            >
              {pagedReports.total > 0 ? (
                <span className="sr-only" aria-live="polite">
                  {pagedReports.rangeStart}–{pagedReports.rangeEnd} de {pagedReports.total}
                </span>
              ) : null}
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

              {/* The painted page state is a phone-only affordance: from 768px
                  up the pager shows Anterior / Siguiente and nothing else. */}
              <span
                data-dashboard-pager-state="true"
                data-clinic-reports-pagination-status="true"
                className="min-w-16 text-center md:hidden"
              >
                Pág. {pagedReports.page + 1} / {pagedReports.pageCount}
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
            {/* Outside the pager nav and out of flow: the nav keeps its own
                width and centred prev/next, the CTA takes the free right edge. */}
            <div
              data-clinic-reports-footer-cta="true"
              className="absolute inset-y-0 right-3 hidden items-center md:flex 2xl:hidden"
            >
              {fullModuleLink}
            </div>
          </div>
        </div>
      ) : (
        <CollectionState
          variant="empty"
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
          scrollableBody
        >
          <div
            data-clinic-reports-detail-dialog="true"
            className="flex min-h-0 flex-col gap-3 text-xs"
          >
            <DetailsPane label={`Detalle del informe #${selectedReport.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.6875rem] text-muted-foreground">
                    Caso / Paciente
                  </p>
                  <p className="dashboard-detail-value text-sm font-semibold text-vetneb-ink">
                    {selectedReport.patientName ?? "Sin nombre"}
                  </p>
                </div>
                <StatusBadge
                  status={selectedReport.status}
                  size="sm"
                  className="shrink-0"
                />
              </div>

              <DetailsMetadata
                items={[
                  { id: "estudio", label: "Estudio", value: selectedReport.studyType ?? "Tipo sin registrar" },
                  { id: "fecha", label: "Fecha", value: formatDate(selectedReport.uploadDate) },
                  { id: "archivo", label: "Archivo / Informe", value: formatReportFile(selectedReport) },
                ]}
              />

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
            </DetailsPane>
          </div>
        </ModuleDialog>
      ) : null}
      </div>
    </ModuleCard>
  );
}
