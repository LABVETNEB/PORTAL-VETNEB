import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DASHBOARD_PAGE_PATH = "frontend/src/app/dashboard/page.tsx";
const ADMIN_TOKENS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx";
const CLINIC_DASHBOARD_SIDEBAR_PATH =
  "frontend/src/components/dashboard/ClinicDashboardSidebar.tsx";
const CLINIC_TOKENS_CARD_PATH =
  "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx";
const API_PATH = "frontend/src/lib/api.ts";

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

function assertOrdered(source: string, markers: string[]): void {
  let previousIndex = -1;

  for (const marker of markers) {
    const index = source.indexOf(marker);
    assert.notEqual(index, -1, `Missing marker: ${marker}`);
    assert.ok(index > previousIndex, `${marker} must keep expected order`);
    previousIndex = index;
  }
}

test("clinic dashboard exists as a clinic-only dashboard and keeps admin out", () => {
  const source = read(DASHBOARD_PAGE_PATH);
  const sidebarSource = read(CLINIC_DASHBOARD_SIDEBAR_PATH);
  const removedSessionScopeCopy = "Esta superficie usa solo sesión " + "clínica.";

  assert.ok(source.includes('title: "Dashboard Clínica — Portal VETNEB"'));
  assert.ok(source.includes('title="Dashboard Clínica"'));
  assert.ok(source.includes('import { ClinicParticularTokensCard } from "@/components/dashboard/ClinicParticularTokensCard";'));
  assert.ok(source.includes("<ClinicParticularTokensCard />"));
  assert.ok(sidebarSource.includes('label: "Tokens particulares"'));
  assert.ok(sidebarSource.includes('`${ROUTES.dashboard}?module=tokens`'));
  assert.equal(source.includes(removedSessionScopeCopy), false);
  assert.equal(source.includes('label: "Admin"'), false);
  assert.equal(source.includes("ROUTES.dashboardAdmin"), false);
});

test("clinic particular tokens card exists and uses clinic helpers", () => {
  assert.equal(
    existsSync(resolve(process.cwd(), CLINIC_TOKENS_CARD_PATH)),
    true,
    "clinic particular tokens card must exist",
  );

  const source = read(CLINIC_TOKENS_CARD_PATH);
  const removedScopedCopy = "Alta clinic-" + "scoped";
  const removedTokenEndpoint = "POST " + "/api/particular-tokens";

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("createClinicParticularToken"));
  assert.ok(source.includes("getClinicParticularTokens"));
  assert.ok(source.includes('id="clinic-particular-tokens"'));
  assert.ok(source.includes("generatedToken"));
  assert.ok(source.includes("El token completo solo se muestra una vez."));
  assert.equal(source.includes("/api/admin/particular-tokens"), false);
  assert.equal(source.includes(removedScopedCopy), false);
  assert.equal(source.includes(removedTokenEndpoint), false);
});

test("clinic tokens uses inline master-detail with paged list and step dialogs", () => {
  const source = read(CLINIC_TOKENS_CARD_PATH);

  assert.ok(source.includes("const TOKENS_PAGE_SIZE = 4;"));
  assert.ok(source.includes("usePagedRows(tokens, TOKENS_PAGE_SIZE)"));
  assert.ok(source.includes("<CompactPager"));
  assert.ok(source.includes("selectedTokenId"));
  assert.ok(source.includes("ModuleSurface"));
  assert.ok(source.includes("dashboard-inline-list"));
  assert.ok(source.includes('data-clinic-access-list-body="true"'));
  assert.ok(source.includes("dashboard-inline-detail"));
  assert.ok(source.includes("dashboard-detail-panel"));
  assert.ok(source.includes("aria-expanded={isSelected}"));
  assert.ok(source.includes('data-detail-state="selected"'));
  assert.equal(source.includes("isMobileDetailOpen"), false);
  assert.equal(source.includes("Volver a la lista"), false);
  assert.equal(source.includes('hasOpenDetail && !isSelected && "hidden sm:block"'), false);
  assert.equal(source.includes('xl:grid-cols-[0.82fr_1.46fr]'), false);
  assert.equal(source.includes("dashboard-inline-scroll"), false);
  assert.ok(source.includes("CREATE_TOKEN_STEP_ORDER"));
  assert.ok(source.includes("createStep"));
  assert.ok(source.includes("Siguiente"));
  assert.ok(source.includes("Anterior"));
  assert.ok(source.includes('title="Generar token particular"'));
  assert.ok(source.includes('title="Token generado"'));
  assert.equal(source.includes("overflow-y-auto"), false);
});

