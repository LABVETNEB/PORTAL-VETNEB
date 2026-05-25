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
  assert.equal(source.includes('{ value: "", label: "Tipo de estudio" }'), false);
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
  assert.ok(source.includes("const [studyType, setStudyType] = useState(STUDY_TYPE_OPTIONS[0].value);"));
  assert.ok(source.includes("const [uploadDate, setUploadDate] = useState(\"\");"));
  assert.ok(source.includes("const [errorMessage, setErrorMessage] = useState<string | null>(null);"));
  assert.ok(source.includes("const [successMessage, setSuccessMessage] = useState<string | null>(null);"));
  assert.ok(source.includes("const [isSubmitting, setIsSubmitting] = useState(false);"));
  assert.ok(source.includes("function resetForm()"));
  assert.ok(source.includes("fileInputRef.current.value = \"\";"));
  assert.ok(source.includes("const [selectedFileName, setSelectedFileName] = useState(\"\");"));
  assert.ok(source.includes("setSelectedFileName(\"\");"));
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
  assert.ok(source.includes("Seleccionar archivo"));
  assert.ok(source.includes("Sin archivo seleccionado"));
  assert.equal(source.includes("Choose File"), false);
  assert.equal(source.includes("No file chosen"), false);
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

// --- fix(admin): load registered clinics in report upload modal ---

test("upload modal clinic loader: isLoadingClinics excluded from effect deps to prevent cancellation race", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  // The dep array must NOT include isLoadingClinics – its presence causes React
  // to run the effect cleanup (setting cancelled=true) the moment
  // setIsLoadingClinics(true) fires, which prevents the finally block from
  // ever calling setIsLoadingClinics(false) and leaves the modal stuck on
  // "Cargando clínicas registradas...".
  assert.ok(
    source.includes("}, [clinicOptions.length, isOpen]);"),
    "dep array must be [clinicOptions.length, isOpen] — isLoadingClinics must be absent",
  );
  assert.equal(
    source.includes("}, [clinicOptions.length, isLoadingClinics, isOpen]);"),
    false,
    "dep array must NOT include isLoadingClinics",
  );
});

test("upload modal clinic loader: eslint disable comment documents intentional dep omission", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  assert.ok(
    source.includes("eslint-disable-next-line react-hooks/exhaustive-deps"),
    "intentional dep omission must be documented with eslint-disable comment",
  );
  assert.ok(
    source.includes("isLoadingClinics is intentionally omitted"),
    "comment must explain why isLoadingClinics is omitted from the dep array",
  );
});

test("upload modal clinic loader: finally block always calls setIsLoadingClinics(false)", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  // The finally block is the only place setIsLoadingClinics(false) is called,
  // guarded by !cancelled so loading resolves after the fetch completes.
  assert.ok(source.includes("} finally {"));
  assert.ok(source.includes("if (!cancelled) {"));
  assert.ok(source.includes("setIsLoadingClinics(false);"));
});

test("upload modal clinic loader: guard prevents duplicate load while in flight", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  // The guard inside the effect (not in deps) still short-circuits re-entry.
  assert.ok(
    source.includes("if (!isOpen || clinicOptions.length > 0 || isLoadingClinics) {"),
    "guard must check isLoadingClinics to block duplicate concurrent loads",
  );
});

test("upload modal clinic loader: uses getAdminUsersRoles with userType clinic and pagination", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  assert.ok(source.includes('import { getAdminUsersRoles } from "@/lib/api";'));
  assert.ok(source.includes('getAdminUsersRoles({'));
  assert.ok(source.includes('userType: "clinic",'));
  assert.ok(source.includes('limit,'));
  assert.ok(source.includes('offset,'));
  assert.ok(source.includes('total = snapshot.total;'));
  assert.ok(source.includes('offset += snapshot.users.length;'));
});

test("upload modal clinic loader: normalizes and searches clinic by name, username and ID", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  // normalizeSearchText strips accents and lowercases — MIBABAU matches mibabau
  assert.ok(source.includes('function normalizeSearchText(value: string)'));
  assert.ok(source.includes('.normalize("NFD")'));
  assert.ok(source.includes('.replace(/\\p{Diacritic}/gu, "")'));
  assert.ok(source.includes('.toLowerCase()'));
  assert.ok(source.includes('.trim()'));

  // buildClinicSearchText joins id + name + usernames for full-text search
  assert.ok(source.includes('function buildClinicSearchText(option: ClinicOption)'));
  assert.ok(
    source.includes('[option.id, option.name, ...option.usernames].join(" ")'),
    "search text must include id, name and usernames so MIBABAU matches by username",
  );

  // matchClinicOption supports partial tokens
  assert.ok(source.includes('function matchClinicOption(option: ClinicOption, query: string)'));
  assert.ok(source.includes('tokens.every((token) => searchable.includes(token))'));

  // filteredClinicOptions applies matchClinicOption with clinicSearch
  assert.ok(source.includes('const filteredClinicOptions = clinicOptions'));
  assert.ok(source.includes('.filter((option) => matchClinicOption(option, clinicSearch))'));
});

test("upload modal clinic loader: selectClinic sets clinicId and clears validation error", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  assert.ok(source.includes('function selectClinic(option: ClinicOption)'));
  assert.ok(source.includes('setClinicId(String(option.id));'));
  assert.ok(source.includes('setClinicSearch(option.name);'));
  // Selecting a clinic from the listbox clears the error message so the
  // "Seleccione una clínica registrada del listado." banner disappears.
  assert.ok(source.includes('setErrorMessage(null);'));
});

test("upload modal submit: no validation error when clinicId and selectedClinic are set", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  // Validation only fires when BOTH clinicId and selectedClinic are falsy.
  // After selectClinic() is called, clinicId = String(option.id) (truthy) and
  // selectedClinic resolves via clinicOptions.find — so this branch is skipped.
  assert.ok(source.includes('if (!clinicId || !selectedClinic) {'));
  assert.ok(source.includes('"Seleccione una clínica registrada del listado."'));

  // selectedClinic is derived — not a separate state — to stay consistent.
  assert.ok(
    source.includes('const selectedClinic = clinicOptions.find('),
    "selectedClinic must be derived from clinicOptions so it resolves once clinicId is set",
  );
  assert.ok(source.includes('(option) => String(option.id) === clinicId,'));
});

test("upload modal clinic loader: deduplicates and sorts options by clinic id", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  assert.ok(source.includes('function dedupeClinicOptions(options: ClinicOption[])'));
  assert.ok(source.includes('const byId = new Map<number, ClinicOption>()'));
  assert.ok(source.includes('byId.get(option.id)'));
  assert.ok(source.includes('return Array.from(byId.values()).sort(sortClinicOptions)'));
  assert.ok(source.includes('setClinicOptions(dedupeClinicOptions(options));'));
});

test("upload modal clinic loader: apiFetch wrapper uses credentials include by default", () => {
  const API_PATH = "frontend/src/lib/api.ts";
  const source = read(API_PATH);

  assert.ok(
    source.includes('credentials: options.credentials ?? "include"'),
    'apiFetch must default credentials to "include" for admin session cookie',
  );
});
