import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx";
const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const ADMIN_SIDEBAR_PATH =
  "frontend/src/components/dashboard/AdminDashboardSidebar.tsx";
const API_PATH = "frontend/src/lib/api.ts";
const CLINIC_CARD_PATH =
  "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx";
const EXPECTED_SPECIES_OPTIONS = [
  "Caninos",
  "Felinos",
  "Exóticos",
  "Bovinos",
  "Equinos",
  "Porcinos",
  "Ovinos",
  "Caprinos",
  "Aves",
] as const;

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);

  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);

  return source.slice(startIndex, endIndex);
}

test("admin particular token generator uses admin helpers without technical copy", () => {
  const card = read(ADMIN_CARD_PATH);
  const api = read(API_PATH);
  const removedScopedCopy = "Alta admin-" + "scoped";
  const removedAdminEndpoint = "POST " + "/api/admin/particular-tokens";

  assert.ok(card.includes('"use client";'));
  assert.ok(card.includes("createAdminParticularToken"));
  assert.ok(card.includes("getAdminUsersRoles"));
  assert.ok(card.includes("getAdminParticularTokens"));
  assert.ok(card.includes("deleteAdminParticularToken"));
  assert.ok(card.includes("type AdminParticularTokenCreatePayload"));
  assert.ok(card.includes("type AdminParticularTokenSummary"));
  assert.equal(card.includes(removedScopedCopy), false);
  assert.equal(card.includes(removedAdminEndpoint), false);
  assert.ok(api.includes("export async function createAdminParticularToken("));
  assert.ok(api.includes('"/api/admin/particular-tokens"'));
  assert.ok(api.includes("export async function revokeAdminParticularToken("));
  assert.ok(api.includes("export async function deleteAdminParticularToken("));
  assert.ok(
    api.includes("`/api/admin/particular-tokens/${tokenId}/revoke`,"),
  );
  assert.ok(
    api.includes("`/api/admin/particular-tokens/${tokenId}`"),
  );
});

test("admin particular token generator uses registered clinic selector instead of manual clinic id", () => {
  const source = read(ADMIN_CARD_PATH);
  const types = read("frontend/src/types/index.ts");

  assert.ok(source.includes("clinicId: string;"));
  assert.equal(source.includes('{ key: "clinicId", label: "ID de clínica" }'), false);
  assert.equal(source.includes('htmlFor="admin-token-clinic-id"'), false);
  assert.equal(source.includes('name="clinicId"\n                type="number"'), false);
  assert.ok(source.includes('htmlFor="admin-token-clinic-search"'));
  assert.ok(source.includes("Clínica"));
  assert.ok(
    source.includes(
      'placeholder="Buscar clínica por nombre, localidad, usuario o ID..."',
    ),
  );
  assert.ok(source.includes('id="admin-token-clinic-id"'));
  assert.ok(source.includes('name="clinicId"'));
  assert.ok(source.includes('type="hidden"'));
  assert.ok(source.includes("const selectedClinic = clinicOptions.find("));
  assert.ok(source.includes("payload = buildPayload(formState, selectedClinic);"));
  assert.ok(source.includes("clinicId: selectedClinic.id"));
  assert.ok(
    source.includes('"Seleccione una clínica registrada del listado."'),
  );
  assert.ok(source.includes('role="listbox"'));
  assert.ok(source.includes('role="option"'));
  assert.ok(source.includes("aria-selected"));
  assert.ok(types.includes("clinicLocality?: string | null;"));
  assert.equal(source.includes("veterinario"), false);
});

test("admin particular token clinic selector loads deduped clinics by name user id and locality", () => {
  const source = read(ADMIN_CARD_PATH);

  assert.ok(source.includes('import {\n  createAdminParticularToken,\n  deleteAdminParticularToken,\n  getAdminUsersRoles,'));
  assert.ok(source.includes("getAdminUsersRoles({"));
  assert.ok(source.includes('userType: "clinic",'));
  assert.ok(source.includes("limit,"));
  assert.ok(source.includes("offset,"));
  assert.ok(source.includes("total = snapshot.total;"));
  assert.ok(source.includes("offset += snapshot.users.length;"));
  assert.ok(source.includes("function normalizeSearchText(value: string | number): string"));
  assert.ok(source.includes('.normalize("NFD")'));
  assert.ok(source.includes('.replace(/\\p{Diacritic}/gu, "")'));
  assert.ok(source.includes("[option.id, option.name, option.locality ?? \"\", ...option.usernames].join("));
  assert.ok(source.includes("function matchClinicOption(option: ClinicOption, query: string): boolean"));
  assert.ok(source.includes("function dedupeClinicOptions(options: ClinicOption[]): ClinicOption[]"));
  assert.ok(source.includes("const byId = new Map<number, ClinicOption>();"));
  assert.ok(source.includes("locality: current.locality ?? option.locality"));
  assert.ok(source.includes("user.clinicLocality ?? null"));
  assert.ok(source.includes("Localidad:"));
  assert.ok(source.includes("{option.locality ?? \"No informada\"}"));
  assert.ok(source.includes("Usuarios:"));
  assert.ok(source.includes("option.usernames.join(\", \")"));
});

