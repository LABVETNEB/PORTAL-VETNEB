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
  assert.equal(source.includes("createAdminStudyTrackingCase"), false);
});

test("upload report modal keeps study type options", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  assert.ok(source.includes("const STUDY_TYPE_OPTIONS = ["));
  assert.equal(source.includes('{ value: "", label: "Tipo de estudio" }'), false);
  // Backend accepts Spanish slugs: citologia, histopatologia, hemoparasitos
  assert.ok(source.includes('{ value: "histopatologia", label: "Histopatología" }'));
  assert.ok(source.includes('{ value: "citologia", label: "Citología" }'));
  assert.ok(source.includes('{ value: "hemoparasitos", label: "Hemoparásitos" }'));
  // Legacy English slugs must NOT be present — backend rejects them
  assert.equal(source.includes('"histopathology"'), false, "histopathology slug is invalid — backend rejects it");
  assert.equal(source.includes('"cytology"'), false, "cytology slug is invalid — backend rejects it");
  assert.equal(source.includes('"immunohistochemistry"'), false, "immunohistochemistry slug is not in backend enum");
  assert.equal(source.includes('"special_stain"'), false, "special_stain slug is not in backend enum");
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
  assert.ok(source.includes("if (selectedParticularToken) {"));
  assert.ok(
    source.includes(
      'formData.append("particularTokenId", String(selectedParticularToken.id));',
    ),
  );
});

