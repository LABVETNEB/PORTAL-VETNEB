"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  FilePlus2,
  Loader2,
  RefreshCw,
} from "lucide-react";

import {
  dashboardFilterActionClassName,
  dashboardFilterControlClassName,
  FilterBar,
  FilterField,
  type FilterBarDensity,
} from "@/components/dashboard/FilterBar";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { useAdaptiveItemsPerPage } from "@/hooks/useAdaptiveItemsPerPage";
import {
  ADMIN_REPORT_STAGE_OPTIONS,
  AdminReportStatusBadge,
} from "./AdminReportStatusBadge";
import { AdminReportsUploadPanel } from "./AdminReportsUploadPanel";

// Server pagination is now sized by the measured rows container (Zero-Scroll
// adaptive contract, R-03/PR-SRV-0 module #4). PR-3 established nine dense rows
// as the safe 1366x768 desktop limit; that constant survives only as the
// pre-measurement fallback and as the desktop floor. A media query no longer
// decides cardinality, and the mobile/desktop `limit`/`offset` divergence
// (nine desktop rows vs a fixed ten-row mobile page, two independent fetch
// pipelines) is collapsed into a single measured runtime.
const REPORTS_FALLBACK_ROWS = 9;
// Hybrid cap: the effective `limit` never exceeds this superset ceiling even on
// very tall viewports; recompute of offset always clamps against it.
const REPORTS_SUPERSET_CAP = 36;
// Fixed header row height of the desktop table (`[&_th]:h-7`), discounted from
// the measured region so the row math never counts the header as a data row.
const REPORTS_TABLE_HEADER_PX = 28;
// Fallback item height used until a real row is measured.
const REPORTS_ROW_HEIGHT_FALLBACK_PX = 36;

type Measurement = {
  containerNode: HTMLElement | null;
  rowHeightPx: number;
  headerHeightPx: number;
};