type TestClinicOption = {
  id: number;
  name: string;
  usernames: string[];
  locality: string | null;
};

function testNormalize(value: string | number): string {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function testBuildSearchText(option: TestClinicOption): string {
  return testNormalize(
    [option.id, option.name, option.locality ?? "", ...option.usernames].join(
      " ",
    ),
  );
}

function testMatch(option: TestClinicOption, query: string): boolean {
  const normalizedQuery = testNormalize(query);

  if (!normalizedQuery) {
    return true;
  }

  const searchable = testBuildSearchText(option);

  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => searchable.includes(token));
}

test("admin particular token clinic selector matches by available locality contract", () => {
  const clinic = {
    id: 42,
    name: "Clínica Ejemplo Sur",
    usernames: ["usuario_ejemplo"],
    locality: "Córdoba Capital",
  };

  assert.ok(testMatch(clinic, "Clinica Ejemplo"));
  assert.ok(testMatch(clinic, "usuario_ejemplo"));
  assert.ok(testMatch(clinic, "42"));
  assert.ok(testMatch(clinic, "cordoba"));
  assert.equal(testMatch(clinic, "rosario"), false);
});

test("admin particular tokens exposes advanced filter bar for real table fields", () => {
  const source = read(ADMIN_CARD_PATH);
  const auditFilter = read("frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx");

  assert.ok(source.includes('data-admin-filter-bar={mobile ? "advanced-mobile" : "advanced"}'));
  assert.ok(source.includes('"Filtros avanzados de tokens particulares"'));
  assert.ok(source.includes("Filtros avanzados de tokens particulares mobile"));
  assert.ok(source.includes("Todos los tokens"));
  assert.ok(source.includes("type AdminParticularTokenFilterState = {"));
  assert.ok(source.includes("token: string;"));
  assert.ok(source.includes("clinic: string;"));
  assert.ok(source.includes("reportId: string;"));
  assert.ok(source.includes("patient: string;"));
  assert.ok(source.includes('status: "" | "active" | "inactive";'));
  assert.ok(source.includes("from: string;"));
  assert.ok(source.includes("to: string;"));
  assert.ok(source.includes('<FilterField label="Token" density={density}>'));
  assert.ok(source.includes('<FilterField label="Clínica" density={density}>'));
  assert.ok(source.includes('<FilterField label="Informe" density={density}>'));
  assert.ok(source.includes('<FilterField label="Paciente / tutor" density={density}>'));
  assert.ok(source.includes('<FilterField label="Estado" density={density}>'));
  assert.ok(source.includes('<FilterField label="Desde" density={density}>'));
  assert.ok(source.includes('<FilterField label="Hasta" density={density}>'));
  assert.ok(source.includes("dashboardFilterControlClassName(density)"));
  assert.ok(source.includes("dashboardFilterActionClassName(density)"));
  assert.ok(source.includes("Aplicar"));
  assert.ok(source.includes("Limpiar"));
  assert.ok(source.includes("visibleTokens.map((token, index) => ("));
  assert.equal(source.includes("filteredMobileTokens"), false);
  assert.equal(source.includes("Email del particular") && source.includes('name="filterEmail"'), false);
  assert.ok(auditFilter.includes('aria-label={mobile ? "Filtros de auditoría mobile" : "Filtros de auditoría"}'));
  assert.ok(auditFilter.includes("Desde"));
  assert.ok(auditFilter.includes("Hasta"));
  assert.ok(auditFilter.includes("Aplicar"));
});

