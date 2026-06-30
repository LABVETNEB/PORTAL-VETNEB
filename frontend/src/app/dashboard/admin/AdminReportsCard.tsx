"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  FilePlus2,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAdminReportWorkflow,
  updateAdminReportSpecialStain,
  updateAdminReportWorkflowStage,
  type AdminReportWorkflowItem,
  type AdminReportWorkflowStage,
} from "@/lib/api";
import {
  ADMIN_REPORT_STAGE_OPTIONS,
  AdminReportStatusBadge,
} from "./AdminReportStatusBadge";
import { AdminReportsUploadPanel } from "./AdminReportsUploadPanel";

// PR-3 established nine dense rows as the safe 1366x768 limit while the App
// Shell intentionally has no vertical scroll region.
const PAGE_SIZE = 9;
const MOBILE_PAGE_SIZE = 10;

const STUDY_LABELS: Record<string, string> = {
  histopatologia: "Histopatología",
  citologia: "Citología",
  hemoparasitos: "Hemoparásitos",
};

type AdminReportsFilterState = {
  report: string;
  clinic: string;
  patient: string;
  status: "" | AdminReportWorkflowStage;
  study: string;
  file: string;
  from: string;
  to: string;
};

const INITIAL_FILTER_STATE: AdminReportsFilterState = {
  report: "",
  clinic: "",
  patient: "",
  status: "",
  study: "",
  file: "",
  from: "",
  to: "",
};

const filterSelectClassName =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-vetneb-ink outline-none focus:border-vetneb-teal focus:ring-2 focus:ring-vetneb-teal/15";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

function studyLabel(value: string | null) {
  if (!value) return "Sin tipo";
  return STUDY_LABELS[value] ?? value;
}

