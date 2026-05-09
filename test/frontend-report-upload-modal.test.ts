import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const UPLOAD_MODAL_PATH =
  "frontend/src/components/dashboard/UploadReportModal.tsx";
const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend report upload modal exists and uses upload api client", () => {
  assert.equal(existsSync(resolve(process.cwd(), UPLOAD_MODAL_PATH)), true);

  const source = read(UPLOAD_MODAL_PATH);

  assert.ok(source.includes('"use client"'));
  assert.ok(source.includes('import { uploadAdminReport } from "@/lib/api"'));
  assert.ok(source.includes("new FormData()"));
  assert.ok(source.includes('formData.append("clinicId", clinicId)'));
  assert.ok(source.includes('formData.append("file", file)'));
  assert.ok(source.includes('formData.append("patientName", patientName.trim())'));
  assert.ok(source.includes('formData.append("studyType", studyType)'));
  assert.ok(source.includes('formData.append("uploadDate", uploadDate)'));
  assert.ok(source.includes("await uploadAdminReport(formData)"));
  assert.ok(source.includes("router.refresh()"));
});

test("frontend report upload modal handles user feedback and submit state", () => {
  const source = read(UPLOAD_MODAL_PATH);

  assert.ok(source.includes("const [errorMessage, setErrorMessage]"));
  assert.ok(source.includes("const [successMessage, setSuccessMessage]"));
  assert.ok(source.includes("const [isSubmitting, setIsSubmitting]"));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("disabled={isSubmitting}"));
  assert.ok(source.includes("Seleccione un archivo PDF para subir."));
});

test("frontend report upload modal stays scoped to frontend ui", () => {
  const source = read(UPLOAD_MODAL_PATH);

  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("/api/admin/reports/upload"), false);
  assert.equal(source.includes("process.env"), false);
});

test("frontend informes page exposes upload report modal", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes('import { UploadReportModal } from "@/components/dashboard/UploadReportModal"'));
  assert.ok(source.includes("<UploadReportModal />"));
});