test("admin particular tokens filters apply to visible token table fields", () => {
  const source = read(ADMIN_CARD_PATH);
  const filterBlock = sectionBetween(
    source,
    "function matchesAdminParticularTokenFilters(",
    "function toIsoDateFromInput(",
  );
  const applyBlock = sectionBetween(
    source,
    "function applyAdvancedFilters(",
    "function clearAdvancedFilters()",
  );
  const clearBlock = sectionBetween(
    source,
    "function clearAdvancedFilters()",
    "function openTokenDetail(",
  );

  assert.ok(filterBlock.includes("token.tokenLast4"));
  assert.ok(filterBlock.includes("resolveClinicName(clinicOptions, token.clinicId)"));
  assert.ok(filterBlock.includes("token.clinicId"));
  assert.ok(filterBlock.includes("token.reportId ? String(token.reportId) : \"Sin vínculo\""));
  assert.ok(filterBlock.includes("token.petName"));
  assert.ok(filterBlock.includes("token.tutorLastName"));
  assert.ok(filterBlock.includes('token.isActive ? "active" : "inactive"'));
  assert.ok(filterBlock.includes("matchesCreatedAtRange(token, filters.from, filters.to)"));
  assert.ok(source.includes("const createdAt = toDateInputValue(token.createdAt);"));
  assert.ok(applyBlock.includes("setAppliedFilters({"));
  assert.ok(applyBlock.includes("pagedTokens.setPage(0);"));
  assert.ok(clearBlock.includes("setFilterDraft(INITIAL_FILTER_STATE);"));
  assert.ok(clearBlock.includes("setAppliedFilters(INITIAL_FILTER_STATE);"));
  assert.ok(clearBlock.includes("pagedTokens.setPage(0);"));
});

test("admin particular token generator keeps programmed fields", () => {
  const source = read(ADMIN_CARD_PATH);

  assert.ok(source.includes('id="admin-token-clinic-id"'));
  assert.ok(source.includes("Complete el campo obligatorio"));
  assert.ok(source.includes("tutorLastName"));
  assert.ok(source.includes("petName"));
  assert.ok(source.includes("petAge"));
  assert.ok(source.includes("petBreed"));
  assert.ok(source.includes("petSex"));
  assert.ok(source.includes("petSpecies"));
  assert.ok(source.includes("sampleLocation"));
  assert.ok(source.includes("sampleEvolution"));
  assert.ok(source.includes("detailsLesion"));
  assert.ok(source.includes("extractionDate"));
  assert.ok(source.includes("shippingDate"));
});

test("admin particular token form sends recipient email through backend contract", () => {
  const source = read(ADMIN_CARD_PATH);
  const api = read(API_PATH);
  const payloadType = sectionBetween(
    api,
    "export type AdminParticularTokenCreatePayload = {",
    "};",
  );
  const payloadBuilder = sectionBetween(
    source,
    "function buildPayload(",
    "function formatTokenSource",
  );
  const submitSuccess = sectionBetween(
    source,
    "const response = await createAdminParticularToken(payload);",
    "} catch (error) {",
  );

  assert.ok(source.includes("particularEmail: string;"));
  assert.ok(source.includes('name="particularEmail"'));
  assert.ok(source.includes('type="email"'));
  assert.ok(source.includes('placeholder="email@ejemplo.com"'));
  assert.ok(source.includes("recipientEmail: normalizeText(formState.particularEmail),"));
  assert.ok(source.includes('required'));
  assert.ok(source.includes("Email del particular"));
  assert.ok(
    source.includes(
      "Obligatorio. El backend enviará el token a este email usando la",
    ),
  );
  assert.ok(source.includes("configuración de correo de VETNEB."));
  assert.ok(source.includes("const generatedRecipientEmail = formState.particularEmail.trim();"));
  assert.ok(
    source.includes("const response = await createAdminParticularToken(payload);"),
  );
  assert.ok(
    submitSuccess.includes(
      "setGeneratedTokenRecipientEmail(generatedRecipientEmail || null);",
    ),
  );
  assert.ok(submitSuccess.includes("setGeneratedTokenDetails(nextGeneratedTokenDetails);"));
  assert.equal(payloadType.includes("particularEmail"), false);
  assert.ok(payloadType.includes("recipientEmail: string;"));
  assert.ok(payloadBuilder.includes("formState.particularEmail"));
  assert.ok(payloadBuilder.includes("recipientEmail: normalizeText(formState.particularEmail),"));
  assert.equal(payloadBuilder.includes("email:"), false);
});

