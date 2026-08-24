import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";
const INFORMES_LIST_PATH =
  "frontend/src/app/dashboard/informes/InformesReportsList.tsx";
const INFORMES_ACTIONS_PATH =
  "frontend/src/app/dashboard/informes/informes.actions.ts";
const API_CLIENT_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard informes defines non-indexable metadata and clinic read dependencies", () => {
  const source = read(INFORMES_PAGE_PATH);
  const listSource = read(INFORMES_LIST_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('getReportsPaginated,'));
  assert.ok(source.includes('searchReportsPaginated,'));
  assert.ok(source.includes('"@/lib/api"'));
  assert.ok(source.includes('title: "Informes — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  // B10: the shell chrome (topbar + navigation frame + main) has one owner for
  // all six clinic routes, so the route imports the shell, not the topbar.
  assert.ok(source.includes('import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";'));
  assert.equal(
    source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'),
    false,
  );
  assert.ok(source.includes('import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";'));
  assert.ok(source.includes('import { StatusBadge } from "@/components/dashboard/StatusBadge";'));
  assert.equal(source.includes('} from "@/components/dashboard/StickyActionBar";'), false);
  assert.ok(listSource.includes('} from "@/components/dashboard/StudyTimeline";'));
  assert.ok(listSource.includes('import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";'));
  assert.equal(source.includes("UploadReportModal"), false);
});

test("dashboard informes page imports and renders the split InformesReportsList client component", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(
    source.includes(
      'import { InformesReportsList } from "./InformesReportsList";',
    ),
  );
  assert.ok(source.includes("<InformesReportsList"));
  assert.ok(source.includes("filters={{ query, status, studyType }}"));
  assert.ok(source.includes("initialReports={reports}"));
  assert.ok(source.includes("initialTotal={pagedResult.total}"));
  assert.ok(source.includes("initialPage={pagedResult.page}"));
  assert.ok(source.includes("initialPageSize={pagedResult.pageSize}"));
  assert.ok(source.includes("initialLoadError={reportsLoadError}"));
  assert.ok(source.includes("initialSelectedReportId={selectedReportId}"));
});

test("dashboard informes reads filters from searchParams and uses live search endpoint", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes("type InformesPageSearchParams = {"));
  assert.ok(source.includes("query?: string | string[];"));
  assert.ok(source.includes("status?: string | string[];"));
  assert.ok(source.includes("reportId?: string | string[];"));
  assert.ok(source.includes("searchParams?: Promise<InformesPageSearchParams>;"));
  assert.ok(source.includes("const resolvedSearchParams = (await searchParams) ?? {};"));
  assert.ok(source.includes("const query = normalizeSearchParamValue(resolvedSearchParams.query).trim();"));
  assert.ok(source.includes("const status = normalizeStatusFilter("));
  assert.ok(source.includes("const selectedReportId = normalizeReportIdFilter("));
  assert.ok(source.includes("pagedResult = query"));
  assert.ok(source.includes("? await searchReportsPaginated("));
  assert.ok(source.includes("query,"));
  assert.ok(source.includes("status: status || undefined,"));
  assert.ok(source.includes(": await getReportsPaginated("));
  assert.ok(source.includes("{ throwOnError: true }"));
});

test("dashboard informes preserves request options with forwarded cookies and no-store reads", () => {
  const source = read(INFORMES_PAGE_PATH);
  const actionsSource = read(INFORMES_ACTIONS_PATH);

  assert.ok(source.includes("async function getReportsRequestOptions(): Promise<RequestInit>"));
  assert.ok(source.includes("const cookieHeader = (await cookies()).toString();"));
  assert.ok(source.includes('cache: "no-store"'));
  assert.ok(source.includes("headers: cookieHeader ? { Cookie: cookieHeader } : {},"));
  assert.ok(source.includes("const requestOptions = await getReportsRequestOptions();"));
  assert.ok(source.includes("requestOptions,"));

  // The client-driven re-fetch (RF debounced pagination) goes through its own
  // server action, which forwards cookies the same way for every re-fetch.
  assert.ok(actionsSource.includes('"use server";'));
  assert.ok(actionsSource.includes("async function getInformesRequestOptions(): Promise<RequestInit>"));
  assert.ok(actionsSource.includes("const cookieHeader = (await cookies()).toString();"));
  assert.ok(actionsSource.includes('cache: "no-store"'));
});

test("dashboard informes keeps status filter options aligned to report statuses", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes("const statusOptions = ["));
  assert.ok(source.includes('{ value: "", label: "Todos los estados" }'));
  assert.ok(source.includes('{ value: "uploaded", label: "Subido" }'));
  assert.ok(source.includes('{ value: "processing", label: "Procesando" }'));
  assert.ok(source.includes('{ value: "ready", label: "Listo" }'));
  assert.ok(source.includes('{ value: "delivered", label: "Entregado" }'));
});