function measurementsEqual(a: Measurement, b: Measurement) {
  return (
    a.containerNode === b.containerNode &&
    a.rowHeightPx === b.rowHeightPx &&
    a.headerHeightPx === b.headerHeightPx
  );
}

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
  const [offset, setOffset] = useState(0);
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

  // One collapsed runtime feeds both presentations, so the visible container
  // (desktop table region or mobile list region) drives a single cardinality.
  // The old second `mobileReports` fetch pipeline (a fixed ten-row mobile page
  // gated by a media query) is gone: no more double fetch, no more divergent
  // limit/offset.
  const [desktopBodyNode, setDesktopBodyNode] = useState<HTMLElement | null>(
    null,
  );
  const [mobileBodyNode, setMobileBodyNode] = useState<HTMLElement | null>(null);
  const [desktopRowNode, setDesktopRowNode] = useState<HTMLElement | null>(null);
  const [mobileRowNode, setMobileRowNode] = useState<HTMLElement | null>(null);
  const [measurement, setMeasurement] = useState<Measurement>({
    containerNode: null,
    rowHeightPx: REPORTS_ROW_HEIGHT_FALLBACK_PX,
    headerHeightPx: 0,
  });

  const latestRequestRef = useRef(0);
  const rowPitchRef = useRef({ containerHeight: 0, rowHeightPx: 0 });
  const onFirstPageRef = useRef(true);

  useLayoutEffect(() => {
    onFirstPageRef.current = offset === 0;
  }, [offset]);


  useLayoutEffect(() => {
    const nodes = [
      desktopBodyNode,
      mobileBodyNode,
      desktopRowNode,
      mobileRowNode,
    ].filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) {
      return;
    }

    let frame: number | null = null;

    // Row pitch is a property of the LAYOUT, not of the slice being shown: the
    // tallest row of the container is the pitch, learned ONCE per canvas
    // geometry. Re-learning it from a different slice changed the limit, which
    // refetched, which re-rendered — the limit thrash of §20.3. Content changes
    // never re-learn it; a real resize does.
    const measureRowPitch = (
      container: HTMLElement,
      rowSelector: string,
      firstRowNode: HTMLElement | null,
    ): number => {
      const containerHeight = container.getBoundingClientRect().height;
      const cached = rowPitchRef.current;

      if (cached.rowHeightPx > 0 &&
        (!onFirstPageRef.current ||
          cached.containerHeight === containerHeight)) {
        return cached.rowHeightPx;
      }

      const rows = Array.from(
        container.querySelectorAll<HTMLElement>(rowSelector),
      );
      const measured = rows.reduce(
        (maximum, row) => Math.max(maximum, row.getBoundingClientRect().height),
        firstRowNode?.getBoundingClientRect().height ?? 0,
      );

      if (measured > 0) {
        rowPitchRef.current = { containerHeight, rowHeightPx: measured };
        return measured;
      }

      return cached.rowHeightPx > 0
        ? cached.rowHeightPx
        : REPORTS_ROW_HEIGHT_FALLBACK_PX;
    };

    const recompute = () => {
      frame = null;

      const mobileHeight = mobileBodyNode?.getBoundingClientRect().height ?? 0;
      if (mobileHeight > 0 && mobileBodyNode) {
        const rowHeight = measureRowPitch(
          mobileBodyNode,
          '[data-admin-mobile-core-item="true"]',
          mobileRowNode,
        );
        setMeasurement((previous) => {
          const next: Measurement = {
            containerNode: mobileBodyNode,
            rowHeightPx:
              rowHeight > 0 ? rowHeight : REPORTS_ROW_HEIGHT_FALLBACK_PX,
            headerHeightPx: 0,
          };
          return measurementsEqual(previous, next) ? previous : next;
        });
        return;
      }

      const desktopHeight = desktopBodyNode?.getBoundingClientRect().height ?? 0;
      if (desktopHeight > 0 && desktopBodyNode) {
        const rowHeight = measureRowPitch(
          desktopBodyNode,
          "tbody tr",
          desktopRowNode,
        );
        setMeasurement((previous) => {
          const next: Measurement = {
            containerNode: desktopBodyNode,
            rowHeightPx:
              rowHeight > 0 ? rowHeight : REPORTS_ROW_HEIGHT_FALLBACK_PX,
            headerHeightPx: REPORTS_TABLE_HEADER_PX,
          };
          return measurementsEqual(previous, next) ? previous : next;
        });
      }
    };

    const scheduleRecompute = () => {
      if (frame === null) {
        frame = requestAnimationFrame(recompute);
      }
    };

    const observer = new ResizeObserver(scheduleRecompute);
    nodes.forEach((node) => observer.observe(node));

    // Rows are replaced wholesale on a page change; the replacement itself is
    // the signal that a reprobe may be due.
    const mutationObserver = new MutationObserver(scheduleRecompute);
    const collectionNode = mobileBodyNode ?? desktopBodyNode;
    if (collectionNode) {
      mutationObserver.observe(collectionNode, {
        childList: true,
        subtree: true,
      });
    }

    scheduleRecompute();

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [desktopBodyNode, mobileBodyNode, desktopRowNode, mobileRowNode]);

  // The desktop table is pinned to nine populated rows at the shortest
  // supported desktop viewport (1366×768) by the App Shell contract
  // (`expectNinePopulatedRows`). A positive safety cushion could floor the
  // measured fit to eight and break that contract, so the desktop context
  // (detected by the discounted table header) keeps a floor of nine — matching
  // the pre-adaptive fixed page size — while still adapting upward on taller
  // viewports. The mobile list (no table header) keeps a floor of one so it can
  // shrink freely on short phones. Same exception documented for Users/Roles
  // (SRV-2); Clínicas (R-02) has no such contract and uses a floor of one.
  const isDesktopMeasurement = measurement.headerHeightPx > 0;
  const { itemsPerPage: rowsPerPage } = useAdaptiveItemsPerPage({
    containerNode: measurement.containerNode,
    fallbackItems: REPORTS_FALLBACK_ROWS,
    itemHeightPx: measurement.rowHeightPx,
    headerHeightPx: measurement.headerHeightPx,
    minItems: isDesktopMeasurement ? REPORTS_FALLBACK_ROWS : 1,
    maxItems: REPORTS_SUPERSET_CAP,
  });

  // Effective server page size: at least the measured rows, capped at the
  // superset ceiling. The hook already clamps to [minItems, REPORTS_SUPERSET_CAP].
  const effectiveLimit = rowsPerPage;

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? null,
    [reports, selectedReportId],
  );

  const hasActiveFilters = !isFilterStateEmpty(appliedFilters);
  const filteredReports = reports.filter((report) =>
    matchesAdminReportFilters(report, appliedFilters),
  );
  const deliveredCount = filteredReports.filter(
    (report) => report.workflowStage === "delivered",
  ).length;
  const specialStainCount = filteredReports.filter(
    (report) => report.specialStainRequested,
  ).length;
  // The report-workflow endpoint exposes no `total`, only `hasMore` per full
  // page (PR-SRV-0 §6 rule 2): offset is clamped to ≥ 0 and next-page is driven
  // by `hasMore`; there is no pageCount / jump-to-last.
  const page = Math.floor(offset / effectiveLimit) + 1;
  const hasPrev = offset > 0;
  const hasNext = hasMore;
  const rangeStart = filteredReports.length ? offset + 1 : 0;
  const rangeEnd = offset + filteredReports.length;

  const query = useMemo(
    () => ({ limit: effectiveLimit, offset }),
    [effectiveLimit, offset],
  );

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    try {
      const snapshot = await getAdminReportWorkflow({
        limit: query.limit,
        offset: query.offset,
      });
      if (requestId !== latestRequestRef.current) return;
      setReports(snapshot.reports);
      setHasMore(snapshot.pagination.hasMore);
      setSelectedReportId((current) =>
        snapshot.reports.some((report) => report.id === current) ? current : null,
      );
    } catch (error) {
      if (requestId !== latestRequestRef.current) return;
      setReports([]);
      setHasMore(false);
      setSelectedReportId(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar la cola de informes.",
      );
    } finally {
      if (requestId === latestRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [query]);

  // Recompute offset when the effective limit changes so the same first record
  // stays visible (PR-SRV-0 §6). No `total` clamp is possible here (endpoint
  // exposes none), so only the `offset ≥ 0` floor applies; `hasMore` still
  // gates the next page.
  const previousLimitRef = useRef(effectiveLimit);
  useEffect(() => {
    if (previousLimitRef.current === effectiveLimit) {
      return;
    }
    previousLimitRef.current = effectiveLimit;

    setOffset((currentOffset) => {
      const nextOffset = Math.max(
        0,
        Math.floor(currentOffset / effectiveLimit) * effectiveLimit,
      );
      return nextOffset === currentOffset ? currentOffset : nextOffset;
    });
  }, [effectiveLimit]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  function replaceReport(updated: AdminReportWorkflowItem) {
    setReports((current) =>
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
    // Jump back to the first page after an upload. If offset is already 0,
    // `query` won't change on its own, so reload directly; otherwise the offset
    // change flows into `query` and the load effect reloads once (no double
    // fetch).
    if (offset === 0) {
      await loadReports();
    } else {
      setOffset(0);
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
    // Applying a filter resets the page to the first record (PR-SRV-0 §6.3);
    // a cardinality change (resize/zoom) never touches the filters.
    setOffset(0);
    setErrorMessage(null);
  }

  function clearAdvancedFilters() {
    setFilterDraft(INITIAL_FILTER_STATE);
    setAppliedFilters(INITIAL_FILTER_STATE);
    setOffset(0);
    setErrorMessage(null);
  }

  function goToPreviousPage() {
    setErrorMessage(null);
    setOffset(Math.max(offset - effectiveLimit, 0));
  }

  function goToNextPage() {
    setErrorMessage(null);
    setOffset(offset + effectiveLimit);
  }

  function renderAdvancedFilterForm(mobile = false) {
    const density: FilterBarDensity = mobile ? "comfortable" : "compact";
    const controlClassName = dashboardFilterControlClassName(density);
    const buttonClassName = dashboardFilterActionClassName(density);

    return (
      <FilterBar
        data-admin-report-upload-filter-bar={mobile ? "advanced-mobile" : "advanced"}
        density={density}
        className={
          mobile
            ? "grid grid-cols-2 gap-2"
            : "hidden shrink-0 md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-[0.8fr_1fr_0.95fr_0.95fr_0.9fr_0.9fr_0.85fr_0.85fr_auto_auto] xl:px-1.5"
        }
        onSubmit={applyAdvancedFilters}
        aria-label={
          mobile
            ? "Filtros avanzados de informes mobile"
            : "Filtros avanzados de informes"
        }
      >
        <FilterField label="Informe" density={density} labelHidden={!mobile}>
          <Input
            className={controlClassName}
            type="text"
            placeholder="#ID"
            value={filterDraft.report}
            onChange={(event) => updateFilterDraft("report", event.target.value)}
          />
        </FilterField>
        <FilterField label="Clínica" density={density} labelHidden={!mobile}>
          <Input
            className={controlClassName}
            type="text"
            placeholder="Nombre o ID"
            value={filterDraft.clinic}
            onChange={(event) => updateFilterDraft("clinic", event.target.value)}
          />
        </FilterField>
        <FilterField label="Paciente" density={density} labelHidden={!mobile}>
          <Input
            className={controlClassName}
            type="text"
            placeholder="Texto visible"
            value={filterDraft.patient}
            onChange={(event) => updateFilterDraft("patient", event.target.value)}
          />
        </FilterField>
        <FilterField label="Estado" density={density} labelHidden={!mobile}>
          <Select
            className={controlClassName}
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
          </Select>
        </FilterField>
        <FilterField label="Estudio" density={density} labelHidden={!mobile}>
          <Input
            className={controlClassName}
            type="text"
            placeholder="Tipo visible"
            value={filterDraft.study}
            onChange={(event) => updateFilterDraft("study", event.target.value)}
          />
        </FilterField>
        <FilterField label="Archivo" density={density} labelHidden={!mobile}>
          <Input
            className={controlClassName}
            type="text"
            placeholder="Nombre"
            value={filterDraft.file}
            onChange={(event) => updateFilterDraft("file", event.target.value)}
          />
        </FilterField>
        <FilterField label="Desde" density={density} labelHidden={!mobile}>
          <Input
            className={controlClassName}
            type="date"
            value={filterDraft.from}
            onChange={(event) => updateFilterDraft("from", event.target.value)}
          />
        </FilterField>
        <FilterField label="Hasta" density={density} labelHidden={!mobile}>
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
    <Card className="dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b border-vetneb-line/70 px-4 py-3 md:py-1">
        <div className="min-w-0">
          <CardTitle className="text-xl leading-tight md:text-base">Informes</CardTitle>
          <p className="mt-0 text-xs text-muted-foreground">
            Cola administrativa, trazabilidad y documentos en una sola vista.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs md:h-7 md:px-2"
            onClick={() => void loadReports()}
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

      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-3 pt-2 md:gap-1 md:pb-1 md:pt-1">
        <div
          data-admin-reports-toolbar="true"
          className="flex min-h-8 shrink-0 items-center justify-between gap-2 rounded-md border border-vetneb-line/65 bg-vetneb-surface-raised/45 px-2.5 text-xs text-muted-foreground md:min-h-7"
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
              ? `${filteredReports.length} filtrados`
              : `${filteredReports.length} en página`}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hidden tabular-nums md:inline">
              {hasActiveFilters ? "Filtros activos" : `Página ${page}`}
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
          <div
            ref={setDesktopBodyNode}
            className="dashboard-table-responsive hidden min-h-0 flex-1 md:block"
          >
            {filteredReports.length ? (
              <Table className="table-fixed text-xs [&_th]:h-7 [&_th]:px-2 [&_td]:px-2">
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
                  {filteredReports.map((report, index) => (
                    <TableRow
                      key={report.id}
                      ref={index === 0 ? setDesktopRowNode : undefined}
                    >
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
            <div
              ref={setMobileBodyNode}
              className="min-h-0 flex-1 divide-y divide-vetneb-line/60 overflow-hidden rounded-md border border-vetneb-line/75"
              data-admin-reports-mobile-list="true"
            >
              {filteredReports.length ? (
                filteredReports.map((report, index) => (
                  <div
                    key={report.id}
                    ref={index === 0 ? setMobileRowNode : undefined}
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
                ))
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

            {filteredReports.length || hasPrev ? (
              <div
                className="flex shrink-0 items-center justify-center gap-1.5 border-t border-vetneb-line/65 pt-1.5 text-xs text-muted-foreground"
                data-admin-mobile-core-pager="true"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2.5 text-xs"
                  disabled={!hasPrev || isLoading}
                  onClick={goToPreviousPage}
                  aria-label="Página anterior"
                >
                  Anterior
                </Button>
                <span className="min-w-12 text-center">Pág. {page}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2.5 text-xs"
                  disabled={!hasNext || isLoading}
                  onClick={goToNextPage}
                  aria-label="Página siguiente"
                >
                  Siguiente
                </Button>
              </div>
            ) : null}
          </div>

          <nav
            className="mt-2 hidden min-h-10 shrink-0 items-center justify-between gap-2 border-t border-vetneb-line/65 px-1 pt-2 text-xs text-muted-foreground md:mt-0.5 md:flex md:min-h-7 md:pt-0.5"
            aria-label="Paginación de informes admin"
          >
            <span>
              {filteredReports.length ? `${rangeStart}–${rangeEnd}` : "0 resultados"} · {effectiveLimit} por página
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 md:h-7 md:w-7"
                disabled={!hasPrev || isLoading}
                onClick={goToPreviousPage}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <span className="min-w-16 text-center">Página {page}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 md:h-7 md:w-7"
                disabled={!hasNext || isLoading}
                onClick={goToNextPage}
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
