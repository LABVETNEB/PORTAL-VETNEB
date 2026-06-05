import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";
const MASTER_DETAIL_WORKSPACE_PATH =
  "frontend/src/components/dashboard/MasterDetailWorkspace.tsx";
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

test("MasterDetailWorkspace keeps reusable two-panel layout contract", () => {
  const source = read(MASTER_DETAIL_WORKSPACE_PATH);

  assert.ok(source.includes("export type MasterDetailWorkspaceProps = {"));
  assert.ok(source.includes("master: ReactNode;"));
  assert.ok(source.includes("detail: ReactNode;"));
  assert.ok(source.includes("emptyDetail?: ReactNode;"));
  assert.ok(source.includes("selectedId?: string | null;"));
  assert.ok(source.includes("workspaceLabel?: string;"));
  assert.ok(source.includes("masterLabel?: string;"));
  assert.ok(source.includes("detailLabel?: string;"));
  assert.ok(source.includes("className?: string;"));
  assert.ok(source.includes('workspaceLabel = "Workspace maestro detalle"'));
  assert.ok(source.includes('masterLabel = "Panel maestro"'));
  assert.ok(source.includes('detailLabel = "Panel de detalle"'));
  assert.ok(source.includes("aria-label={workspaceLabel}"));
  assert.ok(source.includes("aria-label={masterLabel}"));
  assert.ok(source.includes("aria-label={detailLabel}"));
  assert.ok(source.includes('data-detail-state={hasSelection ? "selected" : "empty"}'));
  assert.ok(source.includes('aria-live="polite"'));
  assert.ok(source.includes("Sin detalle seleccionado"));
  assert.ok(source.includes("xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]"));
  assert.ok(source.includes("overflow-x-hidden"));
  assert.ok(source.includes("xl:max-h-[calc(100vh-13rem)]"));
  assert.ok(source.includes("xl:overflow-y-auto"));
  assert.ok(source.includes("data-selected-id={selectedId ?? undefined}"));
  assert.equal(source.includes("fetch("), false);
});

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

test("dashboard informes composes master-detail, selected report detail, timeline, and sticky actions", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes("<DashboardPageHeader"));
  assert.ok(source.includes("<StickyActionBar"));
  assert.ok(source.includes("<MasterDetailWorkspace"));
  assert.ok(source.includes("<StudyTimeline steps={selectedReportTimelineSteps} />"));
  assert.ok(source.includes("buildStudyTimelineSteps(selectedReport)"));
  assert.ok(source.includes("const selectedReport ="));
  assert.ok(source.includes("reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null"));
  assert.ok(source.includes("const stickyActions = ["));
  assert.ok(source.includes('label: "Lista"'));
  assert.ok(source.includes('href: "#reports-master-list"'));
  assert.ok(source.includes('label: "Detalle"'));
  assert.ok(source.includes('href: "#report-detail"'));
  assert.ok(source.includes('id="reports-master-list"'));
  assert.ok(source.includes('id="report-detail"'));
  assert.ok(source.includes('id="report-actions"'));
  assert.ok(source.includes("Línea de tiempo del estudio"));
  assert.ok(source.includes("Pasos derivados del estado y fechas ya disponibles del informe."));
  assert.ok(source.includes("reportId={selectedReport.id}"));
  assert.ok(source.includes("hasFile={selectedReport.hasFile}"));
  assert.ok(source.includes("reportId={report.id}"));
  assert.ok(source.includes("hasFile={report.hasFile}"));
});

test("dashboard informes derives timeline steps from existing report fields only", () => {
  const source = read(INFORMES_PAGE_PATH);

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

test("dashboard informes master-detail scope avoids forbidden navigation and dependency changes", () => {
  const informesSource = read(INFORMES_PAGE_PATH);
  const masterDetailSource = read(MASTER_DETAIL_WORKSPACE_PATH);
  const timelineSource = read(STUDY_TIMELINE_PATH);
  const stickyActionBarSource = read(STICKY_ACTION_BAR_PATH);
  const packageDiff = execFileSync(
    "git",
    ["diff", "--name-only", "--", "package.json", "pnpm-lock.yaml"],
    { encoding: "utf8" },
  ).trim();

  assertNoForbiddenSurfaceImports(masterDetailSource, "MasterDetailWorkspace");
  assertNoForbiddenSurfaceImports(timelineSource, "StudyTimeline");
  assertNoForbiddenSurfaceImports(stickyActionBarSource, "StickyActionBar");
  assert.equal(informesSource.includes('from "next/link"'), false);
  assert.equal(masterDetailSource.includes('from "next/link"'), false);
  assert.equal(timelineSource.includes('from "next/link"'), false);
  assert.equal(stickyActionBarSource.includes('from "next/link"'), false);
  assert.equal(informesSource.includes("<a"), false);
  assert.equal(masterDetailSource.includes("<a"), false);
  assert.equal(timelineSource.includes("<a"), false);
  assert.equal(stickyActionBarSource.includes("<a"), false);
  assert.equal(packageDiff, "");
});
