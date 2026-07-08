import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const CONTROLLER_PATH =
  "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx";
const CARD_PATH = "frontend/src/app/dashboard/admin/AdminReportsCard.tsx";
const UPLOAD_PATH =
  "frontend/src/app/dashboard/admin/AdminReportsUploadPanel.tsx";
const STATUS_PATH =
  "frontend/src/app/dashboard/admin/AdminReportStatusBadge.tsx";
const GLOBALS_PATH = "frontend/src/app/globals.css";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);

  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);

  return source.slice(startIndex, endIndex);
}

test("Admin Informes preserva el identificador real y monta la consola dedicada", () => {
  const page = read(PAGE_PATH);
  const controller = read(CONTROLLER_PATH);

  assert.ok(page.includes('id="admin-report-upload"'));
  assert.ok(page.includes('import { AdminReportsCard } from "./AdminReportsCard";'));
  assert.ok(page.includes("<AdminReportsCard />"));
  assert.ok(controller.includes('"admin-report-upload": {'));
  assert.ok(controller.includes('title: "Informes"'));
  assert.ok(
    controller.includes(
      'description: "Carga, estado y trazabilidad de informes administrados."',
    ),
  );
});

test("Admin Informes usa paginación server-side adaptativa por viewport (HY cap 36)", () => {
  const card = read(CARD_PATH);

  // R-03: cardinality is measured, not fixed. The legacy PAGE_SIZE=9 survives
  // only as the fallback/desktop floor, renamed; MOBILE_PAGE_SIZE and the
  // matchMedia second pipeline are gone (single collapsed runtime).
  assert.ok(card.includes("const REPORTS_FALLBACK_ROWS = 9;"));
  assert.ok(card.includes("const REPORTS_SUPERSET_CAP = 36;"));
  assert.ok(card.includes("useAdaptiveItemsPerPage"));
  assert.ok(card.includes("const effectiveLimit = rowsPerPage;"));
  assert.equal(card.includes("const PAGE_SIZE = 9;"), false);
  assert.equal(card.includes("const MOBILE_PAGE_SIZE"), false);
  assert.equal(card.includes("window.matchMedia"), false);
  assert.equal(card.includes("isMobileViewport"), false);
  assert.equal(card.includes("loadMobileReports"), false);

  assert.ok(card.includes("getAdminReportWorkflow({"));
  assert.ok(card.includes("limit: query.limit"));
  assert.ok(card.includes("offset: query.offset"));
  assert.ok(card.includes("snapshot.pagination.hasMore"));
  assert.equal(card.includes("slice("), false);
  assert.ok(card.includes('aria-label="Paginación de informes admin"'));
  assert.ok(card.includes("Página anterior"));
  assert.ok(card.includes("Página siguiente"));
});

test("Admin Informes recomputa offset y descarta respuestas viejas (anti-race)", () => {
  const card = read(CARD_PATH);

  // Request-id guard: a stale response whose id is no longer current is dropped.
  assert.ok(card.includes("const latestRequestRef = useRef(0);"));
  assert.ok(card.includes("const requestId = latestRequestRef.current + 1;"));
  assert.ok(card.includes("if (requestId !== latestRequestRef.current) return;"));

  // Offset recompute keeps the same first visible record when the limit
  // changes; no `total` clamp is possible (endpoint exposes none).
  assert.ok(card.includes("const previousLimitRef = useRef(effectiveLimit);"));
  assert.ok(
    card.includes("Math.floor(currentOffset / effectiveLimit) * effectiveLimit"),
  );

  // Desktop keeps the nine-row floor (App Shell contract), mobile floors at one.
  assert.ok(
    card.includes(
      "minItems: isDesktopMeasurement ? REPORTS_FALLBACK_ROWS : 1,",
    ),
  );
});

test("Admin Informes presenta tabla y lista mobile densas con detalle en diálogo", () => {
  const card = read(CARD_PATH);

  for (const marker of [
    "Caso / paciente",
    "Clínica",
    "Estudio",
    "Estado",
    "Fecha",
    "Archivo",
    "Acción",
    "dashboard-table-responsive hidden min-h-0 flex-1 md:block",
    "md:hidden",
    "<ModuleDialog",
    "AdminReportStatusBadge",
  ]) {
    assert.ok(card.includes(marker), `falta contrato visual: ${marker}`);
  }

  assert.equal(card.includes("detalle inline"), false);
  assert.equal(card.includes("dropzone"), false);
});

