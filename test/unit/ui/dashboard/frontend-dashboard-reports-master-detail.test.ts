import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  assertClean7aDependencyCleanupInvariants,
} from "../../../helpers/clean7a-dependency-cleanup-scope.ts";

const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";
const INFORMES_LIST_PATH =
  "frontend/src/app/dashboard/informes/InformesReportsList.tsx";
const INFORMES_ACTIONS_PATH =
  "frontend/src/app/dashboard/informes/informes.actions.ts";
const STUDY_TIMELINE_PATH =
  "frontend/src/components/dashboard/StudyTimeline.tsx";
const STICKY_ACTION_BAR_PATH =
  "frontend/src/components/dashboard/StickyActionBar.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function assertNoForbiddenSurfaceImports(source: string, context: string): void {
  const importLines = source
    .split("\n")
    .filter((line) => line.trim().startsWith("import "));
  const forbiddenPatterns = [
    /@\/app\/api/,
    /@\/middleware/,
    /@\/lib\/auth/,
    /@\/components\/public/,
    /\.\.\/.*\/auth/,
    /\.\.\/.*\/middleware/,
    /\.\.\/.*\/public/,
  ];

  for (const line of importLines) {
    for (const pattern of forbiddenPatterns) {
      assert.equal(
        pattern.test(line),
        false,
        `${context} must not import forbidden surface via: ${line}`,
      );
    }
  }
}

test("StudyTimeline supports ordered visual states without business calculations", () => {
  const source = read(STUDY_TIMELINE_PATH);

  assert.ok(source.includes("export type StudyTimelineStep = {"));
  assert.ok(source.includes("steps: StudyTimelineStep[];"));
  assert.ok(source.includes("ariaLabel?: string;"));
  assert.ok(source.includes('ariaLabel = "Línea de tiempo del estudio"'));
  assert.ok(source.includes('"completed"'));
  assert.ok(source.includes('"current"'));
  assert.ok(source.includes('"pending"'));
  assert.ok(source.includes('"warning"'));
  assert.ok(source.includes('"error"'));
  assert.ok(source.includes("const TIMELINE_STATUS_CONFIG = {"));
  assert.ok(source.includes("completed: {"));
  assert.ok(source.includes("current: {"));
  assert.ok(source.includes("pending: {"));
  assert.ok(source.includes("warning: {"));
  assert.ok(source.includes("error: {"));
  assert.ok(source.includes("icon: CheckCircle2"));
  assert.ok(source.includes("icon: LoaderCircle"));
  assert.ok(source.includes("icon: Clock3"));
  assert.ok(source.includes("icon: AlertTriangle"));
  assert.ok(source.includes("icon: XCircle"));
  assert.ok(source.includes("{config.label}"));
  assert.ok(source.includes('<span className="sr-only">Estado: </span>'));
  assert.ok(source.includes('aria-current={step.status === "current" ? "step" : undefined}'));
  assert.ok(source.includes("aria-label={`${step.label}. Estado: ${config.label}. Fecha: ${"));
  assert.ok(source.includes('{step.date ?? "Pendiente"}'));
  assert.ok(source.includes("steps.map((step, index) =>"));
  assert.ok(source.includes("data-timeline-status={step.status}"));
  assert.equal(source.includes("formatDate("), false);
  assert.equal(source.includes("getReports"), false);
  assert.equal(source.includes("fetch("), false);
});

test("dashboard informes composes profile-layout list, selected report detail, timeline, and actions", () => {
  const pageSource = read(INFORMES_PAGE_PATH);
  const listSource = read(INFORMES_LIST_PATH);

  assert.ok(pageSource.includes("<DashboardPageHeader"));
  assert.equal(pageSource.includes("<StickyActionBar"), false);
  assert.equal(listSource.includes("<StickyActionBar"), false);
  assert.ok(listSource.includes("Lista de informes"));
  assert.ok(listSource.includes("Detalle del informe"));
  assert.ok(listSource.includes("<StudyTimeline steps={selectedReportTimelineSteps} />"));
  assert.ok(listSource.includes("buildStudyTimelineSteps(selectedReport)"));
  assert.ok(listSource.includes("const selectedReport ="));
  assert.ok(listSource.includes("selectedReportId === null"));
  assert.ok(listSource.includes("? (reports[0] ?? null)"));
  assert.ok(listSource.includes(": (reports.find((report) => report.id === selectedReportId) ?? null)"));
  assert.ok(listSource.includes("result.reports.some((report) => report.id === current)"));
  assert.ok(listSource.includes(": (result.reports[0]?.id ?? null)"));
  assert.ok(listSource.includes('id="reports-master-list"'));
  assert.ok(listSource.includes('id="report-detail"'));
  assert.ok(listSource.includes("Línea de tiempo del estudio"));
  assert.ok(listSource.includes("Pasos derivados del estado y fechas ya disponibles."));
  assert.ok(listSource.includes("reportId={selectedReport.id}"));
  assert.ok(listSource.includes("hasFile={selectedReport.hasFile}"));
});