test("admin generated token block requires manual communication confirmation", () => {
  const source = read(ADMIN_CARD_PATH);
  const clearGeneratedToken = sectionBetween(
    source,
    "function clearGeneratedTokenState()",
    "async function handleCopyManualMessage()",
  );

  assert.ok(source.includes("IMPORTANTE: el token completo solo se muestra una vez."));
  assert.ok(
    source.includes(
      "Antes de cerrar este bloque, verificá que el token haya sido",
    ),
  );
  assert.ok(source.includes("copiado si necesitás respaldo operativo."));
  assert.ok(source.includes("Email enviado a:"));
  assert.ok(source.includes("El backend informó envío correcto del email."));
  assert.ok(source.includes("Copiar mensaje para enviar"));
  assert.ok(source.includes("navigator.clipboard?.writeText"));
  assert.ok(source.includes("buildManualTokenMessage(generatedToken, generatedTokenDetails)"));
  assert.ok(
    source.includes(
      "Hola. VETNEB informa que ya podés consultar el seguimiento/informe de",
    ),
  );
  assert.ok(source.includes('type="checkbox"'));
  assert.ok(
    source.includes(
      "Confirmo que registré el token visible o que no necesito copia",
    ),
  );
  assert.ok(source.includes("Cerrar token visible"));
  assert.ok(source.includes("disabled={!isGeneratedTokenConfirmed}"));
  assert.ok(clearGeneratedToken.includes("setGeneratedToken(null);"));
  assert.ok(clearGeneratedToken.includes("setGeneratedTokenRecipientEmail(null);"));
  assert.ok(clearGeneratedToken.includes("setIsGeneratedTokenConfirmed(false);"));
  assert.ok(clearGeneratedToken.includes("setCopyStatusMessage(null);"));
  assert.ok(source.includes("disabled={isSubmitting || generatedToken !== null}"));
});

test("admin dashboard mounts token generator and exposes admin navigation anchor", () => {
  const page = read(ADMIN_PAGE_PATH);
  const sidebar = read(ADMIN_SIDEBAR_PATH);

  assert.ok(page.includes('import { AdminParticularTokensCard } from "./AdminParticularTokensCard";'));
  assert.ok(page.includes('id="admin-particular-tokens"'));
  assert.ok(page.includes("<AdminParticularTokensCard />"));
  assert.ok(sidebar.includes('label: "Tokens particulares"'));
  assert.ok(sidebar.includes('`${ROUTES.dashboardAdmin}?module=admin-particular-tokens`'));
});

test("clinic token generator remains clinic-scoped and separate from admin generator", () => {
  const clinic = read(CLINIC_CARD_PATH);
  const admin = read(ADMIN_CARD_PATH);
  const removedClinicEndpoint = "POST " + "/api/particular-tokens";

  assert.ok(clinic.includes("createClinicParticularToken"));
  assert.ok(clinic.includes("getClinicParticularTokens"));
  assert.equal(clinic.includes("clinicId: string;"), false);
  assert.equal(clinic.includes('name="clinicId"'), false);
  assert.equal(clinic.includes("getAdminUsersRoles"), false);
  assert.equal(clinic.includes("createAdminParticularToken"), false);
  assert.equal(clinic.includes(removedClinicEndpoint), false);

  assert.ok(admin.includes("createAdminParticularToken"));
  assert.ok(admin.includes("getAdminParticularTokens"));
  assert.equal(admin.includes("createClinicParticularToken"), false);
});

test("admin and clinic token forms keep normalized sex and species options", () => {
  const admin = read(ADMIN_CARD_PATH);
  const clinic = read(CLINIC_CARD_PATH);

  for (const [context, source] of [
    ["admin", admin],
    ["clinic", clinic],
  ] as const) {
    assert.equal(
      source.includes('value: "", label: "Seleccionar sexo"'),
      false,
      `${context} form must not include selectable sex placeholder`,
    );
    assert.equal(
      source.includes('value: "No informado", label: "No informado"'),
      false,
      `${context} form must not include "No informado" sex option`,
    );
    assert.equal(
      source.includes('value: "", label: "Seleccionar especie"'),
      false,
      `${context} form must not include selectable species placeholder`,
    );
    assert.equal(source.includes('value: "Canina", label: "Canina"'), false);
    assert.equal(source.includes('value: "Felina", label: "Felina"'), false);
    assert.equal(source.includes('value: "Equina", label: "Equina"'), false);
    assert.equal(source.includes('value: "Otra", label: "Otra"'), false);

    assert.ok(source.includes('value: "Macho", label: "Macho"'));
    assert.ok(source.includes('value: "Hembra", label: "Hembra"'));
    assert.ok(source.includes('petSex: "Macho"'));
    assert.ok(source.includes('petSpecies: "Caninos"'));

    let previousIndex = -1;
    for (const species of EXPECTED_SPECIES_OPTIONS) {
      const marker = `value: "${species}", label: "${species}"`;
      const index = source.indexOf(marker);
      assert.ok(index !== -1, `${context} form must include ${species}`);
      assert.ok(
        index > previousIndex,
        `${context} form must keep species order for ${species}`,
      );
      previousIndex = index;
    }
  }
});