test("upload report modal calls upload API refreshes dashboard and handles errors", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);

  assert.ok(source.includes("const response = await uploadAdminReport(formData);"));
  assert.equal(source.includes("createAdminStudyTrackingCase"), false);
  assert.equal(source.includes("trackingResponse"), false);
  assert.equal(
    source.includes("Seguimiento particular creado con entrega estimada"),
    false,
  );
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

  // The dep array must be [isOpen] only.
  // isLoadingClinics must NOT be included — its presence causes React to run
  // the effect cleanup (setting cancelled=true) the moment setIsLoadingClinics(true)
  // fires, which prevents the finally block from calling setIsLoadingClinics(false)
  // and leaves the modal stuck on "Cargando clínicas registradas...".
  // clinicOptions.length must NOT be included — that was the stale catalog bug
  // (prevented re-fetch when catalog was already populated).
  assert.ok(
    source.includes("}, [isOpen]);"),
    "dep array must be [isOpen] only — isLoadingClinics and clinicOptions.length must be absent",
  );
  assert.equal(
    source.includes("}, [clinicOptions.length, isOpen]);"),
    false,
    "dep array must NOT include clinicOptions.length — stale catalog bug",
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

  // The guard inside the effect (not in deps) short-circuits concurrent re-entry
  // using isLoadingClinics. clinicOptions.length > 0 has been removed to allow
  // refreshing the catalog on every open.
  assert.ok(
    source.includes("if (!isOpen || isLoadingClinics) {"),
    "guard must check isLoadingClinics to block duplicate concurrent loads — clinicOptions.length > 0 must be absent",
  );
  assert.equal(
    source.includes("clinicOptions.length > 0"),
    false,
    "clinicOptions.length > 0 guard must be removed — it caused stale catalog on subsequent opens",
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

  // filteredClinicOptions applies matchClinicOption with clinicSearch when query is active
  assert.ok(
    source.includes('const filteredClinicOptions = hasClinicQuery'),
    "filteredClinicOptions must be gated on hasClinicQuery — full catalog must not show on empty input",
  );
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
// --- fix(admin): refresh clinic catalog in report upload modal ---
// Unit tests for the pure search/dedup functions and structural invariants.
// All clinic data is fictional — no real staging names are used.

type TestClinicOption = { id: number; name: string; usernames: string[] };

function testNormalize(value: string | number): string {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function testBuildSearchText(opt: TestClinicOption): string {
  return testNormalize([opt.id, opt.name, ...opt.usernames].join(" "));
}

function testMatch(opt: TestClinicOption, query: string): boolean {
  const nq = testNormalize(query);
  if (!nq) return true;
  const searchable = testBuildSearchText(opt);
  return nq
    .split(/\s+/)
    .filter(Boolean)
    .every((t: string) => searchable.includes(t));
}

function testDedupe(options: TestClinicOption[]): TestClinicOption[] {
  const byId = new Map<number, TestClinicOption>();
  for (const opt of options) {
    const cur = byId.get(opt.id);
    if (!cur) {
      byId.set(opt.id, { ...opt, usernames: [...opt.usernames] });
      continue;
    }
    byId.set(opt.id, {
      ...cur,
      name: cur.name || opt.name,
      usernames: Array.from(new Set([...cur.usernames, ...opt.usernames])).sort(
        (a, b) => a.localeCompare(b, "es", { sensitivity: "base" }),
      ),
    });
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
  );
}

// Generic fictional clinics — no real staging names
const CLINIC_ALPHA = { id: 42, name: "Clinica Ejemplo Sur", usernames: ["usuario_ejemplo"] };
const CLINIC_BETA = { id: 99, name: "Veterinaria Nortena", usernames: ["nortena_user"] };

test("clinic search: match by full clinic name (generic)", () => {
  assert.ok(testMatch(CLINIC_ALPHA, "Clinica Ejemplo Sur"));
  assert.equal(testMatch(CLINIC_BETA, "Clinica Ejemplo Sur"), false);
});

test("clinic search: match by partial text (generic)", () => {
  assert.ok(testMatch(CLINIC_ALPHA, "Ejemplo"));
  assert.ok(testMatch(CLINIC_BETA, "norte"));
  assert.equal(testMatch(CLINIC_ALPHA, "norte"), false);
});

test("clinic search: case-insensitive match (generic)", () => {
  assert.ok(testMatch(CLINIC_ALPHA, "CLINICA EJEMPLO"));
  assert.ok(testMatch(CLINIC_ALPHA, "clinica ejemplo"));
  assert.ok(testMatch(CLINIC_ALPHA, "CliNica eJempLO"));
});

test("clinic search: accent-normalized match (generic)", () => {
  // Searching without accent must still match accented names
  assert.ok(testMatch(CLINIC_ALPHA, "clinica"));
  assert.ok(testMatch(CLINIC_ALPHA, "Clinica"));
  assert.ok(testMatch(CLINIC_BETA, "nortena"));
});

test("clinic search: match by clinic ID (generic)", () => {
  assert.ok(testMatch(CLINIC_ALPHA, "42"));
  assert.ok(testMatch(CLINIC_BETA, "99"));
  assert.equal(testMatch(CLINIC_ALPHA, "99"), false);
});

test("clinic search: match by associated username (generic)", () => {
  assert.ok(testMatch(CLINIC_ALPHA, "usuario_ejemplo"));
  assert.ok(testMatch(CLINIC_BETA, "nortena_user"));
  assert.equal(testMatch(CLINIC_ALPHA, "nortena_user"), false);
});

test("clinic deduplicate: merges duplicate IDs and preserves unique usernames (generic)", () => {
  const raw = [
    { id: 10, name: "Clinica Generica", usernames: ["user_a"] },
    { id: 10, name: "Clinica Generica", usernames: ["user_b"] },
    { id: 20, name: "Otra Clinica", usernames: ["user_c"] },
  ];
  const result = testDedupe(raw);
  assert.equal(result.length, 2);
  const clinic10 = result.find((o) => o.id === 10);
  assert.ok(clinic10, "entry with id 10 must exist");
  assert.ok(clinic10 && clinic10.usernames.includes("user_a"));
  assert.ok(clinic10 && clinic10.usernames.includes("user_b"));
  assert.equal(clinic10 && clinic10.usernames.length, 2);
});

test("upload modal catalog refresh: dep array [isOpen] ensures reload on every modal open", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.ok(
    source.includes("}, [isOpen]);"),
    "dep array must be [isOpen] so the effect reruns on every open and refreshes the catalog",
  );
  assert.equal(
    source.includes("}, [clinicOptions.length, isOpen]);"),
    false,
    "clinicOptions.length must be absent from dep array — it was the stale catalog bug",
  );
});

test("upload modal catalog refresh: no clinicOptions.length guard that blocks re-fetch on reopen", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.equal(
    source.includes("clinicOptions.length > 0"),
    false,
    "clinicOptions.length > 0 guard must be removed — new clinics must appear on next modal open",
  );
  assert.ok(
    source.includes("if (!isOpen || isLoadingClinics) {"),
    "only isOpen and isLoadingClinics should guard the load",
  );
});

test("upload modal: no hardcoded clinic names or staging-specific IDs in component source", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.ok(source.includes("`Clínica #${user.clinicId}`"));
  assert.equal(source.includes("clinicId: 1,"), false);
  assert.equal(source.includes("clinicId: 2,"), false);
});

