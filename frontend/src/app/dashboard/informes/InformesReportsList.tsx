"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/dashboard/EmptyState";
import { ErrorState } from "@/components/dashboard/ErrorState";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  StudyTimeline,
  type StudyTimelineStep,
} from "@/components/dashboard/StudyTimeline";
import { useAdaptiveItemsPerPage } from "@/hooks/useAdaptiveItemsPerPage";
import { cn, getReportStatusLabel, getReportStatusVariant, formatDate } from "@/lib/utils";
import type { Report, ReportStatus } from "@/types";
import { getInformesPage } from "./informes.actions";
import { INFORMES_FALLBACK_ROWS, INFORMES_LIMIT_CAP } from "./informes.constants";

const INFORMES_ROW_HEIGHT_FALLBACK_PX = 88;

type Measurement = {
  containerNode: HTMLElement | null;
  rowHeightPx: number;
};

type ReportDetailSection = "resumen" | "archivos" | "timeline";

const REPORT_DETAIL_SECTIONS: Array<{
  id: ReportDetailSection;
  label: string;
}> = [
  { id: "resumen", label: "Resumen" },
  { id: "archivos", label: "Archivos" },
  { id: "timeline", label: "Timeline" },
];

function measurementsEqual(a: Measurement, b: Measurement) {
  return a.containerNode === b.containerNode && a.rowHeightPx === b.rowHeightPx;
}

function normalizeOffsetForLimit(
  currentOffset: number,
  limit: number,
  total: number,
) {
  let nextOffset = Math.floor(currentOffset / limit) * limit;
  if (total > 0) {
    const lastValidOffset = Math.max(
      0,
      (Math.ceil(total / limit) - 1) * limit,
    );
    nextOffset = Math.min(nextOffset, lastValidOffset);
  }
  return Math.max(0, nextOffset);
}

function getReportTitle(report: Report) {
  return report.patientName
    ? `${report.patientName} · Informe #${report.id}`
    : `Informe #${report.id}`;
}

const REPORT_STATUS_ORDER = {
  uploaded: 0,
  processing: 1,
  ready: 2,
  delivered: 3,
} satisfies Record<ReportStatus, number>;

function getTimelineStepStatus(
  currentStatus: ReportStatus,
  stepStatus: ReportStatus,
): StudyTimelineStep["status"] {
  if (currentStatus === stepStatus) {
    return stepStatus === "delivered" ? "completed" : "current";
  }

  return REPORT_STATUS_ORDER[currentStatus] > REPORT_STATUS_ORDER[stepStatus]
    ? "completed"
    : "pending";
}

function buildStudyTimelineSteps(report: Report): StudyTimelineStep[] {
  const currentStatus = report.currentStatus ?? report.status;
  const uploadedDate = report.uploadDate ?? report.createdAt;
  const updatedDate = report.updatedAt;

  return [
    {
      id: "uploaded",
      label: "Carga recibida",
      date: uploadedDate ? formatDate(uploadedDate) : null,
      description: "Fecha registrada para el informe en el portal.",
      status: "completed",
    },
    {
      id: "processing",
      label: "Procesamiento",
      date: currentStatus === "processing" ? formatDate(updatedDate) : null,
      description: "Estado operativo informado por el registro del informe.",
      status: getTimelineStepStatus(currentStatus, "processing"),
    },
    {
      id: "ready",
      label: "Informe disponible",
      date:
        currentStatus === "ready" || currentStatus === "delivered"
          ? formatDate(updatedDate)
          : null,
      description: "El archivo queda disponible cuando el estado real lo indique.",
      status: getTimelineStepStatus(currentStatus, "ready"),
    },
    {
      id: "delivered",
      label: "Entrega",
      date: currentStatus === "delivered" ? formatDate(updatedDate) : null,
      description: "Cierre del circuito visible para la clínica.",
      status: getTimelineStepStatus(currentStatus, "delivered"),
    },
  ];
}