test("clinic token generation requires all programmed data fields", () => {
  const source = read(CLINIC_TOKENS_CARD_PATH);

  [
    "tutorLastName",
    "petName",
    "petAge",
    "petBreed",
    "petSex",
    "petSpecies",
    "sampleLocation",
    "sampleEvolution",
    "detailsLesion",
    "extractionDate",
    "shippingDate",
  ].forEach((field) => {
    assert.ok(source.includes(field), `${field} must be present`);
  });

  assert.ok(source.includes("validateFormState"));
  assert.ok(source.includes("Complete el campo obligatorio"));
  assert.ok(source.includes("required"));
  assert.ok(source.includes("reportId: parseOptionalReportId(formState.reportId)"));
});

test("clinic token generator stays session scoped without clinic id controls", () => {
  const source = read(CLINIC_TOKENS_CARD_PATH);
  const api = read(API_PATH);
  const payloadType = sectionBetween(
    api,
    "export type ClinicParticularTokenCreatePayload = {",
    "};",
  );
  const formState = sectionBetween(
    source,
    "type ClinicParticularTokenFormState = {",
    "};",
  );
  const payloadBuilder = sectionBetween(
    source,
    "function buildPayload(",
    "function formatTokenSource",
  );

  assert.equal(source.includes("ID de clínica"), false);
  assert.equal(source.includes('name="clinicId"'), false);
  assert.equal(source.includes("clinicId: string;"), false);
  assert.equal(source.includes("getAdminUsersRoles"), false);
  assert.equal(source.includes("selectedClinic"), false);
  assert.equal(formState.includes("clinicId"), false);
  assert.equal(payloadType.includes("clinicId"), false);
  assert.equal(payloadBuilder.includes("clinicId"), false);
  assert.ok(source.includes("payload = buildPayload(formState);"));
  assert.ok(
    source.includes("const response = await createClinicParticularToken(payload);"),
  );
  assert.ok(api.includes('"/api/particular-tokens"'));
});

test("clinic token form keeps admin field labels and required contract", () => {
  const clinic = read(CLINIC_TOKENS_CARD_PATH);
  const admin = read(ADMIN_TOKENS_CARD_PATH);
  const clinicRequiredFields = sectionBetween(
    clinic,
    "const REQUIRED_FIELD_LABELS:",
    "];",
  );
  const adminRequiredFields = sectionBetween(
    admin,
    "const REQUIRED_FIELD_LABELS:",
    "];",
  );

  for (const label of [
    "Apellido del tutor",
    "Nombre del paciente",
    "Edad",
    "Raza",
    "Sexo",
    "Especie",
    "Ubicación de la muestra",
    "Evolución",
    "Fecha de extracción",
    "Fecha de envío",
    "Detalle de lesión",
  ]) {
    assert.ok(clinic.includes(label), `clinic form must include ${label}`);
    assert.ok(admin.includes(label), `admin form must include ${label}`);
  }

  for (const field of [
    "tutorLastName",
    "petName",
    "petAge",
    "petBreed",
    "petSex",
    "petSpecies",
    "sampleLocation",
    "sampleEvolution",
    "detailsLesion",
    "extractionDate",
    "shippingDate",
  ]) {
    assert.ok(clinicRequiredFields.includes(`{ key: "${field}"`));
    assert.ok(adminRequiredFields.includes(`{ key: "${field}"`));
  }

  assert.equal(clinicRequiredFields.includes('{ key: "reportId"'), false);
  assert.equal(adminRequiredFields.includes('{ key: "reportId"'), false);
  assert.ok(clinic.includes('className="field-textarea"'));
  assert.ok(admin.includes('className="field-textarea"'));
});

test("clinic report link remains optional and distinct from clinic identity", () => {
  const source = read(CLINIC_TOKENS_CARD_PATH);
  const reportField = sectionBetween(
    source,
    'id="clinic-token-report-id"',
    "</div>",
  );

  assert.ok(source.includes("ID informe vinculado"));
  assert.ok(
    source.includes("El ID de informe debe ser un número entero positivo."),
  );
  assert.ok(reportField.includes('name="reportId"'));
  assert.ok(reportField.includes('placeholder="Opcional"'));
  assert.equal(reportField.includes("required"), false);
  assert.equal(reportField.includes("clinicId"), false);
  assert.equal(source.includes("ID de clínica"), false);
});