// --- fix(admin): align report upload modal study type and token optionality ---

// 1. Clinic list hidden when search is empty and no clinic selected
test("upload modal: clinic list hidden when search is empty and no clinic selected", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.ok(
    source.includes("const hasClinicQuery = normalizeSearchText(clinicSearch).length > 0;"),
    "hasClinicQuery must be derived from normalized clinicSearch",
  );
  assert.ok(
    source.includes("const filteredClinicOptions = hasClinicQuery"),
    "filteredClinicOptions must depend on hasClinicQuery",
  );
  assert.ok(
    source.includes(": [];"),
    "filteredClinicOptions must return [] when query is empty and no clinic is selected",
  );
});

// 2. "No hay clinicas registradas..." not shown when search is empty
test("upload modal: no-match message not shown when search is empty", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.ok(
    source.includes("!isLoadingClinics && hasClinicQuery && filteredClinicOptions.length === 0"),
    "no-match message must require hasClinicQuery — must not appear with empty input",
  );
  assert.equal(
    source.includes("!isLoadingClinics && filteredClinicOptions.length === 0 ?"),
    false,
    "bare filteredClinicOptions.length === 0 check must be gone — it showed message on empty input",
  );
});

// 3. Results appear when user types a search query
test("upload modal: results appear when clinicSearch has text", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.ok(
    source.includes(".filter((option) => matchClinicOption(option, clinicSearch))"),
    "filter must still use matchClinicOption with clinicSearch",
  );
  assert.ok(
    source.includes(".slice(0, 20)"),
    "results must be capped at 20 items",
  );
});

// 4. "No hay clinicas registradas..." appears when search has text and no matches
test("upload modal: no-match message shown when search has text and no matches", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.ok(
    source.includes("No hay clínicas registradas que coincidan con la búsqueda."),
    "no-match message must still exist in the component",
  );
  assert.ok(
    source.includes("hasClinicQuery && filteredClinicOptions.length === 0"),
    "no-match message must be gated on hasClinicQuery AND empty results",
  );
});

// 5. Selected clinic stays visible when search input is cleared
test("upload modal: selected clinic remains visible when search is cleared", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.ok(
    source.includes(": selectedClinic"),
    "when query is empty and a clinic is selected, filteredClinicOptions must return [selectedClinic]",
  );
  assert.ok(
    source.includes("? [selectedClinic]"),
    "selectedClinic entry must be wrapped in an array",
  );
});

// 6. Catalog refreshes on every modal open (dep array invariant maintained)
test("upload modal: catalog refreshes on every open — dep array still [isOpen]", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.ok(
    source.includes("}, [isOpen]);"),
    "dep array must remain [isOpen] so catalog is refreshed on every open",
  );
});

