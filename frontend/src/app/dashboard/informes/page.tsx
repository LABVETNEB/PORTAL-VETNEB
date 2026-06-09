import type { Metadata } from "next";
import { cookies } from "next/headers";
import { FileText, ListChecks } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ErrorState } from "@/components/dashboard/ErrorState";
import { FilterDrawer } from "@/components/dashboard/FilterDrawer";
import { MasterDetailWorkspace } from "@/components/dashboard/MasterDetailWorkspace";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  StickyFilterBar,
  type ActiveFilter,
} from "@/components/dashboard/StickyFilterBar";
import {
  StickyActionBar,
  type StickyActionBarAction,
} from "@/components/dashboard/StickyActionBar";
import {
  StudyTimeline,
  type StudyTimelineStep,
} from "@/components/dashboard/StudyTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  getReportsPaginated,
  searchReportsPaginated,
  type PaginatedReports,
} from "@/lib/api";
import {
  getReportStatusLabel,
  getReportStatusVariant,
  formatDate,
} from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import type { Report, ReportStatus } from "@/types";

export const metadata: Metadata = {
  title: "Informes — Portal VETNEB",
  robots: { index: false, follow: false },
};

const REPORTS_PAGE_SIZE = 20;

const statusOptions = [
  { value: "", label: "Todos los estados" },
  { value: "uploaded", label: "Subido" },
  { value: "processing", label: "Procesando" },
  { value: "ready", label: "Listo" },
  { value: "delivered", label: "Entregado" },
];

type InformesPageSearchParams = {
  query?: string | string[];
  status?: string | string[];
  studyType?: string | string[];
  reportId?: string | string[];
  page?: string | string[];
};

function normalizeSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function normalizeStatusFilter(value: string) {
  if (statusOptions.some((option) => option.value === value)) {
    return value;
  }

  return "";
}

function normalizeReportIdFilter(value: string) {
  const reportId = Number(value);

  return Number.isInteger(reportId) && reportId > 0 ? reportId : null;
}

function normalizePageParam(value: string): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

function getStatusFilterLabel(value: string) {
  return statusOptions.find((option) => option.value === value)?.label ?? value;
}

function buildActiveFilters(input: {
  query: string;
  status: string;
  studyType: string;
}): ActiveFilter[] {
  const activeFilters: ActiveFilter[] = [];

  if (input.query) {
    activeFilters.push({ label: "Búsqueda", value: input.query });
  }

  if (input.status) {
    activeFilters.push({
      label: "Estado",
      value: getStatusFilterLabel(input.status),
    });
  }

  if (input.studyType) {
    activeFilters.push({ label: "Tipo de estudio", value: input.studyType });
  }

  return activeFilters;
}

function buildInformesHref(input: {
  query?: string;
  status?: string;
  studyType?: string;
  reportId?: number | null;
  page?: number;
  hash?: string;
}) {
  const params = new URLSearchParams();

  if (input.query) {
    params.set("query", input.query);
  }

  if (input.status) {
    params.set("status", input.status);
  }

  if (input.studyType) {
    params.set("studyType", input.studyType);
  }

  if (input.reportId) {
    params.set("reportId", String(input.reportId));
  }

  if (input.page && input.page > 1) {
    params.set("page", String(input.page));
  }

  const qs = params.toString();
  const hash = input.hash ? `#${input.hash}` : "";

  return `/dashboard/informes${qs ? `?${qs}` : ""}${hash}`;
}