function normalizeSearchText(value: string | number | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().substring(0, 10);
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

function isFilterStateEmpty(filters: AdminReportsFilterState) {
  return Object.values(filters).every((value) => !value.trim());
}

function getReportPrimaryDate(report: AdminReportWorkflowItem) {
  return report.uploadDate ?? report.createdAt;
}

function matchesReportDateRange(
  report: AdminReportWorkflowItem,
  from: string,
  to: string,
) {
  const primaryDate = toDateInputValue(getReportPrimaryDate(report));
  if (!primaryDate) return !from && !to;
  if (from && primaryDate < from) return false;
  if (to && primaryDate > to) return false;
  return true;
}

function matchesAdminReportFilters(
  report: AdminReportWorkflowItem,
  filters: AdminReportsFilterState,
) {
  const reportDisplay = `Informe #${report.id}`;
  const clinicDisplay = report.clinicName || `Clínica #${report.clinicId}`;
  const patientDisplay = report.patientName || "Paciente sin registrar";
  const studyDisplay = studyLabel(report.studyType);
  const fileDisplay = report.fileName || "Sin archivo";

  return (
    matchesFilterText(reportDisplay, filters.report) &&
    (matchesFilterText(clinicDisplay, filters.clinic) ||
      matchesFilterText(report.clinicId, filters.clinic)) &&
    matchesFilterText(patientDisplay, filters.patient) &&
    (!filters.status || report.workflowStage === filters.status) &&
    (matchesFilterText(studyDisplay, filters.study) ||
      matchesFilterText(report.studyType, filters.study)) &&
    matchesFilterText(fileDisplay, filters.file) &&
    matchesReportDateRange(report, filters.from, filters.to)
  );
}

export function AdminReportsCard() {
  const [reports, setReports] = useState<AdminReportWorkflowItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busyReportId, setBusyReportId] = useState<number | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [filterDraft, setFilterDraft] =
    useState<AdminReportsFilterState>(INITIAL_FILTER_STATE);
  const [appliedFilters, setAppliedFilters] =
    useState<AdminReportsFilterState>(INITIAL_FILTER_STATE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Mobile renders a smaller, independently paginated slice of the same
  // server-side workflow queue. Desktop keeps its own PAGE_SIZE=9 fetch
  // untouched so the dense viewport-safe contract stays pinned.
  const [mobileReports, setMobileReports] = useState<AdminReportWorkflowItem[]>([]);
  const [mobilePage, setMobilePage] = useState(0);
  const [mobileHasMore, setMobileHasMore] = useState(false);
  const [isMobileLoading, setIsMobileLoading] = useState(true);
  // Start false so SSR and the client's first render agree. The media-query
  // effect below promotes this to the real viewport value right after mount,
  // which avoids a hydration mismatch on the mobile-only branches.
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const selectedReport = useMemo(
    () =>
      reports.find((report) => report.id === selectedReportId) ??
      mobileReports.find((report) => report.id === selectedReportId) ??
      null,
    [mobileReports, reports, selectedReportId],
  );

  const hasActiveFilters = !isFilterStateEmpty(appliedFilters);
  const filteredReports = reports.filter((report) =>
    matchesAdminReportFilters(report, appliedFilters),
  );
  const filteredMobileReports = mobileReports.filter((report) =>
    matchesAdminReportFilters(report, appliedFilters),
  );
  const deliveredCount = filteredReports.filter(
    (report) => report.workflowStage === "delivered",
  ).length;
  const specialStainCount = filteredReports.filter(
    (report) => report.specialStainRequested,
  ).length;
  const rangeStart = filteredReports.length ? page * PAGE_SIZE + 1 : 0;
  const rangeEnd = page * PAGE_SIZE + filteredReports.length;

  const loadReports = useCallback(async (nextPage: number) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const snapshot = await getAdminReportWorkflow({
        limit: PAGE_SIZE,
        offset: nextPage * PAGE_SIZE,
      });
      setReports(snapshot.reports);
      setHasMore(snapshot.pagination.hasMore);
      setSelectedReportId((current) =>
        snapshot.reports.some((report) => report.id === current) ? current : null,
      );
    } catch (error) {
      setReports([]);
      setHasMore(false);
      setSelectedReportId(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar la cola de informes.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMobileReports = useCallback(async (nextPage: number) => {
    setIsMobileLoading(true);

    try {
      const snapshot = await getAdminReportWorkflow({
        limit: MOBILE_PAGE_SIZE,
        offset: nextPage * MOBILE_PAGE_SIZE,
      });
      setMobileReports(snapshot.reports);
      setMobileHasMore(snapshot.pagination.hasMore);
    } catch {
      setMobileReports([]);
      setMobileHasMore(false);
    } finally {
      setIsMobileLoading(false);
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const updateMobileViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    updateMobileViewport();
    mediaQuery.addEventListener("change", updateMobileViewport);

    return () => {
      mediaQuery.removeEventListener("change", updateMobileViewport);
    };
  }, []);

  useEffect(() => {
    void loadReports(page);
  }, [loadReports, page]);

  useEffect(() => {
    if (!isMobileViewport) return;
    void loadMobileReports(mobilePage);
  }, [isMobileViewport, loadMobileReports, mobilePage]);

  function replaceReport(updated: AdminReportWorkflowItem) {
    setReports((current) =>
      current.map((report) => (report.id === updated.id ? updated : report)),
    );
    setMobileReports((current) =>
      current.map((report) => (report.id === updated.id ? updated : report)),
    );
  }

  async function handleStageChange(
    report: AdminReportWorkflowItem,
    stage: AdminReportWorkflowStage,
  ) {
    if (stage === report.workflowStage || busyReportId !== null) return;
    setBusyReportId(report.id);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await updateAdminReportWorkflowStage(report.id, stage);
      replaceReport(response.report);
      setStatusMessage(`Etapa del informe #${report.id} actualizada.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la etapa del informe.",
      );
    } finally {
      setBusyReportId(null);
    }
  }

  async function handleSpecialStainChange(report: AdminReportWorkflowItem) {
    if (busyReportId !== null) return;
    setBusyReportId(report.id);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await updateAdminReportSpecialStain(
        report.id,
        !report.specialStainRequested,
      );
      replaceReport(response.report);
      setStatusMessage(
        report.specialStainRequested
          ? `Solicitud de tinción del informe #${report.id} resuelta.`
          : `Tinción especial solicitada para el informe #${report.id}.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la tinción especial.",
      );
    } finally {
      setBusyReportId(null);
    }
  }

  async function handleUploaded(message: string) {
    setStatusMessage(message);
    setErrorMessage(null);
    if (page === 0) {
      await loadReports(0);
    } else {
      setPage(0);
    }
    if (isMobileViewport) {
      if (mobilePage === 0) {
        await loadMobileReports(0);
      } else {
        setMobilePage(0);
      }
    }
  }

  function updateFilterDraft<K extends keyof AdminReportsFilterState>(
    field: K,
    value: AdminReportsFilterState[K],
  ) {
    setFilterDraft((current) => ({ ...current, [field]: value }));
    setErrorMessage(null);
  }

  function applyAdvancedFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters({
      report: filterDraft.report.trim(),
      clinic: filterDraft.clinic.trim(),
      patient: filterDraft.patient.trim(),
      status: filterDraft.status,
      study: filterDraft.study.trim(),
      file: filterDraft.file.trim(),
      from: filterDraft.from,
      to: filterDraft.to,
    });
    setPage(0);
    setMobilePage(0);
    setErrorMessage(null);
  }

  function clearAdvancedFilters() {
    setFilterDraft(INITIAL_FILTER_STATE);
    setAppliedFilters(INITIAL_FILTER_STATE);
    setPage(0);
    setMobilePage(0);
    setErrorMessage(null);
  }

  function renderAdvancedFilterForm(mobile = false) {
    return (
      <form
        data-admin-report-upload-filter-bar={mobile ? "advanced-mobile" : "advanced"}
        className={
          mobile
            ? "grid grid-cols-2 items-end gap-2"
            : "hidden shrink-0 grid-cols-2 items-end gap-1.5 rounded-lg border border-vetneb-line/70 bg-muted/15 px-2 py-1 md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-[0.8fr_1fr_0.95fr_0.95fr_0.9fr_0.9fr_0.85fr_0.85fr_auto_auto] xl:px-2"
        }
        onSubmit={applyAdvancedFilters}
        aria-label={
          mobile
            ? "Filtros avanzados de informes mobile"
            : "Filtros avanzados de informes"
        }
      >
        <label className="grid min-w-0 gap-0.5 text-[11px] font-medium text-muted-foreground">
          Informe
          <Input
            className="h-8 text-xs"
            type="text"
            placeholder="#ID"
            value={filterDraft.report}
            onChange={(event) => updateFilterDraft("report", event.target.value)}
          />
        </label>
        <label className="grid min-w-0 gap-0.5 text-[11px] font-medium text-muted-foreground">
          Clínica
          <Input
            className="h-8 text-xs"
            type="text"
            placeholder="Nombre o ID"
            value={filterDraft.clinic}
            onChange={(event) => updateFilterDraft("clinic", event.target.value)}
          />
        </label>
        <label className="grid min-w-0 gap-0.5 text-[11px] font-medium text-muted-foreground">
          Paciente
          <Input
            className="h-8 text-xs"
            type="text"
            placeholder="Texto visible"
            value={filterDraft.patient}
            onChange={(event) => updateFilterDraft("patient", event.target.value)}
          />
        </label>
        <label className="grid min-w-0 gap-0.5 text-[11px] font-medium text-muted-foreground">
          Estado
          <select
            className={filterSelectClassName}
            value={filterDraft.status}
            onChange={(event) =>
              updateFilterDraft(
                "status",
                event.target.value as AdminReportsFilterState["status"],
              )
            }
          >
            <option value="">Todos</option>
            {ADMIN_REPORT_STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-0.5 text-[11px] font-medium text-muted-foreground">
          Estudio
          <Input
            className="h-8 text-xs"
            type="text"
            placeholder="Tipo visible"
            value={filterDraft.study}
            onChange={(event) => updateFilterDraft("study", event.target.value)}
          />
        </label>
        <label className="grid min-w-0 gap-0.5 text-[11px] font-medium text-muted-foreground">
          Archivo
          <Input
            className="h-8 text-xs"
            type="text"
            placeholder="Nombre"
            value={filterDraft.file}
            onChange={(event) => updateFilterDraft("file", event.target.value)}
          />
        </label>
        <label className="grid min-w-0 gap-0.5 text-[11px] font-medium text-muted-foreground">
          Desde
          <Input
            className="h-8 text-xs"
            type="date"
            value={filterDraft.from}
            onChange={(event) => updateFilterDraft("from", event.target.value)}
          />
        </label>
        <label className="grid min-w-0 gap-0.5 text-[11px] font-medium text-muted-foreground">
          Hasta
          <Input
            className="h-8 text-xs"
            type="date"
            value={filterDraft.to}
            onChange={(event) => updateFilterDraft("to", event.target.value)}
          />
        </label>
        <Button type="submit" size="sm" className="h-8 gap-1.5 px-2.5 text-xs">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          Aplicar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={clearAdvancedFilters}
        >
          Limpiar
        </Button>
      </form>
    );
  }

  return (
    <Card className="dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b border-vetneb-line/70 px-4 py-3 md:py-2">
        <div className="min-w-0">
          <CardTitle className="text-xl leading-tight md:text-base">Informes</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cola administrativa, trazabilidad y documentos en una sola vista.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs md:h-7 md:px-2"
            onClick={() => void loadReports(page)}
            disabled={isLoading || busyReportId !== null}
          >
            {isLoading ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 px-2.5 text-xs md:h-7 md:px-2"
            onClick={() => setIsUploadOpen(true)}
          >
            <FilePlus2 aria-hidden="true" />
            Subir informe
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-3 pt-2 md:gap-1.5 md:pb-2 md:pt-1.5">
        <div
          data-admin-reports-toolbar="true"
          className="flex min-h-8 shrink-0 items-center justify-between gap-2 rounded-md border border-vetneb-line/65 bg-vetneb-surface-raised/45 px-2.5 text-xs text-muted-foreground"
        >
          <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 md:flex">
            <span>
              <strong className="font-semibold text-vetneb-ink">{filteredReports.length}</strong> en página
            </span>
            <span>
              <strong className="font-semibold text-vetneb-ink">{deliveredCount}</strong> entregados
            </span>
            <span>
              <strong className="font-semibold text-vetneb-ink">{specialStainCount}</strong> con tinción
            </span>
          </div>
          <span className="min-w-0 flex-1 truncate md:hidden">
            {hasActiveFilters
              ? `${filteredMobileReports.length} filtrados`
              : `${mobileReports.length} en página`}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hidden tabular-nums md:inline">
              {hasActiveFilters ? "Filtros activos" : `Página ${page + 1}`}
            </span>
            <div className="md:hidden">
              <ModuleDialog
                title="Filtrar informes"
                trigger={
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                    <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                    Filtros
                  </Button>
                }
              >
                {renderAdvancedFilterForm(true)}
              </ModuleDialog>
            </div>
          </div>
        </div>

        {renderAdvancedFilterForm()}

        {errorMessage ? (
          <p className="clinical-alert-error shrink-0 px-3 py-1.5 text-xs" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {statusMessage ? (
          <p className="clinical-alert-success shrink-0 px-3 py-1.5 text-xs" role="status">
            {statusMessage}
          </p>
        ) : null}

        <section
          aria-label="Cola administrativa de informes"
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="dashboard-table-responsive hidden min-h-0 flex-1 md:block">
            {filteredReports.length ? (
              <Table className="table-fixed text-[0.8125rem] [&_th]:h-8 [&_th]:px-2.5 [&_td]:px-2.5">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[20%]">Caso / paciente</TableHead>
                    <TableHead className="w-[18%]">Clínica</TableHead>
                    <TableHead className="w-[14%]">Estudio</TableHead>
                    <TableHead className="w-[15%]">Estado</TableHead>
                    <TableHead className="hidden w-[12%] lg:table-cell">Fecha</TableHead>
                    <TableHead className="hidden w-[13%] xl:table-cell">Archivo</TableHead>
                    <TableHead className="w-[8%] text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="py-0.5">
                        <p className="truncate font-medium text-vetneb-ink">
                          {report.patientName || "Paciente sin registrar"}
                        </p>
                        <p className="font-mono text-[0.6875rem] text-muted-foreground">
                          Informe #{report.id}
                        </p>
                      </TableCell>
                      <TableCell className="py-0.5">
                        <p className="truncate">
                          {report.clinicName || `Clínica #${report.clinicId}`}
                        </p>
                      </TableCell>
                      <TableCell className="py-0.5">
                        <span className="block truncate">{studyLabel(report.studyType)}</span>
                      </TableCell>
                      <TableCell className="py-0.5">
                        <AdminReportStatusBadge stage={report.workflowStage} />
                        {report.specialStainRequested ? (
                          <span className="ml-1 text-[0.6875rem] font-semibold text-amber-700">
                            Tinción
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden py-0.5 text-xs lg:table-cell">
                        {formatDate(report.uploadDate ?? report.createdAt)}
                      </TableCell>
                      <TableCell className="hidden py-0.5 xl:table-cell">
                        <span className="block truncate text-xs text-muted-foreground">
                          {report.fileName || "Sin archivo"}
                        </span>
                      </TableCell>
                      <TableCell className="py-0.5 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setSelectedReportId(report.id)}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="surface-empty flex min-h-20 flex-1 items-center justify-center text-xs">
                {isLoading
                  ? "Cargando informes…"
                  : hasActiveFilters
                    ? "No hay informes que coincidan con los filtros aplicados."
                    : "No hay informes en esta página."}
              </p>
            )}
          </div>

          <div
            className="flex min-h-0 flex-1 flex-col gap-2 md:hidden"
            data-admin-mobile-core-module="reports"
          >
            {filteredMobileReports.length ? (
              <>
                <div
                  className="divide-y divide-vetneb-line/60 overflow-hidden rounded-md border border-vetneb-line/75"
                  data-admin-reports-mobile-list="true"
                >
                  {filteredMobileReports.map((report) => (
                    <div
                      key={report.id}
                      className="flex min-h-9 items-center gap-2 px-2.5 py-0.5"
                      data-admin-mobile-core-item="true"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">
                          #{report.id} · {report.patientName || "Sin paciente"}
                        </p>
                        <p className="truncate text-[0.6875rem] text-muted-foreground">
                          {report.clinicName || `Clínica #${report.clinicId}`} · {studyLabel(report.studyType)}
                        </p>
                      </div>
                      <AdminReportStatusBadge stage={report.workflowStage} />
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
                  ))}
                </div>
              </>
            ) : isMobileViewport ? (
              <p className="surface-empty flex min-h-20 flex-1 items-center justify-center text-xs">
                {isMobileLoading
                  ? "Cargando informes…"
                  : hasActiveFilters
                    ? "No hay informes que coincidan con los filtros aplicados."
                    : "No hay informes en esta página."}
              </p>
            ) : null}

            {mobileReports.length ? (
              <div
                className="flex shrink-0 items-center justify-center gap-1.5 border-t border-vetneb-line/65 pt-1.5 text-xs text-muted-foreground"
                data-admin-mobile-core-pager="true"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2.5 text-xs"
                  disabled={mobilePage === 0 || isMobileLoading}
                  onClick={() => setMobilePage((current) => Math.max(0, current - 1))}
                  aria-label="Página anterior"
                >
                  Anterior
                </Button>
                <span className="min-w-12 text-center">Pág. {mobilePage + 1}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2.5 text-xs"
                  disabled={!mobileHasMore || isMobileLoading}
                  onClick={() => setMobilePage((current) => current + 1)}
                  aria-label="Página siguiente"
                >
                  Siguiente
                </Button>
              </div>
            ) : null}
          </div>

          <nav
            className="mt-2 hidden min-h-10 shrink-0 items-center justify-between gap-2 border-t border-vetneb-line/65 px-1 pt-2 text-xs text-muted-foreground md:mt-1 md:flex md:min-h-8 md:pt-1"
            aria-label="Paginación de informes admin"
          >
            <span>
              {filteredReports.length ? `${rangeStart}–${rangeEnd}` : "0 resultados"} · {PAGE_SIZE} por página
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 md:h-7 md:w-7"
                disabled={page === 0 || isLoading}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <span className="min-w-16 text-center">Página {page + 1}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 md:h-7 md:w-7"
                disabled={!hasMore || isLoading}
                onClick={() => setPage((current) => current + 1)}
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </nav>
        </section>
      </CardContent>

      <AdminReportsUploadPanel
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        onUploaded={handleUploaded}
      />

      {selectedReport ? (
        <ModuleDialog
          open={selectedReportId !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setSelectedReportId(null);
          }}
          busy={busyReportId === selectedReport.id}
          title={`Informe #${selectedReport.id}`}
          description={
            selectedReport.clinicName || `Clínica #${selectedReport.clinicId}`
          }
        >
          <div className="space-y-3 text-[0.8125rem]">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-vetneb-line/70 px-3 py-2">
              <div>
                <p className="text-[0.6875rem] text-muted-foreground">Paciente</p>
                <p className="truncate font-medium">
                  {selectedReport.patientName || "Sin registrar"}
                </p>
              </div>
              <div>
                <p className="text-[0.6875rem] text-muted-foreground">Estudio</p>
                <p className="truncate font-medium">{studyLabel(selectedReport.studyType)}</p>
              </div>
              <div>
                <p className="text-[0.6875rem] text-muted-foreground">Carga</p>
                <p>{formatDate(selectedReport.uploadDate ?? selectedReport.createdAt)}</p>
              </div>
              <div>
                <p className="text-[0.6875rem] text-muted-foreground">Última actualización</p>
                <p>{formatDate(selectedReport.workflowUpdatedAt)}</p>
              </div>
              <div className="col-span-2 min-w-0">
                <p className="text-[0.6875rem] text-muted-foreground">Archivo</p>
                <p className="truncate">{selectedReport.fileName || "Sin archivo disponible"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium">Etapa operativa</span>
                <select
                  className="field-select h-8 text-xs"
                  value={selectedReport.workflowStage}
                  disabled={busyReportId !== null}
                  onChange={(event) =>
                    void handleStageChange(
                      selectedReport,
                      event.target.value as AdminReportWorkflowStage,
                    )
                  }
                >
                  {ADMIN_REPORT_STAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-1">
                <span className="block text-xs font-medium">Tinción especial</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full text-xs"
                  disabled={busyReportId !== null}
                  onClick={() => void handleSpecialStainChange(selectedReport)}
                >
                  {busyReportId === selectedReport.id ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : null}
                  {selectedReport.specialStainRequested ? "Marcar resuelta" : "Solicitar tinción"}
                </Button>
              </div>
            </div>

            <div className="border-t border-vetneb-line/65 pt-2">
              <p className="mb-1 text-xs font-medium">Documento seguro</p>
              <ReportFileActions
                reportId={selectedReport.id}
                hasFile={Boolean(selectedReport.fileName)}
                scope="admin"
                align="start"
              />
            </div>
          </div>
        </ModuleDialog>
      ) : null}
    </Card>
  );
}
