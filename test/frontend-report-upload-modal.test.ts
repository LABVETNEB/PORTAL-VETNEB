import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const UPLOAD_MODAL_PATH = "frontend/src/components/dashboard/UploadReportModal.tsx";
const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";
const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const ADMIN_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx";

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
  assert.ok(
    source.includes(
      'formData.append("particularTokenId", String(selectedParticularToken.id));',
    ),
  );
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

  // Backend accepts Spanish slugs only: citologia, histopatologia, hemoparasitos
  assert.ok(source.includes('{ value: "histopatologia", label: "Histopatología" }'));
  assert.ok(source.includes('{ value: "citologia", label: "Citología" }'));
  assert.ok(source.includes('{ value: "hemoparasitos", label: "Hemoparásitos" }'));
  // Legacy English slugs must NOT be present — backend rejects them with "Tipo de estudio inválido"
  assert.equal(source.includes('"histopathology"'), false);
  assert.equal(source.includes('"cytology"'), false);
  assert.equal(source.includes('"immunohistochemistry"'), false);
  assert.equal(source.includes('"special_stain"'), false);
  // Default and reset still use the first option
  assert.ok(source.includes("useState(STUDY_TYPE_OPTIONS[0].value)"));
  assert.ok(source.includes("setStudyType(STUDY_TYPE_OPTIONS[0].value)"));
  // No empty placeholder
  assert.equal(source.includes('{ value: "", label: "Tipo de estudio" }'), false);
});

test("frontend informes page does not expose admin upload modal in clinic dashboard", () => {
  const source = read(INFORMES_PAGE_PATH);
  const removedSourceCopy = "Lectura clinic-" + "scoped conectada a";

  assert.equal(source.includes('import { UploadReportModal } from "@/components/dashboard/UploadReportModal"'), false);
  assert.equal(source.includes("<UploadReportModal />"), false);
  assert.equal(source.includes(removedSourceCopy), false);
  assert.equal(source.includes("dashboard administrador"), false);
});

test("frontend admin token workspace does not mount upload report modal", () => {
  const page = read(ADMIN_PAGE_PATH);
  const card = read(ADMIN_CARD_PATH);

  assert.equal(page.includes('import { UploadReportModal } from "@/components/dashboard/UploadReportModal";'), false);
  assert.ok(page.includes('id="admin-report-upload"'));
  assert.equal(page.includes("<UploadReportModal />"), false);
  assert.ok(page.includes("Carga de informes"));
  assert.equal(card.includes('import { UploadReportModal } from "@/components/dashboard/UploadReportModal";'), false);
  assert.equal(card.includes("triggerLabel={"), false);
  assert.equal(card.includes('"Subir informe para este token"'), false);
  assert.equal(card.includes('"Reemplazar informe"'), false);
  assert.equal(card.includes("presetParticularToken={token}"), false);
});

test("frontend upload report modal supports preset particular token uploads", () => {
  const source = read(UPLOAD_MODAL_PATH);

  assert.ok(source.includes("type UploadReportModalProps = {"));
  assert.ok(source.includes("triggerLabel?: string;"));
  assert.ok(source.includes("presetClinic?: PresetClinic;"));
  assert.ok(source.includes("presetParticularToken?: AdminParticularTokenSummary;"));
  assert.ok(source.includes("onUploaded?: () => void | Promise<void>;"));
  assert.ok(source.includes("const isPresetMode = hasPresetClinic && hasPresetParticularToken;"));
  assert.ok(source.includes("Carga preconfigurada"));
  assert.ok(source.includes("Clínica: {presetClinic.name} (#{presetClinic.id})"));
  assert.ok(source.includes("Token: ****{presetParticularToken.tokenLast4}"));
  assert.ok(source.includes("buildPresetPatientName(presetParticularToken)"));
  assert.ok(source.includes('formData.append("clinicId", String(presetClinic.id));'));
  assert.ok(source.includes('formData.append("particularTokenId", String(presetParticularToken.id));'));
  assert.ok(source.includes("await onUploaded?.();"));
});
