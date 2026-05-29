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
  assert.ok(sidebarSource.includes('`${ROUTES.dashboard}#clinic-particular-tokens`'));
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