test("admin particular token form has autoComplete off on form element and all sensitive inputs", () => {
  const source = read(ADMIN_CARD_PATH);

  assert.ok(source.includes('autoComplete="off"'), "form or inputs must have autoComplete off");
  assert.ok(source.includes('<form') && source.includes('autoComplete="off"'), "form container must disable autocomplete");
  assert.equal(source.includes('autoComplete="on"'), false, "no autoComplete=on allowed");

  const sensitiveInputIds = [
    "admin-token-particular-email",
    "admin-token-tutor-last-name",
    "admin-token-pet-name",
    "admin-token-pet-age",
    "admin-token-pet-breed",
    "admin-token-sample-location",
    "admin-token-sample-evolution",
    "admin-token-extraction-date",
    "admin-token-shipping-date",
  ];

  for (const id of sensitiveInputIds) {
    const idx = source.indexOf(`id="${id}"`);
    assert.ok(idx !== -1, `input ${id} must exist`);
    const block = source.slice(idx, idx + 400);
    assert.ok(block.includes('autoComplete="off"'), `input ${id} must have autoComplete="off"`);
  }
});

test("clinic particular token form has autoComplete off on form element and all sensitive inputs", () => {
  const source = read(CLINIC_CARD_PATH);

  assert.ok(source.includes('autoComplete="off"'), "clinic form must have autoComplete off");
  assert.equal(source.includes('autoComplete="on"'), false, "no autoComplete=on in clinic form");

  const sensitiveInputIds = [
    "clinic-token-particular-email",
    "clinic-token-tutor-last-name",
    "clinic-token-pet-name",
    "clinic-token-pet-age",
    "clinic-token-pet-breed",
    "clinic-token-sample-location",
    "clinic-token-sample-evolution",
    "clinic-token-extraction-date",
    "clinic-token-shipping-date",
    "clinic-token-report-id",
  ];

  for (const id of sensitiveInputIds) {
    const idx = source.indexOf(`id="${id}"`);
    assert.ok(idx !== -1, `clinic input ${id} must exist`);
    const block = source.slice(idx, idx + 400);
    assert.ok(block.includes('autoComplete="off"'), `clinic input ${id} must have autoComplete="off"`);
  }
});

test("admin token card delete handler uses deleteAdminParticularToken not revokeAdminParticularToken", () => {
  const card = read(ADMIN_CARD_PATH);
  const api = read(API_PATH);

  assert.ok(card.includes("deleteAdminParticularToken"), "card must import deleteAdminParticularToken");
  assert.equal(card.includes("revokeAdminParticularToken"), false, "card must not reference revokeAdminParticularToken");
  assert.ok(card.includes("handleDeleteToken"), "card must have handleDeleteToken function");
  assert.ok(card.includes("Eliminar token"), "card must show delete terminology");
  assert.equal(card.includes("Token inactivo"), false, "card must not show Token inactivo state");
  assert.ok(api.includes("export type AdminParticularTokenDeleteResponse"), "api must export AdminParticularTokenDeleteResponse type");
  assert.ok(api.includes('method: "DELETE"'), "deleteAdminParticularToken must use DELETE method");
});

test("admin token card consume seguimiento por token desde study-tracking", () => {
  const card = read(ADMIN_CARD_PATH);
  const api = read(API_PATH);

  assert.ok(card.includes("getAdminStudyTrackingCases"));
  assert.ok(card.includes("trackingCasesByTokenId"));
  assert.ok(card.includes("Seguimiento"));
  assert.ok(card.includes("labReceivedAt"));
  assert.ok(card.includes("Entrega en laboratorio"));
  assert.ok(card.includes("Impacta la estimación del informe."));
  assert.ok(card.includes("handleLabReceivedAtUpdate("));
  assert.ok(card.includes("Actualizar entrega"));
  assert.ok(card.includes("getTrackingStageLabel("));
  assert.ok(card.includes("Alerta: Solicitud de tinción especial"));
  assert.ok(card.includes("Solicitar tinción especial"));
  assert.ok(card.includes("Resolver tinción especial"));
  assert.ok(card.includes("handleSpecialStainChange("));
  assert.ok(card.includes("specialStainRequired: !trackingCase.specialStainRequired"));
  assert.ok(card.includes("No se pudo actualizar la alerta de tinción especial."));
  assert.ok(api.includes("export async function getAdminStudyTrackingCases("));
});