test("Admin Informes expone barra avanzada para los campos visibles reales", () => {
  const card = read(CARD_PATH);
  const auditFilter = read("frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx");
  const tokensCard = read("frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx");

  assert.ok(card.includes('data-admin-report-upload-filter-bar={mobile ? "advanced-mobile" : "advanced"}'));
  assert.ok(card.includes('"Filtros avanzados de informes"'));
  assert.ok(card.includes("Filtros avanzados de informes mobile"));
  assert.ok(card.includes("Filtrar informes"));
  assert.ok(card.includes('import {\n  dashboardFilterActionClassName,'));
  assert.ok(card.includes("FilterBar,"));
  assert.ok(card.includes("FilterField,"));
  assert.ok(card.includes('const density: FilterBarDensity = mobile ? "comfortable" : "compact";'));
  assert.ok(card.includes("const controlClassName = dashboardFilterControlClassName(density);"));
  assert.ok(card.includes("const buttonClassName = dashboardFilterActionClassName(density);"));
  assert.ok(card.includes("<FilterBar"));
  assert.ok(card.includes('<FilterField label="Estado" density={density} labelHidden={!mobile}>'));
  assert.ok(card.includes("md:min-h-7"));
  assert.ok(card.includes("[&_th]:h-7"));
  assert.ok(card.includes("type AdminReportsFilterState = {"));
  assert.ok(card.includes("report: string;"));
  assert.ok(card.includes("clinic: string;"));
  assert.ok(card.includes("patient: string;"));
  assert.ok(card.includes('status: "" | AdminReportWorkflowStage;'));
  assert.ok(card.includes("study: string;"));
  assert.ok(card.includes("file: string;"));
  assert.ok(card.includes("from: string;"));
  assert.ok(card.includes("to: string;"));

  for (const label of [
    "Informe",
    "Clínica",
    "Paciente",
    "Estado",
    "Estudio",
    "Archivo",
    "Desde",
    "Hasta",
    "Aplicar",
    "Limpiar",
  ]) {
    assert.ok(card.includes(label), `falta filtro visible: ${label}`);
  }

  assert.equal(card.includes("Responsable"), false);
  assert.equal(card.includes("Tutor"), false);
  assert.ok(auditFilter.includes("Desde"));
  assert.ok(tokensCard.includes('data-admin-filter-bar={mobile ? "advanced-mobile" : "advanced"}'));
});

test("Admin Informes filtra sobre datos cargados sin cambiar contrato API", () => {
  const card = read(CARD_PATH);
  const filterBlock = sectionBetween(
    card,
    "function matchesAdminReportFilters(",
    "export function AdminReportsCard()",
  );
  const applyBlock = sectionBetween(
    card,
    "function applyAdvancedFilters(",
    "function clearAdvancedFilters()",
  );
  const clearBlock = sectionBetween(
    card,
    "function clearAdvancedFilters()",
    "function renderAdvancedFilterForm(",
  );
  const apiBlock = sectionBetween(
    card,
    "const loadReports = useCallback(async () => {",
    "// Recompute offset when the effective limit changes",
  );

  assert.ok(filterBlock.includes("const reportDisplay = `Informe #${report.id}`;"));
  assert.ok(filterBlock.includes("const clinicDisplay = report.clinicName || `Clínica #${report.clinicId}`;"));
  assert.ok(filterBlock.includes('const patientDisplay = report.patientName || "Paciente sin registrar";'));
  assert.ok(filterBlock.includes("const studyDisplay = studyLabel(report.studyType);"));
  assert.ok(filterBlock.includes('const fileDisplay = report.fileName || "Sin archivo";'));
  assert.ok(filterBlock.includes("report.workflowStage === filters.status"));
  assert.ok(filterBlock.includes("matchesReportDateRange(report, filters.from, filters.to)"));
  assert.ok(card.includes("return report.uploadDate ?? report.createdAt;"));
  assert.ok(card.includes("const filteredReports = reports.filter((report) =>"));
  // Single collapsed runtime: no second mobile-only filtered list.
  assert.equal(card.includes("filteredMobileReports"), false);
  assert.ok(card.includes("{filteredReports.map((report, index) => ("));

  assert.ok(applyBlock.includes("setAppliedFilters({"));
  assert.ok(applyBlock.includes("report: filterDraft.report.trim(),"));
  assert.ok(applyBlock.includes("clinic: filterDraft.clinic.trim(),"));
  assert.ok(applyBlock.includes("patient: filterDraft.patient.trim(),"));
  assert.ok(applyBlock.includes("status: filterDraft.status,"));
  assert.ok(applyBlock.includes("study: filterDraft.study.trim(),"));
  assert.ok(applyBlock.includes("file: filterDraft.file.trim(),"));
  assert.ok(applyBlock.includes("from: filterDraft.from,"));
  assert.ok(applyBlock.includes("to: filterDraft.to,"));
  // Applying/clearing a filter resets to the first record (offset 0).
  assert.ok(applyBlock.includes("setOffset(0);"));
  assert.equal(applyBlock.includes("setMobilePage(0);"), false);
  assert.ok(clearBlock.includes("setFilterDraft(INITIAL_FILTER_STATE);"));
  assert.ok(clearBlock.includes("setAppliedFilters(INITIAL_FILTER_STATE);"));
  assert.ok(clearBlock.includes("setOffset(0);"));
  // The fetch stays limit/offset only — filters remain client-side (no new
  // server contract, no backend change).
  assert.ok(apiBlock.includes("limit: query.limit"));
  assert.ok(apiBlock.includes("offset: query.offset"));
  assert.equal(apiBlock.includes("search:"), false);
  assert.equal(apiBlock.includes("filters:"), false);
});

