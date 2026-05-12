import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const UPLOAD_MODAL_PATH = "frontend/src/components/dashboard/UploadReportModal.tsx";
const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";
const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend upload report modal remains available as admin-only implementation", () => {
  assert.equal(existsSync(resolve(process.cwd(), UPLOAD_MODAL_PATH)), true);

  const source = read(UPLOAD_MODAL_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("uploadAdminReport"));
  assert.ok(source.includes("getAdminUsersRoles"));
  assert.ok(source.includes("getAdminParticularTokens"));
  assert.ok(source.includes("createAdminStudyTrackingCase"));
  assert.ok(source.includes("uploadAdminReport"));
});

test("frontend upload report modal keeps file picker fully localized", () => {
  const source = read(UPLOAD_MODAL_PATH);

  assert.ok(source.includes('className="sr-only"'));
  assert.ok(source.includes("selectedFileName"));
  assert.ok(source.includes("handleFileChange"));
  assert.ok(source.includes("Seleccionar archivo"));
  assert.ok(source.includes("Sin archivo seleccionado"));
  assert.equal(source.includes("Choose File"), false);
  assert.equal(source.includes("No file chosen"), false);
});

test("frontend upload report modal keeps study type options without placeholder option", () => {
  const source = read(UPLOAD_MODAL_PATH);

  assert.ok(source.includes('{ value: "histopathology", label: "Histopatología" }'));
  assert.ok(source.includes('{ value: "cytology", label: "Citología" }'));
  assert.ok(source.includes('{ value: "immunohistochemistry", label: "Inmunohistoquímica" }'));
  assert.ok(source.includes('{ value: "special_stain", label: "Hematología" }'));
  assert.ok(source.includes("useState(STUDY_TYPE_OPTIONS[0].value)"));
  assert.ok(source.includes("setStudyType(STUDY_TYPE_OPTIONS[0].value)"));
  assert.equal(source.includes('{ value: "", label: "Tipo de estudio" }'), false);
});

test("frontend informes page does not expose admin upload modal in clinic dashboard", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.equal(source.includes('import { UploadReportModal } from "@/components/dashboard/UploadReportModal"'), false);
  assert.equal(source.includes("<UploadReportModal />"), false);
  assert.ok(source.includes("Lectura clinic-scoped conectada a"));
  assert.ok(source.includes("dashboard administrador"));
});

test("frontend admin dashboard exposes upload report modal only in admin surface", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes('import { UploadReportModal } from "@/components/dashboard/UploadReportModal";'));
  assert.ok(source.includes('id="admin-report-upload"'));
  assert.ok(source.includes("<UploadReportModal />"));
  assert.ok(source.includes("Carga de informes"));
});