test("clinic particular token form sends recipient email through backend contract", () => {
  const source = read(CLINIC_TOKENS_CARD_PATH);
  const api = read(API_PATH);
  const payloadType = sectionBetween(
    api,
    "export type ClinicParticularTokenCreatePayload = {",
    "};",
  );
  const payloadBuilder = sectionBetween(
    source,
    "function buildPayload(",
    "function formatTokenSource",
  );
  const submitSuccess = sectionBetween(
    source,
    "const response = await createClinicParticularToken(payload);",
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
    source.includes("const response = await createClinicParticularToken(payload);"),
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

test("clinic token generation keeps generated token block list refresh and reset", () => {
  const source = read(CLINIC_TOKENS_CARD_PATH);
  const submitSuccess = sectionBetween(
    source,
    "const response = await createClinicParticularToken(payload);",
    "} catch (error) {",
  );

  assert.ok(source.includes("Token generado"));
  assert.ok(source.includes('aria-label="Token particular generado"'));
  assert.ok(source.includes("El token completo solo se muestra una vez."));
  assert.ok(source.includes("IMPORTANTE: el token completo solo se muestra una vez."));
  assert.ok(source.includes("Email enviado a:"));
  assert.ok(source.includes("El backend informó envío correcto del email."));
  assert.ok(source.includes("Copiar mensaje para enviar"));
  assert.ok(source.includes('type="checkbox"'));
  assert.ok(source.includes("Cerrar token visible"));
  assert.ok(source.includes("disabled={!isGeneratedTokenConfirmed}"));
  assert.ok(source.includes("Últimos tokens de la clínica"));
  assert.ok(source.includes('onClick={() => void loadTokens()}'));
  assert.ok(source.includes("setFormState(INITIAL_FORM_STATE);"));
  assertOrdered(submitSuccess, [
    "setGeneratedToken(response.token);",
    "setStatusMessage(response.message);",
    "resetForm();",
    "await loadTokens();",
  ]);
});

test("clinic generated token block clears only through confirmation close", () => {
  const source = read(CLINIC_TOKENS_CARD_PATH);
  const clearGeneratedToken = sectionBetween(
    source,
    "function clearGeneratedTokenState()",
    "async function handleCopyManualMessage()",
  );

  assert.ok(source.includes("navigator.clipboard?.writeText"));
  assert.ok(source.includes("buildManualTokenMessage(generatedToken, generatedTokenDetails)"));
  assert.ok(
    source.includes(
      "Hola. VETNEB informa que ya podés consultar el seguimiento/informe de",
    ),
  );
  assert.ok(
    source.includes(
      "Confirmo que registré el token visible o que no necesito copia",
    ),
  );
  assert.ok(clearGeneratedToken.includes("setGeneratedToken(null);"));
  assert.ok(clearGeneratedToken.includes("setGeneratedTokenRecipientEmail(null);"));
  assert.ok(clearGeneratedToken.includes("setIsGeneratedTokenConfirmed(false);"));
  assert.ok(clearGeneratedToken.includes("setCopyStatusMessage(null);"));
  assert.ok(source.includes("disabled={isSubmitting || generatedToken !== null}"));
});

test("frontend api exposes clinic-scoped particular token helpers", () => {
  const source = read(API_PATH);

  assert.ok(source.includes("export type ClinicParticularTokenSummary"));
  assert.ok(source.includes("export type ClinicParticularTokenCreatePayload"));
  assert.ok(source.includes("export async function getClinicParticularTokens("));
  assert.ok(source.includes("export async function createClinicParticularToken("));
  assert.ok(source.includes("export async function linkClinicParticularTokenReport("));
  assert.ok(source.includes('"/api/particular-tokens"'));
  assert.ok(source.includes("`/api/particular-tokens${qs ? `?${qs}` : \"\"}`"));
  assert.ok(source.includes("`/api/particular-tokens/${tokenId}/report`"));
});

test("clinic token card muestra seguimiento y alerta de tinción especial desde study-tracking", () => {
  const card = read(CLINIC_TOKENS_CARD_PATH);
  const api = read(API_PATH);

  assert.ok(card.includes("getClinicStudyTrackingCases"));
  assert.ok(card.includes("trackingCasesByTokenId"));
  assert.ok(card.includes("Seguimiento"));
  assert.ok(card.includes("getTrackingStageLabel("));
  assert.ok(card.includes("Alerta: Solicitud de tinción especial"));
  assert.ok(api.includes("export async function getClinicStudyTrackingCases("));
});
