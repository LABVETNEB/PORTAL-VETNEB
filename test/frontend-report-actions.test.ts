import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const UPLOAD_REPORT_MODAL_PATH = "frontend/src/components/dashboard/UploadReportModal.tsx";
const REPORT_DOWNLOAD_BUTTON_PATH = "frontend/src/components/dashboard/ReportDownloadButton.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("upload report modal is client-side and imports upload dependencies", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { FormEvent, useRef, useState } from "react";'));
  assert.ok(source.includes('import { useRouter } from "next/navigation";'));
  assert.ok(source.includes('import { Button } from "@/components/ui/button";'));
  assert.ok(source.includes('import { Input } from "@/components/ui/input";'));
  assert.ok(source.includes('import { uploadAdminReport } from "@/lib/api";'));
  assert.ok(source.includes('import { getAdminUsersRoles } from "@/lib/api";'));
  assert.ok(source.includes("getAdminParticularTokens"));
  assert.ok(source.includes("createAdminStudyTrackingCase"));
});

test("upload report modal keeps study type options", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  assert.ok(source.includes("const STUDY_TYPE_OPTIONS = ["));
  assert.ok(source.includes('{ value: "", label: "Tipo de estudio" }'));
  assert.ok(source.includes('{ value: "histopathology", label: "Histopatología" }'));
  assert.ok(source.includes('{ value: "cytology", label: "Citología" }'));
  assert.ok(source.includes('{ value: "immunohistochemistry", label: "Inmunohistoquímica" }'));
  assert.ok(source.includes('{ value: "special_stain", label: "Hematología" }'));
});

test("upload report modal keeps form state reset and file ref handling", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  assert.ok(source.includes("const fileInputRef = useRef<HTMLInputElement | null>(null);"));
  assert.ok(source.includes("const [isOpen, setIsOpen] = useState(false);"));
    assert.ok(source.includes("const [clinicId, setClinicId] = useState(\"\");"));
  assert.ok(source.includes("const [clinicSearch, setClinicSearch] = useState(\"\");"));
  assert.ok(source.includes("const [clinicOptions, setClinicOptions] = useState<ClinicOption[]>([]);"));
  assert.ok(source.includes("const [particularTokenId, setParticularTokenId] = useState(\"\");"));
  assert.ok(source.includes("AdminParticularTokenSummary"));
  assert.ok(source.includes("const [patientName, setPatientName] = useState(\"\");"));
  assert.ok(source.includes("const [studyType, setStudyType] = useState(\"\");"));
  assert.ok(source.includes("const [uploadDate, setUploadDate] = useState(\"\");"));
  assert.ok(source.includes("const [errorMessage, setErrorMessage] = useState<string | null>(null);"));
  assert.ok(source.includes("const [successMessage, setSuccessMessage] = useState<string | null>(null);"));
  assert.ok(source.includes("const [isSubmitting, setIsSubmitting] = useState(false);"));
  assert.ok(source.includes("function resetForm()"));
  assert.ok(source.includes("fileInputRef.current.value = \"\";"));
});

test("upload report modal validates PDF file and submits FormData safely", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  assert.ok(source.includes("async function handleSubmit(event: FormEvent<HTMLFormElement>)"));
  assert.ok(source.includes("event.preventDefault();"));
  assert.ok(source.includes("if (isSubmitting) {"));
  assert.ok(source.includes("const file = fileInputRef.current?.files?.[0];"));
  assert.ok(source.includes("Seleccione un archivo PDF para subir."));
    assert.ok(source.includes("if (!clinicId || !selectedClinic) {"));
  assert.ok(source.includes("const formData = new FormData();"));
  assert.ok(source.includes('formData.append("clinicId", clinicId);'));
  assert.ok(source.includes('formData.append("file", file);'));
  assert.ok(source.includes('formData.append("patientName", patientName.trim());'));
  assert.ok(source.includes('formData.append("studyType", studyType);'));
  assert.ok(source.includes('formData.append("uploadDate", uploadDate);'));
});

test("upload report modal calls upload API refreshes dashboard and handles errors", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  assert.ok(source.includes("const response = await uploadAdminReport(formData);"));
  assert.ok(source.includes("const trackingResponse = await createAdminStudyTrackingCase({"));
  assert.ok(source.includes("response.report.id"));
  assert.ok(source.includes("trackingResponse.trackingCase.estimatedDeliveryAt"));
  assert.ok(source.includes("Seguimiento particular creado con entrega estimada"));
  assert.ok(source.includes("setSuccessMessage(response.message);"));
  assert.ok(source.includes("resetForm();"));
  assert.ok(source.includes("router.refresh();"));
  assert.ok(source.includes("No se pudo subir el informe. Intente nuevamente."));
  assert.ok(source.includes("setIsSubmitting(false);"));
});

