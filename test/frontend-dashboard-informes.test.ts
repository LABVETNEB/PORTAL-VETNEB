import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";
const API_CLIENT_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard informes defines non-indexable metadata and clinic read dependencies", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('import { getReports, searchReports } from "@/lib/api";'));
  assert.ok(source.includes('title: "Informes — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  assert.ok(source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'));
  assert.ok(source.includes('import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";'));
  assert.ok(source.includes('import { MasterDetailWorkspace } from "@/components/dashboard/MasterDetailWorkspace";'));
  assert.ok(source.includes('import { StatusBadge } from "@/components/dashboard/StatusBadge";'));
  assert.ok(source.includes('} from "@/components/dashboard/StickyActionBar";'));
  assert.ok(source.includes('} from "@/components/dashboard/StudyTimeline";'));
  assert.ok(source.includes('import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";'));
  assert.equal(source.includes("UploadReportModal"), false);
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
  assert.ok(source.includes("reports = query"));
  assert.ok(source.includes("? await searchReports("));
  assert.ok(source.includes("query,"));
  assert.ok(source.includes("status: status || undefined,"));
  assert.ok(source.includes(": await getReports("));
  assert.ok(source.includes("{ throwOnError: true }"));
});

test("dashboard informes preserves request options with forwarded cookies and no-store reads", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes("async function getReportsRequestOptions(): Promise<RequestInit>"));
  assert.ok(source.includes("const cookieHeader = (await cookies()).toString();"));
  assert.ok(source.includes('cache: "no-store"'));
  assert.ok(source.includes("headers: cookieHeader ? { Cookie: cookieHeader } : {},"));
  assert.ok(source.includes("const requestOptions = await getReportsRequestOptions();"));
  assert.ok(source.includes("requestOptions,"));
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

test("dashboard informes renders clinic reports surface without technical source copy", () => {
  const source = read(INFORMES_PAGE_PATH);
  const removedSourceCopy = "Lectura clinic-" + "scoped conectada a";
  const removedReportsEndpoint = "GET " + "/api/reports";

  assert.ok(source.includes('title="Informes"'));
  assert.ok(source.includes('subtitle="Consulta de informes médicos veterinarios"'));
  assert.ok(source.includes('notifications="clinic"'));
  assert.ok(source.includes("<DashboardPageHeader"));
  assert.ok(source.includes("<StickyActionBar"));
  assert.ok(source.includes("<MasterDetailWorkspace"));
  assert.ok(source.includes("<StudyTimeline"));
  assert.equal(source.includes("<UploadReportModal />"), false);
  assert.equal(source.includes("/api/admin"), false);
  assert.equal(source.includes(removedSourceCopy), false);
  assert.equal(source.includes(removedReportsEndpoint), false);
});

test("dashboard informes renders filters and reports table columns", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes('<form method="get"'));
  assert.ok(source.includes('placeholder="Buscar por paciente o tipo de estudio..."'));
  assert.ok(source.includes('name="query"'));
  assert.ok(source.includes("defaultValue={query}"));
  assert.ok(source.includes('aria-label="Buscar informes"'));
  assert.ok(source.includes('name="status"'));
  assert.ok(source.includes("defaultValue={status}"));
  assert.ok(source.includes('aria-label="Filtrar por estado"'));
  assert.ok(source.includes("<Button type=\"submit\" size=\"sm\">"));
  assert.ok(source.includes("Filtrar"));
  assert.ok(source.includes('href="/dashboard/informes"'));
  assert.ok(source.includes("Limpiar"));
  assert.ok(source.includes('id="reports-master-list"'));
  assert.ok(source.includes('id="report-detail"'));
  assert.ok(source.includes("<TableHead>ID</TableHead>"));
  assert.ok(source.includes("<TableHead>Paciente</TableHead>"));
  assert.ok(source.includes("<TableHead>Tipo de estudio</TableHead>"));
  assert.ok(source.includes("<TableHead>Clínica</TableHead>"));
  assert.ok(source.includes("<TableHead>Fecha</TableHead>"));
  assert.ok(source.includes("<TableHead>Estado</TableHead>"));
  assert.ok(source.includes('<TableHead className="text-right">Acciones</TableHead>'));
});

test("dashboard informes keeps row rendering badges dates and report actions", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes("reports.map((report) =>"));
  assert.ok(source.includes("const isSelected = selectedReport?.id === report.id;"));
  assert.ok(source.includes('report.patientName ?? "—"'));
  assert.ok(source.includes('report.studyType ?? "—"'));
  assert.ok(source.includes("report.clinicName ?? `Clínica #${report.clinicId}`"));
  assert.ok(source.includes("formatDate(report.uploadDate)"));
  assert.ok(source.includes("getReportStatusVariant(report.status)"));
  assert.ok(source.includes("getReportStatusLabel(report.status)"));
  assert.ok(source.includes("<ReportFileActions"));
  assert.ok(source.includes("reportId={report.id}"));
  assert.ok(source.includes("hasFile={report.hasFile}"));
  assert.ok(source.includes("reportId={selectedReport.id}"));
  assert.ok(source.includes("hasFile={selectedReport.hasFile}"));
  assert.equal(source.includes("storagePath"), false);
});

test("dashboard informes keeps empty state and avoids client-side fetch literals", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes("No hay informes disponibles."));
  assert.ok(source.includes("<EmptyState"));
  assert.ok(source.includes("colSpan={7}"));
  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("mock"), false);
});

test("dashboard informes separates fetch failures from real empty report lists", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes("let reports: Awaited<ReturnType<typeof getReports>> = [];"));
  assert.ok(source.includes("let reportsLoadError = false;"));
  assert.ok(source.includes("try {"));
  assert.ok(source.includes("reportsLoadError = true;"));
  assert.ok(source.includes("reportsLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar los informes. Intente nuevamente."));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes(": reports.length ?"));
  assert.ok(source.includes("No hay informes disponibles."));
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