test("dashboard informes renders profile-layout clinic reports surface without technical source copy", () => {
  const source = read(INFORMES_PAGE_PATH);
  const listSource = read(INFORMES_LIST_PATH);
  const removedSourceCopy = "Lectura clinic-" + "scoped conectada a";
  const removedReportsEndpoint = "GET " + "/api/reports";

  assert.ok(source.includes('title="Informes"'));
  assert.ok(source.includes('subtitle="Consulta de informes médicos veterinarios"'));
  assert.ok(source.includes('<ClinicDashboardShell'));
  // B10: the clinic notification role is declared once, by the shared shell.
  assert.equal(source.includes('notifications="clinic"'), false);
  assert.ok(source.includes("<DashboardPageHeader"));
  assert.equal(source.includes("<StickyActionBar"), false);
  assert.ok(listSource.includes("Lista de informes"));
  assert.ok(listSource.includes("Detalle del informe"));
  assert.ok(listSource.includes("<StudyTimeline"));
  assert.equal(source.includes("<UploadReportModal />"), false);
  assert.equal(source.includes("/api/admin"), false);
  assert.equal(source.includes(removedSourceCopy), false);
  assert.equal(source.includes(removedReportsEndpoint), false);
});

test("dashboard informes renders compact inline filters and profile-layout list/detail columns", () => {
  const source = read(INFORMES_PAGE_PATH);
  const listSource = read(INFORMES_LIST_PATH);

  assert.ok(source.includes('import {\n  dashboardFilterActionClassName,'));
  assert.ok(source.includes("FilterBar,"));
  assert.ok(source.includes("FilterField,"));
  assert.ok(source.includes("<FilterBar"));
  assert.ok(source.includes('method="get"'));
  assert.ok(source.includes('placeholder="Buscar por paciente o tipo de estudio..."'));
  assert.ok(source.includes('name="query"'));
  assert.ok(source.includes("defaultValue={query}"));
  assert.ok(source.includes('aria-label="Buscar informes"'));
  assert.ok(source.includes('name="status"'));
  assert.ok(source.includes("defaultValue={status}"));
  assert.ok(source.includes('aria-label="Filtrar por estado"'));
  assert.ok(source.includes('<FilterField label="Estado">'));
  assert.ok(source.includes('<Button type="submit" size="sm" className={dashboardFilterActionClassName()}>'));
  assert.ok(source.includes("Filtrar"));
  assert.ok(source.includes('href="/dashboard/informes"'));
  assert.ok(source.includes("Limpiar"));
  assert.ok(listSource.includes('id="reports-master-list"'));
  assert.ok(listSource.includes('id="report-detail"'));
  assert.ok(listSource.includes("Lista de informes"));
  assert.ok(listSource.includes("Detalle del informe"));
  assert.equal(listSource.includes("<TableHead>"), false);
});

test("dashboard informes keeps list rendering badges dates and selected report actions", () => {
  const source = read(INFORMES_LIST_PATH);

  assert.ok(source.includes("visibleReports.map((report, index) =>"));
  assert.ok(source.includes("const isSelected = selectedReport?.id === report.id;"));
  assert.ok(source.includes('report.patientName ?? "Paciente sin nombre"'));
  assert.ok(source.includes('report.studyType ?? "Tipo sin registrar"'));
  assert.ok(source.includes("formatDate(report.uploadDate)"));
  assert.ok(source.includes("getReportStatusVariant(report.status)"));
  assert.ok(source.includes("getReportStatusLabel(report.status)"));
  assert.ok(source.includes("id={`report-${report.id}`}"));
  assert.ok(source.includes("<ReportFileActions"));
  assert.ok(source.includes("reportId={selectedReport.id}"));
  assert.ok(source.includes("hasFile={selectedReport.hasFile}"));
  assert.equal(source.includes("storagePath"), false);
});

test("dashboard informes keeps empty state and avoids client-side fetch literals", () => {
  const pageSource = read(INFORMES_PAGE_PATH);
  const listSource = read(INFORMES_LIST_PATH);
  const actionsSource = read(INFORMES_ACTIONS_PATH);

  assert.ok(listSource.includes("No hay informes disponibles."));
  assert.ok(listSource.includes("<EmptyState"));
  assert.equal(listSource.includes("colSpan={7}"), false);
  assert.equal(pageSource.includes("fetch("), false);
  assert.equal(listSource.includes("fetch("), false);
  assert.equal(actionsSource.includes("fetch("), false);
  assert.equal(pageSource.includes("mock"), false);
  assert.equal(listSource.includes("mock"), false);
});

