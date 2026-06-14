import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const REPORT_ACTIONS_PATH =
  "frontend/src/components/dashboard/ReportDownloadButton.tsx";
const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend report actions component exists and uses preview/download APIs", () => {
  assert.equal(existsSync(resolve(process.cwd(), REPORT_ACTIONS_PATH)), true);

  const source = read(REPORT_ACTIONS_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("getReportDownloadUrl, getReportPreviewUrl"));
  assert.ok(source.includes('import { Download, Eye } from "lucide-react";'));
  assert.ok(source.includes("export function ReportFileActions("));
  assert.ok(source.includes('await getReportPreviewUrl(reportId, { scope })'));
  assert.ok(source.includes('await getReportDownloadUrl(reportId, { scope })'));
  assert.ok(source.includes('window.open(url, "_blank", "noopener,noreferrer");'));
});

test("frontend report actions handles unavailable loading and error states", () => {
  const source = read(REPORT_ACTIONS_PATH);

  assert.ok(source.includes("const [loadingAction, setLoadingAction]"));
  assert.ok(source.includes("const [errorMessage, setErrorMessage]"));
  assert.ok(source.includes('reportId: number | null;'));
  assert.ok(source.includes('hasFile?: boolean;'));
  assert.ok(source.includes('scope?: "clinic" | "admin";'));
  assert.ok(source.includes("Informe no disponible para visualizar."));
  assert.ok(source.includes("Informe no disponible para descarga."));
  assert.ok(source.includes("Archivo no disponible."));
  assert.ok(source.includes('role="alert"'));
  assert.equal(source.includes("sin permiso"), false);
  assert.equal(source.includes("No autorizado"), false);
});

test("frontend informes page uses report file actions", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(
    source.includes(
      'import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";',
    ),
  );
  assert.ok(source.includes("<ReportFileActions"));
  assert.ok(source.includes("reportId={report.id}"));
  assert.ok(source.includes("hasFile={report.hasFile}"));
  assert.equal(source.includes("storagePath"), false);
  assert.equal(source.includes("<button"), false);
});