test("Admin Informes respeta los límites de densidad y no introduce scroll regional", () => {
  const source = [read(CARD_PATH), read(UPLOAD_PATH), read(STATUS_PATH)].join("\n");

  for (const forbidden of [
    "text-2xl",
    "text-3xl",
    "p-6",
    "p-8",
    "gap-6",
    "gap-8",
    "h-14",
    "h-16",
    "overflow-y-auto",
    "overflow-y-scroll",
    "data-dashboard-scroll-region",
  ]) {
    assert.equal(source.includes(forbidden), false, `token prohibido: ${forbidden}`);
  }

  const globals = read(GLOBALS_PATH);
  assert.match(
    globals,
    /\.dashboard-main\s*\{[\s\S]*?@apply[^;]*overflow-hidden[^;]*;[\s\S]*?\}/,
  );
});

test("la subida compacta conserva campos y evita cargar el catálogo global", () => {
  const upload = read(UPLOAD_PATH);

  assert.ok(upload.includes("<ModuleDialog"));
  assert.ok(upload.includes('type UploadStep = "assignment" | "document";'));
  assert.ok(upload.includes("getAdminClinics({"));
  assert.ok(upload.includes("search: query"));
  assert.ok(upload.includes("limit: CLINIC_RESULT_LIMIT"));
  assert.ok(upload.includes("getAdminParticularTokens({"));
  assert.ok(upload.includes("uploadAdminReport(formData)"));
  assert.ok(upload.includes('formData.append("clinicId"'));
  assert.ok(upload.includes('formData.append("file", file)'));
  assert.ok(upload.includes('formData.append("particularTokenId"'));
  assert.ok(upload.includes('accept="application/pdf"'));
  assert.equal(upload.includes("getAdminUsersRoles"), false);
  assert.equal(upload.includes("Promise.all"), false);
});

test("seguridad de archivos y trazabilidad permanecen bajo contratos admin", () => {
  const source = [read(CARD_PATH), read(UPLOAD_PATH)].join("\n");

  assert.ok(source.includes("updateAdminReportWorkflowStage"));
  assert.ok(source.includes("updateAdminReportSpecialStain"));
  assert.ok(source.includes("<ReportFileActions"));
  assert.ok(source.includes('scope="admin"'));
  assert.equal(source.includes("dangerouslySetInnerHTML"), false);
  assert.equal(source.includes("console.log"), false);
  assert.equal(source.includes("console.info"), false);
  assert.equal(source.includes("downloadUrl"), false);
  assert.equal(source.includes("previewUrl"), false);
  assert.equal(source.includes("fetch("), false);
});