// 7. clinicOptions.length not reintroduced as dep-array blocker
test("upload modal: clinicOptions.length not reintroduced in dep array", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.equal(
    source.includes("}, [clinicOptions.length, isOpen]);"),
    false,
    "clinicOptions.length must not be in dep array — stale catalog bug",
  );
  assert.equal(
    source.includes("clinicOptions.length > 0"),
    false,
    "clinicOptions.length > 0 guard must not be reintroduced",
  );
});

// 8. isLoadingClinics not reintroduced in dep array
test("upload modal: isLoadingClinics not reintroduced in dep array", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.equal(
    source.includes("}, [isLoadingClinics, isOpen]);"),
    false,
    "isLoadingClinics must not be in dep array — causes cancellation race",
  );
  assert.equal(
    source.includes("}, [clinicOptions.length, isLoadingClinics, isOpen]);"),
    false,
  );
});

// 9. Label "Citologia" sends valid backend studyType
test("upload modal: label Citología maps to backend-valid studyType slug", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.ok(
    source.includes('{ value: "citologia", label: "Citología" }'),
    "Citología must use value 'citologia' — the backend-accepted slug",
  );
  assert.equal(
    source.includes('"cytology"'),
    false,
    "English slug 'cytology' is invalid — backend returns Tipo de estudio inválido",
  );
});

// 10. Label "Histopatologia" sends valid backend studyType
test("upload modal: label Histopatología maps to backend-valid studyType slug", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.ok(
    source.includes('{ value: "histopatologia", label: "Histopatología" }'),
    "Histopatología must use value 'histopatologia' — the backend-accepted slug",
  );
  assert.equal(
    source.includes('"histopathology"'),
    false,
    "English slug 'histopathology' is invalid — backend returns Tipo de estudio inválido",
  );
});

// 11. No token ID sent when "Sin token particular vinculado" is selected
test("upload modal: no invalid token ID sent when no particular token is selected", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.ok(
    source.includes('const [particularTokenId, setParticularTokenId] = useState("");'),
    "particularTokenId defaults to empty string",
  );
  assert.ok(
    source.includes("if (selectedParticularToken) {"),
    "particularTokenId append must be gated on selectedParticularToken",
  );
  assert.ok(
    source.includes(
      'formData.append("particularTokenId", String(selectedParticularToken.id));',
    ),
    "particularTokenId must be appended only when a valid token is selected",
  );
});

// 12. Lack of particular tokens does not block submit
test("upload modal: missing particular tokens do not block submit button", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.equal(
    source.includes("disabled={isSubmitting || particularTokens"),
    false,
    "submit button must not be disabled by particularTokens state",
  );
  assert.equal(
    source.includes("disabled={particularTokens"),
    false,
    "submit button must not be disabled by particularTokens state",
  );
  assert.ok(
    source.includes("clinical-alert-warning"),
    "token warning must use clinical-alert-warning (informative), not clinical-alert-error",
  );
  assert.ok(
    source.includes("Esta clínica no tiene tokens particulares disponibles."),
    "informative warning message must be present",
  );
});

// 13. Valid token ID is sent when a particular token is selected
test("upload modal: valid token ID is appended to upload payload when selected", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.ok(
    source.includes(
      'formData.append("particularTokenId", String(selectedParticularToken.id));',
    ),
    "when a token is selected, its ID must be sent in multipart upload",
  );
  assert.equal(source.includes("createAdminStudyTrackingCase"), false);
  assert.ok(
    source.includes("const selectedParticularToken = particularTokens.find("),
    "selectedParticularToken must be derived from particularTokenId state",
  );
  assert.ok(
    source.includes("(token) => String(token.id) === particularTokenId,"),
    "lookup must compare by string-coerced ID",
  );
});

// 14. No hardcoded real clinic names in component
test("upload modal: no hardcoded real clinic names in component source", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.ok(source.includes("`Clínica #${user.clinicId}`"));
  assert.equal(source.includes("clinicId: 1,"), false);
  assert.equal(source.includes("clinicId: 2,"), false);
  assert.equal(source.includes('"immunohistochemistry"'), false);
  assert.equal(source.includes('"special_stain"'), false);
});