export type InformesReportsListProps = {
  filters: {
    query: string;
    status: string;
    studyType: string;
  };
  initialReports: Report[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  initialLoadError: boolean;
  initialSelectedReportId: number | null;
};

export function InformesReportsList({
  filters,
  initialReports,
  initialTotal,
  initialPage,
  initialPageSize,
  initialLoadError,
  initialSelectedReportId,
}: InformesReportsListProps) {
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [requestWindow, setRequestWindow] = useState({
    limit: initialPageSize,
    offset: (initialPage - 1) * initialPageSize,
  });
  const [loadError, setLoadError] = useState(initialLoadError);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(
    initialSelectedReportId,
  );
  const [detailSection, setDetailSection] =
    useState<ReportDetailSection>("resumen");
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const [bodyNode, setBodyNode] = useState<HTMLElement | null>(null);
  const [rowNode, setRowNode] = useState<HTMLElement | null>(null);
  const [measurement, setMeasurement] = useState<Measurement>({
    containerNode: null,
    rowHeightPx: INFORMES_ROW_HEIGHT_FALLBACK_PX,
  });

  const latestRequestRef = useRef(0);

  // Row pitch accepted for the current layout. Informes rows are not uniform —
  // a long study name wraps on a narrow phone and grows the row — so probing
  // "the first rendered row" made the pitch depend on which reports happened to
  // be on screen: page 1 and page 2 measured different heights, the page size
  // changed mid-transition and a single "Página siguiente" emitted two server
  // actions (observed at 360x800 under a full serial matrix run). The pitch is
  // a property of the layout, not of the current page: probed once per measured
  // -region size, reused across page changes, re-probed when that region
  // resizes. Same rule as AdminReportsCard / AdminMaintenanceDryRunCard.
  const rowPitchRef = useRef<{
    node: HTMLElement | null;
    containerHeight: number;
    rowHeightPx: number;
  }>({ node: null, containerHeight: 0, rowHeightPx: 0 });
  const onFirstPageRef = useRef(true);
  const isOnFirstPage = requestWindow.offset === 0;
  useLayoutEffect(() => {
    onFirstPageRef.current = isOnFirstPage;
  }, [isOnFirstPage]);

  function resolveRowPitch(
    container: HTMLElement,
    containerHeight: number,
    measuredRowHeight: number,
  ): number {
    const cached = rowPitchRef.current;
    const layoutChanged =
      cached.node !== container || cached.containerHeight !== containerHeight;

    // Held while paging, re-probed on the first page — see AdminReportsCard.
    if (!layoutChanged && cached.rowHeightPx > 0 && !onFirstPageRef.current) {
      return cached.rowHeightPx;
    }

    const rowHeightPx =
      measuredRowHeight > 0 ? measuredRowHeight : INFORMES_ROW_HEIGHT_FALLBACK_PX;
    rowPitchRef.current = {
      node: container,
      containerHeight,
      rowHeightPx: measuredRowHeight > 0 ? measuredRowHeight : 0,
    };
    return rowHeightPx;
  }

  useLayoutEffect(() => {
    if (!bodyNode) {
      return;
    }

    let frame: number | null = null;

    const recompute = () => {
      frame = null;

      const containerHeight = bodyNode.getBoundingClientRect().height;
      if (containerHeight <= 0) {
        return;
      }

      const rowHeight = rowNode?.getBoundingClientRect().height ?? 0;
      setMeasurement((previous) => {
        const next: Measurement = {
          containerNode: bodyNode,
          rowHeightPx: resolveRowPitch(bodyNode, containerHeight, rowHeight),
        };
        return measurementsEqual(previous, next) ? previous : next;
      });
    };

    const scheduleRecompute = () => {
      if (frame === null) {
        frame = requestAnimationFrame(recompute);
      }
    };

    const observer = new ResizeObserver(scheduleRecompute);
    observer.observe(bodyNode);
    if (rowNode) {
      observer.observe(rowNode);
    }
    recompute();

    return () => {
      observer.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [bodyNode, rowNode]);

  const { itemsPerPage: rowsPerPage } = useAdaptiveItemsPerPage({
    containerNode: measurement.containerNode,
    fallbackItems: INFORMES_FALLBACK_ROWS,
    itemHeightPx: measurement.rowHeightPx,
    minItems: 1,
    maxItems: INFORMES_LIMIT_CAP,
  });

  const effectiveLimit = rowsPerPage;

  useLayoutEffect(() => {
    setRequestWindow((current) => {
      if (current.limit === effectiveLimit) {
        return current;
      }

      return {
        limit: effectiveLimit,
        offset: normalizeOffsetForLimit(
          current.offset,
          effectiveLimit,
          totalCount,
        ),
      };
    });
  }, [effectiveLimit, totalCount]);

  const query = useMemo(
    () => ({
      query: filters.query || undefined,
      status: filters.status || undefined,
      studyType: filters.studyType || undefined,
      pageSize: requestWindow.limit,
      offset: requestWindow.offset,
    }),
    [filters.query, filters.status, filters.studyType, requestWindow],
  );

  useEffect(() => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    void (async () => {
      const page = Math.floor(query.offset / query.pageSize) + 1;
      const result = await getInformesPage({
        query: query.query,
        status: query.status,
        studyType: query.studyType,
        page,
        pageSize: query.pageSize,
      });

      if (requestId !== latestRequestRef.current) {
        return;
      }

      setReports(result.reports);
      setSelectedReportId((current) =>
        current === null || result.reports.some((report) => report.id === current)
          ? current
          : (result.reports[0]?.id ?? null),
      );
      setTotalCount(result.total);
      setLoadError(result.loadError);
    })();
  }, [query]);

  // The measured `effectiveLimit` can shrink faster than the corrective
  // server re-fetch resolves (network round trip). Capping the rendered
  // rows at the current limit prevents briefly showing more rows than the
  // measured canvas actually fits (silent clipping under `overflow-hidden`)
  // while the fetch for the smaller page size is still in flight.
  const visibleReports = useMemo(
    () => (reports.length > effectiveLimit ? reports.slice(0, effectiveLimit) : reports),
    [reports, effectiveLimit],
  );

  const reportsTotalPages = Math.max(1, Math.ceil(totalCount / effectiveLimit));
  const page = Math.min(
    Math.floor(requestWindow.offset / effectiveLimit) + 1,
    reportsTotalPages,
  );
  const pageStart = totalCount > 0 ? requestWindow.offset + 1 : 0;
  const pageEnd = Math.min(
    requestWindow.offset + visibleReports.length,
    totalCount,
  );
  const hasActiveFilters = Boolean(filters.query || filters.status || filters.studyType);

  const selectedReport =
    selectedReportId === null
      ? (reports[0] ?? null)
      : (reports.find((report) => report.id === selectedReportId) ?? null);

  const selectedReportTimelineSteps = selectedReport
    ? buildStudyTimelineSteps(selectedReport)
    : [];

  function goToPreviousPage() {
    setRequestWindow((current) => {
      const currentOffset = normalizeOffsetForLimit(
        current.offset,
        effectiveLimit,
        totalCount,
      );
      return {
        limit: effectiveLimit,
        offset: Math.max(0, currentOffset - effectiveLimit),
      };
    });
  }

  function goToNextPage() {
    setRequestWindow((current) => {
      const currentOffset = normalizeOffsetForLimit(
        current.offset,
        effectiveLimit,
        totalCount,
      );
      return {
        limit: effectiveLimit,
        offset: currentOffset + effectiveLimit,
      };
    });
  }

  function selectReport(reportId: number) {
    setSelectedReportId(reportId);
    setDetailSection("resumen");
  }

  // Bounded detail canvas (desktop panel + mobile dialog body): compact
  // header, segmented sections and a persistent action dock. No core
  // scroller — every section fits its canvas; long values truncate.
  function renderReportDetailCanvas({
    actionDockSurface,
    exposeActionDock,
  }: {
    actionDockSurface: "panel" | "dialog";
    exposeActionDock: boolean;
  }) {
    if (!selectedReport) {
      return null;
    }

    const report = selectedReport;

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-vetneb-line/70 pb-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Detalle del informe
            </p>
            <h2
              id="report-detail-heading"
              className="mt-0.5 truncate text-base font-semibold text-vetneb-ink"
            >
              {getReportTitle(report)}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              Clínica {report.clinicName ?? `#${report.clinicId}`}
            </p>
          </div>
          <StatusBadge
            status={report.status}
            label={getReportStatusLabel(report.status)}
          />
        </div>

        <div
          role="tablist"
          aria-label="Secciones del detalle del informe"
          data-informes-detail-sections="true"
          className="dashboard-module-tablist shrink-0"
        >
          {REPORT_DETAIL_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={detailSection === section.id}
              data-informes-detail-section-tab={section.id}
              onClick={() => setDetailSection(section.id)}
              className="dashboard-module-tab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85"
            >
              {section.label}
            </button>
          ))}
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          data-informes-detail-section-panel={detailSection}
        >
          {detailSection === "resumen" ? (
            <dl className="grid min-h-0 grid-cols-2 content-start gap-2 overflow-hidden xl:grid-cols-3">
              <div className="surface-soft min-w-0">
                <dt className="text-xs text-muted-foreground">Paciente</dt>
                <dd className="mt-1 truncate font-semibold text-vetneb-ink">
                  {report.patientName ?? "—"}
                </dd>
              </div>
              <div className="surface-soft min-w-0">
                <dt className="text-xs text-muted-foreground">Tipo de estudio</dt>
                <dd className="mt-1 truncate font-semibold text-vetneb-ink">
                  {report.studyType ?? "—"}
                </dd>
              </div>
              <div className="surface-soft min-w-0">
                <dt className="text-xs text-muted-foreground">Fecha</dt>
                <dd className="mt-1 truncate font-semibold text-vetneb-ink">
                  {formatDate(report.uploadDate)}
                </dd>
              </div>
              <div className="surface-soft min-w-0">
                <dt className="text-xs text-muted-foreground">Creado</dt>
                <dd className="mt-1 truncate font-semibold text-vetneb-ink">
                  {formatDate(report.createdAt)}
                </dd>
              </div>
              <div className="surface-soft min-w-0">
                <dt className="text-xs text-muted-foreground">Actualizado</dt>
                <dd className="mt-1 truncate font-semibold text-vetneb-ink">
                  {formatDate(report.updatedAt)}
                </dd>
              </div>
              <div className="surface-soft min-w-0">
                <dt className="text-xs text-muted-foreground">Estado</dt>
                <dd className="mt-1 truncate font-semibold text-vetneb-ink">
                  {getReportStatusLabel(report.status)}
                </dd>
              </div>
            </dl>
          ) : null}

          {detailSection === "archivos" ? (
            <div className="surface-soft min-w-0">
              <p className="text-xs text-muted-foreground">Archivo / Informe</p>
              <p className="mt-1 truncate font-semibold text-vetneb-ink">
                {report.fileName ?? (report.hasFile ? "Disponible" : "—")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {report.hasFile
                  ? "El documento está disponible en el dock de acciones."
                  : "El informe aún no tiene archivo vinculado."}
              </p>
            </div>
          ) : null}

          {detailSection === "timeline" ? (
            <section
              className="flex min-h-0 flex-col gap-2 overflow-hidden"
              aria-labelledby="study-timeline-heading"
            >
              <div className="shrink-0">
                <h3
                  id="study-timeline-heading"
                  className="text-sm font-semibold text-vetneb-ink"
                >
                  Línea de tiempo del estudio
                </h3>
                <p className="truncate text-xs text-muted-foreground">
                  Pasos derivados del estado y fechas ya disponibles.
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <StudyTimeline steps={selectedReportTimelineSteps} />
              </div>
            </section>
          ) : null}
        </div>

        <section
          className="shrink-0 border-t border-vetneb-line/70 pt-3"
          aria-labelledby="report-actions-heading"
          data-informes-detail-action-dock={exposeActionDock ? "true" : undefined}
          data-informes-detail-action-dock-surface={actionDockSurface}
        >
          <h3
            id="report-actions-heading"
            className="text-sm font-semibold text-vetneb-ink"
          >
            Acciones
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            Visualización y descarga del archivo disponible.
          </p>
          <div className="mt-2">
            <ReportFileActions
              reportId={selectedReport.id}
              hasFile={selectedReport.hasFile}
              align="start"
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      {/* Hidden below `sm` so the fixed chrome (filters + summary) never
          out-competes the adaptive rows/pager for the short mobile
          viewport's height. */}
      <div className="hidden gap-2 text-sm sm:grid sm:grid-cols-4 xl:min-w-[34rem]">
        <div className="surface-soft px-3 py-2">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="mt-0.5 font-semibold text-vetneb-ink">{totalCount}</p>
        </div>
        <div className="surface-soft px-3 py-2">
          <p className="text-xs text-muted-foreground">Mostrando</p>
          <p className="mt-0.5 font-semibold text-vetneb-ink">
            {totalCount > 0 ? `${pageStart}-${pageEnd}` : "0"}
          </p>
        </div>
        <div className="surface-soft px-3 py-2">
          <p className="text-xs text-muted-foreground">Página</p>
          <p className="mt-0.5 font-semibold text-vetneb-ink">
            {Math.max(page, 1)} / {Math.max(reportsTotalPages, 1)}
          </p>
        </div>
        <div className="surface-soft px-3 py-2">
          <p className="text-xs text-muted-foreground">Filtros</p>
          <p className="mt-0.5 font-semibold text-vetneb-ink">
            {hasActiveFilters ? "Activos" : "Sin filtros"}
          </p>
        </div>
      </div>

      {loadError || reports.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <section
            id="reports-master-list"
            aria-labelledby="reports-list-heading"
            className="dashboard-master-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-vetneb-line/75 bg-card/82"
          >
            <div className="shrink-0 border-b border-vetneb-line/70 px-4 py-3">
              <h2 id="reports-list-heading" className="dashboard-section-heading">
                Lista de informes
              </h2>
              <p className="dashboard-section-description">
                Click en un informe para ver detalles y acciones.
              </p>
            </div>

            <div ref={setBodyNode} className="flex min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
              {loadError ? (
                <div role="alert">
                  <ErrorState
                    title="No se pudieron cargar los informes"
                    message="No se pudieron cargar los informes. Intente nuevamente."
                  />
                </div>
              ) : (
                <EmptyState
                  title="No hay informes disponibles."
                  description="Cuando haya informes para los filtros actuales, aparecerán en esta lista."
                />
              )}
            </div>
          </section>
        </div>
      ) : null}

      {!loadError && reports.length > 0 ? (
        <div
          className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
          data-informes-master-detail-canvas="true"
        >
          <section
            id="reports-master-list"
            aria-labelledby="reports-list-heading"
            data-dashboard-adaptive-reservation="true"
            className="dashboard-master-panel flex min-h-0 flex-col overflow-hidden rounded-xl border border-vetneb-line/75 bg-card/82"
          >
            <div className="shrink-0 border-b border-vetneb-line/70 px-4 py-2.5">
              <h2 id="reports-list-heading" className="dashboard-section-heading">
                Lista de informes
              </h2>
              <p className="dashboard-section-description">
                Click en un informe para abrir su detalle operativo.
              </p>
            </div>

            <div
              ref={setBodyNode}
              data-informes-rows-canvas="true"
              data-dashboard-adaptive-rows-canvas="true"
              className="flex min-h-0 flex-1 flex-col divide-y divide-vetneb-line/60 overflow-hidden"
            >
              {visibleReports.map((report, index) => {
                const isSelected = selectedReport?.id === report.id;

                return (
                  <div key={report.id} className="min-w-0 shrink-0">
                    <div ref={index === 0 ? setRowNode : undefined}>
                      <button
                        type="button"
                        id={`report-${report.id}`}
                        onClick={() => selectReport(report.id)}
                        aria-current={isSelected ? "true" : undefined}
                        aria-label={
                          isSelected
                            ? `Informe seleccionado: ${getReportTitle(report)}`
                            : `Seleccionar informe: ${getReportTitle(report)}`
                        }
                        className={cn(
                          "block w-full px-4 py-3 text-left transition-colors hover:bg-vetneb-cyan/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-inset",
                          isSelected && "bg-vetneb-cyan/12",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                              Informe #{report.id}
                            </p>
                            <p className="mt-1 truncate text-sm font-semibold text-vetneb-ink">
                              {report.patientName ?? "Paciente sin nombre"}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {report.studyType ?? "Tipo sin registrar"} ·{" "}
                              {formatDate(report.uploadDate)}
                            </p>
                          </div>
                          <Badge variant={getReportStatusVariant(report.status)} className="shrink-0">
                            {getReportStatusLabel(report.status)}
                          </Badge>
                        </div>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedReport ? (
              <div
                data-informes-selected-report-summary="true"
                className="flex shrink-0 items-center justify-between gap-2 border-t border-vetneb-line/60 px-3 py-2 lg:hidden"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-vetneb-ink">
                    {getReportTitle(selectedReport)}
                  </p>
                  <p className="truncate text-[0.6875rem] text-muted-foreground">
                    {selectedReport.studyType ?? "Tipo sin registrar"} ·{" "}
                    {formatDate(selectedReport.uploadDate)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 px-2 text-xs"
                  onClick={() => setIsDetailDialogOpen(true)}
                  aria-haspopup="dialog"
                >
                  Ver detalle
                </Button>
              </div>
            ) : null}

            <nav
              aria-label="Paginación de informes"
              data-dashboard-pager="true"
              data-dashboard-adaptive-reserved-region="pager"
              className="dashboard-pager shrink-0 border-t border-vetneb-line/70"
            >
              <span data-dashboard-pager-prev="true" className="inline-flex">
                <button
                  type="button"
                  onClick={goToPreviousPage}
                  disabled={page <= 1}
                  aria-label="Página anterior"
                  aria-disabled={page <= 1 ? "true" : undefined}
                  className="dashboard-pagination-btn inline-flex h-8 items-center justify-center rounded-md border border-input bg-card/95 px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>
              </span>
              <span data-dashboard-pager-state="true" className="dashboard-pagination-context">
                Página {page} de {reportsTotalPages}
              </span>
              <span data-dashboard-pager-next="true" className="inline-flex">
                <button
                  type="button"
                  onClick={goToNextPage}
                  disabled={page >= reportsTotalPages}
                  aria-label="Página siguiente"
                  aria-disabled={page >= reportsTotalPages ? "true" : undefined}
                  className="dashboard-pagination-btn inline-flex h-8 items-center justify-center rounded-md border border-input bg-card/95 px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente
                </button>
              </span>
            </nav>
          </section>

          {selectedReport ? (
            <section
              id="report-detail"
              aria-labelledby="report-detail-heading"
              data-detail-state="selected"
              className="hidden min-h-0 flex-col overflow-hidden rounded-xl border border-vetneb-line/75 bg-vetneb-surface-muted/40 p-4 lg:flex"
            >
              {renderReportDetailCanvas({
                actionDockSurface: "panel",
                exposeActionDock: !isDetailDialogOpen,
              })}
            </section>
          ) : null}

          {selectedReport ? (
            <ModuleDialog
              open={isDetailDialogOpen}
              onOpenChange={(open) => setIsDetailDialogOpen(open)}
              title={getReportTitle(selectedReport)}
              description="Detalle operativo del informe seleccionado."
            >
              <div
                data-informes-detail-dialog="true"
                className="flex min-h-0 flex-col overflow-hidden"
              >
                {renderReportDetailCanvas({
                  actionDockSurface: "dialog",
                  exposeActionDock: isDetailDialogOpen,
                })}
              </div>
            </ModuleDialog>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
