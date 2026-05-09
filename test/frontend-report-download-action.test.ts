import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DOWNLOAD_BUTTON_PATH =
  "frontend/src/components/dashboard/ReportDownloadButton.tsx";
const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend report download button exists and uses download url api", () => {
  assert.equal(existsSync(resolve(process.cwd(), DOWNLOAD_BUTTON_PATH)), true);

  const source = read(DOWNLOAD_BUTTON_PATH);

  assert.ok(source.includes('"use client"'));
  assert.ok(source.includes('import { getReportDownloadUrl } from "@/lib/api"'));
  assert.ok(source.includes("async function handleDownload()"));
  assert.ok(source.includes("await getReportDownloadUrl(reportId)"));
  assert.ok(source.includes('window.open(url, "_blank", "noopener,noreferrer")'));
});

test("frontend report download button handles loading unavailable and error states", () => {
  const source = read(DOWNLOAD_BUTTON_PATH);

  assert.ok(source.includes("const [isLoading, setIsLoading]"));
  assert.ok(source.includes("const [errorMessage, setErrorMessage]"));
  assert.ok(source.includes("disabled={!hasStoragePath || isLoading}"));
  assert.ok(source.includes("Informe no disponible para descarga."));
  assert.ok(source.includes("Preparando..."));
  assert.ok(source.includes('role="alert"'));
});

test("frontend informes page uses report download button", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(
    source.includes(
      'import { ReportDownloadButton } from "@/components/dashboard/ReportDownloadButton"',
    ),
  );
  assert.ok(source.includes("<ReportDownloadButton"));
  assert.ok(source.includes("reportId={report.id}"));
  assert.ok(source.includes("hasStoragePath={Boolean(report.storagePath)}"));
  assert.equal(source.includes("<button"), false);
});
