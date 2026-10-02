import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import { descendants, evaluate, parseTsx } from "../dashboard/dashboard-source-oracle.ts";

const REPORT_ACTIONS_PATH =
  "frontend/src/components/dashboard/ReportDownloadButton.tsx";
const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";
const INFORMES_LIST_PATH =
  "frontend/src/app/dashboard/informes/InformesReportsList.tsx";

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

test("frontend informes page uses selected report file actions", () => {
  const pageSource = read(INFORMES_PAGE_PATH);
  const listSource = read(INFORMES_LIST_PATH);

  assert.equal(pageSource.includes("<button"), false);
  assert.ok(
    listSource.includes(
      'import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";',
    ),
  );
  assert.ok(listSource.includes("<ReportFileActions"));
  assert.ok(listSource.includes("reportId={selectedReport.id}"));
  assert.ok(listSource.includes("hasFile={selectedReport.hasFile}"));
  assert.equal(listSource.includes("storagePath"), false);
});

test("TEST-GLOBAL-08 G06-F13 kills M-F09 so report failures render an alert", () => {
  const source = read(REPORT_ACTIONS_PATH);
  const alertCondition = (candidate: string) => {
    const conditional = descendants(parseTsx(candidate, REPORT_ACTIONS_PATH), ts.isConditionalExpression).find(
      (node) => node.condition.getText().includes("errorMessage") && node.whenTrue.getText().includes('role="alert"'),
    );
    assert.ok(conditional, "error alert conditional must exist");
    return evaluate(conditional.condition, { errorMessage: "Archivo no disponible." });
  };
  assert.equal(alertCondition(source), "Archivo no disponible.");
  const mutant = source.replace("{errorMessage ? (", "{!errorMessage ? (");
  assert.notEqual(mutant, source, "M-F09 must be applicable");
  assert.equal(alertCondition(mutant), false, "M-F09 hides the report error alert");
});