test("admin token card removes report upload action from token workspace", () => {
  const card = read(ADMIN_CARD_PATH);
  const uploadModal = read("frontend/src/components/dashboard/UploadReportModal.tsx");

  assert.equal(card.includes('import { UploadReportModal } from "@/components/dashboard/UploadReportModal";'), false);
  assert.equal(card.includes("triggerLabel={"), false);
  assert.equal(card.includes('"Subir informe para este token"'), false);
  assert.equal(card.includes('"Reemplazar informe"'), false);
  assert.equal(card.includes("presetClinic={buildTokenPresetClinic(clinicOptions, token)}"), false);
  assert.equal(card.includes("presetParticularToken={token}"), false);
  assert.equal(card.includes("onUploaded={loadTokens}"), false);
  assert.ok(uploadModal.includes("presetParticularToken?: AdminParticularTokenSummary;"));
  assert.ok(uploadModal.includes('formData.append("particularTokenId", String(presetParticularToken.id));'));
  assert.equal(card.includes("tokenHash"), false);
  assert.ok(card.includes("Token ****{selectedToken.tokenLast4}"));
});

test("admin token card shows selected linked report preview and download actions without exposing token", () => {
  const card = read(ADMIN_CARD_PATH);

  assert.ok(card.includes('import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";'));
  assert.ok(card.includes("selectedToken.hasLinkedReport && selectedToken.reportId ? ("));
  assert.ok(card.includes("<ReportFileActions"));
  assert.ok(card.includes("reportId={selectedToken.reportId}"));
  assert.ok(card.includes('scope="admin"'));
  assert.ok(card.includes('align="start"'));
  assert.ok(card.includes("Informe vinculado"));
  assert.equal(card.includes('"Reemplazar informe"'), false);
  assert.equal(card.includes("tokenHash"), false);
  assert.equal(card.includes("storagePath"), false);
});

test("admin token card filters by resolved clinic name while desktop rows keep stable clinic id fallback", () => {
  const card = read(ADMIN_CARD_PATH);

  assert.ok(card.includes("hasResolvedName: boolean;"));
  assert.ok(card.includes("hasResolvedName: Boolean(user.clinicName?.trim()),"));
  assert.ok(card.includes("function resolveClinicName("));
  assert.ok(card.includes("return clinic?.hasResolvedName ? clinic.name : null;"));
  assert.ok(card.includes("function formatTokenTitle("));
  assert.ok(card.includes("`${clinicName ?? `Clínica #${token.clinicId}`} · ${token.petName}`"));
  assert.ok(card.includes("function formatTokenClinicLink("));
  assert.ok(card.includes("`Clínica: ${clinicName} (#${clinicId})`"));
  assert.ok(card.includes("`Clínica #${clinicId}`"));
  assert.ok(card.includes("resolveClinicName(clinicOptions, token.clinicId) ??"));
  assert.ok(card.includes('<p className="truncate">{`Clínica #${token.clinicId}`}</p>'));
  assert.ok(card.includes("{resolveClinicName(clinicOptions, token.clinicId) ?? `Clínica #${token.clinicId}`} ·"));
  assert.ok(card.includes("description={formatTokenTitle(clinicOptions, selectedToken)}"));
  assert.ok(card.includes("{formatTokenClinicLink(clinicOptions, selectedToken.clinicId)}"));
});

test("admin token tracking stage uses selected local draft and explicit update button", () => {
  const card = read(ADMIN_CARD_PATH);

  assert.ok(card.includes("trackingStageDraftsByCaseId"));
  assert.ok(card.includes("function handleTrackingStageDraftChange("));
  assert.ok(card.includes("function handleTrackingStageUpdate("));
  assert.ok(card.includes("currentStage: nextStage"));
  assert.ok(card.includes("selectedTrackingStageDraft"));
  assert.ok(card.includes("selectedHasTrackingStageChange"));
  assert.ok(card.includes("handleTrackingStageDraftChange("));
  assert.ok(card.includes("void handleTrackingStageUpdate("));
  assert.ok(card.includes("disabled={"));
  assert.ok(card.includes("!selectedHasTrackingStageChange"));
  assert.ok(card.includes('"Actualizar estado"'));
  assert.ok(card.includes('"Actualizando..."'));
});