test("upload report modal renders accessible dialog and form controls", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  assert.ok(source.includes("Subir informe"));
  assert.ok(source.includes('role="dialog"'));
  assert.ok(source.includes('aria-modal="true"'));
  assert.ok(source.includes('aria-labelledby="upload-report-title"'));
  assert.ok(source.includes('id="upload-report-title"'));
  assert.ok(source.includes("Cargue un PDF y asócielo a una clínica."));
    assert.ok(source.includes('id="upload-clinic-search"'));
  assert.ok(source.includes('name="clinicSearch"'));
  assert.ok(source.includes('placeholder="Buscar clínica registrada por nombre, usuario o ID..."'));
  assert.ok(source.includes('id="upload-clinic-id"'));
  assert.ok(source.includes('type="hidden"'));
  assert.ok(source.includes('role="listbox"'));
  assert.ok(source.includes('aria-label="Clínicas registradas"'));
  assert.ok(source.includes("Seleccione una clínica registrada del listado."));
  assert.ok(source.includes('id="upload-particular-token-id"'));
  assert.ok(source.includes('name="particularTokenId"'));
  assert.ok(source.includes("Sin token particular vinculado"));
  assert.ok(source.includes("Seleccione un token existente para que el informe quede disponible"));
  assert.ok(source.includes('id="upload-file"'));
  assert.ok(source.includes('type="file"'));
  assert.ok(source.includes('accept="application/pdf"'));
  assert.ok(source.includes('id="upload-patient-name"'));
  assert.ok(source.includes('id="upload-study-type"'));
  assert.ok(source.includes('id="upload-date"'));
  assert.ok(source.includes('type="date"'));
  assert.ok(source.includes("15 días hábiles"));
  assert.ok(source.includes("feriados nacionales argentinos"));
});

test("upload report modal renders error success and submit states", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  assert.ok(source.includes("errorMessage ? ("));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("{errorMessage}"));
  assert.ok(source.includes("successMessage ? ("));
  assert.ok(source.includes("{successMessage}"));
  assert.ok(source.includes('{isSubmitting ? "Subiendo informe..." : "Subir informe"}'));
});

test("report download button is client-side and keeps typed props", () => {
  const source = read(REPORT_DOWNLOAD_BUTTON_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { useState } from "react";'));
  assert.ok(source.includes('import { getReportDownloadUrl } from "@/lib/api";'));
  assert.ok(source.includes("type ReportDownloadButtonProps = {"));
  assert.ok(source.includes("reportId: number;"));
  assert.ok(source.includes("hasStoragePath: boolean;"));
});

test("report download button blocks unavailable or duplicate download requests", () => {
  const source = read(REPORT_DOWNLOAD_BUTTON_PATH);

  assert.ok(source.includes("const [isLoading, setIsLoading] = useState(false);"));
  assert.ok(source.includes("const [errorMessage, setErrorMessage] = useState<string | null>(null);"));
  assert.ok(source.includes("async function handleDownload()"));
  assert.ok(source.includes("if (!hasStoragePath || isLoading) {"));
  assert.ok(source.includes("return;"));
  assert.ok(source.includes("setErrorMessage(null);"));
  assert.ok(source.includes("setIsLoading(true);"));
});

test("report download button retrieves URL and opens it safely", () => {
  const source = read(REPORT_DOWNLOAD_BUTTON_PATH);

  assert.ok(source.includes("const url = await getReportDownloadUrl(reportId);"));
  assert.ok(source.includes("Informe no disponible para descarga."));
  assert.ok(source.includes('window.open(url, "_blank", "noopener,noreferrer");'));
  assert.ok(source.includes("No se pudo obtener el enlace de descarga."));
  assert.ok(source.includes("setIsLoading(false);"));
});

test("report download button renders labels titles disabled and alert state", () => {
  const source = read(REPORT_DOWNLOAD_BUTTON_PATH);

  assert.ok(source.includes('disabled={!hasStoragePath || isLoading}'));
  assert.ok(source.includes('title={hasStoragePath ? "Descargar informe" : "Informe no disponible aún"}'));
  assert.ok(source.includes('isLoading'));
  assert.ok(source.includes('"Preparando..."'));
  assert.ok(source.includes('hasStoragePath'));
  assert.ok(source.includes('"Descargar"'));
  assert.ok(source.includes('"No disponible"'));
  assert.ok(source.includes("errorMessage ? ("));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("{errorMessage}"));
});