test("dashboard informes separates fetch failures from real empty report lists", () => {
  const source = read(INFORMES_PAGE_PATH);
  const listSource = read(INFORMES_LIST_PATH);

  assert.ok(source.includes("let pagedResult: PaginatedReports = {"));
  assert.ok(source.includes("let reportsLoadError = false;"));
  assert.ok(source.includes("try {"));
  assert.ok(source.includes("reportsLoadError = true;"));
  assert.ok(listSource.includes("loadError ?"));
  assert.ok(listSource.includes("No se pudieron cargar los informes"));
  assert.ok(listSource.includes("<ErrorState"));
  assert.ok(listSource.includes("reports.length > 0 ?"));
  assert.ok(listSource.includes("No hay informes disponibles."));
});

test("dashboard informes page includes back navigation to modules hub", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes("href={ROUTES.dashboard}"));
  assert.ok(source.includes("Volver a m&oacute;dulos"));
  assert.ok(!source.includes("module=informes"));
  assert.ok(source.includes("Volver"));
  assert.ok(source.includes('aria-label="Volver al dashboard"'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
});

test("dashboard informes filter form includes studyType input to preserve it on submit", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes('name="studyType"'));
  assert.ok(source.includes("defaultValue={studyType}"));
  assert.ok(source.includes('aria-label="Filtrar por tipo de estudio"'));
  assert.ok(source.includes('placeholder="Filtrar por tipo de estudio..."'));
});

test("dashboard informes pagination buttons carry dashboard-pagination-btn accessibility class", () => {
  const source = read(INFORMES_LIST_PATH);

  // dashboard-pagination-btn is the PR-8 a11y marker: disabled state gets
  // pointer-events:none + opacity:0.45 + cursor:not-allowed via globals.css
  const occurrences = (source.match(/dashboard-pagination-btn/g) ?? []).length;
  assert.ok(
    occurrences >= 2,
    `dashboard-pagination-btn must appear on both Anterior and Siguiente buttons (found ${occurrences})`,
  );
});

test("dashboard informes server-adaptive viewport pagination contract (R-07)", () => {
  const listSource = read(INFORMES_LIST_PATH);
  const actionsSource = read(INFORMES_ACTIONS_PATH);
  const constantsSource = read(
    "frontend/src/app/dashboard/informes/informes.constants.ts",
  );

  assert.ok(listSource.includes('"use client";'));
  assert.ok(listSource.includes("useDashboardCanvasCapacity"));
  assert.ok(listSource.includes("canvasNode: bodyNode,"));
  assert.ok(listSource.includes('data-dashboard-row-pitch="card"'));
  assert.equal(listSource.includes("cancelAnimationFrame("), false);
  assert.equal(listSource.includes("observer.disconnect();"), false);
  // The fallback/cap constants must live in a plain (non "use client")
  // module: Next.js turns every named export of a client module into an
  // opaque client reference, so a Server Component importing a numeric
  // constant straight from a "use client" file receives a reference, not
  // the value (this broke the initial offset math as `NaN` during R-07
  // development — verified live before extracting this module).
  assert.equal(constantsSource.includes('"use client"'), false);
  assert.ok(constantsSource.includes("export const INFORMES_FALLBACK_ROWS = 6;"));
  assert.ok(constantsSource.includes("export const INFORMES_LIMIT_CAP = 24;"));
  assert.ok(listSource.includes("const desiredQueryRef = useRef<InformesPageQuery>(query);"));
  assert.ok(listSource.includes("const satisfiedQueryKeyRef = useRef(queryKey);"));
  assert.ok(listSource.includes("const requestInFlightRef = useRef(false);"));
  assert.ok(listSource.includes("requestInFlightRef.current = true;"));
  assert.ok(listSource.includes("nextQueryKey !== desiredQueryKeyRef.current"));
  assert.equal(listSource.includes("latestRequestRef"), false);
  assert.equal(listSource.includes("matchMedia"), false);

  assert.ok(actionsSource.includes("export async function getInformesPage("));
  assert.ok(actionsSource.includes("redirectToLoginOnUnauthorized(error)"));
});

test("api client supports reports status filter without bypassing wrappers", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function getReports("));
  assert.ok(source.includes("params?: {"));
  assert.ok(source.includes("status?: string;"));
  assert.ok(source.includes("limit?: number;"));
  assert.ok(source.includes("offset?: number;"));
  assert.ok(source.includes('query.set("status", params.status.trim());'));
  assert.ok(source.includes("`/api/reports${qs ? `?${qs}` : \"\"}`"));
  assert.ok(source.includes('export async function searchReports('));
  assert.ok(source.includes("throwOnError?: boolean;"));
});
