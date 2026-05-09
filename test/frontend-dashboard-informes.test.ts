import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard informes defines non-indexable metadata and dashboard dependencies", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('title: "Informes — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  assert.ok(source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'));
  assert.ok(source.includes('import { UploadReportModal } from "@/components/dashboard/UploadReportModal";'));
  assert.ok(source.includes('import { ReportDownloadButton } from "@/components/dashboard/ReportDownloadButton";'));
});

test("dashboard informes forwards cookies and disables cache for report reads", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes("async function getReportsRequestOptions(): Promise<RequestInit>"));
  assert.ok(source.includes("const cookieHeader = (await cookies()).toString();"));
  assert.ok(source.includes('cache: "no-store"'));
  assert.ok(source.includes("headers: cookieHeader ? { Cookie: cookieHeader } : {},"));
  assert.ok(source.includes("const reports = await getReports(await getReportsRequestOptions());"));
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

test("dashboard informes renders topbar upload action and read-source notice", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes('title="Informes"'));
  assert.ok(source.includes('subtitle="Gestión de informes médicos veterinarios"'));
  assert.ok(source.includes("<UploadReportModal />"));
  assert.ok(source.includes("Lectura conectada a"));
  assert.ok(source.includes("GET /api/reports"));
});

test("dashboard informes renders filters and reports table columns", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes('placeholder="Buscar por paciente o tipo de estudio..."'));
  assert.ok(source.includes('aria-label="Buscar informes"'));
  assert.ok(source.includes('aria-label="Filtrar por estado"'));
  assert.ok(source.includes("<TableHead>ID</TableHead>"));
  assert.ok(source.includes("<TableHead>Paciente</TableHead>"));
  assert.ok(source.includes("<TableHead>Tipo de estudio</TableHead>"));
  assert.ok(source.includes("<TableHead>Clínica</TableHead>"));
  assert.ok(source.includes("<TableHead>Fecha</TableHead>"));
  assert.ok(source.includes("<TableHead>Estado</TableHead>"));
  assert.ok(source.includes('<TableHead className="text-right">Acciones</TableHead>'));
});

test("dashboard informes keeps row rendering badges dates and download action", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes("reports.map((report) =>"));
  assert.ok(source.includes("report.patientName ?? \"—\""));
  assert.ok(source.includes("report.studyType ?? \"—\""));
  assert.ok(source.includes("report.clinicName ?? `Clínica #${report.clinicId}`"));
  assert.ok(source.includes("formatDate(report.uploadDate)"));
  assert.ok(source.includes("getReportStatusVariant(report.status)"));
  assert.ok(source.includes("getReportStatusLabel(report.status)"));
  assert.ok(source.includes("reportId={report.id}"));
  assert.ok(source.includes("hasStoragePath={Boolean(report.storagePath)}"));
});

test("dashboard informes keeps empty state and avoids client-side fetch literals", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes("No hay informes disponibles."));
  assert.ok(source.includes("colSpan={7}"));
  assert.equal(source.includes("fetch("), false);
});