test("dashboard informes derives timeline steps from existing report fields only", () => {
  const source = read(INFORMES_LIST_PATH);

  assert.ok(source.includes("function buildStudyTimelineSteps(report: Report): StudyTimelineStep[]"));
  assert.ok(source.includes("const currentStatus = report.currentStatus ?? report.status;"));
  assert.ok(source.includes("const uploadedDate = report.uploadDate ?? report.createdAt;"));
  assert.ok(source.includes("const updatedDate = report.updatedAt;"));
  assert.ok(source.includes('id: "uploaded"'));
  assert.ok(source.includes('id: "processing"'));
  assert.ok(source.includes('id: "ready"'));
  assert.ok(source.includes('id: "delivered"'));
  assert.ok(source.includes("formatDate(uploadedDate)"));
  assert.ok(source.includes("formatDate(updatedDate)"));
  assert.equal(source.includes("estimatedDeliveryAt"), false);
  assert.equal(source.includes("new Date("), false);
});

test("dashboard informes server-side pagination controls and compact summary", () => {
  const source = read(INFORMES_LIST_PATH);
  const constantsSource = read(
    "frontend/src/app/dashboard/informes/informes.constants.ts",
  );

  // R-07: pager stays visible at all times (no `> 1` gate), matching the
  // server-adaptive contract already proven on Admin Audit/Reports (R-03/R-06).
  assert.equal(source.includes("reportsTotalPages > 1"), false);
  assert.ok(source.includes('aria-label="Paginación de informes"'));
  assert.ok(source.includes('aria-label="Página anterior"'));
  assert.ok(source.includes('aria-label="Página siguiente"'));
  assert.ok(source.includes("Página {page} de {reportsTotalPages}"));
  assert.ok(source.includes("{totalCount > 0 ? `${pageStart}-${pageEnd}` : \"0\"}"));
  assert.ok(constantsSource.includes("export const INFORMES_FALLBACK_ROWS = 6"));
  assert.ok(source.includes("goToPreviousPage"));
  assert.ok(source.includes("goToNextPage"));
  assert.ok(source.includes("disabled={page <= 1}"));
  assert.ok(source.includes("disabled={page >= reportsTotalPages}"));
});

test("dashboard informes pagination is server-adaptive and does not use client-side array filtering", () => {
  const source = read(INFORMES_LIST_PATH);

  assert.ok(source.includes("useDashboardCanvasCapacity"));
  assert.ok(source.includes("effectiveLimit = rowsPerPage"));
  assert.ok(source.includes("function normalizeOffsetForLimit("));
  assert.ok(source.includes("const [requestWindow, setRequestWindow] = useState({"));
  assert.ok(source.includes("if (current.limit === effectiveLimit)"));
  assert.ok(source.includes("pageSize: requestWindow.limit"));
  assert.ok(source.includes("offset: requestWindow.offset"));
  assert.ok(source.includes("Math.floor(query.offset / query.pageSize) + 1"));
  assert.equal(source.includes("previousLimitRef"), false);
  assert.equal(source.includes("setOffset("), false);
  assert.ok(source.includes("getInformesPage("));
  // Pagination itself must stay server-driven (page/pageSize/offset via
  // getInformesPage): no offset-based client slice may stand in for it.
  assert.equal(source.includes("reports.slice(offset"), false);
  assert.equal(source.includes("reports.filter("), false);
  // The one allowed client-side trim caps the already-fetched page at the
  // measured canvas capacity (always from index 0, never offset-derived) so
  // the corrective re-fetch's network latency can't render more rows than
  // the container actually fits.
  assert.ok(source.includes("reports.slice(0, effectiveLimit)"));
});

test("dashboard informes reportId null selects first report by default without silent fallback", () => {
  const source = read(INFORMES_LIST_PATH);

  assert.ok(source.includes("selectedReportId === null"));
  assert.ok(source.includes("? (reports[0] ?? null)"));
  assert.ok(source.includes(": (reports.find((report) => report.id === selectedReportId) ?? null)"));
  assert.equal(source.includes("?? reports[0] ?? null"), false);
});

test("dashboard informes master-detail preserves navigation and CLEAN7A dependency invariants", () => {
  const informesSource = read(INFORMES_PAGE_PATH);
  const informesListSource = read(INFORMES_LIST_PATH);
  const informesActionsSource = read(INFORMES_ACTIONS_PATH);
  const timelineSource = read(STUDY_TIMELINE_PATH);
  const stickyActionBarSource = read(STICKY_ACTION_BAR_PATH);

  assertNoForbiddenSurfaceImports(informesListSource, "InformesReportsList");
  assertNoForbiddenSurfaceImports(informesActionsSource, "informes.actions");
  assertNoForbiddenSurfaceImports(timelineSource, "StudyTimeline");
  assertNoForbiddenSurfaceImports(stickyActionBarSource, "StickyActionBar");
  assert.equal(informesSource.includes('from "next/link"'), false);
  assert.equal(informesListSource.includes('from "next/link"'), false);
  assert.equal(timelineSource.includes('from "next/link"'), false);
  assert.equal(stickyActionBarSource.includes('from "next/link"'), false);
  assert.equal(informesSource.includes("<a"), false);
  assert.equal(informesListSource.includes("<a"), false);
  assert.equal(timelineSource.includes("<a"), false);
  assert.equal(stickyActionBarSource.includes("<a"), false);
  assertClean7aDependencyCleanupInvariants();
});