function getReportTitle(report: Report) {
  return report.patientName ? `${report.patientName} · Informe #${report.id}` : `Informe #${report.id}`;
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

async function getReportsRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export default async function InformesPage({
  searchParams,
}: {
  searchParams?: Promise<InformesPageSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = normalizeSearchParamValue(resolvedSearchParams.query).trim();
  const status = normalizeStatusFilter(
    normalizeSearchParamValue(resolvedSearchParams.status),
  );
  const studyType = normalizeSearchParamValue(resolvedSearchParams.studyType).trim();
  const selectedReportId = normalizeReportIdFilter(
    normalizeSearchParamValue(resolvedSearchParams.reportId),
  );
  const page = normalizePageParam(normalizeSearchParamValue(resolvedSearchParams.page));
  const requestOptions = await getReportsRequestOptions();

  let pagedResult: PaginatedReports = {
    reports: [],
    total: 0,
    page,
    pageSize: REPORTS_PAGE_SIZE,
    totalPages: 0,
  };
  let reportsLoadError = false;

  try {
    pagedResult = query
      ? await searchReportsPaginated(
          {
            query,
            status: status || undefined,
            studyType: studyType || undefined,
            page,
            pageSize: REPORTS_PAGE_SIZE,
          },
          requestOptions,
          { throwOnError: true },
        )
      : await getReportsPaginated(
          requestOptions,
          {
            status: status || undefined,
            page,
            pageSize: REPORTS_PAGE_SIZE,
          },
          { throwOnError: true },
        );
  } catch {
    reportsLoadError = true;
  }

  const reports = pagedResult.reports;
  const reportsTotal = pagedResult.total;
  const reportsTotalPages = pagedResult.totalPages;
  const offset = (page - 1) * REPORTS_PAGE_SIZE;
  const pageStart = reportsTotal > 0 ? offset + 1 : 0;
  const pageEnd = Math.min(offset + reports.length, reportsTotal);

  const selectedReport =
    reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null;
  const selectedReportIdValue = selectedReport ? String(selectedReport.id) : null;
  const selectedReportTimelineSteps = selectedReport
    ? buildStudyTimelineSteps(selectedReport)
    : [];
  const activeFilters = buildActiveFilters({ query, status, studyType });
  const stickyActions = [
    {
      label: "Lista",
      href: "#reports-master-list",
      variant: "outline",
      icon: <ListChecks className="h-4 w-4" aria-hidden="true" />,
      "aria-label": "Ir a lista de informes",
    },
    {
      label: "Detalle",
      href: "#report-detail",
      variant: "default",
      disabled: !selectedReport,
      icon: <FileText className="h-4 w-4" aria-hidden="true" />,
      "aria-label": selectedReport
        ? `Ir al detalle del informe ${selectedReport.id}`
        : "Detalle de informe no disponible",
    },
  ] satisfies StickyActionBarAction[];

  return (
    <>
      <DashboardTopbar
        title="Informes"
        subtitle="Consulta de informes médicos veterinarios"
        notifications="clinic"
      />
      <main className="dashboard-main">
        <DashboardPageHeader
          title="Informes"
          description="Workspace operativo para revisar informes clinic-scoped, abrir detalle y consultar el avance del estudio sin salir de la lista."
          badge={
            selectedReport ? (
              <StatusBadge
                status={selectedReport.status}
                label={getReportStatusLabel(selectedReport.status)}
                size="sm"
              />
            ) : null
          }
          actions={
            <PublicRouteControl
              href={ROUTES.dashboard}
              variant="bare"
              aria-label="Volver al dashboard"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-card/95 px-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
            >
              <span>Volver a m&oacute;dulos</span>
            </PublicRouteControl>
          }
        />

        <StickyActionBar
          context={selectedReport ? `Informe #${selectedReport.id}` : "Informes"}
          actions={stickyActions}
        >
          {selectedReport ? (
            <ReportFileActions
              reportId={selectedReport.id}
              hasFile={selectedReport.hasFile}
              align="start"
            />
          ) : null}
        </StickyActionBar>

        <StickyFilterBar
          title="Filtros"
          activeFilters={activeFilters}
          drawer={
            <FilterDrawer
              title="Filtros de informes"
              description="Búsqueda por paciente o tipo de estudio, y estado operativo."
              triggerLabel="Filtrar informes"
              activeCount={activeFilters.length}
            >
              <form method="get" className="space-y-4">
                <label className="block">
                  <span className="text-sm font-semibold text-vetneb-ink">
                    Buscar
                  </span>
                  <Input
                    name="query"
                    defaultValue={query}
                    placeholder="Buscar por paciente o tipo de estudio..."
                    className="mt-1 min-w-0"
                    aria-label="Buscar informes"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-vetneb-ink">
                    Estado
                  </span>
                  <select
                    name="status"
                    defaultValue={status}
                    className="field-select mt-1"
                    aria-label="Filtrar por estado"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <PublicRouteControl
                    href="/dashboard/informes"
                    replace
                    variant="bare"
                    className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold text-foreground/80 transition-[background-color,color] duration-150 hover:bg-accent/70 hover:text-accent-foreground"
                  >
                    Limpiar
                  </PublicRouteControl>
                  <Button type="submit" size="sm">
                    Filtrar
                  </Button>
                </div>
              </form>
            </FilterDrawer>
          }
        />

        <MasterDetailWorkspace
          selectedId={selectedReportIdValue}
          master={
            <div id="reports-master-list" className="space-y-4 p-4">
              <div>
                <h2 className="dashboard-section-heading">Informes</h2>
                <p className="dashboard-section-description">
                  {reportsTotal > 0
                    ? `Mostrando ${pageStart}–${pageEnd} de ${reportsTotal}`
                    : "Lista clinic-scoped con selección de detalle."}
                </p>
              </div>

              <div className="min-w-0 overflow-x-auto rounded-lg border border-vetneb-line/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Tipo de estudio</TableHead>
                      <TableHead>Clínica</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportsLoadError ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          role="alert"
                          className="clinical-table-state"
                        >
                          <ErrorState
                            title="No se pudieron cargar los informes"
                            message="No se pudieron cargar los informes. Intente nuevamente."
                            className="text-left"
                          />
                        </TableCell>
                      </TableRow>
                    ) : reports.length ? (
                      reports.map((report) => {
                        const isSelected = selectedReport?.id === report.id;

                        return (
                          <TableRow
                            key={report.id}
                            id={`report-${report.id}`}
                            className={isSelected ? "bg-vetneb-cyan/10" : undefined}
                          >
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              #{report.id}
                            </TableCell>
                            <TableCell className="font-medium">
                              {report.patientName ?? "—"}
                            </TableCell>
                            <TableCell className="text-vetneb-ink/75">
                              {report.studyType ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm text-vetneb-ink/75">
                              {report.clinicName ?? `Clínica #${report.clinicId}`}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(report.uploadDate)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getReportStatusVariant(report.status)}>
                                {getReportStatusLabel(report.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-2">
                                <PublicRouteControl
                                  href={buildInformesHref({
                                    query,
                                    status,
                                    studyType,
                                    reportId: report.id,
                                    page,
                                    hash: "report-detail",
                                  })}
                                  replace
                                  prefetch={false}
                                  variant="bare"
                                  aria-current={isSelected ? "true" : undefined}
                                  className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-card/95 px-2 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70"
                                >
                                  {isSelected ? "Seleccionado" : "Seleccionar"}
                                </PublicRouteControl>
                                <ReportFileActions
                                  reportId={report.id}
                                  hasFile={report.hasFile}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="clinical-table-state"
                        >
                          <EmptyState
                            title="No hay informes disponibles."
                            description="Cuando haya informes para los filtros actuales, aparecerán en este panel."
                            className="border-0 bg-transparent"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {reportsTotalPages > 1 && (
                <nav
                  aria-label="Paginación de informes"
                  className="flex items-center justify-between gap-2 pt-1"
                >
                  <PublicRouteControl
                    href={buildInformesHref({ query, status, studyType, page: page - 1 })}
                    replace
                    prefetch={false}
                    variant="bare"
                    disabled={page <= 1}
                    aria-label="Página anterior"
                    aria-disabled={page <= 1 ? "true" : undefined}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-card/95 px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </PublicRouteControl>
                  <span className="text-sm text-muted-foreground">
                    Página {page} de {reportsTotalPages}
                  </span>
                  <PublicRouteControl
                    href={buildInformesHref({ query, status, studyType, page: page + 1 })}
                    replace
                    prefetch={false}
                    variant="bare"
                    disabled={page >= reportsTotalPages}
                    aria-label="Página siguiente"
                    aria-disabled={page >= reportsTotalPages ? "true" : undefined}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-card/95 px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente
                  </PublicRouteControl>
                </nav>
              )}
            </div>
          }
          detail={
            selectedReport ? (
              <div id="report-detail" className="space-y-6 p-5">
                <div className="flex flex-col gap-3 border-b border-vetneb-line/70 pb-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Detalle del informe
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-vetneb-ink">
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

                <section id="report-actions" className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold text-vetneb-ink">
                      Acciones
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Acciones reales existentes para visualizar o descargar el archivo.
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
                    <h3
                      id="study-timeline-heading"
                      className="text-base font-semibold text-vetneb-ink"
                    >
                      Línea de tiempo del estudio
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Pasos derivados del estado y fechas ya disponibles del informe.
                    </p>
                  </div>
                  <StudyTimeline steps={selectedReportTimelineSteps} />
                </section>
              </div>
            ) : (
              <EmptyState
                title="No hay informe seleccionado"
                description="Seleccione un informe de la lista para ver el detalle operativo."
                className="m-5"
              />
            )
          }
          emptyDetail={
            <EmptyState
              title="No hay informe seleccionado"
              description="Seleccione un informe de la lista para ver el detalle operativo."
              className="m-5"
            />
          }
        />

        <div className="h-24 md:hidden" aria-hidden="true" />
      </main>
    </>
  );
}
