"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/dashboard/EmptyState";
import { ErrorState } from "@/components/dashboard/ErrorState";
import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Badge } from "@/components/ui/badge";
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

function measurementsEqual(a: Measurement, b: Measurement) {
  return a.containerNode === b.containerNode && a.rowHeightPx === b.rowHeightPx;
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
  const [offset, setOffset] = useState((initialPage - 1) * initialPageSize);
  const [loadError, setLoadError] = useState(initialLoadError);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(
    initialSelectedReportId,
  );

  const [bodyNode, setBodyNode] = useState<HTMLElement | null>(null);
  const [rowNode, setRowNode] = useState<HTMLElement | null>(null);
  const [measurement, setMeasurement] = useState<Measurement>({
    containerNode: null,
    rowHeightPx: INFORMES_ROW_HEIGHT_FALLBACK_PX,
  });

  const latestRequestRef = useRef(0);
  const totalRef = useRef(initialTotal);

  useEffect(() => {
    totalRef.current = totalCount;
  }, [totalCount]);

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
          rowHeightPx: rowHeight > 0 ? rowHeight : INFORMES_ROW_HEIGHT_FALLBACK_PX,
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

  const query = useMemo(
    () => ({
      query: filters.query || undefined,
      status: filters.status || undefined,
      studyType: filters.studyType || undefined,
      pageSize: effectiveLimit,
      offset,
    }),
    [filters.query, filters.status, filters.studyType, effectiveLimit, offset],
  );

  const previousLimitRef = useRef(effectiveLimit);
  useEffect(() => {
    if (previousLimitRef.current === effectiveLimit) {
      return;
    }
    previousLimitRef.current = effectiveLimit;

    setOffset((currentOffset) => {
      let nextOffset = Math.floor(currentOffset / effectiveLimit) * effectiveLimit;
      const total = totalRef.current;
      if (total > 0) {
        const lastValidOffset = Math.max(
          0,
          (Math.ceil(total / effectiveLimit) - 1) * effectiveLimit,
        );
        nextOffset = Math.min(nextOffset, lastValidOffset);
      }
      nextOffset = Math.max(0, nextOffset);
      return nextOffset === currentOffset ? currentOffset : nextOffset;
    });
  }, [effectiveLimit]);

  useEffect(() => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    void (async () => {
      const page = Math.floor(offset / query.pageSize) + 1;
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
      setTotalCount(result.total);
      setLoadError(result.loadError);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const reportsTotalPages = Math.max(1, Math.ceil(totalCount / effectiveLimit));
  const page = Math.min(Math.floor(offset / effectiveLimit) + 1, reportsTotalPages);
  const pageStart = totalCount > 0 ? offset + 1 : 0;
  const pageEnd = Math.min(offset + reports.length, totalCount);
  const hasActiveFilters = Boolean(filters.query || filters.status || filters.studyType);

  const selectedReport =
    selectedReportId === null
      ? (reports[0] ?? null)
      : (reports.find((report) => report.id === selectedReportId) ?? null);

  const selectedReportTimelineSteps = selectedReport
    ? buildStudyTimelineSteps(selectedReport)
    : [];

  function goToPreviousPage() {
    setOffset((current) => Math.max(0, current - effectiveLimit));
  }

  function goToNextPage() {
    setOffset((current) => current + effectiveLimit);
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
            className="dashboard-master-panel dashboard-inline-list flex-1 rounded-xl border border-vetneb-line/75 bg-card/82"
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
        <div className="flex min-h-0 flex-1 flex-col">
          <section
            id="reports-master-list"
            aria-labelledby="reports-list-heading"
            className="dashboard-master-panel dashboard-inline-list flex-1 rounded-xl border border-vetneb-line/75 bg-card/82"
          >
            <div className="shrink-0 border-b border-vetneb-line/70 px-4 py-3">
              <h2 id="reports-list-heading" className="dashboard-section-heading">
                Lista de informes
              </h2>
              <p className="dashboard-section-description">
                Click en un informe para ver el detalle desplegado dentro del propio informe.
              </p>
            </div>

            <div ref={setBodyNode} className="dashboard-inline-scroll divide-y divide-vetneb-line/60">
              {reports.map((report, index) => {
                const isSelected = selectedReport?.id === report.id;

                return (
                  <div key={report.id} className="min-w-0">
                    <div ref={index === 0 ? setRowNode : undefined}>
                      <button
                        type="button"
                        id={`report-${report.id}`}
                        onClick={() => setSelectedReportId(report.id)}
                        aria-current={isSelected ? "true" : undefined}
                        aria-expanded={isSelected}
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

                    {isSelected && selectedReport ? (
                      <div
                        id="report-detail"
                        aria-labelledby="report-detail-heading"
                        data-detail-state="selected"
                        className="dashboard-inline-detail border-t border-vetneb-line/60 bg-vetneb-surface-muted/40"
                      >
                        <div className="space-y-4 p-4">
                          <div className="flex flex-col gap-3 border-b border-vetneb-line/70 pb-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                                Detalle del informe
                              </p>
                              <h2 id="report-detail-heading" className="mt-1 text-xl font-semibold text-vetneb-ink">
                                {getReportTitle(selectedReport)}
                              </h2>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Clínica {selectedReport.clinicName ?? `#${selectedReport.clinicId}`}
                              </p>
                            </div>
                            <StatusBadge
                              status={selectedReport.status}
                              label={getReportStatusLabel(selectedReport.status)}
                            />
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            <div className="surface-soft">
                              <p className="text-xs text-muted-foreground">Paciente</p>
                              <p className="mt-1 font-semibold text-vetneb-ink">
                                {selectedReport.patientName ?? "—"}
                              </p>
                            </div>
                            <div className="surface-soft">
                              <p className="text-xs text-muted-foreground">Tipo de estudio</p>
                              <p className="mt-1 font-semibold text-vetneb-ink">
                                {selectedReport.studyType ?? "—"}
                              </p>
                            </div>
                            <div className="surface-soft">
                              <p className="text-xs text-muted-foreground">Fecha</p>
                              <p className="mt-1 font-semibold text-vetneb-ink">
                                {formatDate(selectedReport.uploadDate)}
                              </p>
                            </div>
                            <div className="surface-soft">
                              <p className="text-xs text-muted-foreground">Creado</p>
                              <p className="mt-1 font-semibold text-vetneb-ink">
                                {formatDate(selectedReport.createdAt)}
                              </p>
                            </div>
                            <div className="surface-soft">
                              <p className="text-xs text-muted-foreground">Actualizado</p>
                              <p className="mt-1 font-semibold text-vetneb-ink">
                                {formatDate(selectedReport.updatedAt)}
                              </p>
                            </div>
                            <div className="surface-soft">
                              <p className="text-xs text-muted-foreground">Archivo</p>
                              <p className="mt-1 font-semibold text-vetneb-ink">
                                {selectedReport.fileName ?? (selectedReport.hasFile ? "Disponible" : "—")}
                              </p>
                            </div>
                          </div>

                          <section className="space-y-3" aria-labelledby="report-actions-heading">
                            <div>
                              <h3 id="report-actions-heading" className="text-base font-semibold text-vetneb-ink">
                                Acciones
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Visualización y descarga del archivo disponible.
                              </p>
                            </div>
                            <ReportFileActions
                              reportId={selectedReport.id}
                              hasFile={selectedReport.hasFile}
                              align="start"
                            />
                          </section>

                          <section className="space-y-3" aria-labelledby="study-timeline-heading">
                            <div>
                              <h3 id="study-timeline-heading" className="text-base font-semibold text-vetneb-ink">
                                Línea de tiempo del estudio
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Pasos derivados del estado y fechas ya disponibles.
                              </p>
                            </div>
                            <StudyTimeline steps={selectedReportTimelineSteps} />
                          </section>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <nav
              aria-label="Paginación de informes"
              className="flex shrink-0 items-center justify-between gap-2 border-t border-vetneb-line/70 px-4 py-3"
            >
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
              <span className="dashboard-pagination-context">
                Página {page} de {reportsTotalPages}
              </span>
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
            </nav>
          </section>
        </div>
      ) : null}
    </>
  );
}
